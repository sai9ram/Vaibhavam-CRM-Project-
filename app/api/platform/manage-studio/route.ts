import { NextRequest, NextResponse } from 'next/server';
import { verifyPlatformAdmin } from '@/lib/platform-server';
import { getPlanConfig } from '@/lib/plans';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyPlatformAdmin(req.headers.get('authorization'));
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const studioId = String(body.studio_id || '');
    const action = String(body.action || '');

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

      await auth.supabaseAdmin.from('audit_logs').insert({
        studio_id: studioId,
        actor_id: auth.user.id,
        action: 'platform_trial_extended',
        target_type: 'studio',
        target_id: studioId,
        details: { days, trial_ends_at: nextTrialEnd },
      });

      return NextResponse.json({ success: true, trial_ends_at: nextTrialEnd });
    }

    if (action === 'set_plan') {
      const plan = getPlanConfig(String(body.plan || ''));
      if (!plan) return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });

      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await auth.supabaseAdmin
        .from('studios')
        .update({
          plan: plan.id,
          subscription_status: 'active',
          is_active: true,
          storage_limit_bytes: plan.storageLimitBytes,
          max_projects: plan.maxProjects,
          max_team_members: plan.maxTeamMembers,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studioId);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      await auth.supabaseAdmin.from('audit_logs').insert({
        studio_id: studioId,
        actor_id: auth.user.id,
        action: 'platform_plan_assigned',
        target_type: 'studio',
        target_id: studioId,
        details: { plan: plan.id },
      });

      return NextResponse.json({ success: true, plan: plan.id });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update studio.' },
      { status: 500 }
    );
  }
}
