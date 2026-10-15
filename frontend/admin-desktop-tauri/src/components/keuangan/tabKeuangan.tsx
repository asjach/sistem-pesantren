import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import ExcelTable, { type ExcelChoice, type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import FilterRail from '@/components/FilterRail';
import LabeledCombobox from '@/components/LabeledCombobox';
import { ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger } from '@/components/ui/combobox';
import { TopBarSearch } from '@/components/TopBarSearch';
import TagihanCrosstab, { type MetaSel, type SelBlok } from '@/components/keuangan/TagihanCrosstab';
import PresetUrut from '@/components/PresetUrut';
import { ActionIcon, DeleteAction, EditAction } from '@/components/RowActions';
import { Info, Plus, Trash2, TriangleAlert, X } from '@/icons';
import { cn } from '@/lib/utils';
import { teksAturan, teksAturanPaket } from '@/lib/dispensasi';
import type { PetaArahKolom } from '@/lib/urut';
import type { PilihanLembaga } from '@/lembagaAktif';
import type { PerPage } from '@/prefs';
import type {
  CrosstabBaris, CrosstabKolom, CrosstabSel, CrosstabTagihan, Dispensasi, JenisTagihan, RekapDispensasi, Tarif,
} from '@/api/keuangan';
import type { Santri } from '@/api/santri';

/* Isi tiap tab halaman Keuangan.
 *
 * Semua state tetap dipegang halaman (bukan di dalam komponen tab) supaya
 * pencarian/urutan/pilihan tidak hilang saat berpindah tab — Radix melepas
 * isi tab yang tidak aktif. Komponen di sini murni menerima data + handler. */

/** Penanda pilihan "Semua (global)" di baris input tabel Jenis: jenjang
 *  `null` tak bisa diwakili pilihan kosong sebab kolomnya `required`. */
export const JENIS_GLOBAL = '__global';

/** Nama & tipe bisa diedit langsung lewat mode Edit; `lembaga` baca-saja di
 *  baris data (pindah lingkup hanya lewat dialog Ubah) tapi jadi dropdown di
 *  baris input — pilihannya disuntik `JenisTab`. */
export const FIELDS_JENIS: ExcelField[] = [
  {
    key: 'nama', label: 'Jenis Tagihan', kind: 'text', maxLength: 100, required: true,
    validate: (v) => (!v || !v.trim() ? 'Nama jenis wajib diisi.' : null),
  },
  {
    key: 'keterangan', label: 'Keterangan', kind: 'text', maxLength: 1000,
    validate: (v) => ((v ?? '').length > 1000 ? 'Keterangan maksimal 1000 karakter.' : null),
  },
  {
    key: 'tipe', label: 'Tipe', width: 110, kind: 'select', required: true,
    choices: [
      { value: 'bulanan', label: 'Bulanan' },
      { value: 'non_bulanan', label: 'Non-bulanan' },
    ],
    // Sel yang dikosongkan (Delete) ditolak, bukan diam-diam jadi Non-bulanan.
    validate: (v) => (v === 'bulanan' || v === 'non_bulanan' ? null : 'Tipe harus Bulanan atau Non-bulanan.'),
  },
  { key: 'lembaga', label: 'Lembaga', width: 130, kind: 'static', inputKind: 'select', required: true },
  // Urutan tampil KOLOM crosstab Tagihan (jenis lalu periode). Kosong = 0 →
  // kolomnya mengikuti urutan id, jadi tampilan lama tak berubah sampai diisi.
  {
    key: 'urutan', label: 'Urutan', width: 80, kind: 'text', maxLength: 5,
    validate: (v) => ((v ?? '').trim() === '' || /^\d+$/.test((v ?? '').trim())
      ? null : 'Urutan harus angka bulat ≥ 0.'),
  },
  // Switch status tersimpan langsung (tanpa Mode Edit), seperti kolom is_active lain.
  { key: 'aktif', label: 'Status', width: 80, kind: 'toggle' },
];

/** Angka nominal dari teks sel grid: terima digit polos (`75000`) atau
 *  ber-titik ribuan (`75.000`); selain bentuk itu → null (ditolak validate). */
function nominalDariTeks(v: string | null | undefined): number | null {
  const s = (v ?? '').trim();
  if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(s)) return null;
  return Number(s.replace(/\./g, ''));
}

/** Angka urutan dari teks sel grid. Sel kosong (atau dihapus) = 0 alias
 *  "belum diatur"; teks tak sah → nilai lama supaya tak diam-diam mereset.
 *  Dipakai juga dialog Tambah/Ubah Jenis. */
export function urutanDariTeks(v: string | null | undefined, lama: number): number {
  const s = (v ?? '').trim();
  if (s === '') return 0;
  return /^\d+$/.test(s) ? Number(s) : lama;
}

/** Jenjang + TA + jenis adalah kunci baris tarif — sel itu baca-saja; hanya
 *  nominal & status aktif yang bisa diedit langsung lewat mode Edit. */
export const FIELDS_TARIF: ExcelField[] = [
  { key: 'jenjang', label: 'Lembaga', kind: 'static', width: 90 },
  { key: 'tahun_ajaran', label: 'Tahun Ajaran', kind: 'static', width: 110 },
  // Jenis hanya bisa diisi di baris input (mode Input); pilihannya disuntik
  // TarifTab dari daftar jenis yang berlaku untuk lembaga filter.
  { key: 'jenis', label: 'Jenis', kind: 'static', inputKind: 'select', required: true },
  {
    key: 'nominal', label: 'Nominal', width: 110, kind: 'text', maxLength: 15, required: true,
    validate: (v) => ((v ?? '').trim() === ''
      ? 'Nominal wajib diisi.'
      : (nominalDariTeks(v) === null ? 'Nominal harus angka bulat ≥ 0.' : null)),
  },
  // Switch status tersimpan langsung (tanpa Mode Edit) seperti kolom is_active
  // lain; gerbang izinnya mengikuti `canEdit` tabel.
  { key: 'aktif', label: 'Aktif', kind: 'toggle', width: 70 },
];

