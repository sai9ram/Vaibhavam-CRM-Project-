'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Calendar, MapPin } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { STAGE_NAMES } from '@/types/database';
import type { Project, Client } from '@/types/database';

export default function EditorProjectsPage() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<(Project & { client: Client })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (profile) loadProjects(); }, [profile]);

  async function loadProjects() {
    const { data: assignments } = await supabase.from('project_assignments').select('project_id').eq('user_id', profile!.id);
    const projectIds = (assignments || []).map(a => a.project_id);
    if (projectIds.length === 0) { setLoading(false); return; }
    const { data } = await supabase.from('projects').select('*').in('id', projectIds).order('updated_at', { ascending: false });
    const allProjects = data || [];
    if (allProjects.length > 0) {
      const clientIds = [...new Set(allProjects.map(p => p.client_id))];
      const { data: clients } = await supabase.from('clients').select('*').in('id', clientIds);
      const clientMap = new Map((clients || []).map(c => [c.id, c]));
      setProjects(allProjects.map(p => ({ ...p, client: clientMap.get(p.client_id)! })));
    }
    setLoading(false);
  }

  if (loading) return <div className="p-8 animate-pulse"><div className="h-8 w-48 bg-muted rounded mb-4" /><div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-44 bg-muted rounded-xl" />)}</div></div>;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="My Projects" description="Projects assigned to you" />
      {projects.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No projects assigned</h3>
          <p className="text-muted-foreground text-sm">Your assigned projects will appear here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Link key={project.id} href={`/editor/projects/${project.id}`}>
              <Card className="p-5 hover:shadow-md transition-all group cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-luxe flex items-center justify-center shrink-0">
                    <span className="text-white font-serif text-sm">{(project.client?.bride_name?.[0] || '?')}{(project.client?.groom_name?.[0] || '')}</span>
                  </div>
                  <Badge variant={project.status === 'completed' ? 'default' : 'outline'}>{project.status === 'completed' ? 'Completed' : 'Active'}</Badge>
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
                    <div className="h-full bg-gradient-luxe rounded-full" style={{ width: `${project.current_stage * 10}%` }} />
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
