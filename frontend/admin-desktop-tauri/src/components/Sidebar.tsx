import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_GRUP, halamanDariPath, halamanGrupLangsung, halamanSubgrup, jalurSubgrup, type HalamanDef, type SubgrupNav, type TabKategori } from '@/lib/halaman';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import { useTheme } from '@/theme';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronLeft, ChevronRight } from '@/icons';

const itemBase =
  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';

/** Konektor cabang pohon: garis horizontal dari garis panduan vertikal ke
 *  baris anak (induk = wadah `pl-2`, jadi tick `-left-2`/`w-2` pas menyentuh
 *  garisnya), diakhiri node bulat tepat di ujung garis — menempel garis,
 *  tidak menyentuh teks (teks mulai setelah `px-2.5` tautan). Jalur ke halaman
 *  aktif memakai warna aksen tema (`aktif`), cabang lain redup. */
function cabang(aktif = false) {
  const warna = aktif ? 'before:bg-[var(--accent)] after:bg-[var(--accent)]' : 'before:bg-white/15 after:bg-white/40';
  return `relative before:absolute before:top-1/2 before:-left-2 before:h-px before:w-2 before:-translate-y-1/2 before:content-[""] after:absolute after:top-1/2 after:left-0 after:size-[5px] after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:content-[""] ${warna}`;
}

/** Segmen garis vertikal per baris halaman (wadah ber-`pl-2`, garis di
 *  `-left-2` sejajar tick): paruh atas selalu ada (aksen bila di jalur),
 *  paruh bawah menyambung ke baris berikut (aksen bila baris berikut juga di
 *  jalur, abu bila tidak) — tanpa celah kosong. Baris terakhir tanpa paruh
 *  bawah (berhenti di titik). */
function segmenBaris(atasAktif: boolean, bawah: 'aksen' | 'abu' | 'nihil') {
  return cn(
    'relative before:absolute before:top-0 before:-left-2 before:w-px before:content-[""] before:bottom-1/2',
    atasAktif ? 'before:bg-[var(--accent)]' : 'before:bg-white/15',
    bawah !== 'nihil'
      && 'after:absolute after:top-1/2 after:bottom-0 after:-left-2 after:w-px after:content-[""]',
    bawah === 'aksen' && 'after:bg-[var(--accent)]',
    bawah === 'abu' && 'after:bg-white/15',
  );
}

/** Lanjutan garis luar di samping blok bersarang yang masih punya adik di
 *  bawahnya: garis penuh sejajar garis luar (blok menjorok 15px + pad 8px
 *  → garis di -23px dari wadah bersarang). */
function lanjutanLuar(aktif = false) {
  return cn(
    'relative before:absolute before:top-0 before:bottom-0 before:-left-[23px] before:w-px before:content-[""]',
    aktif ? 'before:bg-[var(--accent)]' : 'before:bg-white/15',
  );
}

/** Segmen pembungkus tombol sub-grup: paruh atas masuk ke titik (aksen bila
 *  di jalur), paruh bawah SELALU abu sebagai penyambung ke blok bersarang —
 *  tanpa celah kosong. Paruh bawah absen bila sub terakhir & tertutup (tak
 *  ada lanjutan) agar tak menjuntai. */
function segmenSub(terakhir: boolean, buka: boolean, segAktif: boolean) {
  return cn(
    'relative before:absolute before:top-0 before:-left-2 before:w-px before:content-[""] before:bottom-1/2',
    segAktif ? 'before:bg-[var(--accent)]' : 'before:bg-white/15',
    (!terakhir || buka)
      && 'after:absolute after:top-1/2 after:bottom-0 after:-left-2 after:w-px after:bg-white/15 after:content-[""]',
  );
}

/** Status lipat grup/subgrup (milik perangkat): daftar kunci yang tertutup
 *  (id grup, atau `grup:sub` untuk subgrup). */
const KUNCI_GRUP_TUTUP = 'simpes_sidebar_grup';