export const FIELDS_DISPENSASI: ExcelField[] = [
  { key: 'nama', label: 'Dispensasi', kind: 'static' },
  { key: 'aturan', label: 'Aturan per Jenis', kind: 'static' },
  { key: 'santri', label: 'Santri', kind: 'static', width: 90 },
  { key: 'jenjang', label: 'Jenjang', kind: 'static', width: 90 },
  { key: 'tahun_ajaran', label: 'TA', kind: 'static', width: 100 },
  { key: 'status', label: 'Status', kind: 'static', width: 80 },
];

/** Kolom rekap dampak dispensasi per lembaga — semuanya baca-saja; key
 *  kolom = kode urut yang dikenal endpoint `rekap` (UrutKatalog) sekaligus
 *  kunci nilai dari `getValues`. */
export const FIELDS_REKAP_DISPENSASI: ExcelField[] = [
  { key: 'lembaga', label: 'Lembaga', kind: 'static', width: 100 },
  { key: 'tagihan', label: 'Tagihan', kind: 'static', width: 90 },
  { key: 'penerima', label: 'Penerima', kind: 'static', width: 90 },
  { key: 'potongan', label: 'Total Potongan', kind: 'static', width: 140 },
  { key: 'paket', label: 'Paket', kind: 'static', width: 80 },
];

export const FIELDS_PENERIMA: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'nis', label: 'NIS', kind: 'static', width: 110 },
  { key: 'lembaga', label: 'Lembaga', kind: 'static', width: 100 },
  { key: 'dispensasi', label: 'Dispensasi', kind: 'static' },
  { key: 'tahun_ajaran', label: 'TA', kind: 'static', width: 100 },
];

/** Baris tab Daftar Penerima Dispensasi: satu santri × satu paket dispensasi. */
export interface BarisPenerima {
  /** `${dispensasi_id}:${santri_id}` — unik per pasangan. */
  id: string;
  santri_id: number;
  nama: string;
  nis: string | null;
  lembaga: string | null;
  dispensasi_id: number;
  dispensasi: string;
  tahun_ajaran: string;
}

/** NIS tampil: NIS lokal lebih dulu, lalu NIS kemenag (dari keanggotaan aktif). */
function nisTampil(s: Santri): string | null {
  const aktif = s.lembaga_aktif ?? [];
  return aktif.find((l) => l.nis_lokal)?.nis_lokal
    ?? aktif.find((l) => l.nis_kemenag)?.nis_kemenag
    ?? null;
}

/** Lembaga tampil: jenjang keanggotaan aktif (urut, unik). */
function lembagaTampil(s: Santri): string | null {
  const unik = [...new Set((s.lembaga_aktif ?? []).map((l) => l.jenjang).filter(Boolean))];
  return unik.length ? unik.join(', ') : null;
}

/** Ratakan paket dispensasi → baris penerima (satu baris per pasangan
 *  santri-paket), urut nama santri lalu nama paket. */
export function barisPenerima(daftar: Dispensasi[]): BarisPenerima[] {
  const baris: BarisPenerima[] = [];
  for (const d of daftar) {
    for (const s of d.santri_tambahan ?? []) {
      baris.push({
        id: `${d.id}:${s.id}`,
        santri_id: s.id,
        nama: s.nama_lengkap,
        nis: nisTampil(s),
        lembaga: lembagaTampil(s),
        dispensasi_id: d.id,
        dispensasi: d.nama,
        tahun_ajaran: d.tahun_ajaran,
      });
    }
  }
  return baris.sort((a, b) => a.nama.localeCompare(b.nama, 'id') || a.dispensasi.localeCompare(b.dispensasi, 'id'));
}

/** State urut header satu tabel (dimiliki halaman, diteruskan ke tab). */
export interface SortTabel {
  urut: string[];
  arah: 'naik' | 'turun';
  terapkan: (nilai: string[], arah: 'naik' | 'turun', peta?: PetaArahKolom) => void;
}

/** Nilai grid tabel Jenis Tagihan. `tipe` dikirim mentah karena kolomnya
 *  select — label Bulanan/Non-bulanan diambil dari `choices` kolom. */
export function nilaiGridJenis(j: JenisTagihan): Record<string, string | null> {
  return {
    nama: j.nama,
    keterangan: j.keterangan,
    tipe: j.tipe,
    lembaga: j.jenjang ?? 'Semua',
    // 0 = belum diatur → sel dibiarkan kosong (bukan "0" yang ramai).
    urutan: j.urutan === 0 ? null : String(j.urutan),
    aktif: j.is_active ? 'ya' : 'tidak',
  };
}

/** Payload `ubahJenis` dari sel yang berubah. Lingkup (jenjang) sengaja tidak
 *  ikut — pindah lembaga hanya lewat dialog Ubah; field yang tidak berubah
 *  memakai nilai baris sebab endpoint menuntut `nama` juga. */
export function payloadUbahJenis(baris: JenisTagihan, f: Record<string, string | null>): {
  nama: string; tipe: 'bulanan' | 'non_bulanan'; is_active: boolean; keterangan: string | null; urutan: number;
} {
  const nama = f.nama !== undefined ? (f.nama ?? '').trim() : baris.nama;
  const keterangan = f.keterangan !== undefined ? (f.keterangan ?? '').trim() : (baris.keterangan ?? '');
  return {
    // Validator sudah menolak nama kosong; ini jaring pengaman terakhir.
    nama: nama === '' ? baris.nama : nama,
    tipe: f.tipe !== undefined ? (f.tipe === 'bulanan' ? 'bulanan' : 'non_bulanan') : baris.tipe,
    is_active: f.aktif !== undefined ? f.aktif === 'ya' : baris.is_active,
    keterangan: keterangan === '' ? null : keterangan,
    urutan: f.urutan !== undefined ? urutanDariTeks(f.urutan, baris.urutan) : baris.urutan,
  };
}

/** Payload `buatJenis` dari baris input: nama & tipe wajib, lingkup lembaga
 *  wajib dipilih (`JENIS_GLOBAL` = jenis global, hanya untuk super_admin). */
