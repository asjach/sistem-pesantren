import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logout } from '@/api/auth';
import { isTauri, prefGet, prefSet } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
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
import { DEFAULT_PREFS, WARNA_UI } from '@/prefs';
import { Blend, Check, ChevronDown, ChevronUp, Landmark, LogOut, Monitor, Moon, Paintbrush, Palette, SquareMousePointer, Sun, Users } from '@/icons';
import { useRibbonTable } from '@/components/RibbonTable';
import { useRibbonSlotCtx } from '@/components/RibbonSlot';
import { halamanDariPath } from '@/lib/halaman';
import { RibbonTabel } from './topbar/RibbonTabel';

// ---------- Header: judul halaman + area akun (atas) & baris tools (bawah) ----------

/** Mode tampilan terang/gelap/sistem (ikon saja) — di dekat akun pengguna. */
const MODE_STRIP: { id: ModeName; nama: string; icon: typeof Sun }[] = [
  { id: 'terang', nama: 'Terang', icon: Sun },
  { id: 'gelap', nama: 'Gelap', icon: Moon },
  { id: 'sistem', nama: 'Sistem', icon: Monitor },
];

const navBase =
  'flex items-center gap-2 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';
const navIdle =
  'text-[var(--sidebar-foreground)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] hover:text-white';

/** Preferensi tampil/sembunyi baris toolbar (per perangkat). */
const TOOLS_TAMPIL_KEY = 'simpes_tools_tampil';

/** Header aplikasi: bar judul halaman + area akun, lalu baris ribbon tools
 *  (kontrol tabel aktif atau tools yang disumbang halaman lewat `RibbonSlot`).
 *  Navigasi halaman ada di Sidebar, bukan di sini. */
