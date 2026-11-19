'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getInitials, formatFileSize, formatDate } from '@/lib/format';
import type { CurrencyCode } from '@/types/database';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { Save, Building2, HardDrive } from 'lucide-react';

const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'INR', label: 'INR (₹) — Indian Rupee' },
  { value: 'USD', label: 'USD ($) — US Dollar' },
  { value: 'GBP', label: 'GBP (£) — British Pound' },
  { value: 'EUR', label: 'EUR (€) — Euro' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'AUD', label: 'AUD ($) — Australian Dollar' },
  { value: 'CAD', label: 'CAD ($) — Canadian Dollar' },
  { value: 'SGD', label: 'SGD ($) — Singapore Dollar' },
];

const PLAN_LABELS: Record<string, string> = {
  free_trial: '14-Day Free Trial',
  starter: 'Starter Plan',
  pro: 'Pro Plan',
  studio: 'Studio Plan',
};

export default function AdminSettingsPage() {
  const { profile, studio, user, refreshStudio } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [studioName, setStudioName] = useState(studio?.name || '');
  const [currency, setCurrency] = useState<CurrencyCode>(studio?.currency || 'INR');
  const [brandColor, setBrandColor] = useState(studio?.brand_color || '#b8860b');
  const [savingStudio, setSavingStudio] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (studio) {
      setStudioName(studio.name || '');
      setCurrency(studio.currency || 'INR');
      setBrandColor(studio.brand_color || '#b8860b');
    }
  }, [studio]);

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq('id', profile.id);
    if (error) toast.error(error.message);
    else toast.success('Your profile has been updated.');
    setSavingProfile(false);
  }

  async function saveStudio() {
    if (!studio) return;
    if (studioName.trim().length < 2) {
      toast.error('Please enter a valid studio name.');
      return;
    }
    setSavingStudio(true);
    const { error } = await supabase
      .from('studios')
      .update({
        name: studioName.trim(),
        currency,
        brand_color: brandColor,
      })
      .eq('id', studio.id);
    if (error) {
      toast.error(error.message);
    } else {
      await refreshStudio();
      toast.success('Studio settings saved.');
    }
    setSavingStudio(false);
  }

  const storageLimit = studio?.storage_limit_bytes || 0;
  const storageUsed = studio?.storage_used_bytes || 0;
  const storagePercent = storageLimit > 0 ? Math.min(100, Math.round((storageUsed / storageLimit) * 100)) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in space-y-6">
      <PageHeader title="Settings" description="Manage your account, studio details, and storage plan" />

      {/* Personal Profile */}
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-16 h-16 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-serif text-xl">{getInitials(fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-serif text-lg">{fullName || 'Studio Owner'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-primary mt-1">Studio Owner</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email (cannot be changed)</Label>
            <Input value={user?.email || ''} disabled className="bg-muted/50" />
          </div>
          <Button onClick={saveProfile} disabled={savingProfile} className="bg-gradient-luxe text-white">
            <Save className="w-4 h-4 mr-2" /> {savingProfile ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </Card>

      {/* Studio Branding & Currency */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="font-serif text-lg">Studio Details</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          This name and currency appear across your team dashboard and client portal.
        </p>

        {studio ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Studio Name</Label>
                <Input value={studioName} onChange={e => setStudioName(e.target.value)} placeholder="Your Studio Name" />
              </div>
              <div className="space-y-2">
                <Label>Studio Web Name</Label>
                <Input value={studio.slug} disabled className="bg-muted/50" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={v => setCurrency(v as CurrencyCode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Brand Accent Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={brandColor}
                    onChange={e => setBrandColor(e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input value={brandColor} onChange={e => setBrandColor(e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>

            <Button onClick={saveStudio} disabled={savingStudio} className="bg-gradient-luxe text-white">
              <Save className="w-4 h-4 mr-2" /> {savingStudio ? 'Saving...' : 'Save Studio Details'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Studio settings will appear here once the multi-tenant database update is applied.
          </p>
        )}
      </Card>

      {/* Plan & Storage Usage */}
      {studio && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              <h3 className="font-serif text-lg">Plan &amp; Storage</h3>
            </div>
            <Badge variant={studio.subscription_status === 'active' || studio.subscription_status === 'trialing' ? 'default' : 'destructive'}>
              {PLAN_LABELS[studio.plan] || studio.plan} · {studio.subscription_status}
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium">Media Storage Used</span>
                <span className="text-muted-foreground">
                  {formatFileSize(storageUsed)} of {formatFileSize(storageLimit)} ({storagePercent}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${storagePercent >= 90 ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-sm">
              <div className="p-3 rounded-lg bg-muted/40">
                <div className="text-muted-foreground text-xs">Project Limit</div>
                <div className="font-semibold mt-0.5">{studio.max_projects} projects</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <div className="text-muted-foreground text-xs">Team Limit</div>
                <div className="font-semibold mt-0.5">{studio.max_team_members} members</div>
              </div>
              {studio.subscription_status === 'trialing' && studio.trial_ends_at && (
                <div className="p-3 rounded-lg bg-muted/40">
                  <div className="text-muted-foreground text-xs">Free Trial Ends</div>
                  <div className="font-semibold mt-0.5">{formatDate(studio.trial_ends_at)}</div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

