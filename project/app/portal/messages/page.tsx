'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Send } from 'lucide-react';
import { getInitials, timeAgo } from '@/lib/format';
import type { Conversation, Message, Profile } from '@/types/database';

export default function PortalMessagesPage() {
  const { profile } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<(Message & { sender: Profile })[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (profile) loadConversation(); }, [profile]);

  useEffect(() => {
    if (!conversation) return;
    loadMessages(conversation.id);
    const channel = supabase
      .channel(`portal-msgs-${conversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        async (payload) => {
          const { data: sender } = await supabase.from('profiles').select('*').eq('id', payload.new.sender_id).single();
          setMessages(prev => [...prev, { ...(payload.new as Message), sender: sender! }]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function loadConversation() {
    const { data: clientData } = await supabase.from('clients').select('*').eq('user_id', profile!.id).maybeSingle();
    if (!clientData) { setLoading(false); return; }
    const { data: projData } = await supabase.from('projects').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (projData) {
      let { data: convData } = await supabase.from('conversations').select('*').eq('project_id', projData.id).maybeSingle();
      if (!convData) {
        const { data: newConv } = await supabase.from('conversations').insert({ project_id: projData.id }).select('*').single();
        convData = newConv;
      }
      setConversation(convData);
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
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !conversation) return;
    const { error } = await supabase.from('messages').insert({ conversation_id: conversation.id, sender_id: profile!.id, content: newMessage });
    if (!error) setNewMessage('');
  }

  if (loading) return <div className="p-8 animate-pulse"><div className="h-8 w-48 bg-muted rounded mb-4" /><div className="h-96 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      <PageHeader title="Messages" description="Chat with your photography team" />
      {conversation ? (
        <Card className="p-0 overflow-hidden">
          <div className="h-[550px] flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Send a message to start chatting with your team.</p>
                </div>
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
              <input placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              <button onClick={sendMessage} className="w-10 h-10 rounded-lg bg-gradient-luxe text-white flex items-center justify-center shrink-0"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No conversation available</h3>
          <p className="text-muted-foreground text-sm">Your project chat will be available once a project is assigned.</p>
        </Card>
      )}
    </div>
  );
}
