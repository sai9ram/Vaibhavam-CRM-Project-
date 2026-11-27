import { NextRequest, NextResponse } from 'next/server';
import { verifyPlatformAdmin } from '@/lib/platform-server';
import { SAAS_PLANS } from '@/lib/plans';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyPlatformAdmin(req.headers.get('authorization'));
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const [
      { data: studios, error: studiosErr },
      { data: profiles },
      { data: projects },
      { data: transactions },
      { data: authUsersData },
      { data: dbPlans },
      { data: auditLogs },
    ] = await Promise.all([
      auth.supabaseAdmin.from('studios').select('*').order('created_at', { ascending: false }),
      auth.supabaseAdmin.from('profiles').select('id, studio_id, role, full_name'),
      auth.supabaseAdmin.from('projects').select('id, studio_id'),
      auth.supabaseAdmin.from('billing_transactions').select('*').order('created_at', { ascending: false }).limit(100),
      auth.supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      auth.supabaseAdmin.from('platform_plans').select('*'),
      auth.supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    if (studiosErr) {
      return NextResponse.json({ error: studiosErr.message }, { status: 500 });
    }

    const emailById = new Map<string, string>();
    (authUsersData?.users || []).forEach((u) => {
      if (u.email) emailById.set(u.id, u.email);
    });

    const profileById = new Map<string, { full_name: string }>();
    const teamCountByStudio = new Map<string, number>();
    (profiles || []).forEach((p) => {
      profileById.set(p.id, { full_name: p.full_name || '' });
      if (p.studio_id && (p.role === 'super_admin' || p.role === 'editor')) {
        teamCountByStudio.set(p.studio_id, (teamCountByStudio.get(p.studio_id) || 0) + 1);
      }
    });

    const projectCountByStudio = new Map<string, number>();
    (projects || []).forEach((pr) => {
      if (pr.studio_id) {
        projectCountByStudio.set(pr.studio_id, (projectCountByStudio.get(pr.studio_id) || 0) + 1);
      }
    });

    const studioNameById = new Map<string, string>();
    const enrichedStudios = (studios || []).map((s) => {
      studioNameById.set(s.id, s.name);
      return {
        ...s,
        owner_name: s.owner_id ? profileById.get(s.owner_id)?.full_name || '' : '',
        owner_email: s.owner_id ? emailById.get(s.owner_id) || '' : '',
        project_count: projectCountByStudio.get(s.id) || 0,
        team_count: teamCountByStudio.get(s.id) || 0,
      };
    });

    const paidTransactions = (transactions || []).filter((t) => t.status === 'paid');
    const totalRevenueInr = paidTransactions
      .filter((t) => (t.currency || 'INR').toUpperCase() === 'INR')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalRevenueUsd = paidTransactions
      .filter((t) => (t.currency || '').toUpperCase() === 'USD')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const now = Date.now();
    const activePaidStudios = enrichedStudios.filter((s) => s.is_active && s.subscription_status === 'active').length;
    const trialingStudios = enrichedStudios.filter(
      (s) => s.is_active && s.subscription_status === 'trialing' && (!s.trial_ends_at || new Date(s.trial_ends_at).getTime() > now)
    ).length;
    const inactiveStudios = enrichedStudios.length - activePaidStudios - trialingStudios;
    const totalStorageUsedBytes = enrichedStudios.reduce((sum, s) => sum + Number(s.storage_used_bytes || 0), 0);

    const enrichedTransactions = (transactions || []).map((tx) => ({
      ...tx,
      studio_name: studioNameById.get(tx.studio_id) || 'Studio',
    }));

    const enrichedLogs = (auditLogs || []).map((log) => ({
      ...log,
      studio_name: studioNameById.get(log.studio_id) || 'Studio',
    }));

    const fallbackPlans = Object.values(SAAS_PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      price_inr: p.priceInr,
      price_usd: p.priceUsd,
      storage_limit_gb: Math.round(p.storageLimitBytes / (1024 * 1024 * 1024)),
      max_projects: p.maxProjects,
      max_team_members: p.maxTeamMembers,
      recommended: Boolean(p.recommended),
    }));

    const plans = dbPlans && dbPlans.length > 0 ? dbPlans : fallbackPlans;

    return NextResponse.json({
      stats: {
        totalStudios: enrichedStudios.length,
        activePaidStudios,
        trialingStudios,
        inactiveStudios,
        totalRevenueInr,
        totalRevenueUsd,
        totalStorageUsedBytes,
      },
      studios: enrichedStudios,
      transactions: enrichedTransactions,
      plans,
      auditLogs: enrichedLogs,
      gateways: {
        razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load platform overview.' },
      { status: 500 }
    );
  }
}
