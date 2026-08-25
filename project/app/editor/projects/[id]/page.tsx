'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, MapPin, CheckCircle2, Clock, Upload, Send, Image as ImageIcon, Video, Trash2 } from 'lucide-react';
import { formatDate, getInitials, timeAgo } from '@/lib/format';
import { STAGE_NAMES, MEDIA_CATEGORIES } from '@/types/database';
import { toast } from 'sonner';
import type { Project, Client, ProjectStage, MediaItem, Message, Profile, Conversation, StageStatus } from '@/types/database';

export default function EditorProjectDetailPage() {
  const params = useParams();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [messages, setMessages] = useState<(Message & { sender: Profile })[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCategory, setMediaCategory] = useState('edited_photo');
  const [mediaTitle, setMediaTitle] = useState('');

  useEffect(() => { if (params.id) loadProject(params.id as string); }, [params.id]);

  useEffect(() => {
    if (!conversation) return;
    const channel = supabase
      .channel(`editor-msgs-${conversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        async (payload) => {
          const { data: sender } = await supabase.from('profiles').select('*').eq('id', payload.new.sender_id).single();
          setMessages(prev => [...prev, { ...(payload.new as Message), sender: sender! }]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation]);

  async function loadProject(id: string) {
    const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single();
    if (!proj) return;
    setProject(proj);
    const { data: clientData } = await supabase.from('clients').select('*').eq('id', proj.client_id).single();
    setClient(clientData);
    const [{ data: stagesData }, { data: mediaData }, { data: convData }] = await Promise.all([
      supabase.from('project_stages').select('*').eq('project_id', id).order('stage_number'),
      supabase.from('media').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('conversations').select('*').eq('project_id', id).maybeSingle(),
    ]);
    setStages(stagesData || []);
    setMedia(mediaData || []);
    if (convData) {
      setConversation(convData);
      const { data: msgData } = await supabase.from('messages').select('*').eq('conversation_id', convData.id).order('created_at', { ascending: true });
      if (msgData && msgData.length > 0) {
        const senderIds = [...new Set(msgData.map(m => m.sender_id))];
        const { data: senders } = await supabase.from('profiles').select('*').in('id', senderIds);
        const senderMap = new Map((senders || []).map(s => [s.id, s]));
        setMessages(msgData.map(m => ({ ...m, sender: senderMap.get(m.sender_id)! })));
      }
    }
    setLoading(false);
  }

  async function ensureStages() {
    if (stages.length > 0) return;
    const newStages = STAGE_NAMES.map((name, i) => ({
      project_id: project!.id, stage_number: i + 1, stage_name: name, status: i === 0 ? 'completed' : 'pending',
      completed_at: i === 0 ? new Date().toISOString() : null,
    }));
    const { data } = await supabase.from('project_stages').insert(newStages).select('*');
    if (data) setStages(data);
  }

  async function updateStage(stageId: string, status: StageStatus) {
    const updates: Partial<ProjectStage> = {
      status, completed_at: status === 'completed' ? new Date().toISOString() : null, updated_by: profile?.id,
    };
    const { data } = await supabase.from('project_stages').update(updates).eq('id', stageId).select('*').single();
    if (data) {
      const updated = stages.map(s => s.id === stageId ? data : s);
      setStages(updated);
      const maxCompleted = Math.max(...updated.filter(s => s.status === 'completed').map(s => s.stage_number), 0);
      const nextStage = updated.find(s => s.status === 'in_progress');
      const newCurrent = nextStage ? nextStage.stage_number : (maxCompleted + 1 <= 10 ? maxCompleted + 1 : maxCompleted);
      await supabase.from('projects').update({ current_stage: Math.min(newCurrent, 10) }).eq('id', project!.id);
      toast.success('Stage updated');
    }
  }

  async function addMedia() {
    if (!mediaUrl) { toast.error('Please enter a file URL'); return; }
    const cat = MEDIA_CATEGORIES.find(c => c.value === mediaCategory);
    const { error } = await supabase.from('media').insert({
      project_id: project!.id, category: mediaCategory, title: mediaTitle || cat?.label || '',
      file_url: mediaUrl, thumbnail_url: mediaUrl, file_type: cat?.type || 'image', uploaded_by: profile?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success('Media added'); setMediaUrl(''); setMediaTitle(''); loadProject(project!.id); }
  }

  async function deleteMedia(id: string) {
    await supabase.from('media').delete().eq('id', id);
    setMedia(media.filter(m => m.id !== id));
    toast.success('Media deleted');
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;
    let convId = conversation?.id;
    if (!convId) {
      const { data: conv } = await supabase.from('conversations').insert({ project_id: project!.id }).select('*').single();
      if (conv) { setConversation(conv); convId = conv.id; }
    }
    const { error } = await supabase.from('messages').insert({ conversation_id: convId!, sender_id: profile!.id, content: newMessage });
    if (!error) setNewMessage('');
  }

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-64 bg-muted rounded" /><div className="h-64 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      <Link href="/editor/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Projects
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl">{project?.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{client?.bride_name} & {client?.groom_name}</p>
        </div>
        <Badge variant={project?.status === 'completed' ? 'default' : 'outline'} className="text-sm px-3 py-1">{project?.status === 'completed' ? 'Completed' : 'Active'}</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="w-3.5 h-3.5" /> Event Date</div><p className="font-medium text-sm">{formatDate(project?.event_date || null)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><MapPin className="w-3.5 h-3.5" /> Venue</div><p className="font-medium text-sm truncate">{project?.event_venue || 'Not set'}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CheckCircle2 className="w-3.5 h-3.5" /> Progress</div><p className="font-medium text-sm">Stage {project?.current_stage}/10</p></Card>
      </div>

      <Tabs defaultValue="stages">
        <TabsList className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="stages"><CheckCircle2 className="w-4 h-4 mr-2" /> Stages</TabsTrigger>
          <TabsTrigger value="media"><ImageIcon className="w-4 h-4 mr-2" /> Media</TabsTrigger>
          <TabsTrigger value="chat"><Send className="w-4 h-4 mr-2" /> Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="stages">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg">Progress Timeline</h3>
              {stages.length === 0 && <Button size="sm" variant="outline" onClick={ensureStages}>Initialize Stages</Button>}
            </div>
            {stages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><p className="text-sm mb-3">No stages initialized yet.</p><Button size="sm" onClick={ensureStages} className="bg-gradient-luxe text-white">Initialize 10 Stages</Button></div>
            ) : (
              <div className="space-y-1">
                {stages.map((stage, i) => (
                  <div key={stage.id} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${stage.status === 'completed' ? 'bg-success text-success-foreground' : stage.status === 'in_progress' ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {stage.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : stage.status === 'in_progress' ? <Clock className="w-4 h-4" /> : <span className="text-sm font-medium">{stage.stage_number}</span>}
                      </div>
                      {i < stages.length - 1 && <div className={`w-0.5 h-12 ${stage.status === 'completed' ? 'bg-success' : 'bg-border'}`} />}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-medium ${stage.status === 'completed' ? 'text-muted-foreground line-through' : ''}`}>{stage.stage_name}</p>
                          {stage.completed_at && <p className="text-xs text-muted-foreground">Completed {formatDate(stage.completed_at)}</p>}
                        </div>
                        <Select value={stage.status} onValueChange={v => updateStage(stage.id, v as StageStatus)}>
                          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card className="p-6">
            <h3 className="font-serif text-lg mb-4">Upload Media</h3>
            <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 rounded-lg bg-muted/50">
              <Input placeholder="Media file URL" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className="flex-1" />
              <Input placeholder="Title (optional)" value={mediaTitle} onChange={e => setMediaTitle(e.target.value)} className="w-full sm:w-40" />
              <Select value={mediaCategory} onValueChange={setMediaCategory}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{MEDIA_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={addMedia} className="bg-gradient-luxe text-white shrink-0"><Upload className="w-4 h-4 mr-2" /> Add</Button>
            </div>
            {media.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">No media uploaded yet.</p></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {media.map(item => (
                  <div key={item.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted/30">
                    {item.file_type === 'video' ? <video src={item.file_url} className="w-full h-40 object-cover" controls /> : <img src={item.file_url} alt={item.title} className="w-full h-40 object-cover" />}
                    <div className="p-3">
                      <p className="text-xs font-medium truncate">{item.title || MEDIA_CATEGORIES.find(c => c.value === item.category)?.label}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant={item.approved ? 'default' : 'outline'} className="text-xs">{item.approved ? 'Approved' : 'Pending'}</Badge>
                        <button onClick={() => deleteMedia(item.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card className="p-0 overflow-hidden">
            <div className="h-[500px] flex flex-col">
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground"><Send className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">No messages yet. Start the conversation.</p></div>
                ) : messages.map(msg => {
                  const isOwn = msg.sender_id === profile?.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-2 max-w-[75%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {!isOwn && <Avatar className="w-8 h-8 shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(msg.sender?.full_name || '')}</AvatarFallback></Avatar>}
                        <div>
                          {!isOwn && <p className="text-xs text-muted-foreground mb-1 px-1">{msg.sender?.full_name}</p>}
                          <div className={`rounded-2xl px-4 py-2 ${isOwn ? 'bg-gradient-luxe text-white' : 'bg-muted'}`}><p className="text-sm">{msg.content}</p></div>
                          <p className={`text-xs text-muted-foreground mt-1 px-1 ${isOwn ? 'text-right' : ''}`}>{timeAgo(msg.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <Input placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} className="flex-1" />
                <Button onClick={sendMessage} size="icon" className="bg-gradient-luxe text-white shrink-0"><Send className="w-4 h-4" /></Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
