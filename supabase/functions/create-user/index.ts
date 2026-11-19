import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Please sign in again to continue." }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Your session has expired. Please sign in again." }, 401);
    }

    // Verify caller is a studio super_admin and resolve their studio_id
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, studio_id")
      .eq("id", userData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "super_admin" || !callerProfile.studio_id) {
      return jsonResponse({ error: "Only studio owners can add team members or clients." }, 403);
    }

    const studioId = callerProfile.studio_id;

    // Verify studio is active and within subscription limits
    const { data: studio } = await supabaseAdmin
      .from("studios")
      .select("id, is_active, subscription_status, trial_ends_at, max_team_members")
      .eq("id", studioId)
      .single();

    const trialValid =
      studio?.subscription_status === "trialing" &&
      (!studio.trial_ends_at || new Date(studio.trial_ends_at) > new Date());
    const studioActive =
      studio?.is_active && (studio.subscription_status === "active" || trialValid);

    if (!studioActive) {
      return jsonResponse(
        { error: "Your studio plan is inactive. Please renew your plan to add new accounts." },
        403
      );
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim();
    const phone = String(body.phone || "").trim();
    const role = String(body.role || "").trim();

    if (!email || !email.includes("@")) {
      return jsonResponse({ error: "Please enter a valid email address." }, 400);
    }
    if (password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters long." }, 400);
    }
    if (role !== "editor" && role !== "client") {
      return jsonResponse({ error: "Account role must be either editor or client." }, 400);
    }

    // Enforce team member quota when creating an editor
    if (role === "editor" && studio.max_team_members) {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .in("role", ["super_admin", "editor"]);

      if ((count ?? 0) >= studio.max_team_members) {
        return jsonResponse(
          {
            error: `Your studio has reached its limit of ${studio.max_team_members} team members. Please upgrade your plan to add more.`,
          },
          403
        );
      }
    }

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role, studio_id: studioId },
    });

    if (createError || !authData.user) {
      return jsonResponse({ error: createError?.message || "Could not create account." }, 400);
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authData.user.id,
        studio_id: studioId,
        full_name: fullName,
        phone,
        role,
      });

    if (profileError) {
      // Roll back auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return jsonResponse({ error: "Could not save user profile. Please try again." }, 500);
    }

    await supabaseAdmin.from("audit_logs").insert({
      studio_id: studioId,
      actor_id: userData.user.id,
      action: "user_created",
      target_type: "profile",
      target_id: authData.user.id,
      details: { email, role, full_name: fullName },
    });

    return jsonResponse({
      user: { id: authData.user.id, email: authData.user.email, role, studio_id: studioId },
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Something went wrong. Please try again." },
      500
    );
  }
});