export function payloadBuatJenis(f: Record<string, string | null>): {
  nama: string; tipe: 'bulanan' | 'non_bulanan'; jenjang: string | null; keterangan: string | null; urutan: number;
} {
  const nama = (f.nama ?? '').trim();
  if (nama === '') throw new Error('Nama jenis wajib diisi.');
  const tipe = f.tipe === 'bulanan' ? 'bulanan' as const
    : f.tipe === 'non_bulanan' ? 'non_bulanan' as const : null;
  if (tipe === null) throw new Error('Pilih tipe tagihan dulu.');
  const lembaga = (f.lembaga ?? '').trim();
  if (lembaga === '') throw new Error('Pilih lembaga dulu.');
  const keterangan = (f.keterangan ?? '').trim();
  return {
    nama, tipe, jenjang: lembaga === JENIS_GLOBAL ? null : lembaga,
    keterangan: keterangan === '' ? null : keterangan,
    urutan: urutanDariTeks(f.urutan, 0),
  };
}

/** Baris tarif yang sudah memakai kombinasi (lembaga, tahun ajaran, jenis) —
 *  calon bentrok saat menambah baris baru. `tingkat` sengaja tidak ikut:
 *  baris input selalu tanpa tingkat, dan pipeline generate tidak pernah
 *  membaca tingkat tarif. Index DB `uq_tarif_tagihan` memang memuat tingkat,
 *  tetapi MySQL/SQLite menganggap NULL berbeda sehingga baris ganda tetap
 *  bisa lolos ke database — penjaga ini yang menutupnya. */
export function tarifBentrok(
  rows: readonly Tarif[],
  calon: { jenjang: string; tahun_ajaran: string; jenis_id: number },
): Tarif | null {
  return rows.find((t) => t.jenjang === calon.jenjang
    && t.tahun_ajaran === calon.tahun_ajaran
    && t.jenis_id === calon.jenis_id) ?? null;
}

/** Penjaga sebelum POST: lempar pesan bentrok bila (lembaga, TA, jenis) sudah
 *  punya tarif. Dipakai halaman agar duplikat dicegah di klien — tidak
 *  bergantung pada 422 server. */
export function pastikanTarifBaru(
  rows: readonly Tarif[],
  calon: { jenjang: string; tahun_ajaran: string; jenis_id: number },
): void {
  const bentrok = tarifBentrok(rows, calon);
  if (bentrok === null) return;
  throw new Error(`Tarif ${bentrok.jenis?.nama ?? 'jenis ini'} untuk ${calon.jenjang} ${calon.tahun_ajaran} sudah ada — ubah baris itu, bukan menambah baris baru.`);
}

/** Pilihan jenis di baris input tabel Tarif: jenis global (null) selalu ikut +
 *  khusus lembaga filter (penyaringan sama dengan dialog Tambah Tarif); jenis
 *  yang sudah punya tarif di lingkup ini ditandai "· sudah ada". */
export function opsiJenisTarif(
  jenis: JenisTagihan[],
  jenjangFilter: string | null,
  terpakai: ReadonlySet<number>,
): ExcelChoice[] {
  return jenis
    .filter((j) => j.jenjang === null || j.jenjang === jenjangFilter)
    .map((j) => ({ value: String(j.id), label: terpakai.has(j.id) ? `${j.nama} · sudah ada` : j.nama }));
}

/** Acuan tetap saat halaman tidak mengirim daftar jenis terpakai. */
const TANPA_JENIS_TERPAKAI: ReadonlySet<number> = new Set();

/** Tab Jenis Tagihan: tabel + tombol tambah/ubah. Nama, tipe, dan status bisa
 *  diedit langsung (mode Edit, izin `keuangan.ubah`); mode Input membuat jenis
 *  baru (izin `keuangan.tambah`) dengan lingkup lembaga dipilih di baris input. */
export function JenisTab({ rows, loading, sort, efektifSuper, pilihanLembaga, canEdit, onCommit, onSaved, onCreateRow, onTambah, onEdit, onHapus }: {
  rows: JenisTagihan[];
  loading: boolean;
  sort: SortTabel;
  efektifSuper: boolean;
  /** Opsi lingkup lembaga di baris input (jenis global + lembaga peran). */
  pilihanLembaga: PilihanLembaga[];
  /** Gerbang izin `keuangan.ubah`: menyalakan mode Edit & switch Status. */
  canEdit: boolean;
  /** Simpan satu baris hasil edit sel (antrean auto-save ExcelTable). */
  onCommit: (id: number, fields: Record<string, string | null>) => Promise<void>;
  onSaved: () => Promise<void> | void;
  /** Absen = mode Input tidak tersedia (pemegang `keuangan.tambah` saja). */
  onCreateRow?: (fields: Record<string, string | null>) => Promise<void>;
  onTambah: () => void;
  onEdit: (j: JenisTagihan) => void;
  onHapus: (j: JenisTagihan) => void;
}) {
  /** Pilihan lingkup di baris input: "Semua (global)" hanya untuk super_admin
   *  efektif — sama seperti select lingkup pada dialog Tambah Jenis. */
  const fields = useMemo<ExcelField[]>(() => {
    const opsi: ExcelChoice[] = pilihanLembaga.map((l) => ({ value: l.jenjang, label: `${l.jenjang} — ${l.nama}` }));
    if (efektifSuper) opsi.unshift({ value: JENIS_GLOBAL, label: 'Semua (global)' });
    return FIELDS_JENIS.map((f) => (f.key === 'lembaga' ? { ...f, inputChoices: opsi } : f));
  }, [pilihanLembaga, efektifSuper]);

  return (
    <ExcelTable<JenisTagihan & { id: number }>
      tableKey="keuangan_jenis"
      fields={fields}
      rows={rows.map((j) => ({ ...j, id: j.id }))}
      urutAktif={sort.urut}
      arahUrut={sort.arah}
      onUrut={sort.terapkan}
      getValues={nilaiGridJenis}
      loading={loading}
      emptyText="Belum ada jenis tagihan."
      canEdit={canEdit}
      onCommit={onCommit}
      onSaved={onSaved}
      onCreateRow={onCreateRow}
      renderActions={(j) => (
        (j.jenjang !== null || efektifSuper)
          ? <>
              <EditAction id={`btn_jenis_ubah_${j.id}`} onClick={() => onEdit(j)} />
              <DeleteAction
                id={`btn_jenis_hapus_${j.id}`}
                title="Hapus jenis?"
                description="Jenis dihapus permanen. Jenis yang sudah dipakai pada tarif/tagihan tidak bisa dihapus — nonaktifkan saja."
                onConfirm={() => onHapus(j)}
              />
            </>
          : null
      )}
      hideCheckbox
      addButtonLangsung
      addButton={<Button id="btn_jenis_tambah_buka" size="icon" variant="outline" aria-label="Tambah jenis tagihan" title="Tambah jenis tagihan" onClick={onTambah}><Plus size={16} /></Button>}
    />
  );
}

