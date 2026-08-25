'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Users, FolderKanban, CheckCircle2, DollarSign, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { STAGE_NAMES } from '@/types/database';

const PIE_COLORS = ['hsl(348 70% 30%)', 'hsl(348 45% 50%)', 'hsl(30 55% 45%)', 'hsl(348 30% 65%)', 'hsl(20 50% 50%)'];

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [projectStatusData, setProjectStatusData] = useState<{ name: string; value: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([]);
  const [stageData, setStageData] = useState<{ stage: string; count: number }[]>([]);
  const [eventTypeData, setEventTypeData] = useState<{ name: string; value: number }[]>([]);
  const [totals, setTotals] = useState({ clients: 0, projects: 0, completed: 0, revenue: 0 });

  useEffect(() => { loadReports(); }, []);

  async function loadReports() {
    const [{ data: clients }, { data: projects }, { data: payments }] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('*'),
      supabase.from('payments').select('amount, status, paid_at'),
    ]);

    const allProjects = projects || [];
    const activeCount = allProjects.filter(p => p.status === 'active').length;
    const completedCount = allProjects.filter(p => p.status === 'completed').length;
    const onHoldCount = allProjects.filter(p => p.status === 'on_hold').length;
    const totalRevenue = (payments || []).filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);

    setTotals({ clients: clients?.length || 0, projects: allProjects.length, completed: completedCount, revenue: totalRevenue });
    setProjectStatusData([
      { name: 'Active', value: activeCount },
      { name: 'Completed', value: completedCount },
      { name: 'On Hold', value: onHoldCount },
    ]);

    const months: { month: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleString('en-US', { month: 'short' });
      const monthRevenue = (payments || [])
        .filter(p => p.status === 'paid' && p.paid_at && new Date(p.paid_at).getMonth() === d.getMonth() && new Date(p.paid_at).getFullYear() === d.getFullYear())
        .reduce((sum, p) => sum + Number(p.amount), 0);
      months.push({ month: monthName, revenue: monthRevenue });
    }
    setRevenueData(months);

    setStageData(STAGE_NAMES.map((stage, i) => ({
      stage: `S${i + 1}`,
      count: allProjects.filter(p => p.current_stage === i + 1).length,
    })));

    const eventTypes: Record<string, number> = {};
    allProjects.forEach(p => { eventTypes[p.event_type] = (eventTypes[p.event_type] || 0) + 1; });
    setEventTypeData(Object.entries(eventTypes).map(([name, value]) => ({ name, value })));

    setLoading(false);
  }

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Reports & Insights" description="Studio performance analytics and metrics" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Clients', value: totals.clients, icon: Users, color: 'text-primary' },
          { label: 'Total Projects', value: totals.projects, icon: FolderKanban, color: 'text-warning' },
          { label: 'Completed', value: totals.completed, icon: CheckCircle2, color: 'text-success' },
          { label: 'Total Revenue', value: formatCurrency(totals.revenue), icon: DollarSign, color: 'text-primary' },
        ].map((stat, i) => (
          <Card key={i} className="p-5">
            <stat.icon className={`w-5 h-5 mb-2 ${stat.color}`} />
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="font-serif text-2xl">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Revenue trend */}
        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Project status pie */}
        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4">Project Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={projectStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {projectStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stage distribution */}
        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4">Projects by Stage</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Event type pie */}
        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4">Event Type Breakdown</h3>
          {eventTypeData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={eventTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {eventTypeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
