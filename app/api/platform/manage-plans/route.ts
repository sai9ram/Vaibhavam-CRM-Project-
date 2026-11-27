import { NextRequest, NextResponse } from 'next/server';
import { verifyPlatformAdmin } from '@/lib/platform-server';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyPlatformAdmin(req.headers.get('authorization'));
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const id = String(body.id || '');
    if (id !== 'starter' && id !== 'pro' && id !== 'studio') {
      return NextResponse.json({ error: 'Invalid plan ID.' }, { status: 400 });
    }

    const name = String(body.name || '').trim();
    const tagline = String(body.tagline || '').trim();
    const priceInr = Number(body.price_inr);
    const priceUsd = Number(body.price_usd);
    const storageGb = Number(body.storage_limit_gb);
    const maxProjects = Number(body.max_projects);
    const maxTeamMembers = Number(body.max_team_members);

    if (!name || isNaN(priceInr) || priceInr < 0 || isNaN(priceUsd) || priceUsd < 0) {
      return NextResponse.json({ error: 'Please enter valid plan name and prices.' }, { status: 400 });
    }

    const { data, error } = await auth.supabaseAdmin
      .from('platform_plans')
      .upsert({
        id,
        name,
        tagline,
        price_inr: priceInr,
        price_usd: priceUsd,
        storage_limit_gb: Math.max(1, Math.round(storageGb || 50)),
        max_projects: Math.max(1, Math.round(maxProjects || 50)),
        max_team_members: Math.max(1, Math.round(maxTeamMembers || 5)),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, plan: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update plan.' },
      { status: 500 }
    );
  }
}
