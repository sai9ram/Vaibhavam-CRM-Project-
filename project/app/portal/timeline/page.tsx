'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Clock, Circle } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { STAGE_NAMES } from '@/types/database';
import type { Project, Client, ProjectStage } from '@/types/database';

export default function PortalTimelinePage() {
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (profile) loadData(); }, [profile]);

  async function loadData() {
    const { data: clientData } = await supabase.from('clients').select('*').eq('user_id', profile!.id).maybeSingle();
    if (!clientData) { setLoading(false); return; }
    const { data: projData } = await supabase.from('projects').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (projData) {
      setProject(projData);
      const { data: stagesData } = await supabase.from('project_stages').select('*').eq('project_id', projData.id).order('stage_number');
      setStages(stagesData || []);
    }
    setLoading(false);
  }

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <PageHeader title="Project Timeline" description="Track every stage of your project in real time" />

      {project && (
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{project.title}</span>
            <span className="text-sm text-muted-foreground">Stage {project.current_stage}/10</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-luxe rounded-full transition-all duration-500" style={{ width: `${project.current_stage * 10}%` }} />
          </div>
        </Card>
      )}

      {stages.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">Timeline not yet initialized</h3>
          <p className="text-muted-foreground text-sm">Your studio will set up the progress timeline shortly.</p>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="space-y-1">
            {stages.map((stage, i) => (
              <div key={stage.id} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    stage.status === 'completed' ? 'bg-success text-success-foreground' :
                    stage.status === 'in_progress' ? 'bg-warning text-warning-foreground animate-pulse' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {stage.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                     stage.status === 'in_progress' ? <Clock className="w-5 h-5" /> :
                     <Circle className="w-5 h-5" />}
                  </div>
                  {i < stages.length - 1 && <div className={`w-0.5 h-16 ${stage.status === 'completed' ? 'bg-success' : 'bg-border'}`} />}
                </div>
                <div className="flex-1 pb-6">
                  <p className={`font-serif text-lg ${stage.status === 'completed' ? 'text-muted-foreground' : stage.status === 'in_progress' ? 'text-primary' : ''}`}>
                    {stage.stage_name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {stage.status === 'completed' ? `Completed on ${formatDate(stage.completed_at)}` :
                     stage.status === 'in_progress' ? 'In progress...' :
                     'Waiting to start'}
                  </p>
                  {stage.notes && <p className="text-sm text-muted-foreground mt-2 italic">{stage.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
