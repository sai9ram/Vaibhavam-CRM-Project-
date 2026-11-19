'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image as ImageIcon, Video, Trash2, CheckCircle2 } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { MEDIA_CATEGORIES } from '@/types/database';
import { toast } from 'sonner';
import type { MediaItem, Project, Client } from '@/types/database';

export default function AdminMediaPage() {
  const [media, setMedia] = useState<(MediaItem & { project: Project & { client: Client } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => { loadMedia(); }, []);

  async function loadMedia() {
    const { data: mediaData } = await supabase.from('media').select('*').order('created_at', { ascending: false });
    if (mediaData && mediaData.length > 0) {
      const projectIds = [...new Set(mediaData.map(m => m.project_id))];
      const { data: projects } = await supabase.from('projects').select('*').in('id', projectIds);
      const clientIds = [...new Set((projects || []).map(p => p.client_id))];
      const { data: clients } = await supabase.from('clients').select('*').in('id', clientIds);
      const clientMap = new Map((clients || []).map(c => [c.id, c]));
      const projectMap = new Map((projects || []).map(p => [p.id, { ...p, client: clientMap.get(p.client_id)! }]));
      setMedia(mediaData.map(m => ({ ...m, project: projectMap.get(m.project_id)! })));
    }
    setLoading(false);
  }

  async function deleteMedia(id: string) {
    await supabase.from('media').delete().eq('id', id);
    setMedia(media.filter(m => m.id !== id));
    toast.success('Media deleted');
  }

  async function approveMedia(id: string) {
    await supabase.from('media').update({ approved: true }).eq('id', id);
    setMedia(media.map(m => m.id === id ? { ...m, approved: true } : m));
    toast.success('Media approved');
  }

  const filtered = categoryFilter === 'all' ? media : media.filter(m => m.category === categoryFilter);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Media Library" description="All uploaded media across projects" />

      <div className="mb-6">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {MEDIA_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-52 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No media uploaded</h3>
          <p className="text-muted-foreground text-sm">Media uploaded to projects will appear here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(item => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="relative">
                {item.file_type === 'video' ? (
                  <video src={item.file_url} className="w-full h-40 object-cover" controls />
                ) : (
                  <img src={item.file_url} alt={item.title} className="w-full h-40 object-cover" />
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  {item.file_type === 'video' && <Badge className="bg-black/60 text-white"><Video className="w-3 h-3 mr-1" />Video</Badge>}
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium truncate">{item.title || MEDIA_CATEGORIES.find(c => c.value === item.category)?.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.project?.client?.bride_name} & {item.project?.client?.groom_name}</p>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant={item.approved ? 'default' : 'outline'} className="text-xs">
                    {item.approved ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</> : 'Pending'}
                  </Badge>
                  <div className="flex gap-1">
                    {!item.approved && <button onClick={() => approveMedia(item.id)} className="text-muted-foreground hover:text-success transition-colors"><CheckCircle2 className="w-4 h-4" /></button>}
                    <button onClick={() => deleteMedia(item.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
