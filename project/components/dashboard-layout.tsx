'use client';

import { ReactNode, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Camera, LayoutDashboard, Users, FolderKanban, UserCog,
  Image, MessageSquare, BarChart3, LogOut, Menu, Settings, Calendar,
} from 'lucide-react';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Clients', href: '/admin/clients', icon: Users },
  { label: 'Projects', href: '/admin/projects', icon: FolderKanban },
  { label: 'Team', href: '/admin/team', icon: UserCog },
  { label: 'Media', href: '/admin/media', icon: Image },
  { label: 'Messages', href: '/admin/messages', icon: MessageSquare },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

const editorNav: NavItem[] = [
  { label: 'Dashboard', href: '/editor', icon: LayoutDashboard },
  { label: 'My Projects', href: '/editor/projects', icon: FolderKanban },
  { label: 'Media Upload', href: '/editor/media', icon: Image },
  { label: 'Messages', href: '/editor/messages', icon: MessageSquare },
];

const clientNav: NavItem[] = [
  { label: 'My Project', href: '/portal', icon: LayoutDashboard },
  { label: 'Timeline', href: '/portal/timeline', icon: Calendar },
  { label: 'Gallery', href: '/portal/gallery', icon: Image },
  { label: 'Messages', href: '/portal/messages', icon: MessageSquare },
  { label: 'Payments', href: '/portal/payments', icon: BarChart3 },
];

export function DashboardLayout({ children, role }: { children: ReactNode; role: 'admin' | 'editor' | 'client' }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = role === 'admin' ? adminNav : role === 'editor' ? editorNav : clientNav;
  const roleLabel = role === 'admin' ? 'Super Admin' : role === 'editor' ? 'Editor' : 'Client';

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  function NavList() {
    return (
      <nav className="space-y-1 px-3">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== `/${role === 'admin' ? 'admin' : role === 'editor' ? 'editor' : 'portal'}` && pathname.startsWith(item.href));
          return (
            <button
              key={item.href}
              onClick={() => { router.push(item.href); setMobileOpen(false); }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <item.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              {item.label}
            </button>
          );
        })}
      </nav>
    );
  }

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-gradient-luxe flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-serif text-lg leading-none">Vaibhavam CRM</div>
            <div className="text-xs text-muted-foreground mt-0.5">CRM Platform</div>
          </div>
        </div>

        <div className="flex-1 py-4 overflow-y-auto scrollbar-thin">
          <NavList />
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {getInitials(profile?.full_name || 'User')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profile?.full_name || 'User'}</div>
              <div className="text-xs text-muted-foreground">{roleLabel}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-card border border-border">
            <Menu className="w-5 h-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
