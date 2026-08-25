'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && profile) {
      redirectByRole(profile.role, router);
    }
  }, [user, profile, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: "linear-gradient(135deg, rgba(112, 24, 45, 0.85), rgba(59, 12, 27, 0.72)), url('https://images.pexels.com/photos/17000484/pexels-photo-17000484.jpeg?auto=compress&cs=tinysrgb&h=1200&w=900')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.15) 0%, transparent 50%)'
        }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <span className="font-serif text-2xl tracking-wide">Vaibhavam CRM</span>
          </div>
          <div>
            <Sparkles className="w-8 h-8 mb-4 opacity-80" />
            <h1 className="font-serif text-4xl xl:text-5xl leading-tight mb-4 max-w-md">
              Where every love story finds its perfect frame
            </h1>
            <p className="text-white/80 text-lg max-w-sm">
              The studio management platform for premier wedding & events photography teams.
            </p>
          </div>
          <div className="flex gap-8 text-sm text-white/70">
            <div>
              <div className="text-2xl font-serif text-white">500+</div>
              <div>Events Captured</div>
            </div>
            <div>
              <div className="text-2xl font-serif text-white">12+</div>
              <div>Years of Artistry</div>
            </div>
            <div>
              <div className="text-2xl font-serif text-white">98%</div>
              <div>Client Satisfaction</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-luxe flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif text-xl text-gradient-luxe">Vaibhavam CRM</span>
          </div>

          <h2 className="font-serif text-3xl mb-2">Welcome back</h2>
          <p className="text-muted-foreground mb-8">Sign in to your studio dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@studio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 animate-scale-in">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-gradient-luxe hover:opacity-90 text-white font-medium"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Vaibhavam CRM · Studio access only
          </p>

          <p className="text-center text-sm text-muted-foreground mt-4">
            New client?{' '}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function redirectByRole(role: string, router: ReturnType<typeof useRouter>) {
  if (role === 'super_admin') router.push('/admin');
  else if (role === 'editor') router.push('/editor');
  else router.push('/portal');
}
