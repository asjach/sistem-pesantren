import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '@/api/auth';
import { isTauri, prefGet, prefSet } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme, type ModeName, type ThemeName } from '@/theme';
import { cn } from '@/lib/utils';
import { DEFAULT_PREFS, DENSITY_PX } from '@/prefs';
import { THEME_PRESETS } from '@/themes';
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
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Copy,
  FileCheck2,
  GraduationCap,
  History,
  Home,
  Landmark,
  LogOut,
  Minus,
  Monitor,
  Moon,
  MoveHorizontal,
  NotebookTabs,
  Paintbrush,
  Palette,
  Plus,
  ReceiptText,
  RotateCcw,
  ScrollText,
  Server,
  Sun,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useRibbonTable } from '@/components/RibbonTable';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { halamanDariPath } from '@/lib/halaman';

/** Mode tampilan untuk ribbon (ikon saja). */
const MODE_RIBBON: { id: ModeName; nama: string; icon: typeof Sun }[] = [
  { id: 'terang', nama: 'Terang', icon: Sun },
  { id: 'gelap', nama: 'Gelap', icon: Moon },
  { id: 'sistem', nama: 'Sistem', icon: Monitor },
];

// ---------- Peta tab ribbon ← registri halaman ----------

const RIBBON_LIPAT_KEY = 'simpes_ribbon_lipat';