/** Semua kunci lipat yang valid (grup + seluruh tingkat subgrup). */
function kunciValid(): Set<string> {
  const valid = new Set<string>();
  const jalan = (subs: SubgrupNav[] | undefined, prefix: string) => {
    for (const s of subs ?? []) {
      const kunci = `${prefix}:${s.id}`;
      valid.add(kunci);
      jalan(s.anak, kunci);
    }
  };
  for (const g of NAV_GRUP) {
    valid.add(g.id);
    jalan(g.anak, g.id);
  }
  return valid;
}

function bacaGrupTutup(): Set<string> {
  try {
    const mentah = localStorage.getItem(KUNCI_GRUP_TUTUP);
    if (!mentah) return new Set();
    const daftar: unknown = JSON.parse(mentah);
    if (!Array.isArray(daftar)) return new Set();
    const valid = kunciValid();
    return new Set(daftar.filter((v): v is string => typeof v === 'string' && valid.has(v)));
  } catch {
    return new Set();
  }
}

function simpanGrupTutup(next: Set<string>) {
  try {
    localStorage.setItem(KUNCI_GRUP_TUTUP, JSON.stringify([...next]));
  } catch {
    /* penyimpanan penuh/terkunci: status lipat tak persist */
  }
}

/** Navigasi utama aplikasi: rail kiri berisi tautan halaman per kategori.
 *  Bisa dilipat ke rail ikon (tombol atau Ctrl/Cmd+B); status di pref
 *  `simpes_sidebar`. Tautan halaman terpisah dari tools di ribbon. */
