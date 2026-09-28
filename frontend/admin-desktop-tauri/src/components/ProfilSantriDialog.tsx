import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/api/client';
import { profilSantri, type ProfilSantri } from '@/api/siklus';
import { TGL_KEYS, pihakFields } from '@/components/santri/kolomIdentitas';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatStatus, namaLembaga, namaTahunAjaran } from '@/lib/nilaiTampil';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Kunci data `santri` → label Bahasa Indonesia (label tabel memakai nama
 *  kolom DB; di sini dibuat enak dibaca sesuai konteks dialog). */
const LABEL: Record<string, string> = {
  id: 'ID',
  nama_lengkap: 'Nama lengkap',
  nama_singkat: 'Nama singkat',
  nik: 'NIK',
  nisn: 'NISN',
  jk: 'Jenis kelamin',
  tipe_santri: 'Tipe santri',
  tmp_lahir: 'Tempat lahir',
  tgl_lahir: 'Tanggal lahir',
  anak_ke: 'Anak ke',
  j_saudara: 'Jumlah saudara',
  agama: 'Agama',
  no_hp_santri: 'No. HP',
  email_santri: 'Email',
  kewarganegaraan: 'Kewarganegaraan',
  bahasa_sehari: 'Bahasa sehari-hari',
  cita_cita: 'Cita-cita',
  hobi: 'Hobi',
  kebutuhan_khusus: 'Kebutuhan khusus',
  kebutuhan_disabilitas: 'Kebutuhan disabilitas',
  nomor_kip: 'No. KIP',
  no_kk: 'No. KK',
  kepala_keluarga: 'Kepala keluarga',
  yang_membiayai: 'Yang membiayai',
  alamat: 'Alamat',
  rt: 'RT',
  rw: 'RW',
  desa_kelurahan: 'Desa / kelurahan',
  kecamatan: 'Kecamatan',
  kab_kota: 'Kabupaten / kota',
  provinsi: 'Provinsi',
  kode_pos: 'Kode pos',
  status_tempat_tinggal: 'Status tempat tinggal',
  jarak_ke_pesantren: 'Jarak ke pesantren',
  waktu_tempuh: 'Waktu tempuh',
  transportasi: 'Transportasi',
  tanggal_masuk: 'Tanggal masuk',
};

/** Label field orang tua/wali dari sufiks kuncinya (`ayah_nik` → "NIK"). */
const SUFFIK_PIHAK: Record<string, string> = {
  nama: 'Nama',
  nik: 'NIK',
  tmp_lahir: 'Tempat lahir',
  tgl_lahir: 'Tanggal lahir',
  status: 'Status',
  pekerjaan: 'Pekerjaan',
  pendidikan: 'Pendidikan',
  penghasilan: 'Penghasilan',
  telp: 'Telepon',
  alamat: 'Alamat',
  status_tempat_tinggal: 'Status tempat tinggal',
};

/** Label tampilan sebuah kunci data. */
function labelKunci(kunci: string): string {
  if (LABEL[kunci]) return LABEL[kunci];
  const pihak = /^(ayah|ibu|wali)_(.+)$/.exec(kunci);
  if (pihak && SUFFIK_PIHAK[pihak[2]]) return SUFFIK_PIHAK[pihak[2]];
  return kunci.replace(/_/g, ' ');
}

/** Nilai berenkode (L/P, asrama) → teks yang enak dibaca. */
const PILIHAN: Record<string, Record<string, string>> = {
  jk: { L: 'Laki-laki', P: 'Perempuan' },
  tipe_santri: { asrama: 'Asrama', non_asrama: 'Non-asrama' },
};

/** Satu kelompok kunci di bawah sebuah panel. */
interface Panel {
  judul: string;
  kunci: string[];
}

/** Kunci data orang tua/wali — diambil dari definisi kolom yang sama dengan
 *  Buku Induk agar tidak ada yang terlewat. */
function kunciPihak(p: 'ayah' | 'ibu' | 'wali'): string[] {
  return pihakFields(p, p).map((f) => f.key);
}

const PANEL_IDENTITAS: Panel[] = [
  {
    judul: 'Identitas',
    kunci: ['nama_lengkap', 'nama_singkat', 'nik', 'nisn', 'jk', 'tipe_santri', 'id'],
  },
  {
    judul: 'Kelahiran',
    kunci: ['tmp_lahir', 'tgl_lahir', 'anak_ke', 'j_saudara', 'agama'],
  },
  { judul: 'Kontak', kunci: ['no_hp_santri', 'email_santri'] },
  {
    judul: 'Tambahan',
    kunci: [
      'kewarganegaraan', 'bahasa_sehari', 'cita_cita', 'hobi',
      'kebutuhan_khusus', 'kebutuhan_disabilitas', 'nomor_kip',
    ],
  },
];

