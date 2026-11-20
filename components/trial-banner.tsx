'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle, ArrowRight } from 'lucide-react';

export function TrialBanner() {
  const { studio } = useAuth();
  if (!studio) return null;

  if (studio.subscription_status === 'active') return null;

  const isTrialing = studio.subscription_status === 'trialing';
  const trialEnd = studio.trial_ends_at ? new Date(studio.trial_ends_at).getTime() : null;
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  const expired = isTrialing && trialEnd !== null && trialEnd <= Date.now();
  const urgent = !isTrialing || expired || daysLeft <= 3;

  return (
    <div
      className={`border-b px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm ${
        urgent
          ? 'bg-destructive/10 border-destructive/20 text-destructive'
          : 'bg-primary/5 border-border text-foreground'
      }`}
    >
      <div className="flex items-center gap-2">
        {urgent ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 text-primary shrink-0" />}
        <span>
          {expired || !isTrialing
            ? 'Your studio plan is inactive. Upgrade now to continue adding projects and uploading photos.'
            : `Free Trial: ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left on your 14-day trial.`}
        </span>
      </div>
      <Link href="/admin/billing">
        <Button size="sm" className="h-7 text-xs bg-gradient-luxe text-white">
          Upgrade Plan <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </Link>
    </div>
  );
}