/** Nilai grid tabel Tarif: nominal terformat ribuan, status memakai bentuk
 *  `ya`/`tidak` (bentuk yang dibaca ToggleCell). */
export function nilaiGridTarif(r: Tarif): Record<string, string | null> {
  return {
    jenjang: r.jenjang,
    tahun_ajaran: r.tahun_ajaran,
    jenis: r.jenis?.nama ?? null,
    nominal: r.nominal.toLocaleString('id'),
    aktif: r.is_active ? 'ya' : 'tidak',
  };
}

/** Payload `ubahTarif` dari sel yang berubah: field yang tidak ikut berubah
 *  memakai nilai baris, sebab endpoint menuntut nominal + status sekaligus. */
export function payloadUbahTarif(
  baris: Tarif,
  f: Record<string, string | null>,
): { nominal: number; is_active: boolean } {
  return {
    nominal: f.nominal !== undefined ? (nominalDariTeks(f.nominal) ?? baris.nominal) : baris.nominal,
    is_active: f.aktif !== undefined ? f.aktif === 'ya' : baris.is_active,
  };
}

/** Payload `buatTarif` dari baris input (jenjang + tahun ajaran diambil dari
 *  filter halaman): jenis wajib dipilih, nominal wajib angka yang valid.
 *  Dilempar sebagai Error agar pesannya tampil sebagai toast baris input. */
export function payloadBuatTarif(f: Record<string, string | null>): { jenis_id: number; nominal: number } {
  const jenisId = Number((f.jenis ?? '').trim());
  if (!Number.isInteger(jenisId) || jenisId <= 0) throw new Error('Pilih jenis tagihan dulu.');
  const nominal = nominalDariTeks(f.nominal);
  if (nominal === null) throw new Error('Nominal harus angka bulat ≥ 0.');
  return { jenis_id: jenisId, nominal };
}

/** Tab Tarif: tabel + tombol tambah/ubah/hapus. Nominal & status aktif bisa
 *  diedit langsung (mode Edit, auto-save per sel) oleh pemegang `keuangan.ubah`;
 *  mode Input membuat tarif baru untuk lingkup filter oleh pemegang
 *  `keuangan.tambah`. */
export function TarifTab({ rows, loading, sort, jenis, jenjangFilter, jenisTerpakai, canEdit, onCommit, onSaved, onCreateRow, inputRowValues, onTambah, onEdit, onHapus }: {
  rows: Tarif[];
  loading: boolean;
  sort: SortTabel;
  /** Daftar jenis tagihan untuk dropdown baris input (mode Input). */
  jenis: JenisTagihan[];
  /** Lembaga filter tunggal: menentukan jenis yang berlaku di baris input. */
  jenjangFilter: string | null;
  /** Jenis yang sudah punya tarif di lingkup baris input — ditandai di dropdown. */
  jenisTerpakai?: ReadonlySet<number>;
  /** Gerbang izin `keuangan.ubah`: menyalakan mode Edit & switch Aktif. */
  canEdit: boolean;
  /** Simpan satu baris hasil edit sel (antrean auto-save ExcelTable). */
  onCommit: (id: number, fields: Record<string, string | null>) => Promise<void>;
  onSaved: () => Promise<void> | void;
  /** Absen = mode Input tidak tersedia (pemegang `keuangan.tambah` saja). */
  onCreateRow?: (fields: Record<string, string | null>) => Promise<void>;
  /** Nilai tampilan kolom statis baris input (lembaga + TA dari filter). */
  inputRowValues?: Record<string, string | null>;
  onTambah: () => void;
  onEdit: (t: Tarif) => void;
  onHapus: (t: Tarif) => void;
}) {
  /** Pilihan jenis di baris input (lingkup filter + tanda "sudah ada"). */
  const fields = useMemo<ExcelField[]>(() => {
    const opsi = opsiJenisTarif(jenis, jenjangFilter, jenisTerpakai ?? TANPA_JENIS_TERPAKAI);
    return FIELDS_TARIF.map((f) => (f.key === 'jenis' ? { ...f, inputChoices: opsi } : f));
  }, [jenis, jenjangFilter, jenisTerpakai]);

  return (
    <ExcelTable<Tarif & { id: number }>
      tableKey="keuangan_tarif"
      fields={fields}
      rows={rows.map((t) => ({ ...t, id: t.id }))}
      urutAktif={sort.urut}
      arahUrut={sort.arah}
      onUrut={sort.terapkan}
      getValues={nilaiGridTarif}
      loading={loading}
      emptyText="Belum ada tarif."
      canEdit={canEdit}
      onCommit={onCommit}
      onSaved={onSaved}
      onCreateRow={onCreateRow}
      inputRowValues={inputRowValues}
      renderActions={(r) => (
        <>
          <EditAction id={`btn_tarif_ubah_${r.id}`} onClick={() => onEdit(r)} />
          <DeleteAction
            id={`btn_tarif_hapus_${r.id}`}
            title="Hapus tarif?"
            description="Tarif dihapus permanen. Tarif yang sudah dipakai pada tagihan tidak bisa dihapus — nonaktifkan saja."
            onConfirm={() => onHapus(r)}
          />
        </>
      )}
      hideCheckbox
      addButtonLangsung
      addButton={<Button id="btn_tarif_tambah_buka" size="icon" variant="outline" aria-label="Tambah tarif" title="Tambah tarif" onClick={onTambah}><Plus size={16} /></Button>}
    />
  );
}

/** Tab Dispensasi: tabel + tombol tambah/ubah/hapus. Baris bisa DIPILIH
 *  (klik sel) — halaman memakai baris terpilih untuk mengisi panel penerima. */
