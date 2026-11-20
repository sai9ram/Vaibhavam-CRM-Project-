'use client';

import { useEffect, useRef, useState } from 'react';
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
import { Save, Building2, HardDrive, Palette, Upload, Trash2, Camera, Check } from 'lucide-react';

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

const COLOR_PALETTES = [
  { name: 'Royal Crimson', color: '#82172f' },
  { name: 'Champagne Gold', color: '#b8860b' },
  { name: 'Emerald Forest', color: '#0f766e' },
  { name: 'Midnight Slate', color: '#1e293b' },
  { name: 'Plum Velvet', color: '#6d28d9' },
  { name: 'Warm Terracotta', color: '#c2410c' },
];

const PLAN_LABELS: Record<string, string> = {
  free_trial: '14-Day Free Trial',
  starter: 'Starter Plan',
  pro: 'Pro Plan',
  studio: 'Studio Plan',
};

function resizeImageToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas is not supported in this browser.'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', 0.9));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminSettingsPage() {
  const { profile, studio, user, refreshStudio } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [studioName, setStudioName] = useState(studio?.name || '');
  const [currency, setCurrency] = useState<CurrencyCode>(studio?.currency || 'INR');
  const [brandColor, setBrandColor] = useState(studio?.brand_color || '#82172f');
  const [logoUrl, setLogoUrl] = useState(studio?.logo_url || '');
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
      setBrandColor(studio.brand_color || '#82172f');
      setLogoUrl(studio.logo_url || '');
    }
  }, [studio]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, JPG, or WebP).');
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setLogoUrl(dataUrl);
      toast.success('Logo loaded! Click "Save Studio Design" to apply it everywhere.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load logo.');
    }
  }

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
    const { data: updatedStudio, error } = await supabase
      .from('studios')
      .update({
        name: studioName.trim(),
        currency,
        brand_color: brandColor,
        logo_url: logoUrl.trim(),
      })
      .eq('id', studio.id)
      .select()
      .single();
    if (error || !updatedStudio) {
      toast.error(error?.message || 'Could not save studio settings. Please check permissions and try again.');
    } else {
      await refreshStudio();
      toast.success('Studio design and settings updated live!');
    }
    setSavingStudio(false);
  }

  const storageLimit = studio?.storage_limit_bytes || 0;
  const storageUsed = studio?.storage_used_bytes || 0;
  const storagePercent = storageLimit > 0 ? Math.min(100, Math.round((storageUsed / storageLimit) * 100)) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in space-y-6">
      <PageHeader title="Settings" description="Manage your account, studio design, brand logo, and storage plan" />

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

      {/* Studio Design, Color Palette & Brand Logo */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="font-serif text-lg">Studio Design &amp; Branding</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Customize your studio name, brand logo, and color palette. Changes update across your dashboard and client portal in real time.
        </p>

        {studio ? (
          <div className="space-y-6">
            {/* Brand Logo */}
            <div className="space-y-2">
              <Label>Brand Logo</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Studio Logo Preview"
                    className="w-16 h-16 rounded-xl object-cover border border-border shrink-0"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: brandColor }}
                  >
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1.5" /> Upload Logo
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLogoUrl('')}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                      </Button>
                    )}
                  </div>
                  <Input
                    value={logoUrl.startsWith('data:') ? '' : logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    placeholder="Or paste a logo image URL (https://...)"
                    className="text-xs h-8"
                  />
                </div>
              </div>
            </div>

            {/* Studio Name & Currency */}
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

            {/* Color Palette Presets + Custom Picker */}
            <div className="space-y-3">
              <Label>Color Palette</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {COLOR_PALETTES.map(p => {
                  const selected = brandColor.toLowerCase() === p.color.toLowerCase();
                  return (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => setBrandColor(p.color)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left text-sm transition-all ${
                        selected ? 'border-foreground bg-muted/60 font-medium' : 'border-border hover:bg-muted/30'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                        style={{ background: p.color }}
                      >
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="color"
                  value={brandColor}
                  onChange={e => setBrandColor(e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  value={brandColor}
                  onChange={e => setBrandColor(e.target.value)}
                  placeholder="#82172f"
                  className="w-32 font-mono text-sm"
                />
                <span className="text-xs text-muted-foreground">Or pick any custom hex color</span>
              </div>
            </div>

            {/* Live Preview */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Preview</div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: brandColor }}>
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-serif text-base truncate">{studioName || 'Your Studio'}</div>
                    <div className="text-xs text-muted-foreground">Client &amp; Team Portal</div>
                  </div>
                </div>
                <span
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-white shrink-0"
                  style={{ background: brandColor }}
                >
                  Sample Button
                </span>
              </div>
            </div>

            <Button onClick={saveStudio} disabled={savingStudio} className="bg-gradient-luxe text-white">
              <Save className="w-4 h-4 mr-2" /> {savingStudio ? 'Saving...' : 'Save Studio Design'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Studio settings will appear here once your studio profile finishes loading.
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
