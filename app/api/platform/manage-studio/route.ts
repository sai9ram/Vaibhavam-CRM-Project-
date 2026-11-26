import { NextRequest, NextResponse } from 'next/server';
import { verifyPlatformAdmin } from '@/lib/platform-server';
import { getPlanConfig } from '@/lib/plans';

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

const GB = 1024 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyPlatformAdmin(req.headers.get('authorization'));
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const action = String(body.action || '');

    // 1. CREATE STUDIO + OWNER
    if (action === 'create_studio') {
      const name = String(body.name || '').trim();
      const slug = toSlug(String(body.slug || name));
      const currency = String(body.currency || 'INR').toUpperCase();
      const planId = String(body.plan || 'free_trial');
      const ownerName = String(body.owner_name || '').trim();
      const ownerEmail = String(body.owner_email || '').trim().toLowerCase();
      const ownerPhone = String(body.owner_phone || '').trim();
      const ownerPassword = String(body.owner_password || '');

      if (name.length < 2 || slug.length < 2) {
        return NextResponse.json({ error: 'Please enter a valid studio name and slug.' }, { status: 400 });
      }
      if (!ownerEmail || !ownerEmail.includes('@')) {
        return NextResponse.json({ error: 'Please enter a valid owner email.' }, { status: 400 });
      }
      if (ownerPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
      }

      const { data: existing } = await auth.supabaseAdmin
        .from('studios')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'That studio web name is already taken.' }, { status: 409 });
      }

      const planCfg = getPlanConfig(planId);
      const isTrial = planId === 'free_trial' || !planCfg;

      const { data: studio, error: studioErr } = await auth.supabaseAdmin
        .from('studios')
        .insert({
          name,
          slug,
          currency,
          plan: isTrial ? 'free_trial' : planCfg.id,
          subscription_status: isTrial ? 'trialing' : 'active',
          storage_limit_bytes: isTrial ? 10 * GB : planCfg.storageLimitBytes,
          max_projects: isTrial ? 15 : planCfg.maxProjects,
          max_team_members: isTrial ? 3 : planCfg.maxTeamMembers,
        })
        .select('id')
        .single();

      if (studioErr || !studio) {
        return NextResponse.json({ error: studioErr?.message || 'Could not create studio.' }, { status: 400 });
      }

      const { data: authData, error: userErr } = await auth.supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: { full_name: ownerName, phone: ownerPhone },
        app_metadata: { role: 'super_admin', studio_id: studio.id },
      });

      if (userErr || !authData.user) {
        await auth.supabaseAdmin.from('studios').delete().eq('id', studio.id);
        return NextResponse.json({ error: userErr?.message || 'Could not create owner account.' }, { status: 400 });
      }

      await auth.supabaseAdmin.from('studios').update({ owner_id: authData.user.id }).eq('id', studio.id);
      await auth.supabaseAdmin.from('profiles').update({ full_name: ownerName, phone: ownerPhone }).eq('id', authData.user.id);

      return NextResponse.json({ success: true, studio_id: studio.id }, { status: 201 });
    }

    const studioId = String(body.studio_id || '');
    if (!studioId || !action) {
      return NextResponse.json({ error: 'Missing studio_id or action.' }, { status: 400 });
    }

    const { data: studio } = await auth.supabaseAdmin
      .from('studios')
      .select('id, name, trial_ends_at, is_active')
      .eq('id', studioId)
      .single();

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    // 2. EDIT STUDIO (360° control)
    if (action === 'edit_studio') {
      const name = String(body.name || '').trim();
      const slug = toSlug(String(body.slug || ''));
      const currency = String(body.currency || 'INR').toUpperCase();
      const plan = String(body.plan || 'free_trial');
      const subscriptionStatus = String(body.subscription_status || 'trialing');
      const storageGb = Number(body.storage_limit_gb || 10);
      const maxProjects = Number(body.max_projects || 15);
      const maxTeamMembers = Number(body.max_team_members || 3);
      const isActive = Boolean(body.is_active);

      if (name.length < 2 || slug.length < 2) {
        return NextResponse.json({ error: 'Studio name and slug are required.' }, { status: 400 });
      }

      const { error } = await auth.supabaseAdmin
        .from('studios')
        .update({
          name,
          slug,
          currency,
          plan,
          subscription_status: subscriptionStatus,
          storage_limit_bytes: Math.max(1, Math.round(storageGb)) * GB,
          max_projects: Math.max(1, Math.round(maxProjects)),
          max_team_members: Math.max(1, Math.round(maxTeamMembers)),
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studioId);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      await auth.supabaseAdmin.from('audit_logs').insert({
        studio_id: studioId,
        actor_id: auth.user.id,
        action: 'platform_studio_edited',
        target_type: 'studio',
        target_id: studioId,
        details: { name, plan, subscriptionStatus, storageGb, maxProjects, maxTeamMembers, isActive },
      });

      return NextResponse.json({ success: true });
    }

    // 3. DELETE STUDIO + ITS USERS
    if (action === 'delete_studio') {
      const { data: studioProfiles } = await auth.supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('studio_id', studioId);

      const userIds = (studioProfiles || []).map((p) => p.id).filter((id) => id !== auth.user.id);

      const { error: delErr } = await auth.supabaseAdmin.from('studios').delete().eq('id', studioId);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

      for (const uid of userIds) {
        await auth.supabaseAdmin.auth.admin.deleteUser(uid);
      }

      return NextResponse.json({ success: true });
    }

    // 4. TOGGLE ACTIVE / SUSPEND
    if (action === 'toggle_active') {
      const nextActive = !studio.is_active;
      const { error } = await auth.supabaseAdmin
        .from('studios')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', studioId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      await auth.supabaseAdmin.from('audit_logs').insert({
        studio_id: studioId,
        actor_id: auth.user.id,
        action: nextActive ? 'platform_studio_activated' : 'platform_studio_suspended',
        target_type: 'studio',
        target_id: studioId,
      });

      return NextResponse.json({ success: true, is_active: nextActive });
    }

    // 5. EXTEND TRIAL
    if (action === 'extend_trial') {
      const days = Number(body.days || 14);
      const baseTime = studio.trial_ends_at && new Date(studio.trial_ends_at).getTime() > Date.now()
        ? new Date(studio.trial_ends_at).getTime()
        : Date.now();
      const nextTrialEnd = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await auth.supabaseAdmin
        .from('studios')
        .update({
          subscription_status: 'trialing',
          is_active: true,
          trial_ends_at: nextTrialEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studioId);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, trial_ends_at: nextTrialEnd });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update studio.' },
      { status: 500 }
    );
  }
}
