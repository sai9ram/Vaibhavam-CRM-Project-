'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SAAS_PLANS, type PlanConfig } from '@/lib/plans';
import { formatCurrency, formatDate, formatFileSize } from '@/lib/format';
import type { BillingTransaction } from '@/types/database';
import { toast } from 'sonner';
import { Check, CreditCard, HardDrive, Loader2, Sparkles, ShieldCheck } from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function AdminBillingPage() {
  const { studio, session, refreshStudio } = useAuth();
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [plans, setPlans] = useState<PlanConfig[]>(Object.values(SAAS_PLANS));
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
    if (studio?.id) loadTransactions();
  }, [studio?.id]);

  async function loadPlans() {
    const { data } = await supabase.from('platform_plans').select('*');
    if (data && data.length > 0) {
      const order: Record<string, number> = { starter: 1, pro: 2, studio: 3 };
      const mapped: PlanConfig[] = data
        .map((row) => {
          const fallback = SAAS_PLANS[row.id as keyof typeof SAAS_PLANS];
          const gb = Number(row.storage_limit_gb || 50);
          return {
            id: row.id,
            name: row.name || fallback?.name || row.id,
            tagline: row.tagline || fallback?.tagline || '',
            priceInr: Number(row.price_inr ?? fallback?.priceInr ?? 0),
            priceUsd: Number(row.price_usd ?? fallback?.priceUsd ?? 0),
            storageLimitBytes: gb * 1024 * 1024 * 1024,
            storageLabel: gb >= 1024 ? `${Math.round(gb / 1024)} TB Storage` : `${gb} GB Storage`,
            maxProjects: Number(row.max_projects ?? fallback?.maxProjects ?? 50),
            maxTeamMembers: Number(row.max_team_members ?? fallback?.maxTeamMembers ?? 5),
            recommended: Boolean(row.recommended),
            features: Array.isArray(row.features) && row.features.length > 0
              ? row.features
              : fallback?.features || [],
          };
        })
        .sort((a, b) => (order[a.id] || 99) - (order[b.id] || 99));
      setPlans(mapped);
    }
  }

  async function loadTransactions() {
    const { data } = await supabase
      .from('billing_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    setTransactions((data as BillingTransaction[]) || []);
  }

  async function startCheckout(plan: PlanConfig, provider: 'razorpay' | 'stripe') {
    if (!session?.access_token) {
      toast.error('Please sign in again to continue.');
      return;
    }

    setBusyPlan(`${plan.id}-${provider}`);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: plan.id, provider }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not start checkout.');
        setBusyPlan(null);
        return;
      }

      if (provider === 'stripe' && data.url) {
        window.location.href = data.url;
        return;
      }

      if (provider === 'razorpay') {
        const loaded = await loadRazorpayScript();
        if (!loaded || !window.Razorpay) {
          toast.error('Could not load Razorpay checkout. Please check your connection.');
          setBusyPlan(null);
          return;
        }

        const rzp = new window.Razorpay({
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: 'SureShotz',
          description: `${plan.name} Plan — Monthly`,
          order_id: data.order_id,
          prefill: { email: data.email },
          handler: async (response: Record<string, string>) => {
            const verifyRes = await fetch('/api/billing/verify-razorpay', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                ...response,
                plan: plan.id,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              toast.error(verifyData.error || 'Payment verification failed.');
            } else {
              await refreshStudio();
              await loadTransactions();
              toast.success(`Upgraded to ${plan.name} Plan!`);
            }
            setBusyPlan(null);
          },
          modal: {
            ondismiss: () => setBusyPlan(null),
          },
        });
        rzp.open();
      }
    } catch {
      toast.error('Network error while starting checkout.');
      setBusyPlan(null);
    }
  }

  const storageUsed = studio?.storage_used_bytes || 0;
  const storageLimit = studio?.storage_limit_bytes || 1;
  const storagePct = Math.min(100, Math.round((storageUsed / storageLimit) * 100));

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
      <PageHeader title="Billing &amp; Plans" description="Manage your studio subscription, storage limits, and payment history" />

      {/* Current Plan Summary */}
      {studio && (
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg capitalize">
                  {studio.plan.replace('_', ' ')} Plan
                </h3>
                <p className="text-xs text-muted-foreground">
                  {studio.subscription_status === 'trialing' && studio.trial_ends_at
                    ? `Free trial ends on ${formatDate(studio.trial_ends_at)}`
                    : studio.current_period_end
                    ? `Renews on ${formatDate(studio.current_period_end)}`
                    : 'Active subscription'}
                </p>
              </div>
            </div>
            <Badge variant={studio.subscription_status === 'active' || studio.subscription_status === 'trialing' ? 'default' : 'destructive'} className="capitalize w-fit">
              {studio.subscription_status}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Storage Used</span>
              <span className="text-muted-foreground">
                {formatFileSize(storageUsed)} of {formatFileSize(storageLimit)} ({storagePct}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${storagePct}%` }} />
            </div>
          </div>
        </Card>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isCurrent = studio?.plan === plan.id && studio?.subscription_status === 'active';
          return (
            <Card
              key={plan.id}
              className={`p-6 flex flex-col justify-between relative ${
                plan.recommended ? 'border-primary ring-1 ring-primary/20' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif text-xl">{plan.name}</h3>
                  {plan.recommended && (
                    <Badge className="bg-gradient-luxe text-white border-0 text-xs">
                      <Sparkles className="w-3 h-3 mr-1" /> Popular
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-4">{plan.tagline}</p>

                <div className="mb-5">
                  <span className="font-serif text-3xl">{formatCurrency(plan.priceInr, 'INR')}</span>
                  <span className="text-xs text-muted-foreground"> / month</span>
                  <div className="text-xs text-muted-foreground mt-0.5">or ${plan.priceUsd}/mo via Stripe</div>
                </div>

                <ul className="space-y-2.5 mb-6 text-sm">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {isCurrent ? (
                <Button disabled variant="outline" className="w-full">
                  <ShieldCheck className="w-4 h-4 mr-1.5" /> Current Plan
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={() => startCheckout(plan, 'razorpay')}
                    disabled={!!busyPlan}
                    className="w-full bg-gradient-luxe text-white"
                  >
                    {busyPlan === `${plan.id}-razorpay` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-1.5" /> Pay with Razorpay (INR)
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => startCheckout(plan, 'stripe')}
                    disabled={!!busyPlan}
                    className="w-full text-xs"
                  >
                    {busyPlan === `${plan.id}-stripe` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Pay with Stripe (International USD)'
                    )}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Billing History */}
      <Card className="p-6">
        <h3 className="font-serif text-lg mb-4">Billing History</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscription payments recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-sm">
                <div>
                  <span className="font-medium capitalize">{tx.plan} Plan</span>
                  <span className="text-muted-foreground"> · {tx.provider.toUpperCase()} · {formatDate(tx.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-serif">{tx.currency} {tx.amount}</span>
                  <Badge variant={tx.status === 'paid' ? 'default' : 'outline'} className="capitalize">{tx.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
