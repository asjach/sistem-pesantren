import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logout } from '@/api/auth';
import { isTauri, prefGet, prefSet } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';
import { useSemesterAktif } from '@/semesterAktif';
import { useVisibilitasFilter, EVENT_KELOLA_HALAMAN, TAMPIL_BAWAAN } from '@/components/VisibilitasFilter';
import type { ModeFilterGlobal } from '@/lib/filterHalaman';
import { FilterSelect, FilterToggleGroup } from '@/components/FilterMulti';
import { useTheme, type ModeName, type ThemeName } from '@/theme';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import { Blend, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LogOut, Monitor, Moon, NotebookTabs, Paintbrush, Palette, Sun, Users } from '@/icons';
import { useRibbonTable } from '@/components/RibbonTable';
import { useRibbonSlotCtx } from '@/components/RibbonSlot';
import { useTopBarSearchCtx } from '@/components/TopBarSearch';
import BannerBertindak from '@/components/BannerBertindak';
import DialogKelolaHalaman from '@/components/kelolaHalaman/DialogKelolaHalaman';
import { halamanDariPath } from '@/lib/halaman';
import { RibbonTabel } from './topbar/RibbonTabel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ---------- Header: judul halaman + area akun (atas) & baris tools (bawah) ----------

/** Mode tampilan terang/gelap/sistem (ikon saja) — di dekat akun pengguna. */
const MODE_STRIP: { id: ModeName; nama: string; icon: typeof Sun }[] = [
  { id: 'terang', nama: 'Terang', icon: Sun },
  { id: 'gelap', nama: 'Gelap', icon: Moon },
  { id: 'sistem', nama: 'Sistem', icon: Monitor },
];

function pilihNilaiFilter(
  nilai: string,
  dipilih: readonly string[],
  mode: ModeFilterGlobal,
  setBanyak: (values: string[]) => void,
  setTunggal?: (value: string) => void,
) {
  if (mode === 'single') {
    if (setTunggal) setTunggal(nilai);
    else setBanyak([nilai]);
    return;
  }
  setBanyak(dipilih.includes(nilai) ? dipilih.filter((item) => item !== nilai) : [...dipilih, nilai]);
}

function nilaiDropdown(values: readonly string[], mode: ModeFilterGlobal): string[] {
  return mode === 'single' ? values.slice(0, 1) : [...values];
}

const navBase =
  'flex items-center gap-2 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';
const navIdle =
  'text-[var(--sidebar-foreground)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] hover:text-white';

/** Preferensi tampil/sembunyi baris toolbar (per perangkat). */
const TOOLS_TAMPIL_KEY = 'simpes_tools_tampil';

/** Gagang buka/tutup ribbon tools: strip tipis selebar baris judul/filter,
 *  menempel pada garis batas bawah baris (di atas border baris ribbon) dengan
 *  chevron di tengah; klik area mana pun pada strip untuk membuka/menutup.
 *  Dijangkarkan ke baris judul — bukan ke tepi bawah header — jadi posisinya
 *  sama persis baik saat ribbon tampil maupun disembunyikan. */
