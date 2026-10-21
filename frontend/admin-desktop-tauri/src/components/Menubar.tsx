import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NAV_GRUP, blokGrup, halamanDariPath, halamanSubgrup, izinHalaman, kunciGrupNavigasi, kunciHalamanNavigasi, kunciSubNavigasi, type HalamanDef, type SubgrupNav, type TabKategori } from '@/lib/halaman';
import { useNavigasiVisibilitas } from '@/components/NavigasiVisibilitasProvider';
import { bisa, logout } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import { useTheme, type ThemeName } from '@/theme';
import { ICON_SETS } from '@/iconSets';
import { THEME_PRESETS } from '@/themes';
import { DEFAULT_PREFS, DENSITY_PX, DensityName, RADIUS_MAX, RADIUS_MIN, WARNA_UI } from '@/prefs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Blend, Check, Crop, DensityMedium, LogOut, Minus, Monitor, Paintbrush, Palette, Plus } from '@/icons';
import { cn } from '@/lib/utils';

const LABEL_MENU: Record<TabKategori, string> = {
  beranda: 'Berkas',
  master: 'Data Induk',
  psb: 'PSB',
  santri: 'Santri',
  pegawai: 'Pegawai',
  dokumen: 'Dokumen',
  keuangan: 'Keuangan',
  penilaian: 'Penilaian',
  kurikulum: 'Kurikulum',
  pengaturan: 'Pengaturan',
};

/** Izin halaman khusus super_admin: disembunyikan saat bertindak sebagai lembaga. */
const TERKUNCI = new Set(['izin.lihat', 'server.lihat']);

/** Bar menu ala aplikasi desktop: pengganti Sidebar bila pref `navigasi`
 *  bernilai `menubar`. Sumber halaman sama (`HALAMAN` + izin matriks). */
