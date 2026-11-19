'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Loader2 } from 'lucide-react';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !profile) router.push('/');
    if (!loading && profile && profile.role !== 'client') {
      if (profile.role === 'super_admin') router.push('/admin');
      else router.push('/editor');
    }
  }, [profile, loading, router]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (profile.role !== 'client') return null;

  return <DashboardLayout role="client">{children}</DashboardLayout>;
}