const PANEL_ALAMAT: Panel[] = [
  {
    judul: 'Domisili',
    kunci: [
      'alamat', 'rt', 'rw', 'desa_kelurahan', 'kecamatan',
      'kab_kota', 'provinsi', 'kode_pos',
    ],
  },
  {
    judul: 'Kondisi dan perjalanan',
    kunci: [
      'status_tempat_tinggal', 'jarak_ke_pesantren', 'waktu_tempuh',
      'transportasi', 'tanggal_masuk',
    ],
  },
];

const PANEL_KELUARGA: Panel[] = [
  { judul: 'Kartu keluarga', kunci: ['no_kk', 'kepala_keluarga', 'yang_membiayai'] },
  { judul: 'Ayah', kunci: kunciPihak('ayah') },
  { judul: 'Ibu', kunci: kunciPihak('ibu') },
  { judul: 'Wali', kunci: kunciPihak('wali') },
];

/** Nilai satu field sebagai teks tampil; string kosong bila tidak diisi. */
function nilaiTeks(kunci: string, mentah: unknown): string {
  if (mentah === null || mentah === undefined || mentah === '') return '';
  if (TGL_KEYS.has(kunci)) return String(mentah).slice(0, 10);
  const teks = String(mentah);
  return PILIHAN[kunci]?.[teks] ?? teks;
}

/** Satu baris label–nilai. Nilai kosong tampil '—' redup agar pembaca tahu
 *  field-nya ada, bukan sekadar belum ditampilkan. */
function Baris({ kunci, mentah }: { kunci: string; mentah: unknown }) {
  const nilai = nilaiTeks(kunci, mentah);
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 border-t px-3 py-1.5 first:border-t-0">
      <dt className="truncate text-xs text-muted-foreground">{labelKunci(kunci)}</dt>
      <dd className={cn('text-sm break-words', nilai === '' && 'text-muted-foreground')}>{nilai || '—'}</dd>
    </div>
  );
}

/** Panel sekelompok field dengan judul. */
function PanelData({ panel, data }: { panel: Panel; data: Record<string, unknown> }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold">{panel.judul}</h3>
      <dl className="overflow-hidden rounded-lg border">
        {panel.kunci.map((k) => <Baris key={k} kunci={k} mentah={data[k]} />)}
      </dl>
    </section>
  );
}

