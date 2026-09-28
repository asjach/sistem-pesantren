import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { profilSantri, type ProfilSantri } from '@/api/siklus';
import { errorMessage } from '@/api/client';
import { TGL_KEYS, pihakFields } from '@/components/santri/kolomIdentitas';
import { Copy } from '@/icons';
import { copyText } from '@/lib/clipboard';
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
    judul: 'Identitas dasar',
    kunci: ['nama_lengkap', 'nama_singkat', 'nik', 'nisn', 'jk', 'tipe_santri', 'id'],
  },
  {
    judul: 'Kelahiran',
    kunci: ['tmp_lahir', 'tgl_lahir', 'agama'],
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

// Urutan mengikuti letak di grid 2 kolom: baris 1 Ayah | Ibu, baris 2
// Wali | Kartu keluarga.
const PANEL_KELUARGA: Panel[] = [
  { judul: 'Ayah', kunci: kunciPihak('ayah') },
  { judul: 'Ibu', kunci: kunciPihak('ibu') },
  { judul: 'Wali', kunci: kunciPihak('wali') },
  { judul: 'Kartu keluarga', kunci: ['no_kk', 'kepala_keluarga', 'anak_ke', 'j_saudara', 'yang_membiayai'] },
];

/** Bagian berpanel field — sumber tunggal urutan bagian di profil. */
const BAGIAN: { judul: string; panels: Panel[] }[] = [
  { judul: 'Identitas', panels: PANEL_IDENTITAS },
  { judul: 'Alamat', panels: PANEL_ALAMAT },
  { judul: 'Keluarga', panels: PANEL_KELUARGA },
];

/** Satu tabel relasi: judul, kolom, dan baris yang sudah diformat. */
interface Relasi {
  judul: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
}

/** Nilai satu field sebagai teks tampil; string kosong bila tidak diisi. */
function nilaiTeks(kunci: string, mentah: unknown): string {
  if (mentah === null || mentah === undefined || mentah === '') return '';
  if (TGL_KEYS.has(kunci)) return String(mentah).slice(0, 10);
  const teks = String(mentah);
  return PILIHAN[kunci]?.[teks] ?? teks;
}

/** Nilai untuk disalin ke formulir lain: mentah apa adanya (kode enum ikut
 *  apa adanya), tanggal dipotong YYYY-MM-DD. */
function nilaiSalin(kunci: string, mentah: unknown): string {
  if (mentah === null || mentah === undefined || mentah === '') return '';
  return TGL_KEYS.has(kunci) ? String(mentah).slice(0, 10) : String(mentah);
}

const ymd = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

/** Muat data profil satu Santri. `aktif` memuat/menahan request: dialog yang
 *  belum dibuka menahan, yang ditutup membatalkan, sehingga tidak ada request
 *  sia-sia. Galat dilaporkan lewat toast. */
export function useProfilSantri(santriId: number | null, aktif = true) {
  const [profil, setProfil] = useState<ProfilSantri | null>(null);

  useEffect(() => {
    if (!aktif || santriId == null) return;
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
  }, [santriId, aktif]);

  return profil;
}

/** Chip ringkas (kepala dialog). */
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

/** Satu baris label–nilai. Nilai kosong tampil '—' redup agar pembaca tahu
 *  field-nya ada, bukan sekadar belum ditampilkan. Baris dirapatkan
 *  (padding rapat + huruf 13px) supaya banyak field muat tanpa perlu menggulir
 *  — halaman profil punya 60+ baris. Tombol salin muncul saat baris dilewati
 *  mouse (atau saat difokus) agar tidak ramai namun tetap bisa diketik. */
function Baris({ kunci, mentah, onSalin }: {
  kunci: string;
  mentah: unknown;
  onSalin: (kunci: string) => void;
}) {
  const nilai = nilaiTeks(kunci, mentah);
  const label = labelKunci(kunci);
  return (
    <div className="group grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_1rem] items-baseline gap-2 border-t px-2.5 py-0.5 first:border-t-0">
      <dt className="truncate text-xs leading-5 text-muted-foreground">{label}</dt>
      <dd className={cn('text-[13px] leading-5 break-words', nilai === '' && 'text-muted-foreground')}>
        {nilai || '—'}
      </dd>
      {nilai !== '' && (
        <button
          type="button"
          id={`btn_salin_${kunci}`}
          title={`Salin ${label}`}
          aria-label={`Salin ${label}`}
          onClick={() => onSalin(kunci)}
          className="grid size-4 shrink-0 place-items-center self-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Copy size={12} />
        </button>
      )}
    </div>
  );
}

/** Panel sekelompok field dengan judul. */
function PanelData({ panel, data, onSalin }: {
  panel: Panel;
  data: Record<string, unknown>;
  onSalin: (kunci: string) => void;
}) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-sm font-semibold">{panel.judul}</h4>
      <dl className="overflow-hidden rounded-lg border">
        {panel.kunci.map((k) => <Baris key={k} kunci={k} mentah={data[k]} onSalin={onSalin} />)}
      </dl>
    </section>
  );
}

