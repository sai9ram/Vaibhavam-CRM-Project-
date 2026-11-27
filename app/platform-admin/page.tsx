'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, formatDateTime, formatFileSize, getInitials } from '@/lib/format';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { toast } from 'sonner';
import {
  ShieldCheck, Search, ArrowLeft, RefreshCw, Plus, Pencil,
  Trash2, CalendarPlus, Ban, CheckCircle2, Loader2, LogOut,
  LayoutDashboard, DollarSign, Layers, ScrollText, Settings, Menu, Upload, Save, KeyRound,
} from 'lucide-react';

type PlatformTab = 'overview' | 'sales' | 'plans' | 'logs' | 'settings';

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

interface PlatformPlan {
  id: 'starter' | 'pro' | 'studio';
  name: string;
  tagline: string;
  price_inr: number;
  price_usd: number;
  storage_limit_gb: number;
  max_projects: number;
  max_team_members: number;
  recommended: boolean;
}

interface PlatformAuditLog {
  id: string;
  studio_id: string;
  studio_name: string;
  action: string;
  target_type: string;
  details: Record<string, unknown>;
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

function resizeAvatarToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png', 0.9));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function PlatformMasterAdminPage() {
  const router = useRouter();
  const { user, profile, session, loading: authLoading, refreshProfile, signOut } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<PlatformTab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [studios, setStudios] = useState<PlatformStudio[]>([]);
  const [transactions, setTransactions] = useState<PlatformTransaction[]>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [gateways, setGateways] = useState<{ razorpay: boolean; stripe: boolean }>({ razorpay: false, stripe: false });

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

  // Master Profile & Password State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

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
        setPlans(data.plans || []);
        setAuditLogs(data.auditLogs || []);
        setGateways(data.gateways || { razorpay: false, stripe: false });
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

