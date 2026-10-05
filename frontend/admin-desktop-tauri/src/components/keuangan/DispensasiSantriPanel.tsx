import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { bisa } from '../../api/auth';
import {
  daftarDispensasi, daftarJenis,
  type Dispensasi, type JenisTagihan,
} from '../../api/keuangan';
import { listTahunAjaran, type TahunAjaran } from '../../api/master';
import { Button } from '@/components/ui/button';
import DispensasiDialog from '@/components/keuangan/DispensasiDialog';
import { Plus } from '@/icons';

/** Bagian profil santri: dispensasi yang berlaku untuk santri ini pada TA
 *  aktif + pintasan tambah (santri langsung terisi sebagai sasaran). */
export default function DispensasiSantriPanel({ santri }: { santri: { id: number; nama_lengkap: string } }) {
  const { user } = useAuth();
  const bolehLihat = bisa(user, 'keuangan.lihat');
  const bolehTambah = bisa(user, 'keuangan.tambah');

  const [ta, setTa] = useState<string | null>(null);
  const [daftar, setDaftar] = useState<Dispensasi[]>([]);
  const [jenis, setJenis] = useState<JenisTagihan[]>([]);
  const [daftarTA, setDaftarTA] = useState<TahunAjaran[]>([]);
  const [open, setOpen] = useState(false);

  const muat = useCallback(async () => {
    if (!bolehLihat) return;
    try {
      const [tas, j] = await Promise.all([listTahunAjaran({ per_page: 100 }), daftarJenis()]);
      setDaftarTA(tas.data); setJenis(j);
      const aktif = tas.data.find((x) => x.is_aktif)?.nama ?? tas.data[0]?.nama ?? null;
      setTa(aktif);
      setDaftar(aktif === null ? [] : await daftarDispensasi({ tahun_ajaran: aktif, santri_id: santri.id }));
    } catch { setDaftar([]); }
  }, [bolehLihat, santri.id]);

  useEffect(() => { void muat(); }, [muat]);

  if (!bolehLihat) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium">Dispensasi{ta ? ` (TA ${ta})` : ''}</h3>
        {bolehTambah && (
          <Button id="btn_dispensasi_santri_tambah" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" size={14} /> Tambah
          </Button>
        )}
      </div>
      {daftar.length === 0 ? (
        <p className="text-xs text-muted-foreground">Tidak ada dispensasi yang berlaku untuk santri ini.</p>
      ) : (
        <div className="overflow-hidden rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-1.5 text-left">Nama</th>
                <th className="p-1.5 text-left">Potongan per Jenis</th>
                <th className="p-1.5 text-right">Santri</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-1.5">{d.nama}</td>
                  <td className="p-1.5">
                    {(d.aturan ?? []).map((a) => `${a.jenis?.nama ?? 'Semua jenis'}: ${a.tipe === 'persen' ? `${a.nilai}%` : a.tipe === 'bebas' ? 'bebas' : `Rp ${a.nilai.toLocaleString('id')}`}`).join(' · ')}
                  </td>
                  <td className="p-1.5 text-right">{(d.santri_ids ?? []).length} santri</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DispensasiDialog
        open={open}
        onOpenChange={setOpen}
        editing={null}
        jenis={jenis}
        daftarTA={daftarTA}
        santriAwal={{ id: santri.id, nama_lengkap: santri.nama_lengkap }}
        onSaved={muat}
      />
    </section>
  );
}
