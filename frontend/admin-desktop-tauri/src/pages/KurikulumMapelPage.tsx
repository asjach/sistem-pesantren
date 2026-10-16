import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { Plus, Save, Trash2 } from '@/icons';
import {
  buatMapel, daftarMapel, hapusMapel, ubahMapel,
  type KelompokMapel, type MataPelajaran,
} from '@/api/kurikulum';

const KELOMPOK: { nilai: KelompokMapel; label: string }[] = [
  { nilai: 'formal', label: 'Formal' },
  { nilai: 'pesantren', label: 'Pesantren' },
];

/** Halaman Master Mapel: daftar mata pelajaran per jenjang (kelompok formal / pesantren). */
export default function KurikulumMapelPage() {
  const { jenjangs, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'kurikulum.tambah');
  const canUbah = bisa(user, 'kurikulum.ubah');
  const canHapus = bisa(user, 'kurikulum.hapus');

  const jenjang = targetTunggal(jenjangs);
  const [mapel, setMapel] = useState<MataPelajaran[]>([]);
  const [q, setQ] = useState('');
  const [keaktifan, setKeaktifan] = useState<'aktif' | 'nonaktif' | 'semua'>('aktif');
  const [err, setErr] = useState('');

  const muat = useCallback(async () => {
    if (jenjang === null) { setMapel([]); return; }
    try {
      setMapel(await daftarMapel({ jenjang, q: q || undefined, keaktifan }));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [jenjang, q, keaktifan]);

  useEffect(() => {
    if (filterLoading) return;
    setErr('');
    void muat();
  }, [filterLoading, muat]);

  const jalankan = useCallback(async (kerja: () => Promise<unknown>, sukses: string) => {
    try { await kerja(); toast.success(sukses); await muat(); }
    catch (e) { toast.error(errorMessage(e)); }
  }, [muat]);

  if (jenjang === null) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) pada filter di atas.</p>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <label className="text-xs text-muted-foreground" htmlFor="cari_mapel">Cari</label>
        <Input
          id="cari_mapel" className="h-8 w-48 text-xs" placeholder="Nama / kode mapel…"
          value={q} onChange={(e) => setQ(e.target.value)}
        />
        <label className="text-xs text-muted-foreground" htmlFor="saring_aktif_mapel">Status</label>
        <select
          id="saring_aktif_mapel" className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={keaktifan} onChange={(e) => setKeaktifan(e.target.value as typeof keaktifan)}
        >
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
          <option value="semua">Semua</option>
        </select>
        <span className="text-xs text-muted-foreground">Lingkup <strong>{jenjang}</strong></span>
        <div className="ml-auto">
          <Button type="button" size="sm" id="btn_tambah_mapel" disabled={!canTambah}
            onClick={() => void jalankan(
              () => buatMapel({ jenjang, nama_mapel: 'Mapel Baru', kelompok: 'formal' }),
              'Mapel ditambah.',
            )}>
            <Plus data-icon="inline-start" size={16} /> Tambah
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <table className="w-full max-w-3xl border-collapse text-xs" id="tabel_mata_pelajaran">
          <thead className="bg-muted/60">
            <tr>
              <th className="border border-border px-2 py-1 text-left">Nama Mapel</th>
              <th className="border border-border px-2 py-1 w-28 text-left">Kode</th>
              <th className="border border-border px-2 py-1 w-36 text-left">Kelompok</th>
              <th className="border border-border px-2 py-1 w-20">Aktif</th>
              <th className="border border-border px-2 py-1 w-24">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {mapel.map((m) => (
              <BarisMapel key={m.id} m={m} canUbah={canUbah} canHapus={canHapus} onSimpan={jalankan} />
            ))}
            {mapel.length === 0 && (
              <tr><td colSpan={5} className="border border-border px-2 py-4 text-center text-muted-foreground">
                Belum ada mata pelajaran untuk jenjang ini.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Baris mapel dengan penyuntingan inline. */
function BarisMapel({ m, canUbah, canHapus, onSimpan }: {
  m: MataPelajaran; canUbah: boolean; canHapus: boolean;
  onSimpan: (kerja: () => Promise<unknown>, sukses: string) => Promise<void>;
}) {
  const [nama, setNama] = useState(m.nama_mapel);
  const [kode, setKode] = useState(m.kode_mapel ?? '');
  const [kelompok, setKelompok] = useState<KelompokMapel>(m.kelompok);
  const [aktif, setAktif] = useState(m.is_active);

  useEffect(() => {
    setNama(m.nama_mapel); setKode(m.kode_mapel ?? '');
    setKelompok(m.kelompok); setAktif(m.is_active);
  }, [m]);

  return (
    <tr>
      <td className="border border-border px-1 py-0.5">
        <Input className="h-7 text-xs" aria-label="Nama mapel" disabled={!canUbah} value={nama} onChange={(e) => setNama(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input className="h-7 text-xs" aria-label="Kode mapel" disabled={!canUbah} value={kode} onChange={(e) => setKode(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <select className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs" aria-label="Kelompok"
          disabled={!canUbah} value={kelompok} onChange={(e) => setKelompok(e.target.value as KelompokMapel)}>
          {KELOMPOK.map((k) => <option key={k.nilai} value={k.nilai}>{k.label}</option>)}
        </select>
      </td>
      <td className="border border-border px-1 py-0.5 text-center">
        <input type="checkbox" aria-label="Aktif" disabled={!canUbah} checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <div className="flex justify-center gap-1">
          {canUbah && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Simpan mapel"
              onClick={() => void onSimpan(
                () => ubahMapel(m.id, { nama_mapel: nama, kode_mapel: kode || null, kelompok, is_active: aktif }),
                'Mapel disimpan.',
              )}>
              <Save size={14} />
            </Button>
          )}
          {canHapus && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus mapel"
              onClick={() => void onSimpan(() => hapusMapel(m.id), 'Mapel dihapus.')}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
