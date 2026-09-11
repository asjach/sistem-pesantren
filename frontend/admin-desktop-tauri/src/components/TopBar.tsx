import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '@/api/auth';
import { isTauri } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme';
import { cn } from '@/lib/utils';
import { DENSITY_PX } from '@/prefs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_FONT_PX,
  FONT_OPTIONS,
  MAX_FONT_PX,
  MAX_ROW_H,
  MIN_FONT_PX,
  MIN_ROW_H,
  useGridPrefs,
} from '@/components/GridPrefs';
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Database,
  Landmark,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Rows3,
  Settings,
  Type,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  id: string;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

type NavEntry = ({ kind: 'link' } & NavItem) | ({ kind: 'group' } & NavGroup);

const NAV: NavEntry[] = [
  { kind: 'link', to: '/', label: 'Dashboard', icon: LayoutDashboard, id: 'nav_dashboard' },
  {
    kind: 'group',
    label: 'Data Master',
    icon: Database,
    items: [
      { to: '/lembaga', label: 'Lembaga', icon: Landmark, id: 'nav_lembaga' },
      { to: '/tahun-ajaran', label: 'Tahun Ajaran', icon: CalendarDays, id: 'nav_tahun_ajaran' },
      { to: '/kelas', label: 'Kelas', icon: BookOpen, id: 'nav_kelas' },
      { to: '/referensi', label: 'Referensi', icon: BookMarked, id: 'nav_referensi' },
    ],
  },
  {
    kind: 'group',
    label: 'Keuangan',
    icon: Wallet,
    items: [
      { to: '/pos', label: 'Pos', icon: Wallet, id: 'nav_pos' },
      { to: '/tarif', label: 'Tarif', icon: ReceiptText, id: 'nav_tarif' },
    ],
  },
  { kind: 'link', to: '/users', label: 'Pengguna', icon: Users, id: 'nav_users' },
  { kind: 'link', to: '/pengaturan', label: 'Pengaturan', icon: Settings, id: 'nav_pengaturan' },
];

/** Halaman yang memakai grid — kontrol tampilan tabel hanya relevan di sini. */
const TABLE_ROUTES = ['/users', '/lembaga', '/tahun-ajaran', '/kelas', '/pos', '/tarif'];

const navBase =
  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors';
const navIdle = 'text-[var(--sidebar-foreground)] hover:bg-white/10 hover:text-white';
const navActive = 'bg-white/15 font-semibold text-white';

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Brand + navigasi berkelompok (dropdown) + kontrol tabel + pengguna. */
export default function TopBar() {
  const { user, logoutLocal } = useAuth();
  const { density } = useTheme();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { rowH, fontPx, fontFamily, setRowH, setFontPx, setFontFamily } = useGridPrefs();
  const [rowDraft, setRowDraft] = useState<string | null>(null);
  const [fontDraft, setFontDraft] = useState<string | null>(null);

  const effectiveH = rowH ?? DENSITY_PX[density];
  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;
  const showGrid = TABLE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  async function onLogout() {
    await logout();
    await logoutLocal();
    nav('/login', { replace: true });
  }

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 text-white"
      style={{ background: 'linear-gradient(90deg, var(--sidebar-deep), var(--sidebar))' }}
    >
      <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 md:px-5">
        <div className="font-display text-[17px] font-extrabold leading-tight">
          SIMPES Admin
          <small className="hidden text-[11px] font-normal text-white/60 sm:block">Sistem Pesantren</small>
        </div>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto md:overflow-visible">
          {NAV.map((entry) =>
            entry.kind === 'link' ? (
              <NavLink
                key={entry.to}
                id={entry.id}
                to={entry.to}
                end={entry.to === '/'}
                className={({ isActive }) => cn(navBase, isActive ? navActive : navIdle)}
              >
                <entry.icon size={17} />
                {entry.label}
              </NavLink>
            ) : (
              <NavGroupMenu key={entry.label} group={entry} pathname={pathname} />
            ),
          )}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {showGrid && (
            <div className="flex h-8 items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2">
              <label
                htmlFor="input_tinggi_top"
                title="Tinggi baris (berlaku semua tabel)"
                className="cursor-default text-white/70"
              >
                <Rows3 size={15} />
                <span className="sr-only">Tinggi baris (semua tabel)</span>
              </label>
              <input
                id="input_tinggi_top"
                type="number"
                min={MIN_ROW_H}
                max={MAX_ROW_H}
                step={1}
                aria-label="Tinggi baris (px)"
                className="h-6 w-12 rounded-md border border-white/20 bg-white/5 px-1.5 text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                value={rowDraft ?? String(effectiveH)}
                onChange={(e) => {
                  setRowDraft(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setRowH(clamp(n, MIN_ROW_H, MAX_ROW_H));
                }}
                onBlur={() => setRowDraft(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />

              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger
                  id="select_huruf_top"
                  title="Jenis huruf isi tabel (berlaku semua tabel)"
                  aria-label="Jenis huruf isi tabel"
                  className="h-6 w-40 border-white/20 bg-white/5 text-white [&_svg]:text-white/70"
                >
                  <SelectValue placeholder="Bawaan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Font sistem</SelectLabel>
                    {FONT_OPTIONS.filter((f) => f.group === 'sistem').map((f) => (
                      <SelectItem key={f.label} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Font Google (offline)</SelectLabel>
                    {FONT_OPTIONS.filter((f) => f.group === 'google').map((f) => (
                      <SelectItem key={f.label} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <label
                htmlFor="input_huruf_top"
                title="Ukuran huruf (berlaku semua tabel)"
                className="cursor-default text-white/70"
              >
                <Type size={15} />
                <span className="sr-only">Ukuran huruf (semua tabel)</span>
              </label>
              <input
                id="input_huruf_top"
                type="number"
                min={MIN_FONT_PX}
                max={MAX_FONT_PX}
                step={1}
                aria-label="Ukuran huruf (px)"
                className="h-6 w-12 rounded-md border border-white/20 bg-white/5 px-1.5 text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                value={fontDraft ?? String(effectiveFont)}
                onChange={(e) => {
                  setFontDraft(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setFontPx(clamp(n, MIN_FONT_PX, MAX_FONT_PX));
                }}
                onBlur={() => setFontDraft(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                id="btn_menu_pengguna"
                className={cn(navBase, navIdle, 'data-[state=open]:bg-white/15')}
              >
                <Users size={17} />
                <span className="hidden max-w-[9rem] truncate sm:inline">{user?.name}</span>
                <ChevronDown size={14} className="opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[13rem]">
              <DropdownMenuLabel className="text-foreground">
                <div className="font-medium">{user?.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {isTauri() ? 'desktop' : 'web'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {user?.roles.map((r) => r.name).join(', ')}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                id="btn_logout"
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onSelect={onLogout}
              >
                <LogOut size={16} /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function NavGroupMenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  const active = group.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(navBase, active ? navActive : navIdle)}>
          <group.icon size={17} />
          {group.label}
          <ChevronDown size={14} className="opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {group.items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <NavLink
              id={item.id}
              to={item.to}
              className="flex cursor-pointer items-center gap-2"
            >
              <item.icon size={16} className="text-muted-foreground" />
              {item.label}
            </NavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
