'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { Profile, Studio } from '@/types/database';

function hexToHsl(hex: string): { hsl: string; darkHsl: string } | null {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  const darkLPct = Math.max(10, lPct - 8);
  return {
    hsl: `${hDeg} ${sPct}% ${lPct}%`,
    darkHsl: `${hDeg} ${sPct}% ${darkLPct}%`,
  };
}

function applyStudioTheme(brandColor?: string | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!brandColor) return;
  const parsed = hexToHsl(brandColor);
  if (!parsed) return;
  root.style.setProperty('--primary', parsed.hsl);
  root.style.setProperty('--primary-dark', parsed.darkHsl);
  root.style.setProperty('--ring', parsed.hsl);
  root.style.setProperty('--chart-1', parsed.hsl);
  root.style.setProperty('--accent-foreground', parsed.darkHsl);
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  studio: Studio | null;
  loading: boolean;
  refreshStudio: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStudio = useCallback(async (studioId?: string | null) => {
    if (!studioId) {
      setStudio(null);
      return;
    }
    const { data, error } = await supabase
      .from('studios')
      .select('*')
      .eq('id', studioId)
      .maybeSingle();
    if (!error && data) {
      const nextStudio = data as Studio;
      setStudio(nextStudio);
      applyStudioTheme(nextStudio.brand_color);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    await loadStudio(data?.studio_id);
    setLoading(false);
  }, [loadStudio]);

  const refreshStudio = useCallback(async () => {
    if (profile?.studio_id) {
      await loadStudio(profile.studio_id);
    }
  }, [profile?.studio_id, loadStudio]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setStudio(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Real-time branding sync across all open tabs for this studio
  useEffect(() => {
    if (!studio?.id) return;
    const channel = supabase
      .channel(`studio-branding-${studio.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'studios', filter: `id=eq.${studio.id}` },
        (payload) => {
          const updated = payload.new as Studio;
          setStudio(updated);
          applyStudioTheme(updated.brand_color);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studio?.id]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string, phone: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, role: 'client' } },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setStudio(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, studio, loading, refreshStudio, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
