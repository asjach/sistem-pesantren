import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { bisa } from '@/api/auth';
import { prefGet, prefSet } from '@/api/client';
import { muatPengaturanHalaman } from '@/api/pengaturanHalaman';
import { useAuth } from '@/auth/AuthContext';
import type { HalamanDef, TabHalamanDef } from '@/lib/halaman';
import { kunciTabNavigasi } from '@/lib/halaman';
import { useNavigasiVisibilitas } from '@/components/NavigasiVisibilitasProvider';
import { susunTab } from '@/lib/urutanTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PAGE_SHELL } from '@/components/PageHeader';

/** Gaya tab bersama (dipakai halaman gabungan, Antrean PSB, & Keuangan):
 *  trigger aktif berlatar primary, tanpa padding vertikal, dan tingginya
 *  mengisi PENUH area tab (`h-full` = 26px) sehingga seluruh area bisa diklik. */
export const KELAS_TRIGGER =
  'h-full py-0 text-[11px] data-[state=active]:text-primary-foreground dark:data-[state=active]:text-primary-foreground';

/** Area tab: bisa digulir bila lebih lebar dari area konten (mis. jendela
 *  sempit + sidebar terbuka), tetap di tengah halaman; tinggi tetap 26px
 *  (`group-data-…:h-[26px]` menimpa `h-9` bawaan komponen), tanpa padding,
 *  margin vertikal 4px (`my-1`) supaya bar center di antara ribbon & tabel. */
export const KELAS_LIST_TAB =
  'mx-auto my-1 max-w-full scroll-tanpa-bar gap-x-2 overflow-x-auto overflow-y-hidden border border-border p-0 group-data-[orientation=horizontal]/tabs:h-[26px]';

/** Panel tab (TabsContent): kotak berbingkai agar area isi tab jelas.
 *  `simpes-panel-tab` dipakai CSS: (1) border kiri panel digeser 1px ke kiri
 *  (`margin-left: -1px`) supaya berimpit dengan border kanan rail navigasi —
 *  dua garis 1px berdempetan terbaca 2px; (2) saat isinya tabel yang menempel
 *  tepi, garis kiri tabel dibuang karena bingkai panel sudah menjadi tepi
 *  kirinya — tanpa itu dua garis 1px berdempetan dan terbaca 2px (index.css). */
export const KELAS_PANEL_TAB = 'border border-border simpes-panel-tab';

