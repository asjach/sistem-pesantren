import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { bisa } from '@/api/auth';
import { prefGet, prefSet } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { HALAMAN_DATA_INDUK, type TabHalamanDef } from '@/lib/halaman';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PAGE_SHELL } from '@/components/PageHeader';

/** Kunci pref tab terakhir (per perangkat), pola sama dengan `simpes_keuangan_tab`. */
const KUNCI_TAB = 'simpes_data_induk_tab';

/** Gaya tombol tab — disamakan dengan halaman Keuangan. */
const KELAS_TRIGGER =
  'py-0 text-[11px] data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow dark:data-[state=active]:border-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground';

/** Id elemen snake_case dari rute tab (`/tahun-ajaran` → `tahun_ajaran`). */
function idTab(to: string): string {
  return to.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

/** Tab Data Induk yang diizinkan untuk user (urutan tetap). */
function tabBoleh(bisaLihat: (tab: TabHalamanDef) => boolean): TabHalamanDef[] {
  return (HALAMAN_DATA_INDUK.tabHalaman ?? []).filter(bisaLihat);
}

/** Rute `/data-induk`: arahkan ke tab terakhir yang dibuka (pref perangkat)
 *  bila masih diizinkan; jika tidak, ke tab pertama yang diizinkan. */
export function ArahDataInduk() {
  const { user } = useAuth();
  const kunciIzin = useMemo(
    () => tabBoleh((t) => bisa(user, t.permission)).map((t) => t.to).join('|'),
    [user],
  );
  const [tujuan, setTujuan] = useState<string | null>(null);
  useEffect(() => {
    const boleh = kunciIzin === '' ? [] : kunciIzin.split('|');
    let hidup = true;
    const pilih = (tersimpan: string | null) => {
      if (!hidup) return;
      setTujuan(tersimpan !== null && boleh.includes(tersimpan) ? tersimpan : boleh[0] ?? '/');
    };
    prefGet(KUNCI_TAB)
      .then(pilih)
      .catch(() => pilih(null));
    return () => {
      hidup = false;
    };
  }, [kunciIzin]);
  if (tujuan === null) return null;
  return <Navigate to={tujuan} replace />;
}

/** Kerangka halaman Data Induk: satu halaman berisi beberapa tab (Pengguna,
 *  Lembaga, Tahun Ajaran, Kelas, Buku Induk, Referensi) — pola sama dengan
 *  halaman Keuangan. Tiap tab tetap rute tersendiri (mis. `/users`) supaya
 *  tautan lama, pengaturan halaman, dan filter per halaman tidak berubah;
 *  tab bar hanya mengubah rute. */
export default function DataIndukTabs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tabs = useMemo(() => tabBoleh((t) => bisa(user, t.permission)), [user]);
  const aktif = tabs.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))?.to;

  // Ingat tab terakhir agar tautan "Data Induk" (rute `/data-induk`) kembali ke sana.
  useEffect(() => {
    if (aktif) prefSet(KUNCI_TAB, aktif).catch(() => {});
  }, [aktif]);

  return (
    <div className={PAGE_SHELL}>
      <Tabs
        value={aktif}
        onValueChange={(v) => navigate(v)}
        className="flex min-h-0 flex-1 flex-col gap-0 pt-3"
      >
        {/* `max-w-full overflow-x-auto`: 6 tab bisa lebih lebar dari area konten
            (mis. jendela sempit + sidebar terbuka) — tetap bisa digulir. */}
        <TabsList className="mx-auto max-w-full gap-x-2 overflow-x-auto border border-border px-1 py-1 group-data-[orientation=horizontal]/tabs:h-8">
          {tabs.map((t) => (
            <TabsTrigger key={t.to} value={t.to} id={`tab_data_induk_${idTab(t.to)}`} className={KELAS_TRIGGER}>
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