export function DispensasiTab({ rows, loading, sort, onTambah, onEdit, onHapus, aktifId, onPilih }: {
  rows: Dispensasi[];
  loading: boolean;
  sort: SortTabel;
  onTambah: () => void;
  onEdit: (d: Dispensasi) => void;
  onHapus: (d: Dispensasi) => void;
  /** Baris dispensasi yang sedang dipilih (disorot). */
  aktifId: number | null;
  onPilih: (d: Dispensasi) => void;
}) {
  return (
    <ExcelTable<Dispensasi & { id: number }>
      tableKey="keuangan_dispensasi"
      fields={FIELDS_DISPENSASI}
      rows={rows}
      urutAktif={sort.urut}
      arahUrut={sort.arah}
      onUrut={sort.terapkan}
      onBarisKlik={onPilih}
      barisAktifId={aktifId}
      getValues={(r) => ({
        nama: r.nama,
        aturan: teksAturanPaket(r),
        santri: `${(r.santri_ids ?? []).length} santri`,
        jenjang: r.jenjang ?? 'Semua',
        tahun_ajaran: r.tahun_ajaran,
        status: r.is_active ? 'Aktif' : 'Nonaktif',
      })}
      loading={loading}
      emptyText="Belum ada dispensasi."
      canEdit={false}
      onCommit={async () => {}}
      onSaved={() => {}}
      renderActions={(r) => (
        <>
          <EditAction id={`btn_dispensasi_ubah_${r.id}`} onClick={() => onEdit(r)} />
          <DeleteAction
            id={`btn_dispensasi_hapus_${r.id}`}
            title="Hapus dispensasi?"
            description="Dispensasi dihapus permanen. Dispensasi yang sudah dipakai tagihan tidak bisa dihapus — nonaktifkan saja."
            onConfirm={() => onHapus(r)}
          />
        </>
      )}
      hideCheckbox
      addButtonLangsung
      addButton={<Button id="btn_dispensasi_tambah_buka" size="icon" variant="outline" aria-label="Tambah dispensasi" title="Tambah dispensasi" onClick={onTambah}><Plus size={16} /></Button>}
    />
  );
}

/** Kartu informasi paket dispensasi TERPILIH (halaman Dispensasi, kolom
 *  kanan) — diletakkan di ATAS tabel Daftar Penerima supaya santri yang
 *  sedang dikelola tetap terlihat tanpa menggulir. Isinya mengikuti baris
 *  yang diklik di tabel Daftar Dispensasi (kolom kiri): status, TA, jumlah
 *  penerima, kuota, grup, keterangan, dan seluruh aturan potongannya.
 *
 *  Tata letak mengikuti idiom kartu detail aplikasi (lihat
 *  `DialogLihatLembaga`): kepala berisi identitas + badge status, lalu
 *  pasangan label–nilai yang SEJAJAR KOLOM (grid dua kolom) supaya mata bisa
 *  memindai ke bawah, bukan membaca satu baris panjang yang membungkus.
 *
 *  Murni presentasional (tanpa fetch): halaman sudah memegang paketnya. */
export function KartuDispensasiTerpilih({ d, jumlahPenerima }: {
  /** Paket terpilih — sumber seluruh isi kartu. */
  d: Dispensasi;
  /** Banyaknya penerima paket ini (panjang tabel di bawahnya). */
  jumlahPenerima: number;
}) {
  const aturan = d.aturan ?? [];
  /** Satu baris label–nilai; `kosong` memudarkan nilai "—". */
  const baris = (label: string, isi: ReactNode, idNilai: string, kosong = false, title?: string) => (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        id={idNilai}
        className={cn('min-w-0 truncate', kosong && 'text-muted-foreground')}
        title={title}
      >
        {isi}
      </dd>
    </>
  );

  return (
    <Card id="kartu_dispensasi_terpilih" className="shrink-0 gap-0 p-0 text-xs">
      {/* Kepala: identitas paket + status; jumlah penerima menempel kanan. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-2.5 py-1.5">
        <span id="kartu_dispensasi_nama" className="min-w-0 truncate text-xs font-semibold" title={d.nama}>
          {d.nama}
        </span>
        <Badge
          id="kartu_dispensasi_status"
          variant={d.is_active ? 'default' : 'destructive'}
          className="text-[10px]"
        >
          {d.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
        <span className="ml-auto shrink-0 text-muted-foreground">
          <span id="kartu_dispensasi_penerima" className="font-medium tabular-nums text-foreground">
            {jumlahPenerima}
          </span>{' '}
          penerima
        </span>
      </div>

      {/* Isi: label–nilai sejajar kolom (lebar label = label terpanjang). */}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 px-2.5 py-1.5">
        {baris('Tahun ajaran', d.tahun_ajaran, 'kartu_dispensasi_ta')}
        {baris('Jenjang', d.jenjang ?? 'Semua lembaga', 'kartu_dispensasi_jenjang', d.jenjang == null)}
        {baris(
          'Kuota',
          d.kuota_bulan == null ? 'Tanpa batas' : `${d.kuota_bulan} bulan`,
          'kartu_dispensasi_kuota',
          d.kuota_bulan == null,
        )}
        {baris('Grup', d.grup ?? '—', 'kartu_dispensasi_grup', d.grup == null)}
        {baris('Keterangan', d.keterangan ?? '—', 'kartu_dispensasi_keterangan', d.keterangan == null, d.keterangan ?? undefined)}
      </dl>

      {/* Aturan potongan: satu baris sendiri agar chip bisa membungkus bebas. */}
      <div className="flex flex-wrap items-center gap-1 border-t px-2.5 py-1.5">
        <span className="text-muted-foreground">Aturan</span>
        {aturan.length === 0 ? (
          <span id="kartu_dispensasi_aturan_kosong" className="text-muted-foreground">
            belum ada aturan jenis
          </span>
        ) : (
          aturan.map((a) => (
            <Badge
              key={a.id}
              id={`kartu_dispensasi_aturan_${a.id}`}
              variant="outline"
              className="gap-1 px-1.5 py-px text-[11px] font-normal"
              title={`${a.jenis?.nama ?? 'Semua jenis tagihan'}: ${teksAturan(a)}`}
              aria-label={`${a.jenis?.nama ?? 'Semua jenis tagihan'}: ${teksAturan(a)}`}
            >
              <span className="text-muted-foreground">{a.jenis?.nama ?? 'Semua jenis'}</span>
              <span className="font-medium tabular-nums">{teksAturan(a)}</span>
            </Badge>
          ))
        )}
      </div>
    </Card>
  );
}