function TabRibbon({ tampil, onToggle }: { tampil: boolean; onToggle: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          id="btn_tampil_tools"
          type="button"
          aria-label={tampil ? 'Sembunyikan ribbon' : 'Tampilkan ribbon'}
          aria-expanded={tampil}
          onClick={onToggle}
          className="absolute inset-x-0 bottom-0 z-20 flex h-1 items-center justify-center bg-transparent text-white/60 transition-colors hover:bg-white/15 hover:text-white"
        >
          {tampil ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tampil ? 'Sembunyikan ribbon' : 'Tampilkan ribbon'}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Header aplikasi: bar judul halaman + area akun, lalu baris ribbon tools
 *  (kontrol tabel aktif atau tools yang disumbang halaman lewat `RibbonSlot`).
 *  Navigasi halaman ada di Sidebar, bukan di sini. */
export default function TopBar() {
  const { user, logoutLocal } = useAuth();
  const {
    jenjangs,
    pilihan,
    adaSemua,
    banyakPilihan,
    bertindak,
    pilih: pilihLembaga,
    pilihBanyak: pilihBanyakLembaga,
    pilihPeran,
    pilihanPeran,
    peranJenjang,
    loading: lembagaLoading,
    efektifSuper,
  } = useLembagaAktif();
  const {
    tahunAjaranNames,
    pilihan: taPilihan,
    pilih: pilihTahunAjaran,
    pilihBanyak: pilihBanyakTahunAjaran,
    loading: taLoading,
  } = useTahunAjaranAktif();
  const {
    semesters,
    pilih: pilihSemester,
    pilihBanyak: pilihBanyakSemester,
    loading: semesterLoading,
  } = useSemesterAktif();

  // Dropdown lembaga = filter (bebas diubah kapan pun, termasuk saat bertindak);
  // peran act-as diatur lewat menu akun (section "Peran sebagai") + banner.
  const urutanLembaga = ['MI', 'MD', 'MTS', 'MLN'];
  const posisiLembaga = (value: string) => {
    const index = urutanLembaga.indexOf(value);
    return index === -1 ? urutanLembaga.length : index;
  };
  const daftarLembaga = [...pilihan].sort((a, b) => posisiLembaga(a.jenjang) - posisiLembaga(b.jenjang));
  const classFilterLembaga = cn('relative mr-0 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-20 after:w-px after:bg-white/15', daftarLembaga.length === 1 ? 'w-[80px]' : 'w-[160px]');
  const taPilihanTerurut = [...taPilihan].sort((a, b) => b.nama.localeCompare(a.nama, 'id', { numeric: true }));
  const { theme, mode, dark, iconSet, warnaUI, navigasi, collapsed, setTheme, setMode, setCollapsed, setIconSet, setWarnaUI, setNavigasi } = useTheme();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const ribbon = useRibbonTable();
  const apiTabel = ribbon?.api ?? null;
  const slot = useRibbonSlotCtx();
  const setSlotEl = slot?.setEl;
  const slotAda = slot?.ada ?? false;
  const slotLabel = slot?.label ?? null;
  const search = useTopBarSearchCtx();
  const setSearchEl = search?.setEl;
  const searchAda = search?.ada ?? false;
  /** Filter global yang tampil — halaman mengatur lewat `<PengaturanHalaman>`. */
  const visCtx = useVisibilitasFilter();
  const tampil = visCtx?.tampil ?? TAMPIL_BAWAAN;
  const filterMode = visCtx?.mode;
  const modeLembaga = filterMode?.lembaga ?? 'single';
  const modeTahunAjaran = filterMode?.tahun_ajaran ?? 'single';
  const modeSemester = filterMode?.semester ?? 'single';
  /** Registrasi halaman aktif (untuk dialog Kelola Halaman). */
  const registrasi = visCtx?.registrasi ?? null;
  const [kelolaHalamanOpen, setKelolaHalamanOpen] = useState(false);
  useEffect(() => {
    const bukaKelolaHalaman = () => {
      if (registrasi && efektifSuper) setKelolaHalamanOpen(true);
    };
    window.addEventListener(EVENT_KELOLA_HALAMAN, bukaKelolaHalaman);
    return () => window.removeEventListener(EVENT_KELOLA_HALAMAN, bukaKelolaHalaman);
  }, [efektifSuper, registrasi]);
  function pilihLembagaNilai(v: string) {
    pilihNilaiFilter(v, jenjangs, modeLembaga, pilihBanyakLembaga, pilihLembaga);
  }
  function pilihTahunAjaranNilai(v: string) {
    pilihNilaiFilter(v, tahunAjaranNames, modeTahunAjaran, pilihBanyakTahunAjaran, pilihTahunAjaran);
  }
  function pilihSemesterNilai(v: string) {
    if (modeSemester === 'single' && (v === '1' || v === '2')) {
      pilihSemester(v);
      return;
    }
    pilihNilaiFilter(v, semesters, modeSemester, pilihBanyakSemester);
  }
  const halaman = halamanDariPath(pathname);
  const [toolsTampil, setToolsTampil] = useState(true);
  const [tabTools, setTabTools] = useState<'halaman' | 'tabel'>('halaman');
  const isSuperAdmin = !!user?.roles.some((r) => r.name === 'super_admin');
  const adaToolsHalaman = slotAda;
  const adaToolsTabel = apiTabel !== null;
  const adaTools = adaToolsHalaman || adaToolsTabel;
  // Dua sumber tools (halaman + tabel) → baris tools memakai tab agar ringkas.
  const banyakTab = adaToolsHalaman && adaToolsTabel;
  const tampilTools = adaTools && toolsTampil;
  /** Ada filter global yang benar-benar dirender di topBar (tempat TabRibbon menempel). */
  const adaFilterTopBar = (tampil.lembaga && (adaSemua || banyakPilihan) && daftarLembaga.length > 0)
    || (tampil.tahun_ajaran && taPilihanTerurut.length > 0)
    || tampil.semester;

  // Elemen target portal tools halaman (lihat `RibbonSlot`).
  const hostRef = useCallback((el: HTMLDivElement | null) => setSlotEl?.(el), [setSlotEl]);
  // Elemen target portal pencarian halaman (lihat `TopBarSearch`).
  const searchHostRef = useCallback((el: HTMLDivElement | null) => setSearchEl?.(el), [setSearchEl]);

  useEffect(() => {
    prefGet(TOOLS_TAMPIL_KEY).then((v) => setToolsTampil(v !== '0')).catch(() => {});
  }, []);

  useEffect(() => {
    if (navigasi !== 'sidebar') return;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed, navigasi, setCollapsed]);

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

  const bolehKelolaHalaman = !!registrasi && efektifSuper;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={!bolehKelolaHalaman}>
        <header
          className="relative shrink-0 border-b border-white/15 px-0.5 pt-1 text-white"
          style={{ background: 'linear-gradient(90deg, var(--sidebar-deep), var(--sidebar))' }}
        >
      {/* Judul halaman untuk pembaca layar (visual tampil di bar judul). */}
      <h1 id="judul_halaman_aktif" className="sr-only">
        {halaman?.label ?? 'SIMPES Admin'}
      </h1>

      {/* Baris 1: judul/pencarian (kiri), filter global (tengah), area akun
          (kanan). Grid `1fr auto 1fr` membuat titik tengah kolom filter
          SELALU sama dengan titik tengah baris/halaman — lepas dari lebar
          judul/search maupun area akun. Padding kiri menyisakan ruang untuk
          kenop navigasi yang melintasi border. */}
      <div data-part="area_judul" className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-0 pb-1 pl-6 pr-3 md:pr-6">
        {/* Kenop navigasi: satu tombol untuk dua arah — chevron kiri
            menyembunyikan rail (saat tampil), chevron kanan menampilkannya
            kembali (saat tertutup). Saat rail tampil, tombol melintasi garis
            border vertikalnya (tepi kiri header = border kanan rail),
            persis seperti tab ribbon yang melintasi border bawahnya. Saat
            rail tertutup garis itu tidak ada, jadi tombol digeser masuk penuh
            ke dalam header agar tidak terpotong tepi layar; pergeserannya
            mengikuti animasi lebar rail lewat `transition-[left]` bersamaan
            `duration-200` milik rail itu sendiri.
            Dijangkarkan ke baris judul lewat `top-1/2` + `-translate-y-1/2`,
            jadi tetap di titik tengah yang sama baik saat ribbon tampil
            maupun disembunyikan. */}
        {navigasi === 'sidebar' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                id="btn_lipat_sidebar"
                type="button"
                aria-label={collapsed ? 'Buka navigasi' : 'Lipat navigasi'}
                aria-expanded={!collapsed}
                onClick={() => setCollapsed(!collapsed)}
                style={{ left: collapsed ? '0px' : '-6px' }}
                className="absolute top-1/2 z-20 grid h-6 w-3 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[var(--sidebar)] text-white/75 transition-[left,color] duration-200 hover:border-white/40 hover:text-white"
              >
                {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{collapsed ? 'Buka navigasi (Ctrl/Cmd+B)' : 'Lipat navigasi (Ctrl/Cmd+B)'}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {/* Kolom kiri: judul halaman / pencarian tunggal (portal). */}
        <div className="flex min-w-0 items-center gap-2">
          {!searchAda && (
            <span id="judul_bar_halaman" className="truncate text-sm font-semibold">
              {halaman?.label ?? 'SIMPES Admin'}
            </span>
          )}
          {/* Pencarian tunggal halaman (portal) — menggantikan judul saat ada. */}
          <div ref={searchHostRef} className={cn('flex min-w-0 items-center', searchAda && 'w-[150px] shrink-0')} />
        </div>

        {/* Kolom tengah: filter global — selalu di tengah baris. Pembungkus
            SELALU dirender (border transparan saat tak ada filter) supaya
            tinggi baris dan jangkar tombol ribbon tidak bergeser saat
            berpindah tab berfilter ↔ tanpa filter. */}
        <div
          className={cn(
            'relative flex min-h-[26px] min-w-0 items-center gap-0 rounded-md border p-0',
            adaFilterTopBar ? 'border-white/15 bg-white/5' : 'border-transparent',
          )}
        >
            {tampil.lembaga && (adaSemua || banyakPilihan) && daftarLembaga.length > 0 && (
            <FilterToggleGroup
              id="btn_menu_lembaga_aktif"
              idSemua="menu_lembaga_aktif_semua"
              ariaLabel="Pilih lembaga aktif"
              label="Lembaga"
              mode={modeLembaga}
              opsi={daftarLembaga.map((l) => ({
                nilai: l.jenjang,
                label: l.jenjang,
                id: `menu_lembaga_aktif_${l.jenjang}`,
              }))}
              dipilih={nilaiDropdown(jenjangs, modeLembaga)}
              tampilkanSemua={false}
              className={classFilterLembaga}
              itemClassName="min-w-0 flex-1 shrink"
              onPilih={pilihLembagaNilai}
              onSemua={() => pilihLembaga(null)}
              disabled={lembagaLoading}
            />
          )}
          {tampil.tahun_ajaran && taPilihanTerurut.length > 0 && (
            <FilterSelect
              id="btn_menu_tahun_ajaran_aktif"
              idSemua="menu_ta_aktif_semua"
              ariaLabel="Pilih tahun ajaran aktif"
              title="Tahun ajaran aktif"
              label="Tahun Ajaran"
              mode={modeTahunAjaran}
              opsi={taPilihanTerurut.map((t) => ({
                nilai: t.nama,
                label: t.nama,
                id: `menu_ta_aktif_${t.nama.replace(/[^0-9]/g, '')}`,
              }))}
              dipilih={nilaiDropdown(tahunAjaranNames, modeTahunAjaran)}
              onPilih={pilihTahunAjaranNilai}
              onSemua={() => pilihTahunAjaran(null)}
              disabled={taLoading}
            />
          )}
          {tampil.semester && (
            <FilterToggleGroup
              id="btn_menu_semester_aktif"
              idSemua="menu_semester_aktif_semua"
              ariaLabel="Pilih semester aktif"
              label="Semester"
              mode={modeSemester}
              opsi={(['1', '2'] as const).map((s) => ({
                nilai: s,
                label: s === '1' ? 'Ganjil' : 'Genap',
                id: `menu_semester_aktif_${s}`,
              }))}
              dipilih={nilaiDropdown(semesters, modeSemester)}
              tampilkanSemua={false}
              className="relative mr-0 w-[160px] before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-20 before:w-px before:bg-white/15"
              itemClassName="min-w-0 flex-1 shrink"
              onPilih={pilihSemesterNilai}
              onSemua={() => pilihSemester(null)}
              disabled={semesterLoading}
            />
          )}
        </div>

        {/* Kolom kanan: area akun. */}
        <div data-part="area_akun" className="flex min-w-0 items-center justify-end gap-0.5">
          {registrasi && efektifSuper ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  id="btn_kelola_halaman"
                  type="button"
                  aria-label="Kelola halaman"
                  onClick={() => setKelolaHalamanOpen(true)}
                  className="mr-1 grid size-6 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <NotebookTabs size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Kelola halaman (filter, kolom, urutan, toolbar)</p>
              </TooltipContent>
            </Tooltip>
          ) : null}
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
            <DropdownMenuContent align="end" className="min-w-[15rem]">
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
              {/* Peran act-as super_admin (pengganti tombol PERAN SEBAGAI di
                  baris atas). Tetap tampil saat bertindak agar ganti/keluar
                  peran bisa dari sini selain banner/Esc. */}
              {!lembagaLoading && isSuperAdmin && adaSemua && pilihanPeran.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-foreground">Peran sebagai</DropdownMenuLabel>
                  {pilihanPeran.map((p) => (
                    <DropdownMenuItem key={p.jenjang} id={`menu_peran_${p.jenjang.toLowerCase()}`} onSelect={() => pilihPeran(p.jenjang)}>
                      <span className="flex-1 truncate">{`${p.jenjang} — ${p.nama}`}</span>
                      {peranJenjang === p.jenjang && <Check data-icon="inline-end" size={14} />}
                    </DropdownMenuItem>
                  ))}
                  {bertindak && (
                    <DropdownMenuItem id="menu_peran_kembali" onSelect={() => pilihPeran(null)}>
                      <span className="flex-1">Kembali ke {user?.name}</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              {/* Area mode tampilan (terang/gelap/sistem) — di bawah nama akun,
                  di atas menu Tema. Bukan item menu agar klik tak menutup. */}
              <div className="px-2 py-1.5">
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Mode tampilan
                </div>
                <ToggleGroup
                  type="single"
                  spacing={0}
                  value={mode}
                  onValueChange={(v) => { if (v) setMode(v as ModeName); }}
                  className="w-full"
                >
                  {MODE_STRIP.map((m) => (
                    <ToggleGroupItem
                      key={m.id}
                      id={`menu_mode_${m.id}`}
                      value={m.id}
                      title={`Mode ${m.nama}`}
                      aria-label={`Mode ${m.nama}`}
                      className="flex-1 gap-1.5"
                    >
                      <m.icon size={14} />
                      <span>{m.nama}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger id="menu_set_navigasi">
                  <Monitor data-icon="inline-start" size={16} />
                  <span className="flex-1">Navigasi</span>
                  <span className="text-xs text-muted-foreground capitalize">{navigasi === 'menubar' ? 'Menubar' : 'Sidebar'}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-44">
                  {(['sidebar', 'menubar'] as const).map((m) => (
                    <DropdownMenuItem key={m} id={`menu_navigasi_${m}`} onSelect={() => setNavigasi(m)}>
                      <span className="flex-1">{m === 'sidebar' ? 'Sidebar' : 'Menubar'}</span>
                      {navigasi === m && <Check data-icon="inline-end" size={14} />}
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

        {/* Gagang ribbon: strip tipis selebar baris, menempel di garis batas
            bawah baris judul/filter (lihat `TabRibbon`). */}
        {adaTools && <TabRibbon tampil={toolsTampil} onToggle={togolTools} />}
      </div>

      {/* Banner "bertindak sebagai lembaga": di atas ribbon agar selalu terlihat. */}
      <BannerBertindak terbuka={false} onTutup={() => {}} />

      {/* Baris 2: isi ribbon tools kontekstual (kontrol tabel / tools halaman). */}
      {adaTools && tampilTools && (
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
          <div className="flex min-h-[76px] flex-nowrap items-stretch gap-2 overflow-x-auto px-3 py-3 md:px-5">
            {(!banyakTab || tabTools === 'halaman') && <div ref={hostRef} className="contents" />}
            {(!banyakTab || tabTools === 'tabel') && apiTabel && <RibbonTabel apiTabel={apiTabel} />}
          </div>
        </div>
      )}

      {registrasi && (
        <DialogKelolaHalaman
          open={kelolaHalamanOpen}
          onOpenChange={setKelolaHalamanOpen}
          pageKey={registrasi.pageKey}
          judul={halaman?.label ?? registrasi.pageKey}
          tabel={registrasi.tabel}
          filterBawaan={registrasi.bawaan}
        />
      )}
        </header>
      </ContextMenuTrigger>
      {bolehKelolaHalaman ? (
        <ContextMenuContent>
          <ContextMenuItem
            id="menu_kelola_halaman"
            onSelect={() => window.dispatchEvent(new CustomEvent(EVENT_KELOLA_HALAMAN))}
          >
            <NotebookTabs data-icon="inline-start" size={16} /> Kelola Halaman
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
