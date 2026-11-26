import { getSupabaseAdmin } from '@/lib/billing-server';

export async function verifyPlatformAdmin(authHeader: string | null) {
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
    .select('id, is_platform_admin, full_name')
    .eq('id', userData.user.id)
    .single();

  const allowedEmails = (process.env.PLATFORM_ADMIN_EMAILS || 'sairamdesetti2@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const userEmail = (userData.user.email || '').toLowerCase();
  const isAuthorized = Boolean(profile?.is_platform_admin) || allowedEmails.includes(userEmail);

  if (!isAuthorized) {
    return { error: 'Access denied. Platform Master Admin only.', status: 403 as const };
  }

  return {
    supabaseAdmin,
    user: userData.user,
    profile,
  };
}
