'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CurrencyCode } from '@/types/database';
import { Camera, Eye, EyeOff, Loader2, Sparkles, Building2, User, Phone, Mail, Lock, Globe } from 'lucide-react';

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

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export default function RegisterStudioPage() {
  const router = useRouter();
  const { user, profile, loading, signIn } = useAuth();

  const [studioName, setStudioName] = useState('');
  const [studioSlug, setStudioSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'super_admin') router.push('/admin');
      else if (profile.role === 'editor') router.push('/editor');
      else router.push('/portal');
    }
  }, [user, profile, loading, router]);

  function handleStudioNameChange(val: string) {
    setStudioName(val);
    if (!slugEdited) {
      setStudioSlug(toSlug(val));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (studioName.trim().length < 2) {
      setError('Please enter your photography studio name.');
      return;
    }
    if (password.length < 8) {
      setError('Please choose a password with at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/register-studio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey || '',
        },
        body: JSON.stringify({
          studio_name: studioName.trim(),
          studio_slug: studioSlug.trim() || toSlug(studioName),
          currency,
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create your studio. Please try again.');
        setSubmitting(false);
        return;
      }

      // Sign the studio owner in right away
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        router.push('/');
        return;
      }
      router.push('/admin');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: "linear-gradient(135deg, rgba(112, 24, 45, 0.88), rgba(59, 12, 27, 0.78)), url('/signup-bg.png')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <span className="font-serif text-2xl tracking-wide">SureShotz</span>
          </Link>
          <div>
            <Sparkles className="w-8 h-8 mb-4 opacity-80" />
            <h1 className="font-serif text-4xl xl:text-5xl leading-tight mb-4 max-w-md">
              Run your photography business in one place
            </h1>
            <p className="text-white/80 text-base max-w-md leading-relaxed">
              Manage clients, 10-step wedding workflows, team editors, photo &amp; video deliveries, and payments — with a 14-day free trial.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md text-sm">
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="font-semibold">10 GB</div>
                <div className="text-white/75 text-xs">Free trial storage</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="font-semibold">15 Projects</div>
                <div className="text-white/75 text-xs">Included in trial</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="font-semibold">3 Team</div>
                <div className="text-white/75 text-xs">Admin &amp; editors</div>
              </div>
            </div>
          </div>
          <p className="text-white/60 text-xs">
            Built for wedding &amp; event photography studios
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-luxe flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif text-xl">SureShotz</span>
          </div>

          <h2 className="font-serif text-3xl mb-2">Start your free studio trial</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Set up your photography studio account in less than a minute. No credit card needed.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="studioName">Studio / Business Name</Label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <Input
                  id="studioName"
                  required
                  value={studioName}
                  onChange={e => handleStudioNameChange(e.target.value)}
                  placeholder="e.g. Royal Lens Photography"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="studioSlug">Studio Web Name</Label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    id="studioSlug"
                    required
                    value={studioSlug}
                    onChange={e => { setSlugEdited(true); setStudioSlug(toSlug(e.target.value)); }}
                    placeholder="royal-lens"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Your Full Name</Label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    id="fullName"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Arjun Rao"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    id="phone"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Business Email</Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="owner@royallens.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password (at least 8 characters)</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-gradient-luxe hover:opacity-90 text-white font-medium"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create My Studio Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have a studio account?{' '}
            <Link href="/" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