/** Id elemen snake_case dari rute (`/tahun-ajaran` → `tahun_ajaran`). */
function idRute(to: string): string {
  return to.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

/** Kunci pref tab terakhir halaman (per perangkat), mis.
 *  `simpes_data_induk_tab` / `simpes_penempatan_tab` — pola sama dengan
 *  `simpes_keuangan_tab`. */
function kunciTab(def: HalamanDef): string {
  return `simpes_${idRute(def.to)}_tab`;
}

/** Kunci setelan halaman dari rute halaman gabungan (`/data-induk` →
 *  `data_induk`). Sama dengan `pageKeyDariPath` di VisibilitasFilter. */
export function pageKeyHalaman(def: HalamanDef): string {
  return idRute(def.to);
}

/** Tab halaman gabungan yang diizinkan untuk user (urutan dari setelan
 *  halaman, lalu disaring izin). */
function tabBoleh(def: HalamanDef, bisaLihat: (tab: TabHalamanDef) => boolean): TabHalamanDef[] {
  return (def.tabHalaman ?? []).filter(bisaLihat);
}

/** Muat setelan urutan/sembunyi satu halaman. `null` selama memuat;
 *  kegagalan diperlakukan sebagai bawaan kode supaya tab tetap tampil. */
export function useSetelanTab(def: HalamanDef) {
  const pageKey = pageKeyHalaman(def);
  const [setelan, setSetelan] = useState<{ urutan: string[]; sembunyi: string[] } | null>(null);
  useEffect(() => {
    let hidup = true;
    muatPengaturanHalaman([pageKey])
      .then((res) => {
        if (!hidup) return;
        const d = res.data.peta[pageKey];
        setSetelan({ urutan: d?.urutan ?? [], sembunyi: d?.sembunyi ?? [] });
      })
      .catch(() => { if (hidup) setSetelan({ urutan: [], sembunyi: [] }); });
    return () => { hidup = false; };
  }, [pageKey]);
  return setelan;
}

/** Rute halaman gabungan (mis. `/data-induk`, `/penempatan`): arahkan ke tab
 *  terakhir yang dibuka (pref perangkat) bila masih diizinkan; jika tidak, ke
 *  tab pertama yang diizinkan. */
export function ArahHalamanTabs({ def }: { def: HalamanDef }) {
  const { user } = useAuth();
  const { tersembunyi, memuat } = useNavigasiVisibilitas();
  const kunciPref = kunciTab(def);
  const setelan = useSetelanTab(def);
  const kunciIzin = useMemo(
    () => tabBoleh(def, (t) => bisa(user, t.permission)).map((t) => t.to).join('|'),
    [def, user],
  );
  const [tujuan, setTujuan] = useState<string | null>(null);
  useEffect(() => {
    if (memuat || setelan === null) return;
    const boleh = kunciIzin === '' ? [] : kunciIzin.split('|');
    const { tampil } = susunTab(def.tabHalaman ?? [], setelan.urutan, setelan.sembunyi);
    const urutSemua = tampil.filter((t) => boleh.includes(t.to)).map((t) => t.to);
    const urutBoleh = urutSemua.filter((to) => !tersembunyi.has(kunciTabNavigasi(to)));
    let hidup = true;
    const pilih = (tersimpan: string | null) => {
      if (!hidup) return;
      setTujuan(
        tersimpan !== null && urutBoleh.includes(tersimpan)
          ? tersimpan
          : urutBoleh[0] ?? urutSemua[0] ?? '/',
      );
    };
    prefGet(kunciPref).then(pilih).catch(() => pilih(null));
    return () => { hidup = false; };
  }, [setelan, kunciIzin, kunciPref, def, tersembunyi, memuat]);
  if (memuat || tujuan === null) return null;
  return <Navigate to={tujuan} replace />;
}

/** Kerangka halaman gabungan: satu halaman berisi beberapa tab (pola sama
 *  dengan halaman Keuangan) — dipakai Data Induk & Penempatan. Tiap tab tetap
 *  rute tersendiri (mis. `/users`, `/mi-md`) supaya tautan lama, pengaturan
 *  halaman, izin, dan filter per halaman tidak berubah; tab bar hanya
 *  mengubah rute. `def` = entri registri halaman yang punya `tabHalaman`. */
export default function HalamanTabs({ def }: { def: HalamanDef }) {
  const { user } = useAuth();
  const { tersembunyi, memuat } = useNavigasiVisibilitas();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const kunciPref = kunciTab(def);
  const setelan = useSetelanTab(def);
  /** Saat memuat, pakai urutan kode agar tab tidak berkedip kosong. */
  const susunan = useMemo(
    () => susunTab(def.tabHalaman ?? [], setelan?.urutan ?? [], setelan?.sembunyi ?? []),
    [def, setelan],
  );
  const tabsSemua = useMemo(
    () => susunan.tampil.filter((t) => bisa(user, t.permission)),
    [susunan, user],
  );
  const tabs = useMemo(
    () => tabsSemua.filter((t) => !tersembunyi.has(kunciTabNavigasi(t.to))),
    [tabsSemua, tersembunyi],
  );
  const aktif = tabsSemua.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))?.to;
  const aktifTersembunyi = aktif !== undefined && !tabs.some((t) => t.to === aktif);

  useEffect(() => {
    if (aktif) prefSet(kunciPref, aktif).catch(() => {});
  }, [aktif, kunciPref]);

  useEffect(() => {
    if (memuat || setelan === null || aktif !== undefined || tabs.length === 0) return;
    navigate(tabs[0].to, { replace: true });
  }, [setelan, aktif, tabs, navigate, memuat]);

  return (
    <div className={PAGE_SHELL}>
      <Tabs
        value={aktif}
        onValueChange={(v) => navigate(v)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >

        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.to}
              value={t.to}
              id={`tab_${idRute(def.to)}_${idRute(t.to)}`}
              className={KELAS_TRIGGER}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {aktifTersembunyi ? (
          <div className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
            <Outlet />
          </div>
        ) : (
          <TabsContent value={aktif ?? ''} className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
            <Outlet />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
