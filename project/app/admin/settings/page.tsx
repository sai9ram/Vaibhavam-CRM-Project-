'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/format';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { Save, User } from 'lucide-react';

export default function AdminSettingsPage() {
  const { profile, user } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile!.id);
    if (error) toast.error(error.message);
    else toast.success('Profile updated');
    setSaving(false);
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <PageHeader title="Settings" description="Manage your account and studio preferences" />

      <Card className="p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-16 h-16 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-serif text-xl">{getInitials(fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-serif text-lg">{fullName || 'Admin'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-primary mt-1">Super Admin</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 890" />
          </div>
          <div className="space-y-2">
            <Label>Email (read-only)</Label>
            <Input value={user?.email || ''} disabled className="bg-muted/50" />
          </div>
          <Button onClick={saveProfile} disabled={saving} className="bg-gradient-luxe text-white">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg mb-2">Studio Information</h3>
        <p className="text-sm text-muted-foreground mb-4">Your studio details appear on the client portal.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Studio Name</Label><Input defaultValue="Vaibhavam CRM" /></div>
          <div className="space-y-2"><Label>Support Email</Label><Input defaultValue="support@vaibhavam.com" /></div>
        </div>
      </Card>
    </div>
  );
}