export default function Menubar() {
  const { user, logoutLocal } = useAuth();
  const { bertindak } = useLembagaAktif();
  const { tersembunyi } = useNavigasiVisibilitas();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const halAktif = halamanDariPath(pathname);

  const {
    theme, setTheme, iconSet, setIconSet, warnaUI, setWarnaUI,
    navigasi, setNavigasi, radius, setRadius, density, setDensity, dark,
  } = useTheme();

  const DENSITY_UI: { id: DensityName; nama: string; px: number }[] = [
    { id: 'ramping', nama: 'Ramping', px: DENSITY_PX.ramping },
    { id: 'sedang', nama: 'Sedang', px: DENSITY_PX.sedang },
    { id: 'nyaman', nama: 'Nyaman', px: DENSITY_PX.nyaman },
  ];

  async function onLogout() {
    await logout();
    await logoutLocal();
    navigate('/login');
  }

  /** Halaman gabungan (mis. Data Induk) cukup punya SALAH SATU izin tab. */
  function bolehLihat(h: HalamanDef): boolean {
    return !tersembunyi.has(kunciHalamanNavigasi(h.to))
      && izinHalaman(h).some((izin) => bisa(user, izin) && !(bertindak && TERKUNCI.has(izin)));
  }

  /** Submenu siap render (rekursif): halaman terizin + anak terisi. */
  interface NodeMenu {
    def: SubgrupNav;
    kunci: string;
    items: HalamanDef[];
    anak: NodeMenu[];
  }

  function siapkan(grup: TabKategori, subs: SubgrupNav[] | undefined, prefix: string): NodeMenu[] {
    return (subs ?? [])
      .map((s): NodeMenu => {
        const kunci = `${prefix}:${s.id}`;
        return {
          def: s,
          kunci,
          items: halamanSubgrup(grup, s.id).filter(bolehLihat),
          anak: siapkan(grup, s.anak, kunci),
        };
      })
      .filter((n) => !tersembunyi.has(kunciSubNavigasi(n.kunci)))
      .filter((n) => n.items.length > 0 || n.anak.length > 0);
  }

  /** Submenu bersarang (rekursif): anak subgrup dulu, lalu halaman langsung. */
  function renderSubMenu(n: NodeMenu) {
    const SubIkon = n.def.icon;
    const idAman = n.kunci.replaceAll(':', '_');
    return (
      <DropdownMenuSub key={n.kunci}>
        <DropdownMenuSubTrigger id={`menu_${idAman}`}>
          <SubIkon size={16} />
          {n.def.label}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {n.anak.map(renderSubMenu)}
          {n.items.map(itemMenu)}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }
  function itemMenu(h: HalamanDef) {
    const Icon = h.icon;
    const aktif = halAktif === h;
    return (
      <DropdownMenuItem key={h.to} asChild>
        <Link
          to={h.to}
          aria-current={aktif ? 'page' : undefined}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2',
            aktif && 'bg-accent font-medium text-accent-foreground',
          )}
        >
          <Icon size={16} />
          {h.label}
        </Link>
      </DropdownMenuItem>
    );
  }

  return (
    <nav
      data-slot="menubar"
      aria-label="Menu aplikasi"
      className="flex shrink-0 items-center gap-0.5 border-b border-[color:var(--sidebar-border)] bg-[var(--sidebar)] px-2 py-1 text-[var(--sidebar-foreground)]"
    >
      <span
        className="mr-2 truncate px-1 text-xs font-semibold tracking-wide"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        SIMPES
      </span>
      {NAV_GRUP.map((g) => {
        if (tersembunyi.has(kunciGrupNavigasi(g.id))) return null;

        const entri: ({ sub: NodeMenu } | { hal: HalamanDef })[] = [];
        for (const b of blokGrup(g.id)) {
          if (Array.isArray(b)) {
            for (const h of b.filter(bolehLihat)) entri.push({ hal: h });
            continue;
          }
          const node = siapkan(g.id, [b], g.id)[0];
          if (node) entri.push({ sub: node });
        }
        if (g.id !== 'beranda' && entri.length === 0) return null;
        return (
          <DropdownMenu key={g.id}>
            <DropdownMenuTrigger
              id={`menu_${g.id}`}
              className="rounded-md px-2.5 py-1 text-xs text-[color-mix(in_srgb,var(--sidebar-foreground)_80%,transparent)] outline-none hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] hover:text-[var(--sidebar-foreground)] focus-visible:ring-2 focus-visible:ring-[color:var(--chrome-ring)] data-[state=open]:bg-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)] data-[state=open]:text-[var(--sidebar-foreground)]"
            >
              {LABEL_MENU[g.id]}
            </DropdownMenuTrigger>
            <DropdownMenuContent data-slot="menubar-content" align="start" className="min-w-52">
              {entri.map((e) => ('sub' in e ? renderSubMenu(e.sub) : itemMenu(e.hal)))}
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

      <DropdownMenu key="tampilan">
        <DropdownMenuTrigger
          id="menu_tampilan"
          className="rounded-md px-2.5 py-1 text-xs text-[color-mix(in_srgb,var(--sidebar-foreground)_80%,transparent)] outline-none hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] hover:text-[var(--sidebar-foreground)] focus-visible:ring-2 focus-visible:ring-[color:var(--chrome-ring)] data-[state=open]:bg-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)] data-[state=open]:text-[var(--sidebar-foreground)]"
        >
          Tampilan
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger id="menu_set_tema">
              <Palette data-icon="inline-start" size={16} />
              <span className="flex-1">Tema</span>
              <span className="text-xs text-muted-foreground">{THEME_PRESETS.find((t) => t.id === theme)?.nama}</span>
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
              <span className="text-xs text-muted-foreground">{ICON_SETS.find((s) => s.id === iconSet)?.nama}</span>
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
            <DropdownMenuSubContent className="min-w-44">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="text-xs text-muted-foreground">Membulat</span>
                <div className="flex items-center gap-1">
                  <Button
                    id="btn_radius_kurang_menubar"
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
                  <span id="val_radius_menubar" aria-live="polite" className="w-10 text-center text-xs tabular-nums">
                    {radius}px
                  </span>
                  <Button
                    id="btn_radius_tambah_menubar"
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
            <DropdownMenuSubContent className="min-w-44">
              {DENSITY_UI.map((d) => (
                <DropdownMenuItem key={d.id} id={`menu_density_${d.id}`} onSelect={() => setDensity(d.id)} className="capitalize">
                  <span className="flex-1">{d.nama}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{d.px}px</span>
                  {density === d.id && <Check data-icon="inline-end" size={14} />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