/** Panel Daftar Penerima SATU dispensasi (kanan halaman Dispensasi): santri
 *  penerima paket yang sedang dipilih di tabel kiri + aksi mengeluarkan.
 *  Combobox filter lama dihapus — paketnya sudah ditentukan baris terpilih.
 *  Kolom "Sisa Kuota" (terpakai/kuota) muncul hanya untuk paket berkuota —
 *  dipindah dari tab Daftar Santri di dialog yang kini dihapus. */
export function PenerimaDispensasiPanel({ rows, loading, nama, kuota, terpakai, busy, bolehUbah, emptyText, onKeluarkan }: {
  rows: BarisPenerima[];
  loading: boolean;
  /** Nama paket terpilih (judul panel). */
  nama: string;
  /** Kuota bulan paket terpilih; null = tanpa batas (kolom sisa disembunyikan). */
  kuota: number | null;
  /** Bulan terpakai per santri untuk paket ini (`kuotaPakai`). */
  terpakai: Record<number, number>;
  busy: boolean;
  /** Gerbang izin `keuangan.ubah`: tanpa ini panel baca-saja. */
  bolehUbah: boolean;
  /** Pesan saat tabel kosong — halaman menimpanya ketika pencarian aktif,
   *  supaya "belum ada penerima" tidak menyesatkan saat barisnya tersaring. */
  emptyText?: string;
  onKeluarkan: (santriIds: number[]) => void;
}) {
  const fields = useMemo(
    () => kuota === null
      ? FIELDS_PENERIMA
      : [...FIELDS_PENERIMA, { key: 'sisa', label: 'Sisa Kuota', kind: 'static' as const, width: 90 }],
    [kuota],
  );

  return (
    <ExcelTable<BarisPenerima>
      tableKey="keuangan_penerima_dispensasi"
      header={(
        <span id="judul_penerima_dispensasi" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
          Daftar Penerima {nama} ({rows.length})
        </span>
      )}
      fields={fields}
      rows={rows}
      getValues={(r) => ({
        nama: r.nama,
        nis: r.nis,
        lembaga: r.lembaga,
        dispensasi: r.dispensasi,
        tahun_ajaran: r.tahun_ajaran,
        sisa: kuota === null ? null : `${Math.max(0, kuota - (terpakai[r.santri_id] ?? 0))}/${kuota}`,
      })}
      loading={loading}
      emptyText={emptyText ?? 'Belum ada penerima — masukkan santri dari daftar di kiri.'}
      canEdit={false}
      onCommit={async () => {}}
      onSaved={() => {}}
      aksiLangsung
      renderActions={bolehUbah
        ? (r) => (
          <ActionIcon
            id={`btn_penerima_dispensasi_keluar_${r.santri_id}`}
            title={`Keluarkan ${r.nama}`}
            onClick={() => onKeluarkan([r.santri_id])}
          >
            <X size={16} />
          </ActionIcon>
        )
        : () => null}
      renderBulkActions={!bolehUbah ? undefined : (checked, clear) => checked.length === 0 ? null : (
        <Button
          id="btn_penerima_dispensasi_keluar_banyak"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => { onKeluarkan(checked.map((r) => r.santri_id)); clear(); }}
        >
          <X data-icon="inline-start" size={14} /> Keluarkan ({checked.length})
        </Button>
      )}
    />
  );
}

/** Angka polos untuk sel rekap: dipisah ribuan, tanpa awalan "Rp". */
function angkaRekap(nilai: number): string {
  return nilai.toLocaleString('id');
}

/** Rekap dampak dispensasi per lembaga (tab Rekap Dispensasi halaman
 *  Dispensasi): angka dihitung dari BARIS TAGIHAN, jadi lingkup paket bisa
 *  ditelusuri — pilih satu paket di kotak "Paket" lalu lihat lembaga mana saja
 *  yang memuatnya. Barisnya murni hasil agregat (tanpa aksi), jadi baca-saja:
 *  tanpa centang & aksi. Tingginya mengisi panel tab (`flex`), tanpa batas
 *  baris, karena tabelnya kini selebar area konten. */
export function RekapDispensasiTab({ rows, loading, sort, paket, opsiPaket, onPaket, ringkas }: {
  rows: RekapDispensasi[];
  loading: boolean;
  sort: SortTabel;
  /** Id paket yang disaring; `null` = semua paket (ikut `opsiPaket`). */
  paket: number | null;
  /** Paket yang bisa dipilih (dari daftar dispensasi halaman). */
  opsiPaket: { nilai: number | null; label: string }[];
  onPaket: (nilai: number | null) => void;
  /** Total lintas lembaga dari baris yang TAMPIL (dihitung halaman). */
  ringkas: { tagihan: number; potongan: number };
}) {
  return (
    <ExcelTable<RekapDispensasi>
      tableKey="keuangan_rekap_dispensasi"
      header={(
        <span id="judul_rekap_dispensasi" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
          Rekap Dampak per Lembaga
          <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">
            {angkaRekap(ringkas.tagihan)} tagihan · {ringkas.potongan === 0 ? 'Rp 0' : `Rp ${angkaRekap(ringkas.potongan)}`}
          </span>
        </span>
      )}
      akhirToolbar={(
        <LabeledCombobox label="Paket" htmlFor="sel_rekap_dispensasi_paket" tinggi={26} lebarKombo={190} kelolaLebar={false}>
          <ComboboxRoot
            items={opsiPaket}
            itemToStringLabel={(o) => o.label}
            isItemEqualToValue={(a, b) => a.nilai === b.nilai}
            value={opsiPaket.find((o) => o.nilai === paket) ?? opsiPaket[0]}
            onValueChange={(o) => { if (o !== null) onPaket(o.nilai); }}
          >
            <ComboboxInput
              id="sel_rekap_dispensasi_paket"
              aria-label="Paket dispensasi rekap"
              placeholder="Semua paket"
              title="Bawaan: mengikuti paket yang dipilih di tabel kiri"
            />
            <ComboboxTrigger aria-label="Buka daftar paket rekap" />
            <ComboboxContent>
              <ComboboxEmpty>Tidak ada paket.</ComboboxEmpty>
              <ComboboxList>
                {(o) => <ComboboxItem key={o.label} value={o}>{o.label}</ComboboxItem>}
              </ComboboxList>
            </ComboboxContent>
          </ComboboxRoot>
        </LabeledCombobox>
      )}
      fields={FIELDS_REKAP_DISPENSASI}
      rows={rows}
      getValues={(r) => ({
        lembaga: r.jenjang,
        tagihan: angkaRekap(r.jumlah_tagihan),
        penerima: angkaRekap(r.jumlah_penerima),
        potongan: `Rp ${angkaRekap(r.total_potongan)}`,
        paket: angkaRekap(r.jumlah_paket),
      })}
      loading={loading}
      emptyText={paket === null
        ? 'Belum ada tagihan yang memuat dispensasi pada lingkup filter ini.'
        : 'Paket ini belum dipakai satu tagihan pun pada lingkup filter ini.'}
      canEdit={false}
      onCommit={async () => {}}
      onSaved={() => {}}
      urutAktif={sort.urut}
      arahUrut={sort.arah}
      onUrut={sort.terapkan}
      renderActions={() => null}
      hideCheckbox
      hideActions
    />
  );
}

