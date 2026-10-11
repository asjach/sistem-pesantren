import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logout } from '@/api/auth';
import { isTauri } from '@/api/client';
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
import { DEFAULT_PREFS, DENSITY_PX, DensityName, RADIUS_MAX, RADIUS_MIN, WARNA_UI } from '@/prefs';
import { Blend, Check, ChevronDown, ChevronLeft, ChevronRight, Crop, DensityMedium, LogOut, Minus, Monitor, Moon, NotebookTabs, Paintbrush, Palette, Plus, Sun, Users } from '@/icons';
import { useTopBarSearchCtx } from '@/components/TopBarSearch';
import { useAksiSeretSidebar } from '@/components/SeretSidebar';
import { apakahKlik } from '@/components/useLebarSidebar';
import BannerBertindak from '@/components/BannerBertindak';
import DialogFilterHalaman from '@/components/kelolaHalaman/DialogFilterHalaman';
import DialogKelolaTabel from '@/components/kelolaTabel/DialogKelolaTabel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { halamanDariPath } from '@/lib/halaman';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ---------- Header: judul halaman + area akun (atas) & baris tools (bawah) ----------

/** Mode tampilan terang/gelap/sistem (ikon saja) — di dekat akun pengguna. */
const MODE_STRIP: { id: ModeName; nama: string; icon: typeof Sun }[] = [
  { id: 'terang', nama: 'Terang', icon: Sun },
  { id: 'gelap', nama: 'Gelap', icon: Moon },
  { id: 'sistem', nama: 'Sistem', icon: Monitor },
];

/** Kerapatan baris grid (sama dengan DENSITY_PX): ramping 20px, sedang 24px,
 *  nyaman 30px. Bawaan 'sedang'. Grid (ExcelTable) sudah membaca pref ini. */
