import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyStudioAdmin, activateStudioPlan } from '@/lib/billing-server';
import { getPlanConfig } from '@/lib/plans';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyStudioAdmin(req.headers.get('authorization'));
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Razorpay is not configured on the server.' }, { status: 503 });
    }

    const body = await req.json();
    const orderId = String(body.razorpay_order_id || '');
    const paymentId = String(body.razorpay_payment_id || '');
    const signature = String(body.razorpay_signature || '');
    const planId = String(body.plan || '');

    if (!orderId || !paymentId || !signature || !getPlanConfig(planId)) {
      return NextResponse.json({ error: 'Missing payment verification details.' }, { status: 400 });
    }

    const expectedSig = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return NextResponse.json({ error: 'Payment signature verification failed.' }, { status: 400 });
    }

    const plan = getPlanConfig(planId)!;
    const result = await activateStudioPlan({
      studioId: auth.studioId,
      planId: plan.id,
      provider: 'razorpay',
      paymentId,
      orderId,
      amount: plan.priceInr,
      currency: 'INR',
      actorId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      plan: result.plan.id,
      period_end: result.periodEnd,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not verify payment.' },
      { status: 500 }
    );
  }
}
