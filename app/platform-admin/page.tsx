'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/stat-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, formatFileSize } from '@/lib/format';
import { toast } from 'sonner';
import {
  Building2, DollarSign, Clock, HardDrive, ShieldCheck,
  Search, ArrowLeft, RefreshCw, Ban, CheckCircle2, CalendarPlus,
} from 'lucide-react';

interface PlatformStudio {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscription_status: string;
  is_active: boolean;
  trial_ends_at: string | null;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  max_projects: number;
  max_team_members: number;
  owner_name: string;
  owner_email: string;
  project_count: number;
  team_count: number;
  created_at: string;
}

interface PlatformTransaction {
  id: string;
  studio_id: string;
  studio_name: string;
  provider: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface PlatformStats {
  totalStudios: number;
  activePaidStudios: number;
  trialingStudios: number;
  inactiveStudios: number;
  totalRevenueInr: number;
  totalRevenueUsd: number;
  totalStorageUsedBytes: number;
}

export default function PlatformMasterAdminPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [studios, setStudios] = useState<PlatformStudio[]>([]);
  const [transactions, setTransactions] = useState<PlatformTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/platform/overview', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Access denied.');
      } else {
        setStats(data.stats);
        setStudios(data.studios || []);
        setTransactions(data.transactions || []);
      }
    } catch {
      setError('Could not load platform overview.');
    }
    setLoading(false);
  }, [session?.access_token]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }
    if (session?.access_token) {
      loadOverview();
    }
  }, [authLoading, user, session?.access_token, router, loadOverview]);

  async function runAction(studioId: string, payload: Record<string, unknown>, successMsg: string) {
    if (!session?.access_token) return;
    setBusyId(studioId);
    try {
      const res = await fetch('/api/platform/manage-studio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ studio_id: studioId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Action failed.');
      } else {
        toast.success(successMsg);
        await loadOverview();
      }
    } catch {
      toast.error('Network error.');
    }
    setBusyId(null);
  }

  const filteredStudios = studios.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      s.owner_email.toLowerCase().includes(q) ||
      s.owner_name.toLowerCase().includes(q)
    );
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8 max-w-7xl mx-auto animate-pulse space-y-6">
        <div className="h-9 w-64 bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center space-y-4">
          <ShieldCheck className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="font-serif text-2xl">Platform Master Admin</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link href="/admin">
            <Button className="bg-gradient-luxe text-white">Back to Studio Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to My Studio
            </Link>
            <h1 className="font-serif text-3xl">SureShotz Master Admin</h1>
            <p className="text-sm text-muted-foreground">
              Platform-wide overview of all registered photography studios and SaaS sales revenue
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadOverview} className="w-fit">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh Data
          </Button>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Total Studios" value={stats.totalStudios} icon={<Building2 className="w-5 h-5" />} accent="primary" />
            <StatCard label="Paid Studios" value={stats.activePaidStudios} icon={<ShieldCheck className="w-5 h-5" />} accent="success" />
            <StatCard label="Active Free Trials" value={stats.trialingStudios} icon={<Clock className="w-5 h-5" />} accent="warning" />
            <StatCard
              label="SaaS Sales (INR)"
              value={formatCurrency(stats.totalRevenueInr, 'INR')}
              trend={stats.totalRevenueUsd > 0 ? `+ ${formatCurrency(stats.totalRevenueUsd, 'USD')} USD` : undefined}
              trendUp
              icon={<DollarSign className="w-5 h-5" />}
              accent="success"
            />
            <StatCard
              label="Total Storage Used"
              value={formatFileSize(stats.totalStorageUsedBytes)}
              icon={<HardDrive className="w-5 h-5" />}
              accent="primary"
            />
          </div>
        )}

        {/* Registered Studios */}
        <Card className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl">Registered Studios ({filteredStudios.length})</h2>
              <p className="text-xs text-muted-foreground">Manage plans, extend trials, or suspend/activate studios</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search studio or owner email..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredStudios.map((studio) => (
              <div
                key={studio.id}
                className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-lg">{studio.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">/{studio.slug}</span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {studio.plan.replace('_', ' ')}
                    </Badge>
                    <Badge
                      variant={!studio.is_active || studio.subscription_status === 'canceled' || studio.subscription_status === 'past_due' ? 'destructive' : 'default'}
                      className="capitalize text-xs"
                    >
                      {!studio.is_active ? 'Suspended' : studio.subscription_status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>Owner: {studio.owner_name || 'N/A'} ({studio.owner_email || 'No email'})</span>
                    <span>Projects: {studio.project_count}/{studio.max_projects}</span>
                    <span>Team: {studio.team_count}/{studio.max_team_members}</span>
                    <span>Storage: {formatFileSize(studio.storage_used_bytes)} / {formatFileSize(studio.storage_limit_bytes)}</span>
                    <span>Joined: {formatDate(studio.created_at)}</span>
                    {studio.subscription_status === 'trialing' && studio.trial_ends_at && (
                      <span>Trial ends: {formatDate(studio.trial_ends_at)}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Select
                    disabled={busyId === studio.id}
                    onValueChange={(plan) => runAction(studio.id, { action: 'set_plan', plan }, `Upgraded ${studio.name} to ${plan}.`)}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Set Plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (50 GB)</SelectItem>
                      <SelectItem value="pro">Pro (250 GB)</SelectItem>
                      <SelectItem value="studio">Studio (1 TB)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === studio.id}
                    onClick={() => runAction(studio.id, { action: 'extend_trial', days: 14 }, `Extended trial by 14 days for ${studio.name}.`)}
                    className="h-8 text-xs"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 mr-1" /> +14d Trial
                  </Button>

                  <Button
                    size="sm"
                    variant={studio.is_active ? 'ghost' : 'outline'}
                    disabled={busyId === studio.id}
                    onClick={() => runAction(studio.id, { action: 'toggle_active' }, studio.is_active ? `${studio.name} suspended.` : `${studio.name} activated.`)}
                    className={`h-8 text-xs ${studio.is_active ? 'text-destructive hover:text-destructive' : 'text-success'}`}
                  >
                    {studio.is_active ? <><Ban className="w-3.5 h-3.5 mr-1" /> Suspend</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Activate</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* SaaS Sales History */}
        <Card className="p-6 space-y-4">
          <h2 className="font-serif text-xl">Recent SaaS Sales ({transactions.length})</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscription payments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-sm">
                  <div>
                    <span className="font-medium">{tx.studio_name}</span>
                    <span className="text-muted-foreground capitalize"> · {tx.plan} Plan · {tx.provider.toUpperCase()} · {formatDate(tx.created_at)}</span>
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
    </div>
  );
}