function pathAktif(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

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
      className="flex h-[30px] items-stretch overflow-hidden rounded-md border border-white/20 bg-white/5 focus-within:ring-2 focus-within:ring-white/30"
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

/** Tombol besar ribbon: ikon di atas label (ala Office). */
function RibbonBtn({
  id,
  to,
  icon: Icon,
  label,
  aktif,
}: {
  id: string;
  to: string;
  icon: LucideIcon;
  label: string;
  aktif: boolean;
}) {
  return (
    <NavLink
      id={id}
      to={to}
      end={to === '/'}
      title={label}
      data-part="menu_ribbon"
      className={cn(
        'flex h-[58px] w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[11px] leading-tight transition-colors',
        aktif ? 'bg-white/20 font-semibold text-white' : 'text-white/85 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon size={20} />
      <span className="line-clamp-2">{label}</span>
    </NavLink>
  );
}

/** Tombol perintah ribbon (aksi, bukan navigasi). */
function RibbonCmd({
  id,
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-part="menu_ribbon"
      className={cn(
        'flex h-[58px] w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[11px] leading-tight transition-colors',
        'text-white/85 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <Icon size={20} />
      <span className="line-clamp-2">{label}</span>
    </button>
  );
}

/** Grup perintah ribbon + nama grup di bawahnya (ala Office). */
function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-part="grup_ribbon" className="flex shrink-0 flex-col items-center gap-0.5 px-1.5">
      <div className="flex flex-1 items-center gap-1">{children}</div>
      <span className="text-[10px] uppercase tracking-wide text-white/50">{label}</span>
    </div>
  );
}

function RibbonPemisah() {
  return <span aria-hidden className="mx-0.5 h-[54px] w-px self-center bg-white/15" />;
}

const navBase =
  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';
const navIdle =
  'text-[var(--sidebar-foreground)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] hover:text-white';

/** Ribbon menu (ala Word/Excel): tab + grup perintah + Quick Access. */
export default function TopBar() {
  const { user, logoutLocal } = useAuth();
  const { density, theme, mode, customHex, dark, setTheme, setMode } = useTheme();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { rowH, fontPx, fontFamily, setRowH, setFontPx, setFontFamily } = useGridPrefs();
  const ribbon = useRibbonTable();
  const apiTabel = ribbon?.api ?? null;

  const effectiveH = rowH ?? DENSITY_PX[density];
  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;
  const halaman = halamanDariPath(pathname);
  const showGrid = halaman?.grid === true;

  const [tab, setTab] = useState<string>(() => halamanDariPath(pathname)?.tab ?? 'beranda');
  const [lipat, setLipat] = useState(false);

  // Ribbon "diam": tab TIDAK ikut pindah saat navigasi — hanya berubah lewat
  // klik tab. Satu-satunya pengecualian: tab "Tabel" hilang saat halaman aktif
  // bukan halaman ber-grid (kembali ke tab kategori halaman itu).
  useEffect(() => {
    if (tab === 'tabel' && !showGrid) setTab(halamanDariPath(pathname)?.tab ?? 'beranda');
  }, [pathname, showGrid, tab]);

  useEffect(() => {
    prefGet(RIBBON_LIPAT_KEY).then((v) => setLipat(v === '1')).catch(() => {});
  }, []);

  function togolLipat() {
    setLipat((v) => {
      prefSet(RIBBON_LIPAT_KEY, v ? '0' : '1').catch(() => {});
      return !v;
    });
  }

  /** Klik tab = pilih tab; klik lagi tab yang sedang aktif = lipat/buka panel. */
  function pilihTab(id: string) {
    if (id === tabAktif) {
      togolLipat();
      return;
    }
    setTab(id);
    if (lipat) {
      setLipat(false);
      prefSet(RIBBON_LIPAT_KEY, '0').catch(() => {});
    }
  }

  // Judul halaman → title bar jendela (hemat ruang di aplikasi). Di dev web
  // memakai document.title; di Tauri sekalian set judul window native.
  useEffect(() => {
    const judul = halaman ? `${halaman.label} — SIMPES Admin` : 'SIMPES Admin';
    document.title = judul;
    if (isTauri()) {
      import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => getCurrentWindow().setTitle(judul))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function onLogout() {
    await logout();
    await logoutLocal();
    nav('/login', { replace: true });
  }

  const tabAktif = tab === 'tabel' && !showGrid ? (halaman?.tab ?? 'beranda') : tab;

  const tabDef: { id: string; label: string }[] = [
    { id: 'beranda', label: 'Beranda' },
    { id: 'master', label: 'Master' },
    { id: 'psb', label: 'PSB' },
    { id: 'santri', label: 'Santri' },
    { id: 'keuangan', label: 'Keuangan' },
    { id: 'pengaturan', label: 'Pengaturan' },
  ];
  if (showGrid) tabDef.push({ id: 'tabel', label: 'Tabel' });

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 text-white"
      style={{ background: 'linear-gradient(90deg, var(--sidebar-deep), var(--sidebar))' }}
    >
      {/* Judul halaman untuk pembaca layar (visual ada di title bar jendela). */}
      <h1 id="judul_halaman_aktif" className="sr-only">
        {halaman?.label ?? 'SIMPES Admin'}
      </h1>

      {/* Strip tab + pengguna (kanan) */}
      <div className="flex items-end gap-0.5 px-3 pt-1.5 md:px-5">
        {tabDef.map((t) => {
          const aktif = tabAktif === t.id;
          return (
            <button
              key={t.id}
              id={`tab_ribbon_${t.id}`}
              type="button"
              aria-pressed={aktif}
              aria-expanded={aktif ? !lipat : undefined}
              title={aktif ? (lipat ? `Buka panel ${t.label}` : `Lipat panel ${t.label}`) : `Buka tab ${t.label}`}
              onClick={() => pilihTab(t.id)}
              className={cn(
                'rounded-t-md px-3 py-1 text-xs transition-colors sm:text-sm',
                aktif
                  ? 'bg-white/15 font-semibold text-white'
                  : 'text-white/75 hover:bg-white/10 hover:text-white',
              )}
            >
              {t.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-0.5 pl-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                id="btn_menu_pengguna"
                className={cn(navBase, navIdle, 'rounded-b-none px-2.5 py-1 text-xs data-[state=open]:bg-white/15')}
              >
                <Users size={15} />
                <span className="hidden max-w-[9rem] truncate sm:inline">{user?.name}</span>
                <ChevronDown size={13} className="opacity-70" />
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

      {/* Panel grup perintah */}
      {!lipat && (
        <div className="border-t border-white/10 bg-white/5">
          <div className="flex min-h-[76px] items-stretch overflow-x-auto px-3 py-1.5 md:px-5">
            {tabAktif === 'beranda' && (
              <>
                <RibbonGroup label="Mulai">
                  <RibbonBtn id="nav_dashboard" to="/" icon={Home} label="Dashboard" aktif={pathAktif(pathname, '/')} />
                </RibbonGroup>
                <RibbonPemisah />
                <RibbonGroup label="Pintasan">
                  <RibbonBtn id="nav_pintasan_psb" to="/psb" icon={ClipboardList} label="Antrean PSB" aktif={pathAktif(pathname, '/psb')} />
                  <RibbonBtn id="nav_pintasan_santri" to="/santri" icon={GraduationCap} label="Data Santri" aktif={pathAktif(pathname, '/santri')} />
                  <RibbonBtn id="nav_pintasan_keuangan" to="/keuangan" icon={ScrollText} label="Tagihan & Bayar" aktif={pathAktif(pathname, '/keuangan')} />
                </RibbonGroup>
              </>
            )}

            {tabAktif === 'master' && (
              <RibbonGroup label="Data Induk">
                <RibbonBtn id="nav_users" to="/users" icon={Users} label="Pengguna" aktif={pathAktif(pathname, '/users')} />
                <RibbonBtn id="nav_lembaga" to="/lembaga" icon={Landmark} label="Lembaga" aktif={pathAktif(pathname, '/lembaga')} />
                <RibbonBtn id="nav_tahun_ajaran" to="/tahun-ajaran" icon={CalendarDays} label="Tahun Ajaran" aktif={pathAktif(pathname, '/tahun-ajaran')} />
                <RibbonBtn id="nav_kelas" to="/kelas" icon={BookOpen} label="Kelas" aktif={pathAktif(pathname, '/kelas')} />
                <RibbonBtn id="nav_referensi" to="/referensi" icon={BookMarked} label="Referensi" aktif={pathAktif(pathname, '/referensi')} />
              </RibbonGroup>
            )}

            {tabAktif === 'psb' && (
              <RibbonGroup label="PSB">
                <RibbonBtn id="nav_psb" to="/psb" icon={ClipboardList} label="Antrean" aktif={pathAktif(pathname, '/psb')} />
                <RibbonBtn id="nav_kegiatan_psb" to="/kegiatan-psb" icon={CalendarRange} label="Kegiatan PSB" aktif={pathAktif(pathname, '/kegiatan-psb')} />
                <RibbonBtn id="nav_dokumen_wajib" to="/dokumen-wajib" icon={FileCheck2} label="Dokumen Wajib" aktif={pathAktif(pathname, '/dokumen-wajib')} />
              </RibbonGroup>
            )}

            {tabAktif === 'santri' && (
              <RibbonGroup label="Kesiswaan">
                <RibbonBtn id="nav_santri" to="/santri" icon={GraduationCap} label="Data Santri" aktif={pathAktif(pathname, '/santri')} />
                <RibbonBtn id="nav_siklus" to="/siklus" icon={History} label="Mutasi & Alumni" aktif={pathAktif(pathname, '/siklus')} />
                <RibbonBtn id="nav_pengajuan_biodata" to="/pengajuan-biodata" icon={NotebookTabs} label="Pengajuan Biodata" aktif={pathAktif(pathname, '/pengajuan-biodata')} />
              </RibbonGroup>
            )}

            {tabAktif === 'keuangan' && (
              <RibbonGroup label="Keuangan">
                <RibbonBtn id="nav_pos" to="/pos" icon={Wallet} label="Pos" aktif={pathAktif(pathname, '/pos')} />
                <RibbonBtn id="nav_tarif" to="/tarif" icon={ReceiptText} label="Tarif" aktif={pathAktif(pathname, '/tarif')} />
                <RibbonBtn id="nav_keuangan" to="/keuangan" icon={ScrollText} label="Tagihan & Bayar" aktif={pathAktif(pathname, '/keuangan')} />
              </RibbonGroup>
            )}

            {tabAktif === 'pengaturan' && (
              <>
                <RibbonGroup label="Tema">
                  <Select value={theme} onValueChange={(v) => setTheme(v as ThemeName)}>
                    <SelectTrigger
                      id="select_tema_ribbon"
                      title="Tema warna"
                      aria-label="Tema warna"
                      className="h-8 w-56 border-white/20 bg-white/5 text-white [&_svg]:text-white/70"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectGroup>
                        <SelectLabel>Tema</SelectLabel>
                        {THEME_PRESETS.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block size-3 shrink-0 rounded-full border border-black/20"
                                style={{ background: dark ? t.gelap.accent : t.terang.accent }}
                              />
                              {t.nama}
                              {t.id === DEFAULT_PREFS.theme ? ' • bawaan' : ''}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Kustom</SelectLabel>
                        <SelectItem value="kustom">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-3 shrink-0 rounded-full border border-black/20"
                              style={{ background: customHex }}
                            />
                            Kustom (atur warna di Tampilan)
                          </span>
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <ToggleGroup
                    type="single"
                    spacing={0}
                    value={mode}
                    onValueChange={(v) => { if (v) setMode(v as ModeName); }}
                    className="h-8 overflow-hidden rounded-md border border-white/20 bg-white/5"
                  >
                    {MODE_RIBBON.map((m) => (
                      <ToggleGroupItem
                        key={m.id}
                        id={`ribbon_mode_${m.id}`}
                        value={m.id}
                        title={`Mode ${m.nama}`}
                        aria-label={`Mode ${m.nama}`}
                        className="h-8 w-8 rounded-none border-0 text-white/75 hover:bg-white/10 hover:text-white data-[state=on]:bg-white/20 data-[state=on]:text-white"
                      >
                        <m.icon size={14} />
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </RibbonGroup>
                <RibbonPemisah />
                <RibbonGroup label="Pengaturan">
                  <RibbonBtn id="nav_pengaturan_tampilan" to="/pengaturan/tampilan" icon={Palette} label="Tampilan" aktif={pathAktif(pathname, '/pengaturan/tampilan')} />
                  <RibbonBtn id="nav_pengaturan_bagian" to="/pengaturan/bagian" icon={Paintbrush} label="Bagian UI" aktif={pathAktif(pathname, '/pengaturan/bagian')} />
                  <RibbonBtn id="nav_pengaturan_server" to="/pengaturan/server" icon={Server} label="Server" aktif={pathAktif(pathname, '/pengaturan/server')} />
                </RibbonGroup>
              </>
            )}

            {tabAktif === 'tabel' && showGrid && (
              <>
                <RibbonGroup label="Papan Klip">
                  <RibbonCmd
                    id="ribbon_btn_salin"
                    icon={Copy}
                    label="Salin TSV"
                    disabled={!apiTabel}
                    onClick={() => apiTabel?.salin()}
                  />
                </RibbonGroup>
                <RibbonPemisah />
                <RibbonGroup label="Kolom">
                  <RibbonCmd
                    id="ribbon_btn_autofit"
                    icon={MoveHorizontal}
                    label="Sesuaikan Lebar"
                    disabled={!apiTabel}
                    onClick={() => apiTabel?.autofit()}
                  />
                  <RibbonCmd
                    id="ribbon_btn_reset"
                    icon={RotateCcw}
                    label="Reset Tampilan"
                    disabled={!apiTabel}
                    onClick={() => apiTabel?.reset()}
                  />
                </RibbonGroup>
                <RibbonPemisah />
                <RibbonGroup label="Ukuran">
                  <div className="grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-1.5">
                    <span className="text-right text-[11px] text-white/70">Tinggi baris</span>
                    <SpinBox
                      id="input_tinggi_top"
                      value={effectiveH}
                      min={MIN_ROW_H}
                      max={MAX_ROW_H}
                      title="Tinggi baris (berlaku semua tabel)"
                      ariaLabel="Tinggi baris (px)"
                      onChange={setRowH}
                    />
                    <span className="text-right text-[11px] text-white/70">Ukuran huruf</span>
                    <SpinBox
                      id="input_huruf_top"
                      value={effectiveFont}
                      min={MIN_FONT_PX}
                      max={MAX_FONT_PX}
                      title="Ukuran huruf (berlaku semua tabel)"
                      ariaLabel="Ukuran huruf (px)"
                      onChange={setFontPx}
                    />
                  </div>
                </RibbonGroup>
                <RibbonPemisah />
                <RibbonGroup label="Jenis Huruf">
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger
                      id="select_huruf_top"
                      title="Jenis huruf isi tabel (berlaku semua tabel)"
                      aria-label="Jenis huruf isi tabel"
                      className="h-8 w-44 border-white/20 bg-white/5 text-white [&_svg]:text-white/70"
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
                </RibbonGroup>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
