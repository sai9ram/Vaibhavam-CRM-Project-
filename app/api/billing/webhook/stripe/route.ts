import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { activateStudioPlan, getSupabaseAdmin } from '@/lib/billing-server';

function verifyStripeSignature(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const sigBuf = Buffer.from(v1);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Stripe webhook secret not configured.' }, { status: 503 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature') || '';
    if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const obj = event?.data?.object;

    if (event.type === 'checkout.session.completed' && obj?.metadata?.studio_id && obj?.metadata?.plan) {
      await activateStudioPlan({
        studioId: obj.metadata.studio_id,
        planId: obj.metadata.plan,
        provider: 'stripe',
        paymentId: obj.payment_intent || obj.id,
        orderId: obj.id,
        amount: Number(obj.amount_total || 0) / 100,
        currency: obj.currency || 'USD',
        customerId: obj.customer || '',
        subscriptionId: obj.subscription || '',
        actorId: obj.metadata.actor_id || null,
      });
    } else if (event.type === 'customer.subscription.deleted' && obj?.metadata?.studio_id) {
      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin
        .from('studios')
        .update({ subscription_status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', obj.metadata.studio_id);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe webhook error' },
      { status: 500 }
    );
  }
}
