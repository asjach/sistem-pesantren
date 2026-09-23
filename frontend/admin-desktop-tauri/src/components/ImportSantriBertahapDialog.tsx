import { useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  batalPotongImportSantri,
  importSantriPotong,
  unduhGalatPotongSantri,
  type SantriPotongHasil,
  type SantriPotongRingkasan,
} from '../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download } from '@/icons';
import { toast } from 'sonner';

/** Kolom template gabungan yang dikirim (kunci lain dari file diabaikan):
 *  blok keanggotaan + seluruh kolom profil. */
const KOLOM_KIRIM = [
  'santri_id', 'jenjang', 'nis_lokal', 'nis_kemenag', 'is_active_lembaga',
  'tgl_masuk', 'tgl_selesai', 'tahaj_masuk', 'tingkat_masuk', 'no_urut',
  'nama_sekolah_asal', 'npsn_sekolah_asal', 'nss_sekolah_asal', 'alamat_sekolah_asal',
  'nama_lengkap', 'nama_singkat', 'nik', 'nisn', 'tmp_lahir', 'tgl_lahir', 'jk',
  'anak_ke', 'j_saudara', 'tipe_santri', 'no_hp_santri', 'email_santri', 'agama',
  'cita_cita', 'hobi', 'kebutuhan_khusus', 'kebutuhan_disabilitas', 'nomor_kip',
  'no_kk', 'kepala_keluarga', 'kewarganegaraan', 'bahasa_sehari', 'status_tempat_tinggal',
  'jarak_ke_pesantren', 'waktu_tempuh', 'transportasi', 'tanggal_masuk', 'alamat',
  'rt', 'rw', 'kode_pos', 'provinsi', 'kab_kota', 'kecamatan', 'desa_kelurahan',
  'ayah_nama', 'ayah_nik', 'ayah_tmp_lahir', 'ayah_tgl_lahir', 'ayah_status',
  'ayah_pekerjaan', 'ayah_pendidikan', 'ayah_penghasilan', 'ayah_telp', 'ayah_alamat',
  'ayah_status_tempat_tinggal', 'ibu_nama', 'ibu_nik', 'ibu_tmp_lahir', 'ibu_tgl_lahir',
  'ibu_status', 'ibu_pekerjaan', 'ibu_pendidikan', 'ibu_penghasilan', 'ibu_telp',
  'ibu_alamat', 'ibu_status_tempat_tinggal', 'wali_nama', 'wali_nik', 'wali_tmp_lahir',
  'wali_tgl_lahir', 'wali_status', 'wali_pekerjaan', 'wali_pendidikan', 'wali_penghasilan',
  'wali_telp', 'wali_alamat', 'wali_status_tempat_tinggal', 'yang_membiayai',
];

/** Maks baris per panggilan (disamakan batas backend). */
const POTONGAN = 1000;

type Fase = 'pilih' | 'siap' | 'jalan' | 'selesai';

/** Import santri bertahap: browser membaca file (SheetJS, lazy-load) lalu
 *  mengirim potongan JSON 1000 baris per panggilan dengan progress bar.
 *  Backend tidak pernah menyentuh file — ringan untuk file puluhan ribu baris. */
