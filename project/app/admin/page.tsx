'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, FolderKanban, CheckCircle2, Clock, DollarSign, ArrowRight, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { STAGE_NAMES } from '@/types/database';
import type { Project, Client, Payment } from '@/types/database';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ clients: 0, activeProjects: 0, completedProjects: 0, pendingDeliveries: 0, revenue: 0 });
  const [recentProjects, setRecentProjects] = useState<(Project & { client: Client })[]>([]);
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([]);
  const [stageData, setStageData] = useState<{ stage: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const [clients, projects, payments] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('*'),
      supabase.from('payments').select('amount, status, paid_at'),
    ]);

    const allProjects = projects.data || [];
    const activeCount = allProjects.filter(p => p.status === 'active').length;
    const completedCount = allProjects.filter(p => p.status === 'completed').length;
    const pendingCount = allProjects.filter(p => p.current_stage < 10 && p.status === 'active').length;
    const totalRevenue = (payments.data || []).filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);

    setStats({
      clients: clients.count || 0,
      activeProjects: activeCount,
      completedProjects: completedCount,
      pendingDeliveries: pendingCount,
      revenue: totalRevenue,
    });

    // Recent projects with client info
    const recent = allProjects
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
    if (recent.length > 0) {
      const clientIds = [...new Set(recent.map(p => p.client_id))];
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .in('id', clientIds);
      const clientMap = new Map((clientsData || []).map(c => [c.id, c]));
      setRecentProjects(recent.map(p => ({ ...p, client: clientMap.get(p.client_id)! })));
    }

    // Revenue chart data (last 6 months)
    const months: { month: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleString('en-US', { month: 'short' });
      const monthRevenue = (payments.data || [])
        .filter(p => p.status === 'paid' && p.paid_at && new Date(p.paid_at).getMonth() === d.getMonth() && new Date(p.paid_at).getFullYear() === d.getFullYear())
        .reduce((sum, p) => sum + Number(p.amount), 0);
      months.push({ month: monthName, revenue: monthRevenue });
    }
    setRevenueData(months);

    // Stage distribution
    const stageCounts = STAGE_NAMES.map((stage, i) => ({
      stage: stage.replace(/\s/g, '\n'),
      count: allProjects.filter(p => p.current_stage === i + 1).length,
    }));
    setStageData(stageCounts);

    setLoading(false);
  }

  if (loading) {
    return <div className="p-6 animate-pulse space-y-6">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}
      </div>
    </div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Studio Dashboard"
        description="Overview of your photography studio operations"
        action={
          <Link href="/admin/projects">
            <Button className="bg-gradient-luxe text-white hover:opacity-90">
              View All Projects <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clients" value={stats.clients} icon={<Users className="w-5 h-5" />} accent="primary" />
        <StatCard label="Active Projects" value={stats.activeProjects} icon={<FolderKanban className="w-5 h-5" />} accent="warning" />
        <StatCard label="Completed" value={stats.completedProjects} icon={<CheckCircle2 className="w-5 h-5" />} accent="success" />
        <StatCard label="Pending Deliveries" value={stats.pendingDeliveries} icon={<Clock className="w-5 h-5" />} accent="destructive" />
      </div>

      {/* Revenue + Stage distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg">Revenue Overview</h3>
              <p className="text-sm text-muted-foreground">Last 6 months</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="font-serif text-2xl text-gradient-luxe">{formatCurrency(stats.revenue)}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                formatter={(v: number) => [formatCurrency(v), 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4">Project Stages</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent projects */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg">Recent Projects</h3>
          <Link href="/admin/projects">
            <Button variant="ghost" size="sm" className="text-primary">
              View all <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        {recentProjects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No projects yet. Create your first project to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/admin/projects/${project.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-gradient-luxe flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-serif">
                      {(project.client?.bride_name?.[0] || '?')}{(project.client?.groom_name?.[0] || '')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">
                      {project.client?.bride_name} & {project.client?.groom_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {project.title} · {formatDate(project.event_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">Stage {project.current_stage}/10</p>
                    <p className="text-xs font-medium">{STAGE_NAMES[project.current_stage - 1]}</p>
                  </div>
                  <Badge variant={project.status === 'completed' ? 'default' : project.status === 'on_hold' ? 'secondary' : 'outline'}>
                    {project.status === 'completed' ? 'Completed' : project.status === 'on_hold' ? 'On Hold' : 'Active'}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