const DENSITY_UI: { id: DensityName; nama: string; px: number }[] = [
  { id: 'ramping', nama: 'Ramping', px: DENSITY_PX.ramping },
  { id: 'sedang', nama: 'Sedang', px: DENSITY_PX.sedang },
  { id: 'nyaman', nama: 'Nyaman', px: DENSITY_PX.nyaman },
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
  'flex items-center gap-2 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--chrome-ring)]';
const navIdle =
  'text-[var(--sidebar-foreground)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] hover:text-[var(--sidebar-foreground)]';

/** Header aplikasi: bar judul halaman + filter global + area akun.
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
  const classFilterLembaga = cn('relative mr-0 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-20 after:w-px after:bg-[color:var(--sidebar-border)]', daftarLembaga.length === 1 ? 'w-[80px]' : 'w-[160px]');
  const taPilihanTerurut = [...taPilihan].sort((a, b) => b.nama.localeCompare(a.nama, 'id', { numeric: true }));
  const { theme, mode, dark, iconSet, warnaUI, navigasi, radius, density, setDensity, collapsed, setTheme, setMode, setCollapsed, setIconSet, setWarnaUI, setNavigasi, setRadius } = useTheme();
  /** Kenop lipat merangkap gagang seret lebar; aksinya dari seret bersama. */
  const { mulaiSeret: mulaiSeretKenop } = useAksiSeretSidebar();
  /** Tooltip kenop dikendalikan agar bisa ditutup saat seretan dimulai. */
  const [tipKenop, setTipKenop] = useState(false);
  /** Posisi x pointer saat mousedown kenop terakhir (null = aktivasi keyboard).
   *  Pembeda klik (toggle) vs seretan (atur lebar) — lihat `apakahKlik`. */
  const xKlikKenop = useRef<number | null>(null);
  const nav = useNavigate();
  const { pathname } = useLocation();
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
  /** Registrasi halaman aktif (untuk dialog Kelola Tabel). */
  const registrasi = visCtx?.registrasi ?? null;
  /** Dialog aktif: kelola tabel tertentu, pemilih tabel, atau filter halaman
   *  (halaman tanpa tabel). */
  const [tabelKelola, setTabelKelola] = useState<string | null>(null);
  const [pilihTabelOpen, setPilihTabelOpen] = useState(false);
  const [filterHalamanOpen, setFilterHalamanOpen] = useState(false);
  const bukaKelola = useCallback(() => {
    if (!registrasi || !efektifSuper) return;
    if (registrasi.tabel.length === 0) {
      setFilterHalamanOpen(true);
      return;
    }
    if (registrasi.tabel.length === 1) {
      setTabelKelola(registrasi.tabel[0].key);
      return;
    }
    setPilihTabelOpen(true);
  }, [registrasi, efektifSuper]);
  useEffect(() => {
    window.addEventListener(EVENT_KELOLA_HALAMAN, bukaKelola);
    return () => window.removeEventListener(EVENT_KELOLA_HALAMAN, bukaKelola);
  }, [bukaKelola]);
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
  /** Tabel yang dibuka di dialog Kelola Tabel (null = tidak ada). */
  const tabelKelolaData = tabelKelola === null
    ? null
    : registrasi?.tabel.find((t) => t.key === tabelKelola) ?? registrasi?.tabel[0] ?? null;
  const isSuperAdmin = !!user?.roles.some((r) => r.name === 'super_admin');
  /** Ada filter global yang benar-benar dirender di topBar. */
  const adaFilterTopBar = (tampil.lembaga && (adaSemua || banyakPilihan) && daftarLembaga.length > 0)
    || (tampil.tahun_ajaran && taPilihanTerurut.length > 0)
    || tampil.semester;

  // Elemen target portal pencarian halaman (lihat `TopBarSearch`).
  const searchHostRef = useCallback((el: HTMLDivElement | null) => setSearchEl?.(el), [setSearchEl]);

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
          className="relative shrink-0 border-b border-[color:var(--sidebar-border)] bg-[var(--sidebar)] px-0.5 pt-1 text-[var(--sidebar-foreground)]"
          style={{ background: 'var(--sidebar)' }}
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
      <div data-part="area_judul" className="relative grid min-h-[32px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-0 pb-1 pl-6 pr-3 md:pr-6">
        {/* Kenop navigasi: satu tombol untuk dua arah — chevron kiri
            menyembunyikan rail (saat tampil), chevron kanan menampilkannya
            kembali (saat tertutup). Klik = lipat/buka; SERET = atur lebar,
            aksi yang sama dengan gagang di tepi kanan sidebar (keduanya satu
            instans seret, lihat SeretSidebar). Sisi tab yang digambar
            satu per satu dihapus karena berdesakan dengan garis yang sudah ada,
            sehingga yang tersisa cuma satu garis vertikal 1px di tepi kanan +
            chevron. Tab menyentuh garis pembatas vertikal (tepi kiri header =
            border kanan rail) di sebelah kirinya:
            - `border-l` jatuh di piksel yang SAMA dengan border kanan rail dan
              garis gagang seret (yang sudah berimpit) → pemisah rail↔header
              tebal di tinggi header. Setelah dihapus, garis itu utuh & seragam.
            - `border-b` duduk tepat di atas `border-b` header → dua garis
              horizontal berdempetan.
            - `border-t` jatuh di luar jendela (`-top-1`) → tak pernah terlihat.
            Karena tak ada `border-l`, latar tab HARUS transparan: kalau tetap
            berlatar, padding box-nya melebar 1px ke kiri dan menutup piksel
            garis rail, jadi pemisah justru hilang di tinggi header.
            Tab karena itu tak lagi "melintasi" border bawah header seperti tab
            ribbon — bentuknya sekarang gagang vertikal, ditandai garis kanannya
            yang terus terang saat hover. Offsets `left` (relatif ke baris judul,
            yang bergeser mengikuti lebar rail): `-3px` saat rail tampil — tepi kiri tab jatuh
            tepat di garis pembatas, porsi 1px di sisi rail transparan jadi
            garisnya tak tertutup; `-2px` saat rail tertutup — membatalkan
            `px-0.5` header sehingga tab rata dengan tepi kiri jendela. Tidak
            ada yang terpotong: saat tertutup lebar rail 0, jadi tepi baris = 2
            dan tepi kiri tombol jatuh tepat di 0. Pergeserannya mengikuti
            animasi lebar rail lewat `transition-[left]` bersamaan
            `duration-200` milik rail itu sendiri.
            Tingginya disamakan dengan topBar: direntang penuh dari tepi atas
            header (`-top-1` menutup padding atas header) sampai dasar baris
            judul, jadi tinggi baris tak perlu diukur atau di-hardcode. Tanpa
            radius — bentuknya siku, bukan pil — supaya ujung garis genggamannya
            tegas, sama seperti garis pembatas di sebelahnya.
            Lebar tab cuma 12px, terlalu kecil untuk target pointer, jadi area
            kliknya diperluas lewat pseudo-elemen (tidak mengubah tampilan:
            pseudo tak ikut tata letak). Hanya ke KANAN — ke arah ruang kosong
            `pl-6` baris judul — karena strip di kiri tombol adalah gagang
            seret lebar sidebar (`.absolute … w-1.5 cursor-col-resize`) yang
            tak boleh direbut; perluasan 12px ke kanan menaikkan target ke
            24px, setara tombol ikon lain di header. */}
        {navigasi === 'sidebar' && (
          <Tooltip open={tipKenop} onOpenChange={setTipKenop}>
            <TooltipTrigger asChild>
              <button
                id="btn_lipat_sidebar"
                type="button"
                aria-label={collapsed
                  ? 'Buka navigasi (Ctrl/Cmd+B); seret untuk mengatur lebar'
                  : 'Lipat navigasi (Ctrl/Cmd+B); seret untuk mengatur lebar'}
                aria-expanded={!collapsed}
                onMouseDown={(e) => {
                  // Seret = atur lebar (aksi yang sama dengan gagang di tepi
                  // sidebar); klik tanpa geseran tetap melipat. Tooltip
                  // ditutup dulu agar tak mengambang selama seretan.
                  setTipKenop(false);
                  xKlikKenop.current = e.clientX;
                  mulaiSeretKenop(e);
                }}
                onClick={(e) => {
                  const x = xKlikKenop.current;
                  xKlikKenop.current = null;
                  if (!apakahKlik(x, e.clientX)) return;
                  setCollapsed(!collapsed);
                }}
                style={{ left: collapsed ? '-2px' : '-3px' }}
                className="absolute -top-1 bottom-0 z-20 grid w-3 cursor-col-resize place-items-center rounded-none border-r border-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)] bg-transparent text-[color-mix(in_srgb,var(--sidebar-foreground)_75%,transparent)] outline-none transition-[left,color] duration-200 before:absolute before:inset-y-0 before:left-0 before:-right-3 before:content-[''] touch-none select-none hover:border-[color-mix(in_srgb,var(--sidebar-foreground)_40%,transparent)] hover:text-[var(--sidebar-foreground)] focus-visible:ring-2 focus-visible:ring-[color:var(--chrome-ring)]"
              >
                {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {collapsed ? 'Buka navigasi (Ctrl/Cmd+B)' : 'Lipat navigasi (Ctrl/Cmd+B)'}
                {' · Seret untuk mengatur lebar'}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
        {/* Kolom kiri: judul halaman / pencarian tunggal (portal). */}
        <div className="flex min-w-0 items-center gap-2">
          {!searchAda && (
            <span id="judul_bar_halaman" className="truncate text-xs font-semibold">
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
            adaFilterTopBar ? 'border-[color:var(--sidebar-border)] bg-[color-mix(in_srgb,var(--sidebar-foreground)_5%,transparent)]' : 'border-transparent',
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
              className="relative mr-0 w-[160px] before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-20 before:w-px before:bg-[color:var(--sidebar-border)]"
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
                  aria-label={registrasi.tabel.length === 0 ? 'Kelola filter halaman' : 'Kelola tabel'}
                  onClick={bukaKelola}
                  className="mr-1 grid size-6 place-items-center rounded-md text-[color-mix(in_srgb,var(--sidebar-foreground)_75%,transparent)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] hover:text-[var(--sidebar-foreground)] focus-visible:ring-2 focus-visible:ring-[color:var(--chrome-ring)]"
                >
                  <NotebookTabs size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {registrasi.tabel.length === 0
                    ? 'Kelola filter halaman'
                    : 'Kelola tabel (kolom, urutan, toolbar, filter)'}
                </p>
              </TooltipContent>
            </Tooltip>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                id="btn_menu_pengguna"
                className={cn(navBase, navIdle, 'data-[state=open]:bg-[color-mix(in_srgb,var(--sidebar-foreground)_15%,transparent)]')}
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger id="menu_set_radius">
                  <Crop data-icon="inline-start" size={16} />
                  <span className="flex-1">Sudut</span>
                  <span className="text-xs text-muted-foreground">{radius}px</span>
                </DropdownMenuSubTrigger>
                {/* Stepper di dalam konten tak menutup menu (bukan item menu) —
                    pola yang sama dengan strip Mode tampilan di atas. */}
                <DropdownMenuSubContent className="min-w-44">
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="text-xs text-muted-foreground">Membulat</span>
                    <div className="flex items-center gap-1">
                      <Button
                        id="btn_radius_kurang"
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Kurangi sudut"
                        title="Kurangi sudut"
                        disabled={radius <= RADIUS_MIN}
                        onClick={() => setRadius(radius - 1)}
                      >
                        <Minus size={14} />
                      </Button>
                      <span id="val_radius" aria-live="polite" className="w-10 text-center text-xs tabular-nums">
                        {radius}px
                      </span>
                      <Button
                        id="btn_radius_tambah"
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Tambah sudut"
                        title="Tambah sudut"
                        disabled={radius >= RADIUS_MAX}
                        onClick={() => setRadius(radius + 1)}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger id="menu_set_density">
                  <DensityMedium data-icon="inline-start" size={16} />
                  <span className="flex-1">Kerapatan</span>
                  <span className="text-xs text-muted-foreground capitalize">{density}</span>
                </DropdownMenuSubTrigger>
                {/* Tiga tingkat kerapatan baris grid; bukan item menu agar klik
                    tak menutup (sama seperti strip Mode & stepper Sudut). */}
                <DropdownMenuSubContent className="min-w-44">
                  {DENSITY_UI.map((d) => (
                    <DropdownMenuItem
                      key={d.id}
                      id={`menu_density_${d.id}`}
                      onSelect={() => setDensity(d.id)}
                      className="capitalize"
                    >
                      <span className="flex-1">{d.nama}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{d.px}px</span>
                      {density === d.id && <Check data-icon="inline-end" size={14} />}
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

      <BannerBertindak terbuka={false} onTutup={() => {}} />

      {registrasi && efektifSuper && tabelKelolaData ? (
        <DialogKelolaTabel
          open
          onOpenChange={(o) => { if (!o) setTabelKelola(null); }}
          tableKey={tabelKelolaData.key}
          judul={tabelKelolaData.judul ?? tabelKelolaData.key}
          fields={tabelKelolaData.fields}
          filterRelevan={registrasi.filterRelevan}
          filterBawaan={registrasi.bawaan}
          filterModeBawaan={registrasi.modeBawaan}
          jumlahTabel={registrasi.tabel.length}
        />
      ) : null}

      {registrasi && efektifSuper && registrasi.tabel.length > 1 ? (
        <Dialog open={pilihTabelOpen} onOpenChange={setPilihTabelOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Kelola tabel</DialogTitle>
              <DialogDescription>
                Halaman ini punya beberapa tabel. Pilih tabel yang ingin diatur.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              {registrasi.tabel.map((t) => (
                <Button
                  key={t.key}
                  type="button"
                  variant="outline"
                  id={`btn_pilih_tabel_${t.key}`}
                  className="justify-start"
                  onClick={() => {
                    setPilihTabelOpen(false);
                    setTabelKelola(t.key);
                  }}
                >
                  {t.judul ?? t.key}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {registrasi && efektifSuper && registrasi.tabel.length === 0 ? (
        <DialogFilterHalaman
          open={filterHalamanOpen}
          onOpenChange={setFilterHalamanOpen}
          pageKey={registrasi.pageKey}
          judul={halaman?.label ?? registrasi.pageKey}
          filterRelevan={registrasi.filterRelevan}
          bawaan={registrasi.bawaan}
          modeBawaan={registrasi.modeBawaan}
        />
      ) : null}
        </header>
      </ContextMenuTrigger>
      {bolehKelolaHalaman ? (
        <ContextMenuContent>
          <ContextMenuItem
            id="menu_kelola_halaman"
            onSelect={() => window.dispatchEvent(new CustomEvent(EVENT_KELOLA_HALAMAN))}
          >
            <NotebookTabs data-icon="inline-start" size={16} />
            {registrasi?.tabel.length === 0 ? 'Kelola Filter Halaman' : 'Kelola Tabel'}
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
