'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image as ImageIcon, Video, Download, CheckCircle2 } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { MEDIA_CATEGORIES } from '@/types/database';
import type { MediaItem, Project, Client } from '@/types/database';

export default function PortalGalleryPage() {
  const { profile } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => { if (profile) loadMedia(); }, [profile]);

  async function loadMedia() {
    const { data: clientData } = await supabase.from('clients').select('*').eq('user_id', profile!.id).maybeSingle();
    if (!clientData) { setLoading(false); return; }
    const { data: projData } = await supabase.from('projects').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (projData) {
      const { data: mediaData } = await supabase.from('media').select('*').eq('project_id', projData.id).order('created_at', { ascending: false });
      setMedia((mediaData || []).filter(m => m.approved));
    }
    setLoading(false);
  }

  const filtered = categoryFilter === 'all' ? media : media.filter(m => m.category === categoryFilter);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Gallery" description="Your delivered photos and videos" />

      <div className="mb-6">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Media</SelectItem>
            {MEDIA_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-52 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No media available yet</h3>
          <p className="text-muted-foreground text-sm">Your photos and videos will appear here once the team uploads and approves them.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(item => (
            <Card key={item.id} className="overflow-hidden group">
              {item.file_type === 'video' ? (
                <video src={item.file_url} className="w-full h-48 object-cover" controls />
              ) : (
                <div className="relative">
                  <img src={item.file_url} alt={item.title} className="w-full h-48 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <a href={item.file_url} download target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                      <Download className="w-5 h-5 text-foreground" />
                    </a>
                  </div>
                </div>
              )}
              <div className="p-3">
                <p className="text-xs font-medium truncate">{item.title || MEDIA_CATEGORIES.find(c => c.value === item.category)?.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.created_at)}</p>
                <Badge variant="outline" className="text-xs mt-2">
                  {MEDIA_CATEGORIES.find(c => c.value === item.category)?.label}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