/** Tab Tagihan: bilah alat (cari/urut/filter) + crosstab + pager.
 *  Popover aksi sel dititipkan lewat `popover` agar strukturnya sama seperti
 *  sebelumnya (di dalam wadah gulir crosstab) tanpa memindahkan logikanya. */

/** Opsi filter keaktifan santri (label tampil + nilai ke state). */
const OPSI_KEAKTIFAN: { nilai: '' | 'aktif' | 'nonaktif'; label: string }[] = [
  { nilai: '', label: 'Semua status' },
  { nilai: 'aktif', label: 'Aktif' },
  { nilai: 'nonaktif', label: 'Tidak aktif' },
];

export function TagihanTab({
  crosstab, loading, terpilihId, total,
  cari, onCari, sort, terlambat, onTerlambat, keaktifan, onKeaktifan,
  onPilih, aksiSel, onAksiSel, onAksiKosong, onTambah, onBukaGenerate,
  selection, onTogglePilih, onPilihBlok, onKlikSel, onPilihIrisan, onMulaiGeser, onGeserSelesai, onTambahBlok, onLepasBlok, pager, popover,
}: {
  crosstab: CrosstabTagihan | null;
  loading: boolean;
  terpilihId: number | null;
  total: number;
  cari: string;
  onCari: (v: string) => void;  /** Urut baris (kode + arah) dari Preset Urut `keuangan_tagihan_crosstab`. */
  sort: SortTabel;
  terlambat: boolean;
  onTerlambat: (v: boolean) => void;
  /** Keaktifan santri ('' = semua; cermin penanda merah baris). */
  keaktifan: '' | 'aktif' | 'nonaktif';
  onKeaktifan: (v: '' | 'aktif' | 'nonaktif') => void;
  onPilih: (sel: CrosstabSel, meta: MetaSel, anchor: HTMLElement, kolom: CrosstabKolom) => void;
  /** Permintaan aksi per tagihan dari crosstab (klik kanan / Enter) — halaman
   *  menyimpannya, crosstab memetakannya kembali ke elemen sel. */
  aksiSel: { sel: CrosstabSel; meta: MetaSel; kolom: CrosstabKolom; jangkar: DOMRect } | null;
  onAksiSel: (sel: CrosstabSel, meta: MetaSel, kolom: CrosstabKolom, kotak: DOMRect) => void;
  /** Klik kanan sel kosong → halaman membuka panel batch (bila pilihan > 1). */
  onAksiKosong: (sel: SelBlok, kolom: CrosstabKolom, anchor: HTMLElement) => void;
  /** Diteruskan ke sel kosong crosstab (tombol tambah). */
  onTambah?: (baris: CrosstabBaris, kolom: CrosstabKolom, anchor: HTMLElement) => void;
  onBukaGenerate: () => void;
  /** Kunci sel terpilih (klik kiri, termasuk sel kosong) untuk aksi batch. */
  selection: ReadonlySet<string>;
  /** Ctrl/Cmd+Klik pada sel → toggle (tambah bila tak terpilih, lepas bila
   *  terpilih). */
  onTogglePilih: (sel: SelBlok) => void;
  /** Blok pilihan (geser, Shift+Klik, Shift+panah). */
  onPilihBlok: (items: SelBlok[]) => void;
  /** Klik kiri biasa → sorotan/anchor pindah ke satu sel (ganti pilihan). */
  onKlikSel: (sel: SelBlok) => void;
  /** Tahan-geser DIMULAI di sel `idAwal` → halaman menentukan mode gesture
   *  (irisan bila sel awal sudah terpilih, selain itu seleksi baru). */
  onMulaiGeser: (kunciAwal: string) => void;
  /** Gesture geser berakhir (tombol dilepas) → halaman melepas mode irisan. */
  onGeserSelesai?: () => void;
  /** Tahan-geser → blok MENTAH; halaman mengiriskan dengan pilihan lama. */
  onPilihIrisan: (items: SelBlok[]) => void;
  /** Ctrl/Cmd+tahan-geser → blok baru ditambahkan ke pilihan lama. */
  onTambahBlok: (items: SelBlok[]) => void;
  /** Lepas (kurangi) blok tagihan dari pilihan — Alt/Option+tahan-geser. */
  onLepasBlok: (items: SelBlok[]) => void;
  pager: {
    page: number;
    lastPage: number;
    perPage: PerPage;
    onPage: (p: number) => void;
    onPerPage: (pp: PerPage) => void;
  };
  popover?: ReactNode;
}) {
  /* Tak ada bilah pilihan maupun popover aksi batch: seleksi sel hanya untuk
     menyorot/menandai, dan seluruh aksi per tagihan dibuka dari KLIK KANAN
     pada sel (atau Enter saat sel disorot). `onPilih` dibungkus ref agar
     identitasnya stabil — prop langsung akan merusak memo crosstab. */
  const onPilihRef = useRef(onPilih);
  onPilihRef.current = onPilih;
  const pilihSelStabil = useCallback((sel: CrosstabSel, meta: MetaSel, anchor: HTMLElement, kolom: CrosstabKolom) => {
    onPilihRef.current(sel, meta, anchor, kolom);
  }, []);

  return (
    <>
      {/* Pencarian pindah ke topBar (satu slot per halaman; tab nonaktif
          di-unmount Radix sehingga tak bentrok dengan tab Santri Custom).
          State + debounce tetap milik halaman via `cari`/`onCari`. */}
      <TopBarSearch value={cari} onChange={onCari} placeholder="Cari nama / ayah / ibu…" />
      {/* Bilah alat tagihan: urut | filter | aksi. */}
      <div className="border bg-[var(--sidebar)] p-1 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Petunjuk pakai + legenda warna pindah ke hovercard. Keduanya
              hanya dibaca saat belajar memakai crosstab; sebagai baris tersendiri
              keduanya memakan tinggi card tanpa menambah arti. */}
          <HoverCard openDelay={200} closeDelay={80}>
            <HoverCardTrigger asChild>
              <Button
                id="btn_tagihan_petunjuk"
                type="button"
                size="icon"
                variant="outline"
                aria-label="Petunjuk penggunaan dan arti warna sel tagihan"
                className="shrink-0"
              >
                <Info size={14} />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent align="start" className="w-72 space-y-3 p-3 text-xs leading-relaxed">
              <p>
                Klik kiri untuk memilih sel ala Excel (satu sel, tahan-geser untuk blok, Ctrl+Klik untuk menambah/melepas sel satu per satu, Shift+Klik / Shift+panah untuk blok persegi panjang). Aksi batch dibuka dari chip jumlah tagihan di bilah pilihan. Klik kanan membuka aksi per tagihan; klik sel kosong untuk tambah tagihan.
              </p>
              {/* Legenda warna sel. "Sebagian" sempat hilang: sel kuning muncul
                  tanpa keterangan sama sekali, jadi terlihat seperti warna acak.
                  Pucat = belum lewat jatuh tempo, pekat = sudah lewat. */}
              <div className="space-y-1.5 border-t pt-2">
                <p className="font-medium text-foreground">Arti warna sel</p>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <li className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />Lunas</li>
                  <li className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />Sebagian</li>
                  <li className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />Tunggakan</li>
                  <li className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />Belum Aktif</li>
                </ul>
                <p className="text-muted-foreground">
                  Sel pucat belum lewat jatuh tempo, sel pekat sudah lewat.
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
          <div aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
          <PresetUrut
            tableKey="keuangan_tagihan_crosstab"
            urutAktif={sort.urut}
            arahUrut={sort.arah}
            onUrut={sort.terapkan}
            wrapperClassName="flex-row items-center gap-1.5"
          />
          {/* Status tepat di sebelah Urutkan (satu grup filter baris). */}
          <LabeledCombobox label="Status" htmlFor="sel_tagihan_keaktifan" tinggi={26} lebarKombo={120} kelolaLebar={false}>
            <ComboboxRoot
              items={OPSI_KEAKTIFAN}
              itemToStringLabel={(o) => o.label}
              isItemEqualToValue={(a, b) => a.nilai === b.nilai}
              value={OPSI_KEAKTIFAN.find((o) => o.nilai === keaktifan) ?? OPSI_KEAKTIFAN[0]}
              onValueChange={(o) => { if (o !== null) onKeaktifan(o.nilai); }}
            >
              <ComboboxInput id="sel_tagihan_keaktifan" aria-label="Status keaktifan" placeholder="Semua status" />
              <ComboboxTrigger aria-label="Buka daftar status keaktifan" />
              <ComboboxContent>
                <ComboboxEmpty>Tidak ada status.</ComboboxEmpty>
                <ComboboxList>
                  {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                </ComboboxList>
              </ComboboxContent>
            </ComboboxRoot>
          </LabeledCombobox>
          <div className="flex-1" />
          <Button
            id="btn_tagihan_terlambat"
            size="sm"
            variant={terlambat ? 'default' : 'outline'}
            aria-pressed={terlambat}
            className="gap-1.5 px-2.5 text-xs"
            title="Tampilkan hanya tagihan aktif (sudah jatuh tempo)"
            onClick={() => onTerlambat(!terlambat)}
          >
            <TriangleAlert size={14} />
            Tagihan Aktif
          </Button>
          <Button id="btn_gen_buka" size="sm" className="gap-1.5 px-3 text-xs font-medium" onClick={onBukaGenerate}><Plus size={14} /> Tagihan</Button>
        </div>
      </div>

      {/* Rail filter tingkat & kelas di kiri crosstab — pola yang sama seperti
          tabel Santri (lihat `ExcelTable` berprop `rail`). Bilah alat tetap
          penuh lebar di atas, rail hanya membagi ruang tabel. */}

      <div className="flex min-h-0 flex-1">
        <FilterRail />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <TagihanCrosstab
              data={crosstab}
              loading={loading}
              terpilihId={terpilihId}
              emptyText="Belum ada tagihan."
              onPilih={pilihSelStabil}
              aksi={aksiSel}
              onTambah={onTambah}
              selection={selection}
              onTogglePilih={onTogglePilih}
              onPilihBlok={onPilihBlok}
              onKlikSel={onKlikSel}
              onPilihIrisan={onPilihIrisan}
              onMulaiGeser={onMulaiGeser}
              onGeserSelesai={onGeserSelesai}
              onTambahBlok={onTambahBlok}
              onLepasBlok={onLepasBlok}
              onAksiKanan={onAksiSel}
              onAksiKosong={onAksiKosong}
            />
            {popover}
          </div>
          <Pager
            page={pager.page}
            lastPage={pager.lastPage}
            total={total}
            perPage={pager.perPage}
            onPage={pager.onPage}
            onPerPage={pager.onPerPage}
          />
        </div>
      </div>
    </>
  );
}
