import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import { getMatriks, simpanIzin, type MatriksIzin } from '../api/izin';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const LABEL_AKSI: Record<string, string> = {
  lihat: 'Lihat',
  tambah: 'Tambah',
  ubah: 'Ubah',
  hapus: 'Hapus',
};

/** Pengaturan → Kelola Izin: matriks checkbox role × izin (modul.aksi).
 *  Hanya super_admin (route + API menegakkan). Centang tersimpan per role. */
export default function KelolaIzinPage() {
  const [matriks, setMatriks] = useState<MatriksIzin | null>(null);
  const [centang, setCentang] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [simpanRole, setSimpanRole] = useState('');
  const [err, setErr] = useState('');

  const muat = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const res = await getMatriks();
      setMatriks(res.data);
      const awal: Record<string, Set<string>> = {};
      for (const r of res.data.roles) awal[r.name] = new Set(r.permissions);
      setCentang(awal);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const kotor = useCallback((nama: string): boolean => {
    const asal = matriks?.roles.find((r) => r.name === nama);
    const kini = centang[nama];
    if (!asal || !kini) return false;
    if (asal.permissions.length !== kini.size) return true;
    return asal.permissions.some((p) => !kini.has(p));
  }, [matriks, centang]);

  const balik = useCallback((nama: string, izin: string) => {
    setCentang((prev) => {
      const next = new Set(prev[nama] ?? []);
      if (next.has(izin)) next.delete(izin);
      else next.add(izin);
      return { ...prev, [nama]: next };
    });
  }, []);

  const simpan = useCallback(async (nama: string) => {
    setErr('');
    setSimpanRole(nama);
    try {
      const res = await simpanIzin(nama, [...(centang[nama] ?? [])]);
      toast.success(res.pesan);
      await muat();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSimpanRole('');
    }
  }, [centang, muat]);

  const modul = useMemo(() => Object.entries(matriks?.katalog ?? {}), [matriks]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      {loading || !matriks ? (
        <p className="py-8 text-sm text-muted-foreground">{loading ? 'Memuat matriks izin…' : 'Matriks izin tidak tersedia.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-160 border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium">Modul · aksi</th>
                {matriks.roles.map((r) => (
                  <th key={r.name} className="px-3 py-2 text-center font-medium">
                    {r.name}
                    {r.terkunci && <span className="ml-1 text-xs text-muted-foreground">(kunci)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modul.map(([namaModul, aksi]) => (
                aksi.map((a, i) => {
                  const izin = `${namaModul}.${a}`;
                  return (
                    <tr key={izin} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-1.5">
                        {i === 0 && <span className="font-medium">{namaModul}</span>}
                        <span className="ml-2 text-muted-foreground">{LABEL_AKSI[a] ?? a}</span>
                      </td>
                      {matriks.roles.map((r) => (
                        <td key={r.name} className="px-3 py-1.5 text-center">
                          <Checkbox
                            id={`chk_izin_${r.name}_${namaModul}_${a}`}
                            checked={centang[r.name]?.has(izin) ?? false}
                            disabled={r.terkunci || simpanRole !== ''}
                            onCheckedChange={() => balik(r.name, izin)}
                            aria-label={`Izin ${izin} untuk ${r.name}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40">
                <td className="px-3 py-2 text-xs text-muted-foreground">Simpan per role</td>
                {matriks.roles.map((r) => (
                  <td key={r.name} className="px-3 py-2 text-center">
                    {!r.terkunci && (
                      <Button
                        id={`btn_simpan_izin_${r.name}`}
                        size="sm"
                        variant={kotor(r.name) ? 'default' : 'outline'}
                        disabled={!kotor(r.name) || simpanRole !== ''}
                        onClick={() => void simpan(r.name)}
                      >
                        {simpanRole === r.name ? 'Menyimpan…' : 'Simpan'}
                      </Button>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
