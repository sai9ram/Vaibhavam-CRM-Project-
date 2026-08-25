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
import { ArrowLeft, Mail, Phone, MapPin, Calendar, DollarSign, FolderKanban, KeyRound } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';
import { STAGE_NAMES } from '@/types/database';
import { toast } from 'sonner';
import type { Client, Project, Payment } from '@/types/database';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ bride_name: '', groom_name: '', email: '', phone: '', address: '', notes: '' });

  useEffect(() => {
    if (params.id) loadClient(params.id as string);
  }, [params.id]);

  async function loadClient(id: string) {
    const { data: clientData } = await supabase.from('clients').select('*').eq('id', id).single();
    if (!clientData) { router.push('/admin/clients'); return; }
    setClient(clientData);
    setForm({
      bride_name: clientData.bride_name, groom_name: clientData.groom_name,
      email: clientData.email, phone: clientData.phone,
      address: clientData.address, notes: clientData.notes,
    });
    const [{ data: projData }, { data: payData }] = await Promise.all([
      supabase.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ]);
    setProjects(projData || []);
    setPayments(payData || []);
    setLoading(false);
  }

  async function saveClient() {
    const { error } = await supabase.from('clients').update(form).eq('id', client!.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Client updated');
      setEditMode(false);
      loadClient(client!.id);
    }
  }

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 w-64 bg-muted rounded" /><div className="h-40 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <Link href="/admin/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Clients
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl">{client?.bride_name} & {client?.groom_name}</h1>
          <p className="text-muted-foreground text-sm mt-1">Client since {formatDate(client?.created_at || null)}</p>
        </div>
        <Button variant="outline" onClick={() => setEditMode(!editMode)}>
          {editMode ? 'Cancel' : 'Edit Client'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Client info */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-serif text-lg mb-4">Contact Information</h3>
          {editMode ? (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">Bride Name</Label><Input value={form.bride_name} onChange={e => setForm({ ...form, bride_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Groom Name</Label><Input value={form.groom_name} onChange={e => setForm({ ...form, groom_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={saveClient} className="w-full bg-gradient-luxe text-white">Save Changes</Button>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-muted-foreground"><Mail className="w-4 h-4" /> {client?.email}</div>
              {client?.phone && <div className="flex items-center gap-3 text-muted-foreground"><Phone className="w-4 h-4" /> {client.phone}</div>}
              {client?.address && <div className="flex items-center gap-3 text-muted-foreground"><MapPin className="w-4 h-4" /> {client.address}</div>}
              {client?.notes && <div className="pt-2 border-t border-border"><p className="text-xs text-muted-foreground mb-1">Notes</p><p>{client.notes}</p></div>}
              <div className="pt-2 border-t border-border">
                <Badge variant={client?.user_id ? 'default' : 'outline'}>
                  <KeyRound className="w-3 h-3 mr-1" />
                  {client?.user_id ? 'Portal Access Enabled' : 'No Portal Access'}
                </Badge>
              </div>
            </div>
          )}
        </Card>

        {/* Projects */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg">Projects ({projects.length})</h3>
            <Link href="/admin/projects"><Button size="sm" variant="outline">New Project</Button></Link>
          </div>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No projects yet for this client.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map(project => (
                <Link key={project.id} href={`/admin/projects/${project.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group">
                  <div className="min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">{project.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" /> {formatDate(project.event_date)} · {project.event_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">{formatCurrency(project.package_amount)}</p>
                      <p className="text-xs">Stage {project.current_stage}/10</p>
                    </div>
                    <Badge variant={project.status === 'completed' ? 'default' : 'outline'}>
                      {project.status === 'completed' ? 'Completed' : project.status === 'on_hold' ? 'On Hold' : 'Active'}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Payments */}
      <Card className="p-5 mt-4">
        <h3 className="font-serif text-lg mb-4">Payment History</h3>
        {payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No payments recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map(pay => (
              <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium capitalize">{pay.payment_type} Payment</p>
                  <p className="text-xs text-muted-foreground">{formatDate(pay.paid_at || pay.due_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-lg">{formatCurrency(pay.amount)}</span>
                  <Badge variant={pay.status === 'paid' ? 'default' : 'outline'}>{pay.status === 'paid' ? 'Paid' : 'Pending'}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