  async function savePlan(plan: PlatformPlan) {
    if (!session?.access_token) return;
    setBusy(true);
    try {
      const res = await fetch('/api/platform/manage-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(plan),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || 'Could not update plan.');
      else {
        toast.success(`${plan.name} plan updated live!`);
        await loadOverview();
      }
    } catch {
      toast.error('Network error.');
    }
    setBusy(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeAvatarToDataUrl(file, 256);
      setAvatarUrl(dataUrl);
      toast.success('Photo loaded! Click "Save Profile" to apply.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load image.');
    }
  }

  async function saveMasterProfile() {
    if (!profile) return;
    setSavingProfile(true);
    const { data: updated, error: err } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim(), avatar_url: avatarUrl.trim() })
      .eq('id', profile.id)
      .select()
      .single();
    if (err || !updated) toast.error(err?.message || 'Could not update profile.');
    else {
      await refreshProfile();
      toast.success('Master profile updated.');
    }
    setSavingProfile(false);
  }

  async function changeMasterPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setSavingPassword(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) toast.error(err.message);
    else {
      toast.success('Password updated successfully.');
      setNewPassword('');
    }
    setSavingPassword(false);
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

  // 6-month revenue chart data
  const monthlySalesData = (() => {
    const months: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const rev = transactions
        .filter((t) => {
          const td = new Date(t.created_at);
          return t.status === 'paid' && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      months.push({ month: label, revenue: rev });
    }
    return months;
  })();

  const navItems: { id: PlatformTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'sales', label: 'Sales & Revenue', icon: DollarSign },
    { id: 'plans', label: 'Plans & Pricing', icon: Layers },
    { id: 'logs', label: 'Audit Logs', icon: ScrollText },
    { id: 'settings', label: 'Profile & Settings', icon: Settings },
  ];

  function SidebarBody() {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-gradient-luxe flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-serif text-lg leading-none truncate">SureShotz</div>
            <div className="text-[11px] text-muted-foreground mt-1">Master Admin</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-4 space-y-3">
          {profile?.studio_id && (
            <Link href="/admin" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Switch to Studio View
            </Link>
          )}
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(profile?.full_name || user?.email || 'Admin')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{profile?.full_name || 'Founder'}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => { await signOut(); router.push('/'); }}
            className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
          </Button>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0">
        <SidebarBody />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-card border border-border">
            <Menu className="w-5 h-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <SidebarBody />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Top Action Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60 pl-10 lg:pl-0">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl tracking-tight">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              SureShotz SaaS Platform · 360° Control
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadOverview} className="h-9">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="h-9 bg-gradient-luxe text-white">
              <Plus className="w-4 h-4 mr-1.5" /> New Studio
            </Button>
          </div>
        </header>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5 border-border/60 shadow-none">
                  <p className="text-xs text-muted-foreground">Total Studios</p>
                  <p className="font-serif text-3xl mt-1">{stats.totalStudios}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{formatFileSize(stats.totalStorageUsedBytes)} used total</p>
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
                <div className="p-12 text-center text-sm text-muted-foreground">No studios match your filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-4">Studio</th>
                        <th className="py-3 px-3">Plan &amp; Status</th>
                        <th className="py-3 px-3">Storage</th>
                        <th className="py-3 px-3">Usage</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-sm">
                      {filteredStudios.map((s) => {
                        const pct = s.storage_limit_bytes > 0
                          ? Math.min(100, Math.round((s.storage_used_bytes / s.storage_limit_bytes) * 100))
                          : 0;
                        const isSuspended = !s.is_active || s.subscription_status === 'canceled';

                        return (
                          <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3 min-w-[190px]">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-serif text-xs shrink-0">
                                  {getInitials(s.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-foreground truncate">{s.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {s.owner_email || s.owner_name || 'No owner'} · {formatDate(s.created_at)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="capitalize text-xs font-normal">
                                  {s.plan.replace('_', ' ')}
                                </Badge>
                                <span
                                  className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                                    isSuspended ? 'bg-destructive/10 text-destructive'
                                      : s.subscription_status === 'active' ? 'bg-success/10 text-success'
                                      : 'bg-warning/10 text-warning'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isSuspended ? 'bg-destructive' : s.subscription_status === 'active' ? 'bg-success' : 'bg-warning'
                                    }`}
                                  />
                                  {isSuspended ? 'Suspended' : s.subscription_status}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <div className="w-28 space-y-1">
                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                  <span className="text-foreground font-medium">{formatFileSize(s.storage_used_bytes)}</span>
                                  <span>{formatFileSize(s.storage_limit_bytes)}</span>
                                </div>
                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap text-xs">
                              <div className="text-foreground font-medium">{s.project_count} / {s.max_projects} projects</div>
                              <div className="text-muted-foreground">{s.team_count} / {s.max_team_members} team</div>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <Button size="sm" variant="outline" onClick={() => openEditModal(s)} className="h-7 px-2 text-xs">
                                  <Pencil className="w-3 h-3 mr-1" /> Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => callManageApi({ action: 'extend_trial', studio_id: s.id, days: 14 }, `Extended trial +14d for ${s.name}.`)}
                                  className="h-7 px-2 text-xs"
                                  title="Extend trial by 14 days"
                                >
                                  <CalendarPlus className="w-3 h-3 mr-1" /> +14d
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => callManageApi({ action: 'toggle_active', studio_id: s.id }, s.is_active ? `${s.name} suspended.` : `${s.name} activated.`)}
                                  className={`h-7 px-1.5 text-xs ${s.is_active ? 'text-muted-foreground hover:text-destructive' : 'text-success'}`}
                                  title={s.is_active ? 'Suspend studio' : 'Activate studio'}
                                >
                                  {s.is_active ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => setDeleteTarget(s)}
                                  className="h-7 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                                  title="Delete studio permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 2: SALES & REVENUE */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-5 border-border/60 shadow-none">
                  <p className="text-xs text-muted-foreground">Total Sales (INR)</p>
                  <p className="font-serif text-3xl mt-1">{formatCurrency(stats.totalRevenueInr, 'INR')}</p>
                </Card>
                <Card className="p-5 border-border/60 shadow-none">
                  <p className="text-xs text-muted-foreground">Total Sales (USD)</p>
                  <p className="font-serif text-3xl mt-1">{formatCurrency(stats.totalRevenueUsd, 'USD')}</p>
                </Card>
                <Card className="p-5 border-border/60 shadow-none">
                  <p className="text-xs text-muted-foreground">Active Paying Studios</p>
                  <p className="font-serif text-3xl mt-1 text-success">{stats.activePaidStudios}</p>
                </Card>
              </div>
            )}

            <Card className="p-5 border-border/60 shadow-none">
              <h2 className="font-serif text-lg mb-4">Monthly SaaS Revenue (Last 6 Months)</h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary) / 0.15)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5 border-border/60 shadow-none space-y-3">
              <h2 className="font-serif text-lg">All Subscription Transactions ({transactions.length})</h2>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscription payments recorded yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{tx.studio_name}</span>
                        <span className="text-xs text-muted-foreground capitalize"> · {tx.plan} Plan · {tx.provider} · {formatDateTime(tx.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif">{tx.currency} {tx.amount}</span>
                        <Badge variant="outline" className="text-xs capitalize">{tx.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: PLANS & PRICING */}
        {activeTab === 'plans' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Edit your SaaS plan prices and limits here. Changes take effect immediately on the Studio Billing page.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan, idx) => (
                <Card key={plan.id} className="p-5 border-border/60 shadow-none space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="uppercase text-[11px]">{plan.id}</Badge>
                    {plan.recommended && <Badge className="bg-gradient-luxe text-white border-0 text-[11px]">Popular</Badge>}
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Plan Name</Label>
                      <Input
                        value={plan.name}
                        onChange={(e) => {
                          const next = [...plans];
                          next[idx] = { ...plan, name: e.target.value };
                          setPlans(next);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tagline</Label>
                      <Input
                        value={plan.tagline}
                        onChange={(e) => {
                          const next = [...plans];
                          next[idx] = { ...plan, tagline: e.target.value };
                          setPlans(next);
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-xs">Price (INR ₹)</Label>
                        <Input
                          type="number"
                          value={plan.price_inr}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, price_inr: Number(e.target.value) };
                            setPlans(next);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Price (USD $)</Label>
                        <Input
                          type="number"
                          value={plan.price_usd}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, price_usd: Number(e.target.value) };
                            setPlans(next);
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Storage (GB)</Label>
                        <Input
                          type="number"
                          value={plan.storage_limit_gb}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, storage_limit_gb: Number(e.target.value) };
                            setPlans(next);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Projects</Label>
                        <Input
                          type="number"
                          value={plan.max_projects}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, max_projects: Number(e.target.value) };
                            setPlans(next);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Team</Label>
                        <Input
                          type="number"
                          value={plan.max_team_members}
                          onChange={(e) => {
                            const next = [...plans];
                            next[idx] = { ...plan, max_team_members: Number(e.target.value) };
                            setPlans(next);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => savePlan(plan)} disabled={busy} className="w-full bg-gradient-luxe text-white">
                    <Save className="w-4 h-4 mr-1.5" /> Save {plan.name}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <Card className="p-5 border-border/60 shadow-none space-y-3">
            <h2 className="font-serif text-lg">Platform Security &amp; Activity Logs</h2>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-medium">{log.studio_name}</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <Badge variant="outline" className="text-xs font-mono">{log.action}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 5: PROFILE & SETTINGS */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 border-border/60 shadow-none space-y-5">
              <h2 className="font-serif text-lg">Master Admin Profile</h2>
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border border-border">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-primary font-serif text-lg">
                    {getInitials(fullName || user?.email || 'Admin')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1.5" /> Upload Photo
                  </Button>
                  {avatarUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl('')} className="text-destructive">
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted/50" />
                </div>
                <Button onClick={saveMasterProfile} disabled={savingProfile} className="bg-gradient-luxe text-white">
                  <Save className="w-4 h-4 mr-1.5" /> {savingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-6 border-border/60 shadow-none space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <h2 className="font-serif text-lg">Change Password</h2>
                </div>
                <form onSubmit={changeMasterPassword} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">New Password (min 8 characters)</Label>
                    <Input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={savingPassword} variant="outline">
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </Card>

              <Card className="p-6 border-border/60 shadow-none space-y-3">
                <h2 className="font-serif text-lg">Payment Gateways</h2>
                <div className="flex items-center justify-between text-sm py-1.5">
                  <span>Razorpay (INR)</span>
                  <Badge variant={gateways.razorpay ? 'default' : 'outline'}>
                    {gateways.razorpay ? 'Connected' : 'Keys Not Added'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5">
                  <span>Stripe (International USD)</span>
                  <Badge variant={gateways.stripe ? 'default' : 'outline'}>
                    {gateways.stripe ? 'Connected' : 'Keys Not Added'}
                  </Badge>
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>

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

      {/* EDIT STUDIO MODAL */}
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
