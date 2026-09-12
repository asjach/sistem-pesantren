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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Database,
  FileCheck2,
  GraduationCap,
  History,
  Home,
  Landmark,
  LogOut,
  Minus,
  NotebookTabs,
  Plus,
  ReceiptText,
  Rows3,
  ScrollText,
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
  /** Ikon saja tanpa teks (teks tetap dibaca screen reader & tooltip). */
  iconOnly?: boolean;
}

interface NavSubGroup {
  label: string;
  items: NavItem[];
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: (NavItem | NavSubGroup)[];
}

function isSubGroup(item: NavItem | NavSubGroup): item is NavSubGroup {
  return !('to' in item);
}

type NavEntry = ({ kind: 'link' } & NavItem) | ({ kind: 'group' } & NavGroup);

const NAV: NavEntry[] = [
  { kind: 'link', to: '/', label: 'Dashboard', icon: Home, id: 'nav_dashboard', iconOnly: true },
  {
    kind: 'group',
    label: 'master',
    icon: Database,
    items: [
      { to: '/users', label: 'user', icon: Users, id: 'nav_users' },
      { to: '/lembaga', label: 'Lembaga', icon: Landmark, id: 'nav_lembaga' },
      { to: '/tahun-ajaran', label: 'Tahun Ajaran', icon: CalendarDays, id: 'nav_tahun_ajaran' },
      { to: '/kelas', label: 'Kelas', icon: BookOpen, id: 'nav_kelas' },
      { to: '/referensi', label: 'Referensi', icon: BookMarked, id: 'nav_referensi' },
    ],
  },
  {
    kind: 'group',
    label: 'Santri',
    icon: GraduationCap,
    items: [
      {
        label: 'PSB',
        items: [
          { to: '/psb', label: 'Antrean', icon: ClipboardList, id: 'nav_psb' },
          { to: '/kegiatan-psb', label: 'Kegiatan PSB', icon: CalendarRange, id: 'nav_kegiatan_psb' },
          { to: '/dokumen-wajib', label: 'Dokumen Wajib', icon: FileCheck2, id: 'nav_dokumen_wajib' },
        ],
      },
      { to: '/santri', label: 'Data Santri', icon: Users, id: 'nav_santri' },
      { to: '/siklus', label: 'Mutasi & Alumni', icon: History, id: 'nav_siklus' },
      { to: '/pengajuan-biodata', label: 'Pengajuan Biodata', icon: NotebookTabs, id: 'nav_pengajuan_biodata' },
    ],
  },
  {
    kind: 'group',
    label: 'Keuangan',
    icon: Wallet,
    items: [
      { to: '/pos', label: 'Pos', icon: Wallet, id: 'nav_pos' },
      { to: '/tarif', label: 'Tarif', icon: ReceiptText, id: 'nav_tarif' },
      { to: '/keuangan', label: 'Tagihan & Bayar', icon: ScrollText, id: 'nav_keuangan' },
    ],
  },
];

/** Halaman yang memakai grid — kontrol tampilan tabel hanya relevan di sini. */
const TABLE_ROUTES = [
  '/users',
  '/lembaga',
  '/tahun-ajaran',
  '/kelas',
  '/pos',
  '/tarif',
  '/referensi',
  '/psb',
  '/santri',
  '/siklus',
  '/keuangan',
  '/pengajuan-biodata',
  '/dokumen-wajib',
];

const navBase =
  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';
const navIdle =
  'text-[var(--sidebar-foreground)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] hover:text-white';
