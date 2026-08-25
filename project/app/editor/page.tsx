'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Clock, CheckCircle2, Image as ImageIcon, ArrowRight, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { STAGE_NAMES } from '@/types/database';
import type { Project, Client, ProjectAssignment } from '@/types/database';

export default function EditorDashboard() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<(Project & { client: Client })[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, mediaCount: 0 });

  useEffect(() => { if (profile) loadDashboard(); }, [profile]);

  async function loadDashboard() {
    const { data: assignments } = await supabase.from('project_assignments').select('project_id').eq('user_id', profile!.id);
    const projectIds = (assignments || []).map(a => a.project_id);
    if (projectIds.length === 0) { setLoading(false); return; }

    const [{ data: projData }, { data: mediaData }] = await Promise.all([
      supabase.from('projects').select('*').in('id', projectIds).order('updated_at', { ascending: false }),
      supabase.from('media').select('id', { count: 'exact', head: true }).in('project_id', projectIds),
    ]);

    const allProjects = projData || [];
    if (allProjects.length > 0) {
      const clientIds = [...new Set(allProjects.map(p => p.client_id))];
      const { data: clients } = await supabase.from('clients').select('*').in('id', clientIds);
      const clientMap = new Map((clients || []).map(c => [c.id, c]));
      setProjects(allProjects.map(p => ({ ...p, client: clientMap.get(p.client_id)! })));
    }

    setStats({
      total: allProjects.length,
      active: allProjects.filter(p => p.status === 'active').length,
      completed: allProjects.filter(p => p.status === 'completed').length,
      mediaCount: mediaData?.length || 0,
    });
    setLoading(false);
  }

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}</div></div>;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title={`Welcome, ${profile?.full_name?.split(' ')[0] || 'Editor'}`} description="Your assigned projects and tasks" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Assigned Projects" value={stats.total} icon={<FolderKanban className="w-5 h-5" />} accent="primary" />
        <StatCard label="Active" value={stats.active} icon={<Clock className="w-5 h-5" />} accent="warning" />
        <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="w-5 h-5" />} accent="success" />
        <StatCard label="Media Uploaded" value={stats.mediaCount} icon={<ImageIcon className="w-5 h-5" />} accent="primary" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg">Your Projects</h3>
          <Link href="/editor/projects"><Badge variant="outline" className="cursor-pointer hover:bg-muted">View all <ArrowRight className="w-3 h-3 ml-1" /></Badge></Link>
        </div>
        {projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No projects assigned to you yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map(project => (
              <Link key={project.id} href={`/editor/projects/${project.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-gradient-luxe flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-serif">{(project.client?.bride_name?.[0] || '?')}{(project.client?.groom_name?.[0] || '')}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">{project.title}</p>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(project.event_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">Stage {project.current_stage}/10</p>
                    <p className="text-xs font-medium">{STAGE_NAMES[project.current_stage - 1]}</p>
                  </div>
                  <Badge variant={project.status === 'completed' ? 'default' : 'outline'}>{project.status === 'completed' ? 'Completed' : 'Active'}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