/** Chip ringkas pada kepala dialog. */
function Chip({ children, nada }: { children: string; nada?: 'aktif' | 'tidak' }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs font-medium',
        nada === 'aktif' && 'border-primary/30 bg-primary/10 text-primary',
        nada === 'tidak' && 'border-muted-foreground/30 bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

/** Tabel relasi di bawah tab keanggotaan & riwayat. */
function TabelRelasi({ judul, jumlah, columns, rows }: {
  judul: string;
  jumlah: number;
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold">
        {judul} <span className="font-normal text-muted-foreground">({jumlah})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Tidak ada data.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-1.5 whitespace-nowrap">
                      {r[c.key] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const ymd = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

/** Profil santri (baca-saja): data skalar dikelompokkan per tab (Identitas,
 *  Alamat, Keluarga) dan data relasi (keanggotaan, riwayat belajar, mutasi,
 *  alumni) dikumpulkan di tab tersendiri supaya mudah dipindai. */
export function ProfilSantriDialog({ santriId, open, onOpenChange }: {
  santriId: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [profil, setProfil] = useState<ProfilSantri | null>(null);

  useEffect(() => {
    if (!open || santriId == null) return;
    let batal = false;
    setProfil(null);
    profilSantri(santriId)
      .then((p) => {
        if (!batal) setProfil(p);
      })
      .catch((e) => {
        if (!batal) toast.error(errorMessage(e));
      });
    return () => {
      batal = true;
    };
  }, [open, santriId]);

  const data = useMemo(
    () => (profil ? (profil.santri as unknown as Record<string, unknown>) : {}),
    [profil],
  );

  const aktifPesantren = profil?.santri.is_active_pst === 'Ya';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{profil ? profil.santri.nama_lengkap : 'Profil Santri'}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5">
            {profil ? (
              <>
                <span>Detail data (baca-saja).</span>
                <Chip nada={aktifPesantren ? 'aktif' : 'tidak'}>
                  {aktifPesantren ? 'Aktif di pesantren' : 'Tidak aktif di pesantren'}
                </Chip>
                {nilaiTeks('tipe_santri', data.tipe_santri) !== '' && (
                  <Chip>{nilaiTeks('tipe_santri', data.tipe_santri)}</Chip>
                )}
              </>
            ) : (
              <span>Detail data (baca-saja).</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {profil ? (
          <Tabs defaultValue="identitas" className="min-h-0">
            <TabsList className="w-full justify-start">
              <TabsTrigger id="tab_profil_identitas" value="identitas">Identitas</TabsTrigger>
              <TabsTrigger id="tab_profil_alamat" value="alamat">Alamat</TabsTrigger>
              <TabsTrigger id="tab_profil_keluarga" value="keluarga">Keluarga</TabsTrigger>
              <TabsTrigger id="tab_profil_riwayat" value="riwayat">
                Keanggotaan &amp; riwayat
              </TabsTrigger>
            </TabsList>

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <TabsContent value="identitas" className="mt-3 grid gap-4 sm:grid-cols-2">
                {PANEL_IDENTITAS.map((p) => <PanelData key={p.judul} panel={p} data={data} />)}
              </TabsContent>

              <TabsContent value="alamat" className="mt-3 grid gap-4 sm:grid-cols-2">
                {PANEL_ALAMAT.map((p) => <PanelData key={p.judul} panel={p} data={data} />)}
              </TabsContent>

              <TabsContent value="keluarga" className="mt-3 grid gap-4 sm:grid-cols-2">
                {PANEL_KELUARGA.map((p) => <PanelData key={p.judul} panel={p} data={data} />)}
              </TabsContent>

              <TabsContent value="riwayat" className="mt-3 space-y-5">
                <TabelRelasi
                  judul="Keanggotaan lembaga"
                  jumlah={profil.keanggotaan.length}
                  columns={[
                    { key: 'lembaga', label: 'Lembaga' },
                    { key: 'nis_lokal', label: 'NIS lokal' },
                    { key: 'nis_kemenag', label: 'NIS Kemenag' },
                    { key: 'mulai', label: 'Mulai' },
                    { key: 'selesai', label: 'Selesai' },
                    { key: 'aktif', label: 'Aktif' },
                  ]}
                  rows={profil.keanggotaan.map((k) => ({
                    lembaga: namaLembaga(k.lembaga, k.jenjang) ?? '',
                    nis_lokal: k.nis_lokal ?? '',
                    nis_kemenag: k.nis_kemenag ?? '',
                    mulai: ymd(k.tgl_masuk),
                    selesai: ymd(k.tgl_selesai),
                    aktif: k.is_active_lembaga,
                  }))}
                />
                <TabelRelasi
                  judul="Riwayat belajar"
                  jumlah={profil.riwayat.length}
                  columns={[
                    { key: 'tahun', label: 'Tahun ajaran' },
                    { key: 'semester', label: 'Smt' },
                    { key: 'tingkat', label: 'Tingkat' },
                    { key: 'lembaga', label: 'Lembaga' },
                    { key: 'kelas', label: 'Kelas' },
                    { key: 'status_awal', label: 'Awal' },
                    { key: 'status_akhir', label: 'Akhir' },
                    { key: 'aktif', label: 'Aktif' },
                  ]}
                  rows={profil.riwayat.map((r) => ({
                    tahun: namaTahunAjaran(r.tahun_ajaran) ?? '',
                    semester: r.semester,
                    tingkat: r.tingkat ?? '',
                    lembaga: namaLembaga(r.lembaga, r.jenjang) ?? '',
                    kelas: r.kelas?.nama_kelas ?? '',
                    status_awal: formatStatus(r.status_awal) ?? '',
                    status_akhir: formatStatus(r.status_akhir) ?? '',
                    aktif: r.is_active_riwayat,
                  }))}
                />
                <TabelRelasi
                  judul="Mutasi keluar"
                  jumlah={profil.mutasi.length}
                  columns={[
                    { key: 'lembaga', label: 'Lembaga' },
                    { key: 'kelas', label: 'Kelas terakhir' },
                    { key: 'tanggal', label: 'Tanggal' },
                    { key: 'alasan', label: 'Alasan' },
                    { key: 'tujuan', label: 'Tujuan' },
                  ]}
                  rows={profil.mutasi.map((m) => ({
                    lembaga: namaLembaga(m.lembaga) ?? '',
                    kelas: m.kelas_terakhir?.nama_kelas ?? '',
                    tanggal: ymd(m.tanggal_mutasi),
                    alasan: m.alasan_mutasi ?? '',
                    tujuan: m.nama_sekolah_tujuan ?? '',
                  }))}
                />
                <TabelRelasi
                  judul="Alumni"
                  jumlah={profil.alumni.length}
                  columns={[
                    { key: 'lembaga', label: 'Lembaga lulus' },
                    { key: 'ta', label: 'Tahun lulus' },
                    { key: 'ijazah', label: 'No. ijazah' },
                    { key: 'no_peserta', label: 'No. peserta' },
                    { key: 'skhun', label: 'SKHUN' },
                    { key: 'tanggal', label: 'Tanggal lulus' },
                    { key: 'penyerahan', label: 'Penyerahan ijazah' },
                  ]}
                  rows={profil.alumni.map((a) => ({
                    lembaga: namaLembaga(a.lembaga_lulus) ?? '',
                    ta: namaTahunAjaran(a.tahun_ajaran_lulus) ?? '',
                    ijazah: a.nomor_ijazah ?? '',
                    no_peserta: a.no_peserta ?? '',
                    skhun: a.skhun ?? '',
                    tanggal: ymd(a.tanggal_lulus),
                    penyerahan: a.penyerahan_ijazah ?? '',
                  }))}
                />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Memuat data…</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
