import { NextRequest, NextResponse } from 'next/server';
import { getPlanConfig } from '@/lib/plans';
import { verifyStudioAdmin } from '@/lib/billing-server';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyStudioAdmin(req.headers.get('authorization'));
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const plan = getPlanConfig(String(body.plan || ''));
    const provider = String(body.provider || 'razorpay');

    if (!plan) {
      return NextResponse.json({ error: 'Please choose a valid plan.' }, { status: 400 });
    }

    const { data: studio } = await auth.supabaseAdmin
      .from('studios')
      .select('id, name, currency')
      .eq('id', auth.studioId)
      .single();

    if (provider === 'razorpay') {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        return NextResponse.json(
          { error: 'Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel environment variables.' },
          { status: 503 }
        );
      }

      const amountPaise = plan.priceInr * 100;
      const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: `${auth.studioId.slice(0, 8)}_${Date.now()}`,
          notes: {
            studio_id: auth.studioId,
            plan: plan.id,
            actor_id: auth.user.id,
          },
        }),
      });

      const order = await rzpRes.json();
      if (!rzpRes.ok) {
        return NextResponse.json(
          { error: order?.error?.description || 'Could not start Razorpay checkout.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        provider: 'razorpay',
        key_id: keyId,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        studio_name: studio?.name || 'SureShotz Studio',
        plan_name: plan.name,
        email: auth.user.email || '',
      });
    }

    if (provider === 'stripe') {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return NextResponse.json(
          { error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY in Vercel environment variables.' },
          { status: 503 }
        );
      }

      const origin = req.nextUrl.origin;
      const form = new URLSearchParams({
        mode: 'subscription',
        success_url: `${origin}/admin/billing?success=1&plan=${plan.id}`,
        cancel_url: `${origin}/admin/billing?canceled=1`,
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(plan.priceUsd * 100),
        'line_items[0][price_data][recurring][interval]': 'month',
        'line_items[0][price_data][product_data][name]': `SureShotz ${plan.name} Plan`,
        'line_items[0][quantity]': '1',
        'metadata[studio_id]': auth.studioId,
        'metadata[plan]': plan.id,
        'metadata[actor_id]': auth.user.id,
        'subscription_data[metadata][studio_id]': auth.studioId,
        'subscription_data[metadata][plan]': plan.id,
      });

      if (auth.user.email) {
        form.set('customer_email', auth.user.email);
      }

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });

      const session = await stripeRes.json();
      if (!stripeRes.ok || !session.url) {
        return NextResponse.json(
          { error: session?.error?.message || 'Could not start Stripe checkout.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        provider: 'stripe',
        url: session.url,
      });
    }

    return NextResponse.json({ error: 'Unsupported payment provider.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong starting checkout.' },
      { status: 500 }
    );
  }
}