export default function TopBar() {
  const { user, logoutLocal } = useAuth();
  const { lembagaId, lembaga, pilihan, adaSemua, banyakPilihan, pilih, loading: lembagaLoading } = useLembagaAktif();
  const { theme, mode, dark, iconSet, warnaUI, setTheme, setMode, setIconSet, setWarnaUI } = useTheme();
  const picker = usePicker();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const ribbon = useRibbonTable();
  const apiTabel = ribbon?.api ?? null;
  const slot = useRibbonSlotCtx();
  const setSlotEl = slot?.setEl;
  const slotAda = slot?.ada ?? false;
  const slotLabel = slot?.label ?? null;

  const halaman = halamanDariPath(pathname);
  const [toolsTampil, setToolsTampil] = useState(true);
  const [tabTools, setTabTools] = useState<'halaman' | 'tabel'>('halaman');
  const adaToolsHalaman = slotAda;
  const adaToolsTabel = apiTabel !== null;
  const adaTools = adaToolsHalaman || adaToolsTabel;
  // Dua sumber tools (halaman + tabel) → baris tools memakai tab agar ringkas.
  const banyakTab = adaToolsHalaman && adaToolsTabel;
  const tampilTools = adaTools && toolsTampil;

  // Elemen target portal tools halaman (lihat `RibbonSlot`).
  const hostRef = useCallback((el: HTMLDivElement | null) => setSlotEl?.(el), [setSlotEl]);

  useEffect(() => {
    prefGet(TOOLS_TAMPIL_KEY).then((v) => setToolsTampil(v !== '0')).catch(() => {});
  }, []);

  // Jaga tab aktif tetap valid saat ketersediaan tools berubah (navigasi).
  // Halaman tanpa tools sama sekali tidak menyentuh state (hindari bolak-balik).
  useEffect(() => {
    if (tabTools === 'halaman' && adaToolsHalaman) return;
    if (tabTools === 'tabel' && adaToolsTabel) return;
    if (adaToolsHalaman) setTabTools('halaman');
    else if (adaToolsTabel) setTabTools('tabel');
  }, [tabTools, adaToolsHalaman, adaToolsTabel]);

  function togolTools() {
    setToolsTampil((v) => {
      prefSet(TOOLS_TAMPIL_KEY, v ? '0' : '1').catch(() => {});
      return !v;
    });
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

  return (
    <header
      className="shrink-0 border-b border-white/10 text-white"
      style={{ background: 'linear-gradient(90deg, var(--sidebar-deep), var(--sidebar))' }}
    >
      {/* Judul halaman untuk pembaca layar (visual tampil di bar judul). */}
      <h1 id="judul_halaman_aktif" className="sr-only">
        {halaman?.label ?? 'SIMPES Admin'}
      </h1>

      {/* Baris 1: judul halaman (kiri) + area akun (kanan). */}
      <div className="flex items-center gap-2 px-3 py-1.5 md:px-5">
        <span id="judul_bar_halaman" className="truncate text-sm font-semibold">
          {halaman?.label ?? 'SIMPES Admin'}
        </span>

        <div data-part="area_akun" className="ml-auto flex items-center gap-0.5">
          {!lembagaLoading && (adaSemua || banyakPilihan) && pilihan.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  id="btn_menu_lembaga_aktif"
                  title="Lembaga aktif"
                  aria-label="Pilih lembaga aktif"
                  className={cn(navBase, navIdle, 'mr-1 data-[state=open]:bg-white/15')}
                >
                  <Landmark size={14} />
                  <span className="hidden max-w-[9rem] truncate sm:inline">
                    {lembaga ? (lembaga.kode ?? lembaga.nama) : 'Semua lembaga'}
                  </span>
                  <ChevronDown size={13} className="opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 min-w-[12rem] overflow-y-auto">
                <DropdownMenuLabel className="text-foreground">Lembaga aktif</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {adaSemua && (
                  <DropdownMenuItem id="menu_lembaga_aktif_semua" onSelect={() => pilih(null)}>
                    <span className="flex-1">Semua lembaga</span>
                    {lembagaId === null && <Check data-icon="inline-end" size={14} />}
                  </DropdownMenuItem>
                )}
                {pilihan.map((l) => (
                  <DropdownMenuItem key={l.id} id={`menu_lembaga_aktif_${l.id}`} onSelect={() => pilih(l.id)}>
                    <span className="flex-1 truncate">{l.kode ? `${l.kode} — ${l.nama}` : l.nama}</span>
                    {lembagaId === l.id && <Check data-icon="inline-end" size={14} />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {adaTools && (
            <button
              id="btn_tampil_tools"
              type="button"
              title={toolsTampil ? 'Sembunyikan toolbar' : 'Tampilkan toolbar'}
              aria-label={toolsTampil ? 'Sembunyikan toolbar' : 'Tampilkan toolbar'}
              aria-pressed={toolsTampil}
              onClick={togolTools}
              className={cn(
                'mr-1 grid size-6 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white',
                toolsTampil && 'bg-white/15 text-white',
              )}
            >
              {toolsTampil ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
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
            <SquareMousePointer size={14} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                id="btn_menu_pengguna"
                className={cn(navBase, navIdle, 'data-[state=open]:bg-white/15')}
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
                    {THEME_PRESETS.find((t) => t.id === theme)?.nama}
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger id="menu_set_warna">
                  <Blend data-icon="inline-start" size={16} />
                  <span className="flex-1">Kaya warna UI</span>
                  <span className="text-xs text-muted-foreground capitalize">{warnaUI}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-44">
                  {WARNA_UI.map((w) => (
                    <DropdownMenuItem key={w} id={`menu_warna_${w}`} onSelect={() => setWarnaUI(w)} className="capitalize">
                      <span className="flex-1">{w}</span>
                      {warnaUI === w && <Check data-icon="inline-end" size={14} />}
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

      {/* Baris 2: ribbon tools kontekstual (kontrol tabel / tools halaman). */}
      {tampilTools && (
        <div className="border-t border-white/10 bg-white/5">
          {banyakTab && (
            <div className="flex items-center gap-0.5 border-b border-white/10 px-3 pt-1 md:px-5">
              {([
                { id: 'halaman' as const, label: slotLabel ?? 'Halaman' },
                { id: 'tabel' as const, label: 'Tabel' },
              ]).map((t) => (
                <button
                  key={t.id}
                  id={`tab_tools_${t.id}`}
                  type="button"
                  aria-pressed={tabTools === t.id}
                  onClick={() => setTabTools(t.id)}
                  className={cn(
                    'rounded-t-md px-3 py-0.5 text-[11px] transition-colors',
                    tabTools === t.id
                      ? 'bg-white/15 font-semibold text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex min-h-[76px] flex-wrap items-stretch gap-y-2 px-3 py-3 md:px-5">
            {(!banyakTab || tabTools === 'halaman') && <div ref={hostRef} className="contents" />}
            {(!banyakTab || tabTools === 'tabel') && apiTabel && <RibbonTabel apiTabel={apiTabel} />}
          </div>
        </div>
      )}
    </header>
  );
}
