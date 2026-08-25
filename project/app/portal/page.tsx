'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, MapPin, CheckCircle2, ArrowRight, Users, Image as ImageIcon, MessageSquare, CreditCard } from 'lucide-react';
import { formatDate, formatCurrency, getInitials } from '@/lib/format';
import { STAGE_NAMES } from '@/types/database';
import type { Project, Client, ProjectAssignment, Profile, Payment } from '@/types/database';

export default function PortalHomePage() {
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [team, setTeam] = useState<(ProjectAssignment & { profile: Profile })[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (profile) loadData(); }, [profile]);

  async function loadData() {
    const { data: clientData } = await supabase.from('clients').select('*').eq('user_id', profile!.id).maybeSingle();
    if (!clientData) { setLoading(false); return; }
    setClient(clientData);
    const { data: projData } = await supabase.from('projects').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (projData) {
      setProject(projData);
      const [{ data: assignData }, { data: payData }] = await Promise.all([
        supabase.from('project_assignments').select('*').eq('project_id', projData.id),
        supabase.from('payments').select('*').eq('project_id', projData.id).order('created_at', { ascending: false }),
      ]);
      if (assignData && assignData.length > 0) {
        const userIds = assignData.map(a => a.user_id);
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        setTeam(assignData.map(a => ({ ...a, profile: profileMap.get(a.user_id)! })));
      }
      setPayments(payData || []);
    }
    setLoading(false);
  }

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded-xl" /></div>;

  if (!project) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No project assigned yet</h3>
          <p className="text-muted-foreground text-sm">Your studio will assign a project to your account once your booking is confirmed.</p>
        </Card>
      </div>
    );
  }

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <PageHeader title={`Welcome, ${client?.bride_name || 'there'}`} description="Your wedding project at a glance" />

      {/* Hero project card */}
      <Card className="p-6 mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 opacity-5 bg-gradient-luxe rounded-full -translate-y-16 translate-x-16" />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="font-serif text-2xl mb-1">{project.title}</h2>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatDate(project.event_date)}</span>
              {project.event_venue && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {project.event_venue}</span>}
            </div>
          </div>
          <Badge variant={project.status === 'completed' ? 'default' : 'outline'} className="text-sm px-3 py-1">
            {project.status === 'completed' ? 'Completed' : project.status === 'on_hold' ? 'On Hold' : 'Active'}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Project Progress</span>
            <span className="text-sm text-muted-foreground">Stage {project.current_stage} of 10</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-luxe rounded-full transition-all duration-500" style={{ width: `${project.current_stage * 10}%` }} />
          </div>
          <p className="text-sm text-primary mt-2 font-medium">{STAGE_NAMES[project.current_stage - 1]}</p>
        </div>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Link href="/portal/timeline"><Card className="p-4 hover:shadow-md transition-shadow group cursor-pointer"><CheckCircle2 className="w-5 h-5 text-primary mb-2" /><p className="text-sm font-medium group-hover:text-primary transition-colors">Timeline</p><p className="text-xs text-muted-foreground">Track progress</p></Card></Link>
        <Link href="/portal/gallery"><Card className="p-4 hover:shadow-md transition-shadow group cursor-pointer"><ImageIcon className="w-5 h-5 text-primary mb-2" /><p className="text-sm font-medium group-hover:text-primary transition-colors">Gallery</p><p className="text-xs text-muted-foreground">View media</p></Card></Link>
        <Link href="/portal/messages"><Card className="p-4 hover:shadow-md transition-shadow group cursor-pointer"><MessageSquare className="w-5 h-5 text-primary mb-2" /><p className="text-sm font-medium group-hover:text-primary transition-colors">Messages</p><p className="text-xs text-muted-foreground">Chat with team</p></Card></Link>
        <Link href="/portal/payments"><Card className="p-4 hover:shadow-md transition-shadow group cursor-pointer"><CreditCard className="w-5 h-5 text-primary mb-2" /><p className="text-sm font-medium group-hover:text-primary transition-colors">Payments</p><p className="text-xs text-muted-foreground">{formatCurrency(totalPaid)} paid</p></Card></Link>
      </div>

      {/* Team + Payment summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Your Team</h3>
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {team.map(member => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10"><AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(member.profile?.full_name || '')}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-sm font-medium">{member.profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-serif text-lg mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
              <span className="text-sm text-muted-foreground">Total Paid</span>
              <span className="font-serif text-lg text-success">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10">
              <span className="text-sm text-muted-foreground">Pending</span>
              <span className="font-serif text-lg text-warning">{formatCurrency(totalPending)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Package Total</span>
              <span className="font-serif text-lg">{formatCurrency(project.package_amount)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
