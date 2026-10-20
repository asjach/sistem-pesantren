import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/api/client';
import {
  aktifkanVarianJadwal, daftarVarianJadwal, simpanVarianJadwal, type VarianJadwalItem,
} from '@/api/kurikulum';

/**
 * Panel "Varian Jadwal": riwayat snapshot jadwal satu jenjang + tahun ajaran.
 *
 * Simpan varian = menyalin jadwal saat ini (slot, pengampu, sel) menjadi
 * snapshot baru dan menjadikannya aktif. Mengaktifkan varian lama memulihkan
 * jadwal dari snapshot itu. Hanya satu varian aktif per jenjang + TA.
 */
export default function PanelVarian({
  jenjang, tahunAjaran, canTambah, canUbah, onDipulihkan,
}: {
  jenjang: string;
  tahunAjaran: string;
  canTambah: boolean;
  canUbah: boolean;
  /** Dipanggil setelah aktivasi berhasil agar jadwal & status dimuat ulang. */
  onDipulihkan: () => void;
}) {
  const [varian, setVarian] = useState<VarianJadwalItem[]>([]);
  const [nama, setNama] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  const muat = useCallback(async () => {
    try {
      const r = await daftarVarianJadwal(jenjang, tahunAjaran);
      setVarian(r.varian);
      setGalat('');
    } catch (e) {
      setGalat(errorMessage(e));
    }
  }, [jenjang, tahunAjaran]);

  useEffect(() => { void muat(); }, [muat]);

  async function simpan() {
    const teks = nama.trim();

    if (teks === '') {
      toast.error('Isi nama varian dulu.');
      return;
    }

    setSibuk(true);
    try {
      const r = await simpanVarianJadwal(jenjang, tahunAjaran, teks);
      setVarian(r.varian);
      setNama('');
      setGalat('');
      toast.success(r.pesan ?? 'Varian disimpan.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }

  async function aktifkan(v: VarianJadwalItem) {
    setSibuk(true);
    try {
      const r = await aktifkanVarianJadwal(v.id);
      setVarian(r.varian);
      setGalat('');
      toast.success(r.pesan ?? 'Varian diaktifkan.');
      onDipulihkan();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Varian adalah <b>snapshot</b> jadwal: slot, pengampu, dan sel. Hanya satu yang berstatus
        <b> Aktif</b> dan itulah yang dipakai. Mengaktifkan varian memulihkan jadwal dari snapshot
        itu — kelas yang berstatus Final dilewati.
      </p>

      {galat ? <p role="alert" className="text-xs text-destructive">{galat}</p> : null}

      {canTambah ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs" htmlFor="input_nama_varian">
            Nama varian
            <input
              id="input_nama_varian"
              value={nama}
              maxLength={100}
              placeholder="mis. Normal"
              onChange={(e) => setNama(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            />
          </label>
          <Button
            id="btn_simpan_varian"
            type="button"
            size="sm"
            disabled={sibuk || nama.trim() === ''}
            onClick={() => void simpan()}
          >
            Simpan sebagai varian
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto border" style={{ borderColor: 'var(--divider)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--divider)' }}>
              <th className="px-2 py-1.5 font-medium">Nama</th>
              <th className="px-2 py-1.5 font-medium">Dibuat</th>
              <th className="px-2 py-1.5 font-medium">Oleh</th>
              <th className="px-2 py-1.5 font-medium">Isi</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {varian.map((v) => (
              <tr key={v.id} className="border-b last:border-0" style={{ borderColor: 'var(--divider)' }}>
                <td className="px-2 py-1.5 font-medium">{v.nama}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{v.dibuat_pada ?? '—'}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{v.dibuat_oleh ?? '—'}</td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {v.ringkasan.kelas} kelas · {v.ringkasan.jadwal} sel
                </td>
                <td className="px-2 py-1.5">
                  {v.is_active ? <span className="font-medium text-success">Aktif</span> : null}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    id={`btn_aktifkan_varian_${v.id}`}
                    disabled={v.is_active || !canUbah || sibuk}
                    onClick={() => void aktifkan(v)}
                  >
                    Aktifkan
                  </Button>
                </td>
              </tr>
            ))}
            {varian.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                  Belum ada varian. Simpan jadwal saat ini sebagai varian pertama.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