/** Satu bagian profil: judul kelompok besar + isi (panel field atau tabel
 *  relasi). Bagian ditumpuk dalam satu area gulir, bukan tab, agar seluruh
 *  data terlihat sekilas dan tinggi tidak berubah. */
function Bagian({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="border-b pb-1 text-sm font-semibold">{judul}</h3>
      {children}
    </section>
  );
}

/** Tabel relasi di dalam bagian keanggotaan & riwayat. Baris dibuat rapat
 *  (padding + huruf 13px, line-height tetap) agar tabel panjang — riwayat
 *  belajar bisa puluhan baris — tidak banyak menggulir. */
function TabelRelasi({ judul, jumlah, columns, rows }: {
  judul: string;
  jumlah: number;
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
}) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-sm font-semibold">
        {judul} <span className="font-normal text-muted-foreground">({jumlah})</span>
      </h4>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Tidak ada data.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-[13px] leading-5">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-2.5 py-1 text-left text-xs font-medium whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => (
                    <td key={c.key} className="px-2.5 py-1 whitespace-nowrap">
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

/** Chip status keaktifan + tipe santri, dipakai kepala dialog maupun kepala
 *  halaman profil. */
export function KepalaProfil({ profil }: { profil: ProfilSantri }) {
  const tipe = nilaiTeks('tipe_santri', profil.santri.tipe_santri);
  const aktif = profil.santri.is_active_pst === 'Ya';
  return (
    <>
      <Chip nada={aktif ? 'aktif' : 'tidak'}>
        {aktif ? 'Aktif di pesantren' : 'Tidak aktif di pesantren'}
      </Chip>
      {tipe !== '' && <Chip>{tipe}</Chip>}
    </>
  );
}

/** Isi profil: seluruh bagian ditumpuk dalam satu area gulir ber tinggi tetap
 *  (dialog) atau mengisi sisa tinggi (halaman). Tinggi diberikan lewat
 *  `className` agar keduanya tidak melompat. */
