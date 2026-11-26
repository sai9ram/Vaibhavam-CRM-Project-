'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, formatFileSize, getInitials } from '@/lib/format';
import { toast } from 'sonner';
import {
  ShieldCheck, Search, ArrowLeft, RefreshCw, Plus, Pencil,
  Trash2, CalendarPlus, Ban, CheckCircle2, Loader2, LogOut,
} from 'lucide-react';

interface PlatformStudio {
  id: string;
  name: string;
  slug: string;
  currency: string;
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

const GB = 1024 * 1024 * 1024;

export default function PlatformMasterAdminPage() {
  const router = useRouter();
  const { user, profile, session, loading: authLoading, signOut } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [studios, setStudios] = useState<PlatformStudio[]>([]);
  const [transactions, setTransactions] = useState<PlatformTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'trialing' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Add Studio Dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', slug: '', currency: 'INR', plan: 'free_trial',
    owner_name: '', owner_email: '', owner_phone: '', owner_password: '',
  });

  // Edit Studio Dialog
  const [editStudio, setEditStudio] = useState<PlatformStudio | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', slug: '', currency: 'INR', plan: 'free_trial',
    subscription_status: 'trialing', storage_limit_gb: '10',
    max_projects: '15', max_team_members: '3', is_active: true,
  });

  // Delete Studio Confirm Dialog
  const [deleteTarget, setDeleteTarget] = useState<PlatformStudio | null>(null);

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

  async function callManageApi(payload: Record<string, unknown>, successMsg: string) {
    if (!session?.access_token) return false;
    setBusy(true);
    try {
      const res = await fetch('/api/platform/manage-studio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Action failed.');
        setBusy(false);
        return false;
      }
      toast.success(successMsg);
      await loadOverview();
      setBusy(false);
      return true;
    } catch {
      toast.error('Network error.');
      setBusy(false);
      return false;
    }
  }

  async function handleCreateStudio(e: React.FormEvent) {
    e.preventDefault();
    const ok = await callManageApi({ action: 'create_studio', ...addForm }, `${addForm.name} created.`);
    if (ok) {
      setAddOpen(false);
      setAddForm({ name: '', slug: '', currency: 'INR', plan: 'free_trial', owner_name: '', owner_email: '', owner_phone: '', owner_password: '' });
    }
  }

  function openEditModal(s: PlatformStudio) {
    setEditStudio(s);
    setEditForm({
      name: s.name,
      slug: s.slug,
      currency: s.currency || 'INR',
      plan: s.plan,
      subscription_status: s.subscription_status,
      storage_limit_gb: String(Math.max(1, Math.round((s.storage_limit_bytes || 10 * GB) / GB))),
      max_projects: String(s.max_projects || 15),
      max_team_members: String(s.max_team_members || 3),
      is_active: s.is_active,
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editStudio) return;
    const ok = await callManageApi(
      { action: 'edit_studio', studio_id: editStudio.id, ...editForm },
      `${editForm.name} updated.`
    );
    if (ok) setEditStudio(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const ok = await callManageApi(
      { action: 'delete_studio', studio_id: deleteTarget.id },
      `${deleteTarget.name} permanently deleted.`
    );
    if (ok) setDeleteTarget(null);
  }

  const filteredStudios = studios.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      s.owner_email.toLowerCase().includes(q) ||
      s.owner_name.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filter === 'active') return s.is_active && s.subscription_status === 'active';
    if (filter === 'trialing') return s.is_active && s.subscription_status === 'trialing';
    if (filter === 'inactive') return !s.is_active || s.subscription_status === 'canceled' || s.subscription_status === 'past_due';
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto animate-pulse space-y-6">
        <div className="h-8 w-56 bg-muted rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
        <div className="h-80 bg-muted rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="font-serif text-2xl">Platform Master Admin</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link href="/admin">
            <Button className="bg-gradient-luxe text-white">Back to Studio</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
        {/* Minimalist Top Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
          <div>
            {profile?.studio_id && (
              <Link href="/admin" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-1.5">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Studio
              </Link>
            )}
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif text-2xl sm:text-3xl tracking-tight">SureShotz Master</h1>
              <Badge variant="outline" className="text-[11px] font-normal">360° Admin</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadOverview} className="h-9">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="h-9 bg-gradient-luxe text-white">
              <Plus className="w-4 h-4 mr-1.5" /> New Studio
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); router.push('/'); }}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out
            </Button>
          </div>
        </header>

        {/* Clean 4-Card KPI Strip */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border-border/60 shadow-none">
              <p className="text-xs text-muted-foreground">Total Studios</p>
              <p className="font-serif text-3xl mt-1">{stats.totalStudios}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatFileSize(stats.totalStorageUsedBytes)} used total
              </p>
            </Card>
            <Card className="p-5 border-border/60 shadow-none">
              <p className="text-xs text-muted-foreground">Paid Studios</p>
              <p className="font-serif text-3xl mt-1 text-success">{stats.activePaidStudios}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Active subscriptions</p>
            </Card>
            <Card className="p-5 border-border/60 shadow-none">
              <p className="text-xs text-muted-foreground">Free Trials</p>
              <p className="font-serif text-3xl mt-1">{stats.trialingStudios}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{stats.inactiveStudios} inactive</p>
            </Card>
            <Card className="p-5 border-border/60 shadow-none">
              <p className="text-xs text-muted-foreground">Total SaaS Sales</p>
              <p className="font-serif text-3xl mt-1">{formatCurrency(stats.totalRevenueInr, 'INR')}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {stats.totalRevenueUsd > 0 ? `+ ${formatCurrency(stats.totalRevenueUsd, 'USD')} USD` : 'All-time revenue'}
              </p>
            </Card>
          </div>
        )}

        {/* Studios Directory */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 w-fit">
              {(['all', 'active', 'trialing', 'inactive'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    filter === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'trialing' ? 'Trial' : tab}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search studios or emails..."
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          <Card className="border-border/60 shadow-none overflow-hidden">
            {filteredStudios.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No studios match your filter.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredStudios.map((s) => {
                  const pct = s.storage_limit_bytes > 0
                    ? Math.min(100, Math.round((s.storage_used_bytes / s.storage_limit_bytes) * 100))
                    : 0;
                  const isSuspended = !s.is_active || s.subscription_status === 'canceled';

                  return (
                    <div
                      key={s.id}
                      className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                    >
                      {/* Identity */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-serif text-sm shrink-0">
                          {getInitials(s.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{s.name}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">/{s.slug}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.owner_email || s.owner_name || 'No owner'} · Joined {formatDate(s.created_at)}
                          </div>
                        </div>
                      </div>

                      {/* Metrics & Actions */}
                      <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                        <div className="text-xs space-y-1 min-w-[110px]">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{formatFileSize(s.storage_used_bytes)}</span>
                            <span>{formatFileSize(s.storage_limit_bytes)}</span>
                          </div>
                          <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {s.project_count}/{s.max_projects} proj · {s.team_count}/{s.max_team_members} team
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="capitalize text-[11px] font-normal">
                            {s.plan.replace('_', ' ')}
                          </Badge>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                              isSuspended
                                ? 'bg-destructive/10 text-destructive'
                                : s.subscription_status === 'active'
                                ? 'bg-success/10 text-success'
                                : 'bg-warning/10 text-warning'
                            }`}
                          >
                            {isSuspended ? 'Suspended' : s.subscription_status}
                          </span>
                        </div>

                        {/* 360° Action Buttons */}
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditModal(s)} className="h-8 px-2.5 text-xs">
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => callManageApi({ action: 'extend_trial', studio_id: s.id, days: 14 }, `Extended trial +14d for ${s.name}.`)}
                            className="h-8 px-2 text-xs"
                            title="Extend trial by 14 days"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => callManageApi({ action: 'toggle_active', studio_id: s.id }, s.is_active ? `${s.name} suspended.` : `${s.name} activated.`)}
                            className={`h-8 px-2 text-xs ${s.is_active ? 'text-muted-foreground hover:text-destructive' : 'text-success'}`}
                            title={s.is_active ? 'Suspend studio' : 'Activate studio'}
                          >
                            {s.is_active ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setDeleteTarget(s)}
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                            title="Delete studio"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Recent Sales */}
        <Card className="p-5 border-border/60 shadow-none space-y-3">
          <h2 className="font-serif text-lg">Recent SaaS Sales</h2>
          {transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No subscription payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{tx.studio_name}</span>
                    <span className="text-xs text-muted-foreground capitalize"> · {tx.plan} · {tx.provider} · {formatDate(tx.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif">{tx.currency} {tx.amount}</span>
                    <Badge variant="outline" className="text-[11px] capitalize">{tx.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ADD STUDIO MODAL */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Create New Studio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateStudio} className="space-y-3.5 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Studio Name</Label>
                <Input required value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="Royal Lens" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Web Slug</Label>
                <Input value={addForm.slug} onChange={e => setAddForm({ ...addForm, slug: e.target.value })} placeholder="royal-lens" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Plan</Label>
                <Select value={addForm.plan} onValueChange={v => setAddForm({ ...addForm, plan: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free_trial">Free Trial (10 GB)</SelectItem>
                    <SelectItem value="starter">Starter (50 GB)</SelectItem>
                    <SelectItem value="pro">Pro (250 GB)</SelectItem>
                    <SelectItem value="studio">Studio (1 TB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={addForm.currency} onValueChange={v => setAddForm({ ...addForm, currency: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['INR', 'USD', 'GBP', 'EUR', 'AED', 'AUD', 'CAD', 'SGD'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Owner Name</Label>
                <Input required value={addForm.owner_name} onChange={e => setAddForm({ ...addForm, owner_name: e.target.value })} placeholder="Owner Name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input value={addForm.owner_phone} onChange={e => setAddForm({ ...addForm, owner_phone: e.target.value })} placeholder="+91..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner Email</Label>
              <Input type="email" required value={addForm.owner_email} onChange={e => setAddForm({ ...addForm, owner_email: e.target.value })} placeholder="owner@studio.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Temporary Password (min 8 chars)</Label>
              <Input type="password" required minLength={8} value={addForm.owner_password} onChange={e => setAddForm({ ...addForm, owner_password: e.target.value })} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-luxe text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Studio & Owner'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT STUDIO MODAL (360° Control) */}
      <Dialog open={!!editStudio} onOpenChange={(o) => { if (!o) setEditStudio(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Edit Studio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-3.5 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Studio Name</Label>
                <Input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Web Slug</Label>
                <Input required value={editForm.slug} onChange={e => setEditForm({ ...editForm, slug: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Plan</Label>
                <Select value={editForm.plan} onValueChange={v => setEditForm({ ...editForm, plan: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free_trial">Free Trial</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={editForm.subscription_status} onValueChange={v => setEditForm({ ...editForm, subscription_status: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={editForm.currency} onValueChange={v => setEditForm({ ...editForm, currency: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['INR', 'USD', 'GBP', 'EUR', 'AED', 'AUD', 'CAD', 'SGD'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Storage (GB)</Label>
                <Input type="number" min={1} value={editForm.storage_limit_gb} onChange={e => setEditForm({ ...editForm, storage_limit_gb: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Projects</Label>
                <Input type="number" min={1} value={editForm.max_projects} onChange={e => setEditForm({ ...editForm, max_projects: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Team</Label>
                <Input type="number" min={1} value={editForm.max_team_members} onChange={e => setEditForm({ ...editForm, max_team_members: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="rounded border-border"
              />
              Studio is active (uncheck to suspend access)
            </label>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-luxe text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Studio Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE STUDIO CONFIRMATION MODAL */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive">Delete Studio?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong className="text-foreground">{deleteTarget?.name}</strong> and all of its clients, projects, media records, invoices, and user logins. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={handleConfirmDelete}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Permanently'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
