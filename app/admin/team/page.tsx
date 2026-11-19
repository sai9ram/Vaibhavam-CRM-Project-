'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { UserCog, Plus, Mail, Phone, Trash2, FolderKanban } from 'lucide-react';
import { getInitials, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { Profile, ProjectAssignment } from '@/types/database';

export default function TeamPage() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'editor', phone: '' });

  useEffect(() => { loadTeam(); }, []);

  async function loadTeam() {
    const { data: profiles } = await supabase.from('profiles').select('*').in('role', ['editor', 'super_admin']).order('full_name');
    const { data: assigns } = await supabase.from('project_assignments').select('user_id');
    const counts: Record<string, number> = {};
    (assigns || []).forEach(a => { counts[a.user_id] = (counts[a.user_id] || 0) + 1; });
    setAssignments(counts);
    setMembers(profiles || []);
    setLoading(false);
  }

  async function createMember() {
    if (!form.email || !form.password || !form.full_name) { toast.error('All fields required'); return; }
    setCreating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      toast.success('Team member created');
      setForm({ full_name: '', email: '', password: '', role: 'editor', phone: '' });
      setDialogOpen(false);
      loadTeam();
    } catch (err: any) {
      toast.error(err.message);
    }
    setCreating(false);
  }

  async function deleteMember(id: string) {
    if (!confirm('Remove this team member? Their project assignments will be removed.')) return;
    await supabase.from('project_assignments').delete().eq('user_id', id);
    setMembers(members.filter(m => m.id !== id));
    toast.success('Team member removed');
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <PageHeader
        title="Team Management"
        description="Manage editors and team members"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-luxe text-white hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" /> Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-serif text-xl">Add Team Member</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="John Smith" /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@studio.com" /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 890" /></div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor / Team Member</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={createMember} disabled={creating} className="bg-gradient-luxe text-white">{creating ? 'Creating...' : 'Create Member'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : members.length === 0 ? (
        <Card className="p-12 text-center">
          <UserCog className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="font-serif text-lg mb-2">No team members yet</h3>
          <p className="text-muted-foreground text-sm">Add editors and team members to assign them to projects.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map(member => (
            <Card key={member.id} className="p-5 group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-serif">{getInitials(member.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.full_name}</p>
                    <Badge variant={member.role === 'super_admin' ? 'default' : 'outline'} className="mt-1">
                      {member.role === 'super_admin' ? 'Super Admin' : 'Editor'}
                    </Badge>
                  </div>
                </div>
                {member.role !== 'super_admin' && (
                  <button onClick={() => deleteMember(member.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> <span className="truncate">{member.id === members[0]?.id ? '—' : 'Contact via profile'}</span></div>
                {member.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {member.phone}</div>}
                <div className="flex items-center gap-2"><FolderKanban className="w-3.5 h-3.5" /> {assignments[member.id] || 0} active project(s)</div>
                <div className="text-xs">Joined {formatDate(member.created_at)}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
