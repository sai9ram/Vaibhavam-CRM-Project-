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

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let createdStudioId: string | null = null;
  let createdUserId: string | null = null;

  try {
    const body = await req.json();
    const studioName = String(body.studio_name || "").trim();
    const rawSlug = String(body.studio_slug || studioName);
    const slug = toSlug(rawSlug);
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const currency = String(body.currency || "INR").toUpperCase();

    if (studioName.length < 2) {
      return jsonResponse({ error: "Please enter your photography studio name." }, 400);
    }
    if (!slug || slug.length < 2) {
      return jsonResponse({ error: "Please choose a valid studio web name (letters and numbers)." }, 400);
    }
    if (!fullName) {
      return jsonResponse({ error: "Please enter your full name." }, 400);
    }
    if (!email || !email.includes("@")) {
      return jsonResponse({ error: "Please enter a valid email address." }, 400);
    }
    if (password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters long." }, 400);
    }

    const allowedCurrencies = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD"];
    const safeCurrency = allowedCurrencies.includes(currency) ? currency : "INR";

    // Check if studio web name (slug) is already taken
    const { data: existingStudio } = await supabaseAdmin
      .from("studios")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingStudio) {
      return jsonResponse(
        { error: "That studio name is already taken. Please try a slightly different name." },
        409
      );
    }

    // 1. Create the studio (14-day free trial)
    const { data: studio, error: studioError } = await supabaseAdmin
      .from("studios")
      .insert({
        name: studioName,
        slug,
        currency: safeCurrency,
        plan: "free_trial",
        subscription_status: "trialing",
        storage_limit_bytes: 10737418240, // 10 GB
        max_projects: 15,
        max_team_members: 3,
      })
      .select("id, name, slug")
      .single();

    if (studioError || !studio) {
      return jsonResponse({ error: "Could not create your studio. Please try again." }, 400);
    }
    createdStudioId = studio.id;

    // 2. Create the studio owner auth user with tamper-proof app_metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone },
      app_metadata: { role: "super_admin", studio_id: studio.id },
    });

    if (authError || !authData.user) {
      await supabaseAdmin.from("studios").delete().eq("id", studio.id);
      return jsonResponse(
        { error: authError?.message || "Could not create your login account." },
        400
      );
    }
    createdUserId = authData.user.id;

    // 3. Link owner_id on studio and ensure profile is populated
    await supabaseAdmin
      .from("studios")
      .update({ owner_id: authData.user.id })
      .eq("id", studio.id);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", authData.user.id);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from("studios").delete().eq("id", studio.id);
      return jsonResponse({ error: `Could not finish setting up your profile: ${profileError.message}` }, 500);
    }

    await supabaseAdmin.from("audit_logs").insert({
      studio_id: studio.id,
      actor_id: authData.user.id,
      action: "studio_registered",
      target_type: "studio",
      target_id: studio.id,
      details: { studio_name: studioName, slug, currency: safeCurrency },
    });

    return jsonResponse(
      {
        studio: { id: studio.id, name: studio.name, slug: studio.slug },
        user: { id: authData.user.id, email: authData.user.email },
        message: "Your studio is ready! You can sign in now.",
      },
      201
    );
  } catch (err) {
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    }
    if (createdStudioId) {
      await supabaseAdmin.from("studios").delete().eq("id", createdStudioId);
    }
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Something went wrong. Please try again." },
      500
    );
  }
});

