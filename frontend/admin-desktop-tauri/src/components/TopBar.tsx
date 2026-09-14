import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logout } from '@/api/auth';
import { isTauri, prefGet, prefSet } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme, type ModeName, type ThemeName } from '@/theme';
import { usePicker } from '@/picker';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import { ICON_SETS } from '@/iconSets';
import { THEME_PRESETS } from '@/themes';
import { DEFAULT_PREFS } from '@/prefs';
import { Check, ChevronDown, LogOut, Monitor, Moon, MousePointerClick, Paintbrush, Palette, Sun, Users } from '@/icons';
import { useRibbonTable } from '@/components/RibbonTable';
import { halamanDariPath } from '@/lib/halaman';
import { RibbonBeranda } from './topbar/RibbonBeranda';
import { RibbonMaster } from './topbar/RibbonMaster';
import { RibbonPsb } from './topbar/RibbonPsb';
import { RibbonSantri } from './topbar/RibbonSantri';
import { RibbonKeuangan } from './topbar/RibbonKeuangan';
import { RibbonPengaturan } from './topbar/RibbonPengaturan';
import { RibbonTabel } from './topbar/RibbonTabel';

// ---------- Peta tab ribbon ← registri halaman ----------

const RIBBON_LIPAT_KEY = 'simpes_ribbon_lipat';

/** Mode tampilan terang/gelap/sistem (ikon saja) — di dekat akun pengguna. */
const MODE_STRIP: { id: ModeName; nama: string; icon: typeof Sun }[] = [
  { id: 'terang', nama: 'Terang', icon: Sun },
  { id: 'gelap', nama: 'Gelap', icon: Moon },
  { id: 'sistem', nama: 'Sistem', icon: Monitor },
];

const navBase =
  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';
const navIdle =
  'text-[var(--sidebar-foreground)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] hover:text-white';

/** Ribbon menu (ala Word/Excel): tab + grup perintah + Quick Access. */
export default function TopBar() {
  const { user, logoutLocal } = useAuth();
  const { theme, mode, customHex, dark, iconSet, setTheme, setMode, setIconSet } = useTheme();
  const picker = usePicker();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const ribbon = useRibbonTable();
  const apiTabel = ribbon?.api ?? null;

  const halaman = halamanDariPath(pathname);
  const showGrid = halaman?.grid === true;

  const [tab, setTab] = useState<string>(() => halamanDariPath(pathname)?.tab ?? 'beranda');
  const [lipat, setLipat] = useState(false);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

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

  // Di layar sempit ribbon bisa menggulir: bawa tab & tombol halaman aktif
  // ke tampilan setiap navigasi/tab berubah agar tidak tersembunyi di luar.
  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>(`#tab_ribbon_${tabAktif}`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    panelRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [tabAktif, pathname, lipat]);

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
      <div ref={stripRef} className="flex items-end gap-0.5 overflow-x-auto px-3 pt-1.5 md:px-5">
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

        <div data-part="area_akun" className="ml-auto flex items-center gap-0.5 pl-2">
          <ToggleGroup
            type="single"
            spacing={0}
            value={mode}
            onValueChange={(v) => { if (v) setMode(v as ModeName); }}
            className="mr-1"
          >
            {MODE_STRIP.map((m) => (
              <ToggleGroupItem
                key={m.id}
                id={`strip_mode_${m.id}`}
                value={m.id}
                title={`Mode ${m.nama}`}
                aria-label={`Mode ${m.nama}`}
                className="size-6 rounded-md border-0 text-white/75 hover:bg-white/10 hover:text-white data-[state=on]:bg-white/20 data-[state=on]:text-white"
              >
                <m.icon size={14} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <button
            id="btn_pilih_komponen_global"
            type="button"
            data-picker-abaikan
            title={picker.aktif ? 'Batal pilih komponen (Esc)' : 'Pilih komponen (klik komponen di halaman)'}
            aria-label="Pilih komponen"
            aria-pressed={picker.aktif}
            onClick={() => (picker.aktif ? picker.batal() : picker.mulai())}
            className={cn(
              'mr-1 grid size-6 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white',
              picker.aktif && 'bg-white/25 text-white',
            )}
          >
            <MousePointerClick size={14} />
          </button>
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger id="menu_set_tema">
                  <Palette data-icon="inline-start" size={16} />
                  <span className="flex-1">Tema</span>
                  <span className="text-xs text-muted-foreground">
                    {theme === 'kustom' ? 'Kustom' : THEME_PRESETS.find((t) => t.id === theme)?.nama}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 min-w-52 overflow-y-auto">
                  {THEME_PRESETS.map((t) => (
                    <DropdownMenuItem key={t.id} id={`menu_tema_${t.id}`} onSelect={() => setTheme(t.id as ThemeName)}>
                      <span className="flex flex-1 items-center gap-2">
                        <span
                          className="inline-block size-3 shrink-0 rounded-full border border-black/20"
                          style={{ background: dark ? t.gelap.accent : t.terang.accent }}
                        />
                        {t.nama}
                        {t.id === DEFAULT_PREFS.theme ? ' • bawaan' : ''}
                      </span>
                      {theme === t.id && <Check data-icon="inline-end" size={14} />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem id="menu_tema_kustom" onSelect={() => setTheme('kustom')}>
                    <span className="flex flex-1 items-center gap-2">
                      <span
                        className="inline-block size-3 shrink-0 rounded-full border border-black/20"
                        style={{ background: customHex }}
                      />
                      Kustom (atur warna di Tampilan)
                    </span>
                    {theme === 'kustom' && <Check data-icon="inline-end" size={14} />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger id="menu_set_ikon">
                  <Paintbrush data-icon="inline-start" size={16} />
                  <span className="flex-1">Set ikon</span>
                  <span className="text-xs text-muted-foreground">
                    {ICON_SETS.find((s) => s.id === iconSet)?.nama}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-44">
                  {ICON_SETS.map((s) => (
                    <DropdownMenuItem key={s.id} id={`menu_ikon_${s.id}`} onSelect={() => setIconSet(s.id)}>
                      <span className="flex-1">{s.nama}</span>
                      {iconSet === s.id && <Check data-icon="inline-end" size={14} />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
          <div
            ref={panelRef}
            className={cn(
              'flex items-stretch overflow-x-auto px-3 py-1.5 md:px-5',
              tabAktif === 'tabel' ? 'min-h-0' : 'min-h-[76px]',
            )}
          >
            {tabAktif === 'beranda' && <RibbonBeranda pathname={pathname} />}

            {tabAktif === 'master' && <RibbonMaster pathname={pathname} />}

            {tabAktif === 'psb' && <RibbonPsb pathname={pathname} />}

            {tabAktif === 'santri' && <RibbonSantri pathname={pathname} />}

            {tabAktif === 'keuangan' && <RibbonKeuangan pathname={pathname} />}

            {tabAktif === 'pengaturan' && <RibbonPengaturan pathname={pathname} />}

            {tabAktif === 'tabel' && showGrid && <RibbonTabel apiTabel={apiTabel} />}
          </div>
        </div>
      )}
    </header>
  );
}