export function IsiProfilSantri({ profil, className }: {
  profil: ProfilSantri;
  className: string;
}) {
  const data = useMemo(
    () => profil.santri as unknown as Record<string, unknown>,
    [profil],
  );

  /** Tabel relasi terformat — dipakai render tabel sekaligus teks salin,
   *  supaya isi yang disalin persis sama dengan yang tampil. */
  const relasi = useMemo<Relasi[]>(() => [
    {
      judul: 'Keanggotaan lembaga',
      columns: [
        { key: 'lembaga', label: 'Lembaga' },
        { key: 'nis_lokal', label: 'NIS lokal' },
        { key: 'nis_kemenag', label: 'NIS Kemenag' },
        { key: 'mulai', label: 'Mulai' },
        { key: 'selesai', label: 'Selesai' },
        { key: 'aktif', label: 'Aktif' },
      ],
      rows: profil.keanggotaan.map((k) => ({
        lembaga: namaLembaga(k.lembaga, k.jenjang) ?? '',
        nis_lokal: k.nis_lokal ?? '',
        nis_kemenag: k.nis_kemenag ?? '',
        mulai: ymd(k.tgl_masuk),
        selesai: ymd(k.tgl_selesai),
        aktif: k.is_active_lembaga,
      })),
    },
    {
      judul: 'Riwayat belajar',
      columns: [
        { key: 'tahun', label: 'Tahun ajaran' },
        { key: 'semester', label: 'Smt' },
        { key: 'tingkat', label: 'Tingkat' },
        { key: 'lembaga', label: 'Lembaga' },
        { key: 'kelas', label: 'Kelas' },
        { key: 'status_awal', label: 'Awal' },
        { key: 'status_akhir', label: 'Akhir' },
        { key: 'aktif', label: 'Aktif' },
      ],
      rows: profil.riwayat.map((r) => ({
        tahun: namaTahunAjaran(r.tahun_ajaran) ?? '',
        semester: r.semester,
        tingkat: r.tingkat ?? '',
        lembaga: namaLembaga(r.lembaga, r.jenjang) ?? '',
        kelas: r.kelas?.nama_kelas ?? '',
        status_awal: formatStatus(r.status_awal) ?? '',
        status_akhir: formatStatus(r.status_akhir) ?? '',
        aktif: r.is_active_riwayat,
      })),
    },
    {
      judul: 'Mutasi keluar',
      columns: [
        { key: 'lembaga', label: 'Lembaga' },
        { key: 'kelas', label: 'Kelas terakhir' },
        { key: 'tanggal', label: 'Tanggal' },
        { key: 'alasan', label: 'Alasan' },
        { key: 'tujuan', label: 'Tujuan' },
      ],
      rows: profil.mutasi.map((m) => ({
        lembaga: namaLembaga(m.lembaga) ?? '',
        kelas: m.kelas_terakhir?.nama_kelas ?? '',
        tanggal: ymd(m.tanggal_mutasi),
        alasan: m.alasan_mutasi ?? '',
        tujuan: m.nama_sekolah_tujuan ?? '',
      })),
    },
    {
      judul: 'Alumni',
      columns: [
        { key: 'lembaga', label: 'Lembaga lulus' },
        { key: 'ta', label: 'Tahun lulus' },
        { key: 'ijazah', label: 'No. ijazah' },
        { key: 'no_peserta', label: 'No. peserta' },
        { key: 'skhun', label: 'SKHUN' },
        { key: 'tanggal', label: 'Tanggal lulus' },
        { key: 'penyerahan', label: 'Penyerahan ijazah' },
      ],
      rows: profil.alumni.map((a) => ({
        lembaga: namaLembaga(a.lembaga_lulus) ?? '',
        ta: namaTahunAjaran(a.tahun_ajaran_lulus) ?? '',
        ijazah: a.nomor_ijazah ?? '',
        no_peserta: a.no_peserta ?? '',
        skhun: a.skhun ?? '',
        tanggal: ymd(a.tanggal_lulus),
        penyerahan: a.penyerahan_ijazah ?? '',
      })),
    },
  ], [profil]);

  /** Salin satu nilai field ke papan klip. Yang disalin adalah nilai mentah,
   *  bukan teks terjemahannya, karena tujuannya mengisi formulir lain seperti
   *  EMIS: `jk` harus jadi "L", bukan "Laki-laki". Toast menyebut nama field +
   *  isinya supaya tidak ragu. */
  async function salinNilai(k: string) {
    const teks = nilaiSalin(k, data[k]);
    if (teks === '') return;
    const ok = await copyText(teks);
    if (ok) toast.success(`${labelKunci(k)} disalin: ${teks}`);
    else toast.error(`Gagal menyalin ${labelKunci(k)}.`);
  }

  return (
    <div data-part="isi_profil" className={cn('space-y-6 overflow-y-auto pr-1', className)}>
      {BAGIAN.map((b) => (
        <Bagian key={b.judul} judul={b.judul}>
          <div className="grid gap-4 sm:grid-cols-2">
            {b.panels.map((p) => (
              <PanelData key={p.judul} panel={p} data={data} onSalin={salinNilai} />
            ))}
          </div>
        </Bagian>
      ))}

      <Bagian judul="Keanggotaan &amp; riwayat">
        <div className="space-y-5">
          {relasi.map((t) => (
            <TabelRelasi
              key={t.judul}
              judul={t.judul}
              jumlah={t.rows.length}
              columns={t.columns}
              rows={t.rows}
            />
          ))}
        </div>
      </Bagian>
    </div>
  );
}