export default function Sidebar() {
  const { collapsed, setCollapsed } = useTheme();
  const { user } = useAuth();
  const { bertindak } = useLembagaAktif();
  // Saat bertindak sebagai lembaga, kemampuan super_admin dianggap nonaktif
  // (halaman khusus super_admin ikut disembunyikan).
  const terkunci = new Set(['izin.lihat', 'server.lihat']);
  /** Grup/subgrup yang sedang tertutup (bawaan semua terbuka). */
  const [tutup, setTutup] = useState<Set<string>>(bacaGrupTutup);
  const { pathname } = useLocation();
  const halAktif = halamanDariPath(pathname);

  function bukaKunci(kunci: string[]) {
    setTutup((prev) => {
      if (kunci.every((k) => !prev.has(k))) return prev;
      const next = new Set(prev);
      for (const k of kunci) next.delete(k);
      simpanGrupTutup(next);
      return next;
    });
  }

  function jungkitGrup(id: string) {
    const next = new Set(tutup);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTutup(next);
    simpanGrupTutup(next);
  }

  /** Halaman diizinkan untuk user ini (termasuk penguncian saat bertindak). */
  function bolehLihat(h: HalamanDef): boolean {
    return bisa(user, h.permission) && !(bertindak && terkunci.has(h.permission));
  }

  /** Kunci jalur halaman aktif (grup + tiap tingkat sub) untuk sorot induk. */
  const jalurAktif: string[] = (() => {
    if (!halAktif) return [];
    const jalur = halAktif.sub ? (jalurSubgrup(halAktif.tab, halAktif.sub) ?? []) : [];
    const keluar: string[] = [halAktif.tab];
    let bangun: string = halAktif.tab;
    for (const s of jalur) {
      bangun += `:${s}`;
      keluar.push(bangun);
    }
    return keluar;
  })();

  // Halaman aktif pindah ke grup/subgrup yang tertutup (mis. via URL) →
  // buka jalurnya agar tautan aktif tetap terlihat.
  useEffect(() => {
    if (!halAktif) return;
    bukaKunci(jalurAktif);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /** Tautan halaman: rail lipat = ikon saja; anak submenu = teks menjorok
   *  tanpa ikon; selain itu ikon + label penuh. */
  function tautanHalaman(h: HalamanDef, ikonSaja: boolean, anak = false) {    const Icon = h.icon;
    return (
      <NavLink
        key={h.to}
        to={h.to}
        end={h.to === '/'}
        title={ikonSaja ? h.label : undefined}
        className={({ isActive }) =>
          cn(
            itemBase,
            ikonSaja && 'justify-center px-0',
            anak && ['py-1 text-[13px]', cabang(isActive)],
            isActive
              ? 'bg-white/20 font-semibold text-white'
              : 'text-white/75 hover:bg-white/10 hover:text-white',
          )
        }
      >
        {!anak && <Icon size={16} />}
        {!ikonSaja && <span className="truncate">{h.label}</span>}
      </NavLink>
    );
  }

  /** Subgrup siap render (rekursif): halaman terizin + anak terisi. */
  interface NodeSiap {
    def: SubgrupNav;
    kunci: string;
    items: HalamanDef[];
    anak: NodeSiap[];
  }

  function siapkan(grup: TabKategori, subs: SubgrupNav[] | undefined, prefix: string): NodeSiap[] {
    return (subs ?? [])
      .map((s): NodeSiap => {
        const kunci = `${prefix}:${s.id}`;
        return {
          def: s,
          kunci,
          items: halamanSubgrup(grup, s.id).filter(bolehLihat),
          anak: siapkan(grup, s.anak, kunci),
        };
      })
      .filter((n) => n.items.length > 0 || n.anak.length > 0);
  }

  /** Semua halaman daun di bawah node (subgrup dulu, lalu langsung). */
  function kumpulkan(n: NodeSiap): HalamanDef[] {
    return [...n.anak.flatMap(kumpulkan), ...n.items];
  }

  /** Indeks gabungan (subgrup + halaman langsung) yang memuat halaman aktif
   *  (-1 = tak ada); dipakai garis aksen nyambung root → halaman aktif. */
  function indeksAktif(subs: NodeSiap[], items: HalamanDef[]): number {
    for (let i = 0; i < subs.length; i++) {
      if (jalurAktif.includes(subs[i].kunci)) return i;
    }
    if (halAktif === null) return -1;
    const ii = items.indexOf(halAktif);
    return ii >= 0 ? subs.length + ii : -1;
  }

  /** Baris induk subgrup + isi bersarang (rekursif). Garis aksen masuk dari
   *  atas ke titik tombol (`segAktif`, selalu berhenti di titik — tanpa
   *  terus ke bawah); `lanjutAktif` = halaman aktif ada di adik bawah blok. */
  function renderSub(n: NodeSiap, terakhir: boolean, segAktif: boolean, lanjutAktif: boolean) {
    const SubIkon = n.def.icon;
    const buka = !tutup.has(n.kunci);
    const idAman = n.kunci.replaceAll(':', '_');
    const idx = indeksAktif(n.anak, n.items);
    return (
      <div key={n.kunci}>
        <div className={segmenSub(terakhir, buka, segAktif)}>
          <button
            id={`btn_grup_sidebar_${idAman}`}
            type="button"
            aria-expanded={buka}
            aria-controls={`grup_sidebar_${idAman}`}
            title={`${buka ? 'Tutup' : 'Buka'} grup ${n.def.label}`}
            aria-label={`${buka ? 'Tutup' : 'Buka'} grup ${n.def.label}`}
            onClick={() => jungkitGrup(n.kunci)}
            className={cn(
              itemBase,
              'w-full py-1 text-[13px]',
              cabang(jalurAktif.includes(n.kunci)),
              'text-white/75 hover:bg-white/10 hover:text-white',
            )}
          >
            <SubIkon size={14} />
            <span className="flex-1 truncate text-left">{n.def.label}</span>
            <ChevronDown size={12} className={cn('shrink-0 text-white/60 transition-transform', !buka && '-rotate-90')} />
          </button>
        </div>
        {buka && (
          <div
            id={`grup_sidebar_${idAman}`}
            role="group"
            aria-label={n.def.label}
            className={cn('ml-[15px] pl-2', !terakhir && lanjutanLuar(lanjutAktif))}
          >
            {n.anak.map((c, ci) => renderSub(c, ci === n.anak.length - 1 && n.items.length === 0, idx >= 0 && ci <= idx, idx > ci))}
            {n.items.map((h, ii) => {
              const gabung = n.anak.length + ii;
              const diTrail = idx >= 0 && gabung <= idx;
              const bawah: 'aksen' | 'abu' | 'nihil' = ii === n.items.length - 1
                ? 'nihil'
                : (idx >= 0 && gabung + 1 <= idx ? 'aksen' : 'abu');
              return (
                <div key={h.to} className={segmenBaris(diTrail, bawah)}>
                  {tautanHalaman(h, false, true)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  // Ctrl/Cmd+B: lipat/buka sidebar (ala editor kode).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed, setCollapsed]);

  return (
    <aside
      data-slot="sidebar"
      aria-label="Navigasi utama"
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 text-white transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-60',
      )}
      style={{ background: 'linear-gradient(180deg, var(--sidebar-deep), var(--sidebar))' }}
    >
      <div className={cn('flex items-center py-3', collapsed ? 'justify-center px-1' : 'gap-2 px-3')}>
        {/* Brand disembunyikan saat dilipat (rail hanya menampilkan tombol). */}
        {!collapsed && (
          <span
            className="truncate text-sm font-semibold tracking-wide"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            SIMPES
          </span>
        )}
        <button
          id="btn_lipat_sidebar"
          type="button"
          title={collapsed ? 'Buka navigasi (Ctrl/Cmd+B)' : 'Lipat navigasi (Ctrl/Cmd+B)'}
          aria-label={collapsed ? 'Buka navigasi' : 'Lipat navigasi'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white',
            !collapsed && 'ml-auto',
          )}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3">
        {NAV_GRUP.map((g) => {
          // Subgrup dulu (bagian pertama), lalu halaman langsung grup.
          const subs = siapkan(g.id, g.anak, g.id);
          const langsung = halamanGrupLangsung(g.id).filter(bolehLihat);
          const semua = [...subs.flatMap(kumpulkan), ...langsung];
          if (semua.length === 0) return null;
          const GrupIkon = g.icon;
          // Rail lipat: semua halaman tetap terjangkau sebagai ikon datar.
          if (collapsed) {
            return (
              <div key={g.id} className="mb-1.5">
                {semua.map((h) => tautanHalaman(h, true))}
              </div>
            );
          }
          // Grup satu halaman tanpa subgrup (mis. Beranda): tautan langsung.
          if (subs.length === 0 && langsung.length === 1) {
            return (
              <div key={g.id} className="mb-1.5">
                {tautanHalaman(langsung[0], false)}
              </div>
            );
          }
          // Submenu ala shadcn: baris induk (ikon + label + chevron) dengan
          // anak menjorok + garis pohon (subgrup boleh bersarang, mis.
          // Santri → PSB → Antrean).
          const terbuka = !tutup.has(g.id);
          const idxAktif = indeksAktif(subs, langsung);
          return (
            <div key={g.id} className="mb-1.5">
              <button
                id={`btn_grup_sidebar_${g.id}`}
                type="button"
                aria-expanded={terbuka}
                aria-controls={`grup_sidebar_${g.id}`}
                title={`${terbuka ? 'Tutup' : 'Buka'} grup ${g.label}`}
                aria-label={`${terbuka ? 'Tutup' : 'Buka'} grup ${g.label}`}
                onClick={() => jungkitGrup(g.id)}
                className={cn(
                  itemBase,
                  'w-full',
                  'text-white/75 hover:bg-white/10 hover:text-white',
                )}
              >
                <GrupIkon size={16} />
                <span className="flex-1 truncate text-left">{g.label}</span>
                <ChevronDown size={14} className={cn('shrink-0 text-white/60 transition-transform', !terbuka && '-rotate-90')} />
              </button>
              {terbuka && (
                <div
                  id={`grup_sidebar_${g.id}`}
                  role="group"
                  aria-label={g.label}
                  className="mt-0.5 ml-[18px] pl-2"
                >
                  {subs.map((n, si) => renderSub(n, si === subs.length - 1 && langsung.length === 0, idxAktif >= 0 && si <= idxAktif, idxAktif > si))}
                  {langsung.map((h, li) => {
                    const gabung = subs.length + li;
                    const diTrail = idxAktif >= 0 && gabung <= idxAktif;
                    const bawah: 'aksen' | 'abu' | 'nihil' = li === langsung.length - 1
                      ? 'nihil'
                      : (idxAktif >= 0 && gabung + 1 <= idxAktif ? 'aksen' : 'abu');
                    return (
                      <div key={h.to} className={segmenBaris(diTrail, bawah)}>
                        {tautanHalaman(h, false, true)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