export default function ImportSantriBertahapDialog({ open, onOpenChange, onSelesai }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelesai: () => void;
}) {
  const [namaFile, setNamaFile] = useState('');
  const [baris, setBaris] = useState<Record<string, unknown>[]>([]);
  const [fase, setFase] = useState<Fase>('pilih');
  const [mode, setMode] = useState<'periksa' | 'eksekusi'>('periksa');
  const [sesiId, setSesiId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [ringkasan, setRingkasan] = useState<SantriPotongRingkasan | null>(null);
  const [contoh, setContoh] = useState<SantriPotongHasil['galat_contoh']>([]);
  const [galatUnduh, setGalatUnduh] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const batalRef = useRef(false);

  function reset() {
    setNamaFile('');
    setBaris([]);
    setFase('pilih');
    setSesiId(null);
    setOffset(0);
    setRingkasan(null);
    setContoh([]);
    setGalatUnduh(false);
    batalRef.current = false;
  }

  async function pilihFile(f: File | null) {
    reset();
    if (!f) return;
    setNamaFile(f.name);
    setSibuk(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matriks = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false }) as unknown[][];
      if (matriks.length < 1) {
        toast.error('File kosong.');
        return;
      }
      const kepala = (matriks[0] as unknown[]).map((h) => String(h ?? '').trim().toLowerCase());
      const hilang: string[] = [];
      if (!kepala.includes('jenjang')) hilang.push('jenjang');
      if (!kepala.includes('santri_id') && !kepala.includes('nik') && !kepala.includes('nis_lokal')) {
        hilang.push('santri_id/nik/nis_lokal (salah satu)');
      }
      if (hilang.length > 0) {
        toast.error(`Kolom wajib tidak ada: ${hilang.join(', ')}.`);
        return;
      }
      const data: Record<string, unknown>[] = [];
      for (const r of matriks.slice(1) as unknown[][]) {
        const o: Record<string, unknown> = {};
        kepala.forEach((k, i) => {
          if (KOLOM_KIRIM.includes(k)) o[k] = r[i] ?? null;
        });
        data.push(o);
      }
      if (data.length === 0) {
        toast.error('Tidak ada baris data.');
        return;
      }
      setBaris(data);
      setFase('siap');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }

  async function jalan(modeJalan: 'periksa' | 'eksekusi') {
    if (baris.length === 0 || sibuk) return;
    // Tiap penekanan mulai sesi baru dari baris pertama (upsert idempoten).
    setMode(modeJalan);
    setFase('jalan');
    setSibuk(true);
    setSesiId(null);
    setOffset(0);
    setRingkasan(null);
    setContoh([]);
    setGalatUnduh(false);
    batalRef.current = false;
    let sid: number | null = null;
    try {
      for (let i = 0; i < baris.length; i += POTONGAN) {
        if (batalRef.current) break;
        const potong = baris.slice(i, i + POTONGAN);
        const res = await importSantriPotong({
          ...(sid === null ? { mode: modeJalan, total: baris.length } : { sesi_id: sid, mode: modeJalan }),
          baris: potong,
          ...(i + POTONGAN >= baris.length ? { terakhir: true } : {}),
        });
        sid = res.sesi_id;
        setSesiId(sid);
        setOffset(res.offset);
        setRingkasan(res.ringkasan);
        setContoh(res.galat_contoh);
        setGalatUnduh(res.galat_unduh);
        if (res.selesai) break;
      }
      if (batalRef.current && sid !== null) {
        await batalPotongImportSantri(sid).catch(() => {});
        toast('Import dibatalkan.');
      } else {
        toast.success(modeJalan === 'periksa' ? 'Periksa bertahap selesai.' : 'Import bertahap selesai.');
        if (modeJalan === 'eksekusi') onSelesai();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(false);
      setFase('selesai');
    }
  }

  const persen = baris.length === 0 ? 0 : Math.round((offset / baris.length) * 100);
  const bersih = ringkasan !== null && ringkasan.baris_gagal === 0 && offset >= baris.length && baris.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && sibuk) return; onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import santri bertahap</DialogTitle>
          <DialogDescription>
            Untuk file besar (ribuan baris). File dibaca di browser lalu
            dikirim 1000 baris per panggilan dengan progres — backend tetap ringan.
            Kunci: santri_id, lalu NIS lokal + lembaga; baris cocok diperbarui, hanya kolom terisi.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Input id="input_file_import_santri_bertahap" className="col-span-2" type="file" accept=".xlsx,.xls,.csv"
            disabled={sibuk} onChange={(e) => void pilihFile(e.target.files?.[0] ?? null)} />
          {fase !== 'pilih' && (
            <p className="col-span-2 text-sm text-muted-foreground">
              {namaFile} · {baris.length.toLocaleString('id-ID')} baris data
            </p>
          )}
          {(fase === 'jalan' || fase === 'selesai') && baris.length > 0 && (
            <div className="col-span-2" id="progres_import_santri_bertahap">
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${persen}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {offset.toLocaleString('id-ID')} / {baris.length.toLocaleString('id-ID')} ({persen}%) ·{' '}
                {ringkasan ? `${ringkasan.dibuat} dibuat · ${ringkasan.diperbarui} diperbarui · ${ringkasan.riwayat_dibuat} riwayat · ${ringkasan.baris_gagal} gagal` : '…'}
              </p>
            </div>
          )}
          {ringkasan && ringkasan.baris_gagal > 0 && (
            <div className="col-span-2 rounded-md border p-3 text-sm" id="hasil_import_santri_bertahap">
              <p className="font-medium">{ringkasan.baris_gagal.toLocaleString('id-ID')} baris bermasalah{mode === 'eksekusi' ? ' (dilewati)' : ''}:</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                {contoh.map((x, i) => (
                  <li key={`${x.baris}-${x.kolom}-${i}`}>
                    Baris {x.baris}{x.nis_lokal ? ` (${x.nis_lokal})` : ''} ({x.kolom}): {x.pesan}
                  </li>
                ))}
              </ul>
              {galatUnduh && sesiId !== null && (
                <Button id="btn_unduh_galat_santri_bertahap" type="button" variant="link" className="h-auto px-0"
                  onClick={() => void unduhGalatPotongSantri(sesiId).catch((e) => toast.error(errorMessage(e)))}>
                  <Download data-icon="inline-start" size={16} /> Unduh CSV semua galat
                </Button>
              )}
            </div>
          )}
          {fase === 'selesai' && bersih && (
            <p className="col-span-2 text-sm text-emerald-600" id="hasil_import_santri_bertahap">
              {mode === 'periksa' ? 'Tidak ada masalah — siap diimport.' : 'Import selesai tanpa galat.'}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline"
            onClick={() => {
              if (fase === 'jalan') { batalRef.current = true; }
              else { reset(); onOpenChange(false); }
            }}>
            {fase === 'jalan' ? 'Batalkan' : 'Tutup'}
          </Button>
          <Button id="btn_mulai_periksa_santri_bertahap" type="button" variant="outline"
            disabled={sibuk || baris.length === 0 || fase === 'jalan'}
            onClick={() => void jalan('periksa')}>Periksa</Button>
          <Button id="btn_mulai_import_santri_bertahap" type="button"
            disabled={sibuk || !bersih || mode !== 'periksa'}
            title={bersih ? 'Jalankan import setelah periksa bersih' : 'Periksa dulu hingga bersih'}
            onClick={() => void jalan('eksekusi')}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
