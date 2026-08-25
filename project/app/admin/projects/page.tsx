'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderKanban, Plus, Search, Calendar, MapPin } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';
import { STAGE_NAMES } from '@/types/database';
import { toast } from 'sonner';
import type { Project, Client } from '@/types/database';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<(Project & { client: Client })[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    client_id: '', title: '', event_date: '', event_type: 'Wedding',
    event_venue: '', package_name: '', package_amount: '',
  });

  useEffect(() => { loadProjects(); loadClients(); }, []);

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const clientIds = [...new Set(data.map(p => p.client_id))];
      const { data: clientsData } = await supabase.from('clients').select('*').in('id', clientIds);
      const clientMap = new Map((clientsData || []).map(c => [c.id, c]));
      setProjects(data.map(p => ({ ...p, client: clientMap.get(p.client_id)! })));
    }
    setLoading(false);
  }

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('bride_name');
    setClients(data || []);
  }

  async function createProject() {
    if (!form.client_id || !form.title) { toast.error('Client and title are required'); return; }
    setCreating(true);
    const { error } = await supabase.from('projects').insert({
      client_id: form.client_id,
      title: form.title,
      event_date: form.event_date || null,
      event_type: form.event_type,
      event_venue: form.event_venue,
      package_name: form.package_name,
      package_amount: form.package_amount ? parseFloat(form.package_amount) : 0,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Project created');
      setForm({ client_id: '', title: '', event_date: '', event_type: 'Wedding', event_venue: '', package_name: '', package_amount: '' });
      setDialogOpen(false);
      loadProjects();
    }
    setCreating(false);
  }

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title?.toLowerCase().includes(q) || `${p.client?.bride_name} ${p.client?.groom_name}`.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Projects"
        description="Manage all studio projects and their progress"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-luxe text-white hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Create New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.bride_name} & {c.groom_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project Title</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Smith Wedding 2025" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Event Date</Label>
                    <Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Event Type</Label>
                    <Select value={form.event_type} onValueChange={v => setForm({ ...form, event_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Wedding">Wedding</SelectItem>
                        <SelectItem value="Engagement">Engagement</SelectItem>
                        <SelectItem value="Pre-Wedding">Pre-Wedding</SelectItem>
                        <SelectItem value="Reception">Reception</SelectItem>
                        <SelectItem value="Corporate Event">Corporate Event</SelectItem>
                        <SelectItem value="Birthday">Birthday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Input value={form.event_venue} onChange={e => setForm({ ...form, event_venue: e.target.value })} placeholder="Grand Ballroom, NYC" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Package Name</Label>
                    <Input value={form.package_name} onChange={e => setForm({ ...form, package_name: e.target.value })} placeholder="Premium Gold" />
                  </div>
                  <div className="space-y-2">
                    <Label>Package Amount ($)</Label>
                    <Input type="number" value={form.package_amount} onChange={e => setForm({ ...form, package_amount: e.target.value })} placeholder="5000" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={createProject} disabled={creating} className="bg-gradient-luxe text-white">
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No projects yet</h3>
          <p className="text-muted-foreground text-sm">Create your first project to start tracking progress.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(project => (
            <Link key={project.id} href={`/admin/projects/${project.id}`}>
              <Card className="p-5 hover:shadow-md transition-all group cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-luxe flex items-center justify-center shrink-0">
                    <span className="text-white font-serif text-sm">
                      {(project.client?.bride_name?.[0] || '?')}{(project.client?.groom_name?.[0] || '')}
                    </span>
                  </div>
                  <Badge variant={project.status === 'completed' ? 'default' : project.status === 'on_hold' ? 'secondary' : 'outline'}>
                    {project.status === 'completed' ? 'Completed' : project.status === 'on_hold' ? 'On Hold' : 'Active'}
                  </Badge>
                </div>
                <p className="font-medium truncate group-hover:text-primary transition-colors mb-1">{project.title}</p>
                <p className="text-sm text-muted-foreground mb-3">{project.client?.bride_name} & {project.client?.groom_name}</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(project.event_date)}</div>
                  {project.event_venue && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {project.event_venue}</div>}
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Progress</span>
                    <span className="text-xs font-medium">{project.current_stage}/10</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-luxe rounded-full transition-all" style={{ width: `${project.current_stage * 10}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{STAGE_NAMES[project.current_stage - 1]}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
