import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '@/api/auth';
import { isTauri } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  Landmark,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, id: 'nav_dashboard' },
  { to: '/users', label: 'Pengguna', icon: Users, id: 'nav_users' },
  { to: '/lembaga', label: 'Lembaga', icon: Landmark, id: 'nav_lembaga' },
  { to: '/tahun-ajaran', label: 'Tahun Ajaran', icon: CalendarDays, id: 'nav_tahun_ajaran' },
  { to: '/kelas', label: 'Kelas', icon: BookOpen, id: 'nav_kelas' },
  { to: '/pos', label: 'Pos', icon: Wallet, id: 'nav_pos' },
  { to: '/tarif', label: 'Tarif', icon: ReceiptText, id: 'nav_tarif' },
  { to: '/referensi', label: 'Referensi', icon: BookMarked, id: 'nav_referensi' },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings, id: 'nav_pengaturan' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logoutLocal } = useAuth();
  const { collapsed, setCollapsed } = useTheme();
  const nav = useNavigate();

  // Ctrl/Cmd+B: toggle sidebar (paritas VSCode).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        const el = document.activeElement;
        const typing =
          el instanceof HTMLElement &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (typing) return;
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed, setCollapsed]);

  async function onLogout() {
    await logout();
    await logoutLocal();
    nav('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <aside
        className={cn(
          'sticky top-0 flex h-screen shrink-0 flex-col gap-4 p-3 text-white transition-all',
          'max-md:sticky max-md:h-auto max-md:w-full',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
        style={{ background: 'linear-gradient(180deg, var(--sidebar-deep), var(--sidebar))' }}
      >
        <div className={cn('flex items-center gap-2 px-1', collapsed && 'justify-center')}>
          {!collapsed && (
            <div className="font-display text-[19px] font-extrabold leading-tight">
              SIMPES Admin
              <small className="block text-[11.5px] font-normal text-white/60">Sistem Pesantren</small>
            </div>
          )}
          <Button
            id="btn_sidebar"
            variant="ghost"
            size="icon"
            title={collapsed ? 'Tampilkan sidebar (Ctrl+B)' : 'Sembunyikan sidebar — ikon saja (Ctrl+B)'}
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-white hover:bg-white/10 hover:text-white max-md:hidden"
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </Button>
        </div>
        <nav className="flex flex-col gap-1 max-md:flex-row max-md:overflow-x-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              id={item.id}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm whitespace-nowrap',
                'text-[var(--sidebar-foreground)] hover:bg-white/10 hover:text-white',
                isActive && 'bg-white/15 font-semibold text-white',
                collapsed && 'justify-center px-0 max-md:px-3',
              )}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className={cn(
          'mt-auto flex flex-col gap-2 rounded-xl bg-white/10 p-3 text-[13.5px]',
          'max-md:mt-0 max-md:flex-row max-md:flex-wrap max-md:items-center',
          collapsed && 'items-center p-2 max-md:p-3',
        )}>
          <Badge variant="secondary" className="self-start text-[11px] uppercase">
            {isTauri() ? 'desktop' : 'web'}
          </Badge>
          {!collapsed && (
            <>
              <div className="font-medium">{user?.name}</div>
              <small className="text-white/60">{user?.roles.map((r) => r.name).join(', ')}</small>
            </>
          )}
          <Button
            id="btn_logout"
            variant="outline"
            size={collapsed ? 'icon' : 'default'}
            title="Keluar"
            onClick={onLogout}
            className={cn('border-white/30 bg-transparent text-white hover:bg-white/15 hover:text-white', collapsed && 'max-md:w-auto')}
          >
            <LogOut size={18} />
            {!collapsed && <span>Keluar</span>}
          </Button>
        </div>
      </aside>
      <main className="min-w-0 w-full max-w-none flex-1 space-y-4 p-4 md:px-8 md:py-7">{children}</main>
    </div>
  );
}
