'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Send } from 'lucide-react';
import { getInitials, timeAgo } from '@/lib/format';
import type { Conversation, Message, Project, Client, Profile } from '@/types/database';

export default function EditorMessagesPage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<(Conversation & { project: Project & { client: Client } })[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<(Message & { sender: Profile })[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (profile) loadConversations(); }, [profile]);

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);
    const channel = supabase
      .channel(`editor-conv-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selected.id}` },
        async (payload) => {
          const { data: sender } = await supabase.from('profiles').select('*').eq('id', payload.new.sender_id).single();
          setMessages(prev => [...prev, { ...(payload.new as Message), sender: sender! }]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  async function loadConversations() {
    const { data: assignments } = await supabase.from('project_assignments').select('project_id').eq('user_id', profile!.id);
    const projectIds = (assignments || []).map(a => a.project_id);
    if (projectIds.length === 0) { setLoading(false); return; }
    const { data: convs } = await supabase.from('conversations').select('*').in('project_id', projectIds).order('created_at', { ascending: false });
    if (convs && convs.length > 0) {
      const projIds = [...new Set(convs.map(c => c.project_id))];
      const { data: projects } = await supabase.from('projects').select('*').in('id', projIds);
      const clientIds = [...new Set((projects || []).map(p => p.client_id))];
      const { data: clients } = await supabase.from('clients').select('*').in('id', clientIds);
      const clientMap = new Map((clients || []).map(c => [c.id, c]));
      const projectMap = new Map((projects || []).map(p => [p.id, { ...p, client: clientMap.get(p.client_id)! }]));
      const enriched = convs.map(c => ({ ...c, project: projectMap.get(c.project_id)! }));
      setConversations(enriched);
      if (enriched.length > 0) setSelected(enriched[0]);
    }
    setLoading(false);
  }

  async function loadMessages(convId: string) {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    if (data && data.length > 0) {
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: senders } = await supabase.from('profiles').select('*').in('id', senderIds);
      const senderMap = new Map((senders || []).map(s => [s.id, s]));
      setMessages(data.map(m => ({ ...m, sender: senderMap.get(m.sender_id)! })));
    } else { setMessages([]); }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selected) return;
    const { error } = await supabase.from('messages').insert({ conversation_id: selected.id, sender_id: profile!.id, content: newMessage });
    if (!error) setNewMessage('');
  }

  if (loading) return <div className="p-8 animate-pulse"><div className="h-8 w-48 bg-muted rounded mb-4" /><div className="h-96 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Messages" description="Chat with your assigned clients" />
      {conversations.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No conversations yet</h3>
          <p className="text-muted-foreground text-sm">Open a project and start chatting with the client.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
          <Card className="p-3 overflow-y-auto scrollbar-thin">
            <div className="space-y-1">
              {conversations.map(conv => (
                <button key={conv.id} onClick={() => setSelected(conv)} className={`w-full text-left p-3 rounded-lg transition-colors ${selected?.id === conv.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                  <p className="font-medium text-sm truncate">{conv.project?.client?.bride_name} & {conv.project?.client?.groom_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{conv.project?.title}</p>
                </button>
              ))}
            </div>
          </Card>
          <Card className="lg:col-span-2 p-0 overflow-hidden flex flex-col">
            {selected ? (
              <>
                <div className="p-4 border-b border-border">
                  <p className="font-serif text-lg">{conversations.find(c => c.id === selected.id)?.project?.client?.bride_name} & {conversations.find(c => c.id === selected.id)?.project?.client?.groom_name}</p>
                  <p className="text-xs text-muted-foreground">{conversations.find(c => c.id === selected.id)?.project?.title}</p>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
                  {messages.map(msg => {
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
                  <input placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
                  <button onClick={sendMessage} className="w-10 h-10 rounded-lg bg-gradient-luxe text-white flex items-center justify-center shrink-0"><Send className="w-4 h-4" /></button>
                </div>
              </>
            ) : <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a conversation</div>}
          </Card>
        </div>
      )}
    </div>
  );
}
