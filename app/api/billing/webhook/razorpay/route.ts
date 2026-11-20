import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { activateStudioPlan, getSupabaseAdmin } from '@/lib/billing-server';

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 503 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (!signature || sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const paymentEntity = event?.payload?.payment?.entity;
    const notes = paymentEntity?.notes || event?.payload?.subscription?.entity?.notes || {};
    const studioId = notes.studio_id;
    const planId = notes.plan;

    if (event.event === 'payment.captured' && studioId && planId) {
      await activateStudioPlan({
        studioId,
        planId,
        provider: 'razorpay',
        paymentId: paymentEntity.id,
        orderId: paymentEntity.order_id || '',
        amount: Number(paymentEntity.amount || 0) / 100,
        currency: paymentEntity.currency || 'INR',
        actorId: notes.actor_id || null,
      });
    } else if (event.event === 'subscription.halted' && studioId) {
      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin
        .from('studios')
        .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
        .eq('id', studioId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook error' },
      { status: 500 }
    );
  }
}
