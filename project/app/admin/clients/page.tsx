'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Users, Plus, Search, Mail, Phone, Trash2 } from 'lucide-react';
import { getInitials, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { Client } from '@/types/database';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ bride_name: '', groom_name: '', email: '', phone: '', address: '', notes: '' });

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    setClients(data || []);
    setLoading(false);
  }

  async function createClient() {
    if (!form.email || !form.bride_name) {
      toast.error('Email and bride name are required');
      return;
    }
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('clients').insert({
      ...form,
      created_by: userData.user?.id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Client created successfully');
      setForm({ bride_name: '', groom_name: '', email: '', phone: '', address: '', notes: '' });
      setDialogOpen(false);
      loadClients();
    }
    setCreating(false);
  }

  async function deleteClient(id: string) {
    if (!confirm('Delete this client and all their projects? This cannot be undone.')) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Client deleted');
      loadClients();
    }
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q ||
      c.bride_name?.toLowerCase().includes(q) ||
      c.groom_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Clients"
        description="Manage your studio's client roster"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-luxe text-white hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Add New Client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bride's Name</Label>
                    <Input value={form.bride_name} onChange={e => setForm({ ...form, bride_name: e.target.value })} placeholder="Jane" />
                  </div>
                  <div className="space-y-2">
                    <Label>Groom's Name</Label>
                    <Input value={form.groom_name} onChange={e => setForm({ ...form, groom_name: e.target.value })} placeholder="John" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jane@email.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 890" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Special requests..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={createClient} disabled={creating} className="bg-gradient-luxe text-white">
                  {creating ? 'Creating...' : 'Create Client'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No clients yet</h3>
          <p className="text-muted-foreground text-sm">Add your first client to start managing their projects.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => (
            <Card key={client.id} className="p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-4">
                <Link href={`/admin/clients/${client.id}`} className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-serif">
                      {getInitials(`${client.bride_name} ${client.groom_name}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">
                      {client.bride_name} & {client.groom_name}
                    </p>
                    <p className="text-xs text-muted-foreground">Since {formatDate(client.created_at)}</p>
                  </div>
                </Link>
                <button
                  onClick={() => deleteClient(client.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" /> <span className="truncate">{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {client.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant={client.user_id ? 'default' : 'outline'}>
                    {client.user_id ? 'Has Portal Access' : 'No Portal Access'}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
