import { createClient } from '@supabase/supabase-js';
import { getPlanConfig } from '@/lib/plans';

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Server is missing SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function verifyStudioAdmin(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Please sign in again to continue.', status: 401 as const };
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: 'Your session has expired. Please sign in again.', status: 401 as const };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, studio_id, full_name')
    .eq('id', userData.user.id)
    .single();

  if (!profile || profile.role !== 'super_admin' || !profile.studio_id) {
    return { error: 'Only studio owners can manage billing and plans.', status: 403 as const };
  }

  return {
    supabaseAdmin,
    user: userData.user,
    profile,
    studioId: profile.studio_id as string,
  };
}

export async function activateStudioPlan(params: {
  studioId: string;
  planId: string;
  provider: 'razorpay' | 'stripe';
  paymentId: string;
  orderId?: string;
  amount: number;
  currency: string;
  customerId?: string;
  subscriptionId?: string;
  actorId?: string | null;
}) {
  const plan = getPlanConfig(params.planId);
  if (!plan) {
    throw new Error(`Invalid plan: ${params.planId}`);
  }

  const supabaseAdmin = getSupabaseAdmin();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const updatePayload: Record<string, unknown> = {
    plan: plan.id,
    subscription_status: 'active',
    is_active: true,
    storage_limit_bytes: plan.storageLimitBytes,
    max_projects: plan.maxProjects,
    max_team_members: plan.maxTeamMembers,
    billing_provider: params.provider,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  };

  if (params.customerId) updatePayload.billing_customer_id = params.customerId;
  if (params.subscriptionId) updatePayload.billing_subscription_id = params.subscriptionId;

  const { error: studioError } = await supabaseAdmin
    .from('studios')
    .update(updatePayload)
    .eq('id', params.studioId);

  if (studioError) {
    throw new Error(studioError.message);
  }

  await supabaseAdmin
    .from('billing_transactions')
    .upsert(
      {
        studio_id: params.studioId,
        provider: params.provider,
        provider_payment_id: params.paymentId,
        provider_order_id: params.orderId || '',
        plan: plan.id,
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        status: 'paid',
      },
      { onConflict: 'provider,provider_payment_id' }
    );

  await supabaseAdmin.from('audit_logs').insert({
    studio_id: params.studioId,
    actor_id: params.actorId || null,
    action: 'plan_upgraded',
    target_type: 'studio',
    target_id: params.studioId,
    details: {
      plan: plan.id,
      provider: params.provider,
      payment_id: params.paymentId,
      amount: params.amount,
      currency: params.currency,
    },
  });

  return { plan, periodEnd };
}
