import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { bisa } from '@/api/auth';
import { prefGet, prefSet } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { HalamanDef, TabHalamanDef } from '@/lib/halaman';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PAGE_SHELL } from '@/components/PageHeader';

/** Gaya tab bersama (dipakai halaman gabungan, Antrean PSB, & Keuangan):
 *  trigger aktif berlatar primary, tanpa padding vertikal, dan tingginya
 *  mengisi PENUH area tab (`h-full` = 26px) sehingga seluruh area bisa diklik. */
export const KELAS_TRIGGER =
  'h-full py-0 text-[11px] data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground';

/** Area tab: bisa digulir bila lebih lebar dari area konten (mis. jendela
 *  sempit + sidebar terbuka), tetap di tengah halaman; tinggi tetap 26px
 *  (`group-data-…:h-[26px]` menimpa `h-9` bawaan komponen), tanpa padding,
 *  margin vertikal 8px (`my-2`) supaya bar center di antara ribbon & tabel. */
export const KELAS_LIST_TAB =
  'mx-auto my-2 max-w-full scroll-tanpa-bar gap-x-2 overflow-x-auto overflow-y-hidden border border-border p-0 group-data-[orientation=horizontal]/tabs:h-[26px]';

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

/** Tab halaman gabungan yang diizinkan untuk user (urutan tetap). */
function tabBoleh(def: HalamanDef, bisaLihat: (tab: TabHalamanDef) => boolean): TabHalamanDef[] {
  return (def.tabHalaman ?? []).filter(bisaLihat);
}

/** Rute halaman gabungan (mis. `/data-induk`, `/penempatan`): arahkan ke tab
 *  terakhir yang dibuka (pref perangkat) bila masih diizinkan; jika tidak, ke
 *  tab pertama yang diizinkan. */
export function ArahHalamanTabs({ def }: { def: HalamanDef }) {
  const { user } = useAuth();
  const kunciPref = kunciTab(def);
  const kunciIzin = useMemo(
    () => tabBoleh(def, (t) => bisa(user, t.permission)).map((t) => t.to).join('|'),
    [def, user],
  );
  const [tujuan, setTujuan] = useState<string | null>(null);
  useEffect(() => {
    const boleh = kunciIzin === '' ? [] : kunciIzin.split('|');
    let hidup = true;
    const pilih = (tersimpan: string | null) => {
      if (!hidup) return;
      setTujuan(tersimpan !== null && boleh.includes(tersimpan) ? tersimpan : boleh[0] ?? '/');
    };
    prefGet(kunciPref)
      .then(pilih)
      .catch(() => pilih(null));
    return () => {
      hidup = false;
    };
  }, [kunciIzin, kunciPref]);
  if (tujuan === null) return null;
  return <Navigate to={tujuan} replace />;
}

/** Kerangka halaman gabungan: satu halaman berisi beberapa tab (pola sama
 *  dengan halaman Keuangan) — dipakai Data Induk & Penempatan. Tiap tab tetap
 *  rute tersendiri (mis. `/users`, `/mi-md`) supaya tautan lama, pengaturan
 *  halaman, izin, dan filter per halaman tidak berubah; tab bar hanya
 *  mengubah rute. `def` = entri registri halaman yang punya `tabHalaman`. */
export default function HalamanTabs({ def }: { def: HalamanDef }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const kunciPref = kunciTab(def);
  const tabs = useMemo(() => tabBoleh(def, (t) => bisa(user, t.permission)), [def, user]);
  const aktif = tabs.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))?.to;

  // Ingat tab terakhir agar tautan halaman (rute mis. `/data-induk`) kembali ke sana.
  useEffect(() => {
    if (aktif) prefSet(kunciPref, aktif).catch(() => {});
  }, [aktif, kunciPref]);

  return (
    <div className={PAGE_SHELL}>
      <Tabs
        value={aktif}
        onValueChange={(v) => navigate(v)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        {/* `max-w-full overflow-x-auto`: tab bisa lebih lebar dari area konten
            (mis. jendela sempit + sidebar terbuka) — tetap bisa digulir. */}
        <TabsList className={KELAS_LIST_TAB}>
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
        <TabsContent value={aktif ?? ''} className="min-h-0 flex-1 flex flex-col gap-2">
          <Outlet />
        </TabsContent>
      </Tabs>
    </div>
  );
}