const navActive =
  'bg-[color-mix(in_srgb,var(--sidebar-foreground)_22%,transparent)] font-semibold text-white';

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Spinbox dengan tombol −/+ yang selalu tampil (bukan spinner native saat hover). */
function SpinBox({
  id,
  value,
  min,
  max,
  title,
  ariaLabel,
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  title: string;
  ariaLabel: string;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Commit hanya saat blur/Enter/± agar mengetik tidak memicu re-render global
  // dan AutoFit tiap karakter.
  const commit = (raw: string | null) => {
    setDraft(null);
    if (raw === null || raw.trim() === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(clamp(n, min, max));
  };
  const stepBy = (d: number) => {
    const typed = draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))
      ? Number(draft)
      : value;
    setDraft(null);
    onChange(clamp(typed + d, min, max));
  };
  const btn =
    'grid w-5 shrink-0 place-items-center text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40';
  return (
    <div
      title={title}
      className="flex h-6 items-stretch overflow-hidden rounded-md border border-white/20 bg-white/5 focus-within:ring-2 focus-within:ring-white/30"
    >
      <button
        type="button"
        id={`${id}_kurang`}
        aria-label={`${ariaLabel} kurang`}
        disabled={value <= min}
        className={btn}
        onClick={() => stepBy(-1)}
      >
        <Minus size={12} />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        className="h-full w-8 border-x border-white/20 bg-transparent px-0 text-center text-xs text-white outline-none"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <button
        type="button"
        id={`${id}_tambah`}
        aria-label={`${ariaLabel} tambah`}
        disabled={value >= max}
        className={btn}
        onClick={() => stepBy(1)}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

/** Brand + navigasi berkelompok (dropdown) + kontrol tabel + pengguna. */
export default function TopBar() {
  const { user, logoutLocal } = useAuth();
  const { density } = useTheme();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { rowH, fontPx, fontFamily, setRowH, setFontPx, setFontFamily } = useGridPrefs();

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
      <div className="flex min-h-14 items-center gap-x-4 px-3 py-2 md:px-5">
        <div className="shrink-0 font-display text-[17px] font-extrabold leading-tight">
          SIMPES Admin
          <small className="hidden text-[11px] font-normal text-white/60 sm:block">Sistem Pesantren</small>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((entry) =>
            entry.kind === 'link' ? (
              <NavLink
                key={entry.to}
                id={entry.id}
                to={entry.to}
                end={entry.to === '/'}
                title={entry.iconOnly ? entry.label : undefined}
                aria-label={entry.iconOnly ? entry.label : undefined}
                className={({ isActive }) => cn(navBase, entry.iconOnly && 'px-2', isActive ? navActive : navIdle)}
              >
                <entry.icon size={17} />
                {entry.iconOnly ? <span className="sr-only">{entry.label}</span> : entry.label}
              </NavLink>
            ) : (
              <NavGroupMenu key={entry.label} group={entry} pathname={pathname} />
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {showGrid && (
            <>
              <label
                htmlFor="input_tinggi_top"
                title="Tinggi baris (berlaku semua tabel)"
                className="cursor-default text-white/70"
              >
                <Rows3 size={15} />
                <span className="sr-only">Tinggi baris (semua tabel)</span>
              </label>
              <SpinBox
                id="input_tinggi_top"
                value={effectiveH}
                min={MIN_ROW_H}
                max={MAX_ROW_H}
                title="Tinggi baris (berlaku semua tabel)"
                ariaLabel="Tinggi baris (px)"
                onChange={setRowH}
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
                    <SelectLabel>Font Aptos (bundel)</SelectLabel>
                    {FONT_OPTIONS.filter((f) => f.group === 'aptos').map((f) => (
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
              <SpinBox
                id="input_huruf_top"
                value={effectiveFont}
                min={MIN_FONT_PX}
                max={MAX_FONT_PX}
                title="Ukuran huruf (berlaku semua tabel)"
                ariaLabel="Ukuran huruf (px)"
                onChange={setFontPx}
              />
              <span aria-hidden className="h-6 w-px bg-white/20" />
            </>
          )}

          <NavLink
            id="nav_pengaturan"
            to="/pengaturan"
            title="Pengaturan"
            aria-label="Pengaturan"
            className={({ isActive }) => cn(navBase, 'px-2', isActive ? navActive : navIdle)}
          >
            <Settings size={17} />
            <span className="sr-only">Pengaturan</span>
          </NavLink>

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
                <LogOut data-icon="inline-start" size={16} /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function NavGroupMenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  const allItems = group.items.flatMap((i) => (isSubGroup(i) ? i.items : [i]));
  const active = allItems.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
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
        {group.items.map((item) =>
          isSubGroup(item) ? (
            <DropdownMenuSub key={item.label}>
              <DropdownMenuSubTrigger
                className={cn(
                  item.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)) &&
                    'text-accent-foreground',
                )}
              >
                {item.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {item.items.map((sub) => (
                  <DropdownMenuItem key={sub.to} asChild>
                    <NavLink
                      id={sub.id}
                      to={sub.to}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <sub.icon size={16} className="text-muted-foreground" />
                      {sub.label}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
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
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
