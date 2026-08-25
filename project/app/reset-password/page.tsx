'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Camera, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setSubmitting(false);
    } else {
      toast.success('Password reset successful! Please log in with your new password.');
      router.push('/');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm animate-fade-in space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-luxe flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif text-xl text-gradient-luxe">Vaibhavam CRM</span>
          </Link>
          <h2 className="font-serif text-3xl mt-4">Reset Password</h2>
          <p className="text-muted-foreground text-sm">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 animate-scale-in">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-gradient-luxe hover:opacity-90 text-white font-medium animate-pulse-subtle"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Back to{' '}
          <Link href="/" className="text-primary hover:underline font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
