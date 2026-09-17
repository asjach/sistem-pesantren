import { NavLink, useNavigate } from 'react-router-dom';
import { NAV_GRUP, halamanPerGrup, type TabKategori } from '@/lib/halaman';
import { bisa, logout } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut } from '@/icons';
import { cn } from '@/lib/utils';

const LABEL_MENU: Record<TabKategori, string> = {
  beranda: 'Berkas',
  master: 'Data Induk',
  psb: 'PSB',
  santri: 'Kesiswaan',
  pengaturan: 'Pengaturan',
};

/** Izin halaman khusus super_admin: disembunyikan saat bertindak sebagai lembaga. */
const TERKUNCI = new Set(['izin.lihat', 'server.lihat']);

/** Bar menu ala aplikasi desktop: pengganti Sidebar bila pref `navigasi`
 *  bernilai `menubar`. Sumber halaman sama (`HALAMAN` + izin matriks). */
export default function Menubar() {
  const { user, logoutLocal } = useAuth();
  const { bertindak } = useLembagaAktif();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    await logoutLocal();
    navigate('/login');
  }

  return (
    <nav
      data-slot="menubar"
      aria-label="Menu aplikasi"
      className="flex shrink-0 items-center gap-0.5 border-b bg-[var(--sidebar-deep)] px-2 py-1 text-white"
    >
      <span
        className="mr-2 truncate px-1 text-sm font-semibold tracking-wide"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        SIMPES
      </span>
      {NAV_GRUP.map((g) => {
        const items = halamanPerGrup(g.id)
          .filter((h) => bisa(user, h.permission) && !(bertindak && TERKUNCI.has(h.permission)));
        if (g.id !== 'beranda' && items.length === 0) return null;
        return (
          <DropdownMenu key={g.id}>
            <DropdownMenuTrigger
              id={`menu_${g.id}`}
              className="rounded-md px-2.5 py-1 text-sm text-white/80 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 data-[state=open]:bg-white/20 data-[state=open]:text-white"
            >
              {LABEL_MENU[g.id]}
            </DropdownMenuTrigger>
            <DropdownMenuContent data-slot="menubar-content" align="start" className="min-w-52">
              {items.map((h) => {
                const Icon = h.icon;
                return (
                  <DropdownMenuItem key={h.to} asChild>
                    <NavLink
                      to={h.to}
                      end={h.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex w-full cursor-pointer items-center gap-2',
                          isActive && 'bg-accent font-medium text-accent-foreground',
                        )
                      }
                    >
                      <Icon size={16} />
                      {h.label}
                    </NavLink>
                  </DropdownMenuItem>
                );
              })}
              {g.id === 'beranda' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    id="btn_logout_menubar"
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onSelect={() => void onLogout()}
                  >
                    <LogOut data-icon="inline-start" size={16} /> Keluar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
