'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Calendar, MapPin, DollarSign, CheckCircle2, Circle, Clock,
  Plus, Trash2, Users, Image as ImageIcon, MessageSquare, CreditCard,
  Upload, Send, FileText, Video, Receipt, FileSignature, Eye,
} from 'lucide-react';
import { formatDate, formatCurrency, formatDateTime, formatFileSize, getInitials, timeAgo } from '@/lib/format';
import { STAGE_NAMES, MEDIA_CATEGORIES } from '@/types/database';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { InvoicePreviewDialog } from '@/components/invoice-preview-dialog';
import { AgreementPreviewDialog } from '@/components/agreement-preview-dialog';
import type {
  Project, Client, ProjectStage, ProjectAssignment, MediaItem, Message,
  Payment, Profile, Conversation, StageStatus, Invoice, Agreement,
} from '@/types/database';

export default function ProjectDetailPage() {
  const params = useParams();
  const { profile, studio } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [assignments, setAssignments] = useState<(ProjectAssignment & { profile: Profile })[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [messages, setMessages] = useState<(Message & { sender: Profile })[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCategory, setMediaCategory] = useState<string>('edited_photo');
  const [mediaTitle, setMediaTitle] = useState('');
  const [paymentForm, setPaymentForm] = useState({ amount: '', type: 'advance', due_date: '' });
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    description: '',
    amount: '',
    tax_rate: '0',
    due_date: '',
    notes: '',
  });
  const [agreementForm, setAgreementForm] = useState({
    title: 'Photography & Film Service Agreement',
    terms_text: '',
  });
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewAgreement, setPreviewAgreement] = useState<Agreement | null>(null);

  useEffect(() => {
    if (params.id) loadProject(params.id as string);
  }, [params.id]);

  useEffect(() => {
    if (!conversation) return;
    const channel = supabase
      .channel(`messages-${conversation.id}`)
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

    const [{ data: stagesData }, { data: assignData }, { data: mediaData }, { data: convData }, { data: payData }, { data: teamData }, { data: invData }, { data: agrData }] = await Promise.all([
      supabase.from('project_stages').select('*').eq('project_id', id).order('stage_number'),
      supabase.from('project_assignments').select('*').eq('project_id', id),
      supabase.from('media').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('conversations').select('*').eq('project_id', id).maybeSingle(),
      supabase.from('payments').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'editor'),
      supabase.from('invoices').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('agreements').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    ]);

    setStages(stagesData || []);
    setMedia(mediaData || []);
    setPayments(payData || []);
    setTeamMembers(teamData || []);
    setInvoices((invData as Invoice[]) || []);
    setAgreements((agrData as Agreement[]) || []);

    setInvoiceForm(prev => ({
      ...prev,
      invoice_number: prev.invoice_number || `INV-${new Date().getFullYear()}-${String((invData?.length || 0) + 1).padStart(3, '0')}`,
      description: prev.description || proj.package_name || proj.title || 'Photography Package',
      amount: prev.amount || String(proj.package_amount || ''),
    }));

    setAgreementForm(prev => ({
      ...prev,
      terms_text:
        prev.terms_text ||
        `1. Services Covered\nThe Studio agrees to provide photography and/or videography coverage for "${proj.title}" (${proj.event_type}) on ${proj.event_date || 'the scheduled event date'} at ${proj.event_venue || 'the agreed venue'}.\n\n2. Package & Payment\nTotal package fee is ${formatCurrency(proj.package_amount || 0, studio?.currency)}. Booking advance is required to reserve the date, with the remaining balance due before final delivery.\n\n3. Delivery Timeline\nEdited photos and films will be delivered through the client portal in accordance with the 10-stage workflow.\n\n4. Copyright & Usage\nThe client receives full personal usage rights for all delivered photos and videos. The Studio retains the right to showcase selected highlights in its portfolio unless otherwise agreed in writing.`,
    }));

    if (assignData && assignData.length > 0) {
      const userIds = assignData.map(a => a.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setAssignments(assignData.map(a => ({ ...a, profile: profileMap.get(a.user_id)! })));
    }

    if (convData) {
      setConversation(convData);
      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convData.id)
        .order('created_at', { ascending: true });
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
    if (stages.length > 0) return stages;
    const newStages = STAGE_NAMES.map((name, i) => ({
      project_id: project!.id, stage_number: i + 1, stage_name: name, status: i === 0 ? 'completed' : 'pending',
      completed_at: i === 0 ? new Date().toISOString() : null,
    }));
    const { data } = await supabase.from('project_stages').insert(newStages).select('*');
    if (data) setStages(data);
    return data || [];
  }

  async function updateStage(stageId: string, status: StageStatus) {
    const updates: Partial<ProjectStage> = {
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_by: profile?.id,
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

  async function assignTeamMember(userId: string, role: string) {
    const { error } = await supabase.from('project_assignments').insert({ project_id: project!.id, user_id: userId, role });
    if (error) toast.error(error.message);
    else { toast.success('Team member assigned'); loadProject(project!.id); }
  }

  async function removeAssignment(id: string) {
    await supabase.from('project_assignments').delete().eq('id', id);
    loadProject(project!.id);
  }

  async function addMedia() {
    if (!mediaUrl) { toast.error('Please enter a file URL'); return; }
    const cat = MEDIA_CATEGORIES.find(c => c.value === mediaCategory);
    const { error } = await supabase.from('media').insert({
      project_id: project!.id, category: mediaCategory, title: mediaTitle || cat?.label || '',
      file_url: mediaUrl, thumbnail_url: mediaUrl, file_type: cat?.type || 'image',
      uploaded_by: profile?.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Media added');
      setMediaUrl(''); setMediaTitle('');
      loadProject(project!.id);
    }
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

  async function sendMessage() {
    if (!newMessage.trim()) return;
    if (!conversation) {
      const { data: conv } = await supabase.from('conversations').insert({ project_id: project!.id }).select('*').single();
      if (conv) setConversation(conv);
      const { error } = await supabase.from('messages').insert({
        conversation_id: conv!.id, sender_id: profile!.id, content: newMessage,
      });
      if (!error) { setNewMessage(''); loadProject(project!.id); }
      return;
    }
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversation.id, sender_id: profile!.id, content: newMessage,
    });
    if (!error) setNewMessage('');
  }

  async function addPayment() {
    if (!paymentForm.amount) { toast.error('Amount required'); return; }
    const { error } = await supabase.from('payments').insert({
      project_id: project!.id, client_id: client!.id,
      amount: parseFloat(paymentForm.amount), payment_type: paymentForm.type,
      due_date: paymentForm.due_date || null, status: 'pending',
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Payment record added');
      setPaymentForm({ amount: '', type: 'advance', due_date: '' });
      loadProject(project!.id);
    }
  }

  async function togglePaymentStatus(pay: Payment) {
    const newStatus = pay.status === 'paid' ? 'pending' : 'paid';
    const updates: Partial<Payment> = { status: newStatus };
    if (newStatus === 'paid') updates.paid_at = new Date().toISOString();
    else updates.paid_at = null;
    await supabase.from('payments').update(updates).eq('id', pay.id);
    loadProject(project!.id);
  }

  async function deletePayment(id: string) {
    await supabase.from('payments').delete().eq('id', id);
    loadProject(project!.id);
  }

  async function createInvoice() {
    const amount = parseFloat(invoiceForm.amount);
    const taxRate = parseFloat(invoiceForm.tax_rate || '0') || 0;
    if (!invoiceForm.invoice_number.trim() || !invoiceForm.description.trim() || isNaN(amount) || amount <= 0) {
      toast.error('Please enter an invoice number, description, and valid amount.');
      return;
    }
    const subtotal = amount;
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const totalAmount = subtotal + taxAmount;

    const { error } = await supabase.from('invoices').insert({
      project_id: project!.id,
      client_id: client!.id,
      invoice_number: invoiceForm.invoice_number.trim(),
      title: `Invoice for ${project!.title}`,
      items: [{ description: invoiceForm.description.trim(), quantity: 1, unit_price: subtotal }],
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: 'sent',
      due_date: invoiceForm.due_date || null,
      notes: invoiceForm.notes.trim(),
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Invoice created and shared with the client!');
      setInvoiceForm({ invoice_number: '', description: '', amount: '', tax_rate: '0', due_date: '', notes: '' });
      loadProject(project!.id);
    }
  }

  async function toggleInvoicePaid(inv: Invoice) {
    const nextStatus = inv.status === 'paid' ? 'sent' : 'paid';
    const { error } = await supabase.from('invoices').update({ status: nextStatus }).eq('id', inv.id);
    if (error) toast.error(error.message);
    else loadProject(project!.id);
  }

  async function deleteInvoice(id: string) {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) toast.error(error.message);
    else loadProject(project!.id);
  }

  async function sendAgreement() {
    if (!agreementForm.title.trim() || !agreementForm.terms_text.trim()) {
      toast.error('Please enter an agreement title and terms.');
      return;
    }
    const { error } = await supabase.from('agreements').insert({
      project_id: project!.id,
      client_id: client!.id,
      title: agreementForm.title.trim(),
      terms_text: agreementForm.terms_text.trim(),
      status: 'sent',
      studio_signer_name: profile?.full_name || studio?.name || 'Studio Owner',
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Service agreement sent to client portal for signature!');
      loadProject(project!.id);
    }
  }

  async function deleteAgreement(id: string) {
    const { error } = await supabase.from('agreements').delete().eq('id', id);
    if (error) toast.error(error.message);
    else loadProject(project!.id);
  }

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-64 bg-muted rounded" /><div className="h-64 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      <Link href="/admin/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Projects
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl">{project?.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{client?.bride_name} & {client?.groom_name}</p>
        </div>
        <Badge variant={project?.status === 'completed' ? 'default' : 'outline'} className="text-sm px-3 py-1">
          {project?.status === 'completed' ? 'Completed' : project?.status === 'on_hold' ? 'On Hold' : 'Active'}
        </Badge>
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="w-3.5 h-3.5" /> Event Date</div><p className="font-medium text-sm">{formatDate(project?.event_date || null)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><MapPin className="w-3.5 h-3.5" /> Venue</div><p className="font-medium text-sm truncate">{project?.event_venue || 'Not set'}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Package</div><p className="font-medium text-sm">{formatCurrency(project?.package_amount || 0)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CheckCircle2 className="w-3.5 h-3.5" /> Progress</div><p className="font-medium text-sm">Stage {project?.current_stage}/10</p></Card>
      </div>

      <Tabs defaultValue="stages">
        <TabsList className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="stages"><CheckCircle2 className="w-4 h-4 mr-2" /> Stages</TabsTrigger>
          <TabsTrigger value="team"><Users className="w-4 h-4 mr-2" /> Team</TabsTrigger>
          <TabsTrigger value="media"><ImageIcon className="w-4 h-4 mr-2" /> Media</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="w-4 h-4 mr-2" /> Chat</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="w-4 h-4 mr-2" /> Payments</TabsTrigger>
          <TabsTrigger value="invoices"><Receipt className="w-4 h-4 mr-2" /> Invoices</TabsTrigger>
          <TabsTrigger value="agreement"><FileSignature className="w-4 h-4 mr-2" /> Agreement</TabsTrigger>
        </TabsList>

        {/* STAGES TAB */}
        <TabsContent value="stages">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg">Project Progress Timeline</h3>
              <Button size="sm" variant="outline" onClick={ensureStages}>Initialize Stages</Button>
            </div>
            {stages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm mb-3">No stages initialized yet.</p>
                <Button size="sm" onClick={ensureStages} className="bg-gradient-luxe text-white">Initialize 10 Stages</Button>
              </div>
            ) : (
              <div className="space-y-1">
                {stages.map((stage, i) => (
                  <div key={stage.id} className="flex items-start gap-4 group">
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        stage.status === 'completed' ? 'bg-success text-success-foreground' :
                        stage.status === 'in_progress' ? 'bg-warning text-warning-foreground' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {stage.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                         stage.status === 'in_progress' ? <Clock className="w-4 h-4" /> :
                         <span className="text-sm font-medium">{stage.stage_number}</span>}
                      </div>
                      {i < stages.length - 1 && <div className={`w-0.5 h-12 ${stage.status === 'completed' ? 'bg-success' : 'bg-border'}`} />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-medium ${stage.status === 'completed' ? 'text-muted-foreground line-through' : ''}`}>
                            {stage.stage_name}
                          </p>
                          {stage.completed_at && <p className="text-xs text-muted-foreground">Completed {formatDate(stage.completed_at)}</p>}
                          {stage.notes && <p className="text-xs text-muted-foreground mt-1">{stage.notes}</p>}
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

        {/* TEAM TAB */}
        <TabsContent value="team">
          <Card className="p-6">
            <h3 className="font-serif text-lg mb-4">Assigned Team Members</h3>
            {assignments.length > 0 ? (
              <div className="space-y-2 mb-6">
                {assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group">
                    <div className="flex items-center gap-3">
                      <Avatar><AvatarFallback className="bg-primary/10 text-primary">{getInitials(a.profile?.full_name || '')}</AvatarFallback></Avatar>
                      <div>
                        <p className="font-medium text-sm">{a.profile?.full_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{a.role.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <button onClick={() => removeAssignment(a.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No team members assigned yet.</p>
            )}
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-3">Assign New Member</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select onValueChange={v => {
                  const member = teamMembers.find(m => m.id === v);
                  if (member) assignTeamMember(v, 'editor');
                }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select team member" /></SelectTrigger>
                  <SelectContent>
                    {teamMembers.filter(m => !assignments.some(a => a.user_id === m.id)).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* MEDIA TAB */}
        <TabsContent value="media">
          <Card className="p-6">
            <h3 className="font-serif text-lg mb-4">Media Gallery</h3>
            {/* Upload form */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 rounded-lg bg-muted/50">
              <Input placeholder="Media file URL (e.g. https://...)" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className="flex-1" />
              <Input placeholder="Title (optional)" value={mediaTitle} onChange={e => setMediaTitle(e.target.value)} className="w-full sm:w-40" />
              <Select value={mediaCategory} onValueChange={setMediaCategory}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEDIA_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={addMedia} className="bg-gradient-luxe text-white shrink-0"><Upload className="w-4 h-4 mr-2" /> Add</Button>
            </div>

            {media.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No media uploaded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {media.map(item => (
                  <div key={item.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted/30">
                    {item.file_type === 'video' ? (
                      <video src={item.file_url} className="w-full h-40 object-cover" controls />
                    ) : (
                      <img src={item.file_url} alt={item.title} className="w-full h-40 object-cover" />
                    )}
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium truncate">{item.title || MEDIA_CATEGORIES.find(c => c.value === item.category)?.label}</p>
                        {item.file_type === 'video' && <Video className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.created_at)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {!item.approved ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approveMedia(item.id)}>Approve</Button>
                        ) : (
                          <Badge variant="default" className="text-xs">Approved</Badge>
                        )}
                        <button onClick={() => deleteMedia(item.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-auto">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* CHAT TAB */}
        <TabsContent value="chat">
          <Card className="p-0 overflow-hidden">
            <div className="h-[500px] flex flex-col">
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No messages yet. Start the conversation.</p>
                  </div>
                ) : messages.map(msg => {
                  const isOwn = msg.sender_id === profile?.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-2 max-w-[75%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {!isOwn && <Avatar className="w-8 h-8 shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(msg.sender?.full_name || '')}</AvatarFallback></Avatar>}
                        <div>
                          {!isOwn && <p className="text-xs text-muted-foreground mb-1 px-1">{msg.sender?.full_name}</p>}
                          <div className={`rounded-2xl px-4 py-2 ${isOwn ? 'bg-gradient-luxe text-white' : 'bg-muted'}`}>
                            <p className="text-sm">{msg.content}</p>
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 px-1 ${isOwn ? 'text-right' : ''}`}>{timeAgo(msg.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="flex-1"
                />
                <Button onClick={sendMessage} size="icon" className="bg-gradient-luxe text-white shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* PAYMENTS TAB */}
        <TabsContent value="payments">
          <Card className="p-6">
            <h3 className="font-serif text-lg mb-4">Payment Records</h3>
            {/* Add payment form */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 rounded-lg bg-muted/50">
              <Input type="number" placeholder="Amount (₹)" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full sm:w-32" />
              <Select value={paymentForm.type} onValueChange={v => setPaymentForm({ ...paymentForm, type: v })}>
                <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="balance">Balance</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={paymentForm.due_date} onChange={e => setPaymentForm({ ...paymentForm, due_date: e.target.value })} className="w-full sm:w-44" />
              <Button onClick={addPayment} className="bg-gradient-luxe text-white shrink-0"><Plus className="w-4 h-4 mr-2" /> Add</Button>
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No payment records yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map(pay => (
                  <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${pay.status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm capitalize">{pay.payment_type} Payment — {formatCurrency(pay.amount)}</p>
                        <p className="text-xs text-muted-foreground">{pay.due_date ? `Due ${formatDate(pay.due_date)}` : ''} {pay.paid_at ? `· Paid ${formatDate(pay.paid_at)}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => togglePaymentStatus(pay)} className="h-8 text-xs">
                        {pay.status === 'paid' ? 'Mark Pending' : 'Mark Paid'}
                      </Button>
                      <button onClick={() => deletePayment(pay.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* INVOICES TAB */}
        <TabsContent value="invoices">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-serif text-lg">Invoice Generator</h3>
              <p className="text-sm text-muted-foreground">Create branded invoices that your client can view and download as PDF.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-lg bg-muted/50">
              <Input
                placeholder="Invoice #"
                value={invoiceForm.invoice_number}
                onChange={e => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
              />
              <Input
                placeholder="Service description"
                value={invoiceForm.description}
                onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                className="lg:col-span-2"
              />
              <Input
                type="number"
                placeholder="Amount"
                value={invoiceForm.amount}
                onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Tax %"
                value={invoiceForm.tax_rate}
                onChange={e => setInvoiceForm({ ...invoiceForm, tax_rate: e.target.value })}
              />
              <Input
                type="date"
                value={invoiceForm.due_date}
                onChange={e => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
              />
              <Input
                placeholder="Notes (optional)"
                value={invoiceForm.notes}
                onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                className="sm:col-span-2 lg:col-span-3"
              />
              <Button onClick={createInvoice} className="bg-gradient-luxe text-white">
                <Plus className="w-4 h-4 mr-2" /> Generate Invoice
              </Button>
            </div>

            {invoices.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No invoices generated for this project yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-sm">{inv.invoice_number}</span>
                        <Badge variant={inv.status === 'paid' ? 'default' : 'outline'} className="capitalize">{inv.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total: {formatCurrency(inv.total_amount, studio?.currency)} · Issued {formatDate(inv.issued_at)}
                        {inv.due_date ? ` · Due ${formatDate(inv.due_date)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPreviewInvoice(inv)} className="h-8 text-xs">
                        <Eye className="w-3.5 h-3.5 mr-1" /> View / PDF
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleInvoicePaid(inv)} className="h-8 text-xs">
                        {inv.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                      </Button>
                      <button onClick={() => deleteInvoice(inv.id)} className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* AGREEMENT TAB */}
        <TabsContent value="agreement">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-serif text-lg">Service Agreement &amp; Digital Signature</h3>
              <p className="text-sm text-muted-foreground">Send a service agreement to your client. They can sign it digitally from their portal.</p>
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <div className="space-y-1.5">
                <Label>Agreement Title</Label>
                <Input
                  value={agreementForm.title}
                  onChange={e => setAgreementForm({ ...agreementForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Agreement Terms</Label>
                <textarea
                  rows={7}
                  value={agreementForm.terms_text}
                  onChange={e => setAgreementForm({ ...agreementForm, terms_text: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button onClick={sendAgreement} className="bg-gradient-luxe text-white">
                <Send className="w-4 h-4 mr-2" /> Send Agreement to Client
              </Button>
            </div>

            {agreements.length > 0 && (
              <div className="space-y-2">
                {agreements.map(agr => (
                  <div key={agr.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{agr.title}</span>
                        <Badge variant={agr.status === 'signed' ? 'default' : 'outline'} className="capitalize">
                          {agr.status === 'signed' ? 'Signed' : agr.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {agr.status === 'signed'
                          ? `Signed by ${agr.client_signer_name} on ${formatDate(agr.signed_at)}`
                          : `Sent on ${formatDate(agr.created_at)} · Waiting for client signature`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPreviewAgreement(agr)} className="h-8 text-xs">
                        <Eye className="w-3.5 h-3.5 mr-1" /> View / PDF
                      </Button>
                      {agr.status !== 'signed' && (
                        <button onClick={() => deleteAgreement(agr.id)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <InvoicePreviewDialog
        invoice={previewInvoice}
        open={!!previewInvoice}
        onOpenChange={(o) => { if (!o) setPreviewInvoice(null); }}
        studio={studio}
        client={client}
        project={project}
      />

      <AgreementPreviewDialog
        agreement={previewAgreement}
        open={!!previewAgreement}
        onOpenChange={(o) => { if (!o) setPreviewAgreement(null); }}
        studio={studio}
        client={client}
        project={project}
      />
    </div>
  );
}
