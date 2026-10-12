import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable, { type ExcelChoice, type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import FilterRail from '@/components/FilterRail';
import TagihanCrosstab from '@/components/keuangan/TagihanCrosstab';
import PresetUrut from '@/components/PresetUrut';
import { DeleteAction, EditAction } from '@/components/RowActions';
import { ChevronDown, Info, Pencil, Plus, Search, Trash2, TriangleAlert, Wallet, X } from '@/icons';
import type { PetaArahKolom } from '@/lib/urut';
import type { PilihanLembaga } from '@/lembagaAktif';
import type { PerPage } from '@/prefs';
import type {
  CrosstabBaris, CrosstabKolom, CrosstabSel, CrosstabTagihan, Dispensasi, JenisTagihan, Tarif,
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
  { key: 'tahun_ajaran', label: 'TA', kind: 'static', width: 100 },
  { key: 'status', label: 'Status', kind: 'static', width: 80 },
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
    aktif: j.is_active ? 'ya' : 'tidak',
  };
}

/** Payload `ubahJenis` dari sel yang berubah. Lingkup (jenjang) sengaja tidak
 *  ikut — pindah lembaga hanya lewat dialog Ubah; field yang tidak berubah
 *  memakai nilai baris sebab endpoint menuntut `nama` juga. */
export function payloadUbahJenis(baris: JenisTagihan, f: Record<string, string | null>): {
  nama: string; tipe: 'bulanan' | 'non_bulanan'; is_active: boolean; keterangan: string | null;
} {
  const nama = f.nama !== undefined ? (f.nama ?? '').trim() : baris.nama;
  const keterangan = f.keterangan !== undefined ? (f.keterangan ?? '').trim() : (baris.keterangan ?? '');
  return {
    // Validator sudah menolak nama kosong; ini jaring pengaman terakhir.
    nama: nama === '' ? baris.nama : nama,
    tipe: f.tipe !== undefined ? (f.tipe === 'bulanan' ? 'bulanan' : 'non_bulanan') : baris.tipe,
    is_active: f.aktif !== undefined ? f.aktif === 'ya' : baris.is_active,
    keterangan: keterangan === '' ? null : keterangan,
  };
}

/** Payload `buatJenis` dari baris input: nama & tipe wajib, lingkup lembaga
 *  wajib dipilih (`JENIS_GLOBAL` = jenis global, hanya untuk super_admin). */
export function payloadBuatJenis(f: Record<string, string | null>): {
  nama: string; tipe: 'bulanan' | 'non_bulanan'; jenjang: string | null; keterangan: string | null;
} {
  const nama = (f.nama ?? '').trim();
  if (nama === '') throw new Error('Nama jenis wajib diisi.');
  const tipe = f.tipe === 'bulanan' ? 'bulanan' as const
    : f.tipe === 'non_bulanan' ? 'non_bulanan' as const : null;
  if (tipe === null) throw new Error('Pilih tipe tagihan dulu.');
  const lembaga = (f.lembaga ?? '').trim();
  if (lembaga === '') throw new Error('Pilih lembaga dulu.');
  const keterangan = (f.keterangan ?? '').trim();
  return { nama, tipe, jenjang: lembaga === JENIS_GLOBAL ? null : lembaga, keterangan: keterangan === '' ? null : keterangan };
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

/** Tab Dispensasi: tabel + tombol tambah/ubah/hapus. */
export function DispensasiTab({ rows, loading, sort, onTambah, onEdit, onHapus }: {
  rows: Dispensasi[];
  loading: boolean;
  sort: SortTabel;
  onTambah: () => void;
  onEdit: (d: Dispensasi) => void;
  onHapus: (d: Dispensasi) => void;
}) {
  return (
    <ExcelTable<Dispensasi & { id: number }>
      tableKey="keuangan_dispensasi"
      fields={FIELDS_DISPENSASI}
      rows={rows}
      urutAktif={sort.urut}
      arahUrut={sort.arah}
      onUrut={sort.terapkan}
      getValues={(r) => ({
        nama: r.nama,
        aturan: (r.aturan ?? []).map((a) => `${a.jenis?.nama ?? 'Semua jenis'}: ${a.tipe === 'persen' ? `${a.nilai}%` : a.tipe === 'bebas' ? 'bebas' : `Rp ${a.nilai.toLocaleString('id')}`}`).join(' · '),
        santri: `${(r.santri_ids ?? []).length} santri`,
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

/** Tab Daftar Penerima Dispensasi: tabel santri penerima + combobox paket
 *  dispensasi sebagai filter. Filter dipegang halaman (state hilang saat tab
 *  tidak aktif dilepas Radix). */
export function PenerimaDispensasiTab({ rows, loading, daftar, pilihan, onPilih }: {
  rows: BarisPenerima[];
  loading: boolean;
  /** Opsi combobox: seluruh paket dispensasi. */
  daftar: Dispensasi[];
  /** Id paket terpilih; `'semua'` = tanpa filter. */
  pilihan: number | 'semua';
  onPilih: (v: number | 'semua') => void;
}) {
  return (
    <ExcelTable<BarisPenerima>
      tableKey="keuangan_penerima_dispensasi"
      fields={FIELDS_PENERIMA}
      rows={rows}
      getValues={(r) => ({
        nama: r.nama,
        nis: r.nis,
        lembaga: r.lembaga,
        dispensasi: r.dispensasi,
        tahun_ajaran: r.tahun_ajaran,
      })}
      loading={loading}
      emptyText="Belum ada penerima dispensasi."
      canEdit={false}
      onCommit={async () => {}}
      onSaved={() => {}}
      renderActions={() => null}
      hideCheckbox
      filter={(
        <Select
          value={pilihan === 'semua' ? 'semua' : String(pilihan)}
          onValueChange={(v) => onPilih(v === 'semua' ? 'semua' : Number(v))}
        >
          <SelectTrigger
            id="sel_penerima_dispensasi"
            size="sm"
            aria-label="Filter daftar dispensasi"
            title="Filter daftar dispensasi"
            className="w-[220px]"
          >
            <SelectValue placeholder="Daftar Dispensasi" />
          </SelectTrigger>
          <SelectContent position="popper" align="start" className="contain-layout will-change-transform">
            <SelectItem value="semua">Daftar Dispensasi: semua</SelectItem>
            {daftar.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>{`${d.nama} · ${d.tahun_ajaran}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

/** Tab Tagihan: bilah alat (cari/urut/filter) + crosstab + pager.
 *  Popover aksi sel dititipkan lewat `popover` agar strukturnya sama seperti
 *  sebelumnya (di dalam wadah gulir crosstab) tanpa memindahkan logikanya. */

/** Metadata sel crosstab yang dikirim ke `onPilih` (isi popover aksi sel). */
type MetaSel = {
  nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null; santri_id: number;
  foto_dokumen_id: number | null; foto_profil: boolean; kelas: string | null; jenjang_riwayat: string[];
};
export function TagihanTab({
  crosstab, loading, terpilihId, total,
  cari, onCari, sort, terlambat, onTerlambat,
  onPilih, onTambah, onBukaGenerate,
  selection, onTogglePilih, onPilihBlok, onPilihSatu, onBatalPilih, onLepasBlok, onAksiBatch, batchBusy, pager, popover,
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
  onPilih: (
    sel: CrosstabSel,
    meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null; santri_id: number; foto_dokumen_id: number | null; foto_profil: boolean; kelas: string | null; jenjang_riwayat: string[] },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => void;
  /** Diteruskan ke sel kosong crosstab (tombol tambah). */
  onTambah?: (baris: CrosstabBaris, kolom: CrosstabKolom, anchor: HTMLElement) => void;
  onBukaGenerate: () => void;
  /** Id tagihan terpilih (klik kiri) untuk aksi batch. */
  selection: ReadonlySet<number>;
  /** Ctrl/Cmd+Klik pada sel → toggle (tambah bila tak terpilih, lepas bila
   *  terpilih). */
  onTogglePilih: (sel: CrosstabSel, jenisId: number) => void;
  /** Blok pilihan (Ctrl/Klik, geser, Shift+Klik, Shift+panah). */
  onPilihBlok: (items: { sel: CrosstabSel; jenisId: number }[]) => void;
  /** Klik kiri biasa → pilih SATU sel itu saja (ganti seluruh pilihan). */
  onPilihSatu: (sel: CrosstabSel, jenisId: number) => void;
  /** Kosongkan seluruh pilihan. */
  onBatalPilih: () => void;
  /** Lepas (kurangi) blok tagihan dari pilihan — Ctrl/Cmd+tahan-geser. */
  onLepasBlok: (items: { sel: CrosstabSel; jenisId: number }[]) => void;
  /** Buka dialog konfirmasi aksi batch untuk pilihan saat ini. */
  onAksiBatch: (aksi: 'bayar' | 'hapus_tagihan' | 'hapus_riwayat' | 'ubah') => void;
  /** Salah satu aksi batch sedang berjalan (tombol dinonaktifkan). */
  batchBusy?: boolean;
  pager: {
    page: number;
    lastPage: number;
    perPage: PerPage;
    onPage: (p: number) => void;
    onPerPage: (pp: PerPage) => void;
  };
  popover?: ReactNode;
}) {
  /* Popover aksi batch: muncul otomatis saat gesture seleksi selesai
     (pointer dilepas / blok keyboard), memakai sel pelepasan sebagai
     jangkar. Ditutup saat pilihan kosong; chip "N tagihan dipilih" di
     bilah pilihan jadi pemicu untuk membukanya lagi.

     Saat geser, `selection` berubah tiap sel yang dilewati sehingga effect
     bisa jalan SEBELUM pointer dilepas (jangkar belum ada). `rilisTick`
     memastikan pelepasan itu sendiri ikut memicu effect — menulis ref saja
     tidak memicu render ulang. */
  const [popAksiEl, setPopAksiEl] = useState<HTMLElement | null>(null);
  const [popAksiBuka, setPopAksiBuka] = useState(false);
  const [rilisTick, setRilisTick] = useState(0);
  const jangkarAksiRef = useRef<HTMLElement | null>(null);
  const seleksiDirilis = useCallback((el: HTMLElement) => {
    jangkarAksiRef.current = el;
    setRilisTick((n) => n + 1);
  }, []);
  /* Klik kanan → hanya popover aksi per tagihan. Jangkar popover batch dibuang
     supaya effect seleksi (pilih satu sel hasil klik kanan) tidak membukanya;
     tanpa ini dua popover bisa tampil bersamaan. `onPilih` dibungkus ref agar
     identitasnya stabil — prop langsung akan merusak memo crosstab. */
  const onPilihRef = useRef(onPilih);
  onPilihRef.current = onPilih;
  const pilihSelStabil = useCallback((sel: CrosstabSel, meta: MetaSel, anchor: HTMLElement, kolom: CrosstabKolom) => {
    jangkarAksiRef.current = null;
    setPopAksiBuka(false);
    onPilihRef.current(sel, meta, anchor, kolom);
  }, []);
  useEffect(() => {
    if (selection.size > 0 && jangkarAksiRef.current !== null) {
      setPopAksiEl(jangkarAksiRef.current);
      setPopAksiBuka(true);
    } else {
      setPopAksiBuka(false);
    }
  }, [selection, rilisTick]);

  return (
    <>
      {/* Bilah alat tagihan: cari | urut | filter | aksi. */}
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
                Pilih banyak tagihan ala Excel: klik untuk pilih satu sel, tahan lalu geser untuk blok, Shift+Klik / Shift+panah untuk blok persegi panjang, dan Ctrl+Klik untuk menambah atau melepas sel satu per satu. Aksi batch muncul otomatis setelah seleksi selesai. Klik kanan hanya memilih sel itu dan membuka aksi per tagihan; klik sel kosong untuk tambah tagihan.
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
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="inp_tagihan_cari"
              placeholder="Cari nama / ayah / ibu…"
              className="w-48 pl-8 pr-8"
              value={cari}
              onChange={(e) => onCari(e.target.value)}
            />
            {cari !== '' && (
              <button
                type="button"
                id="btn_tagihan_cari_bersih"
                aria-label="Bersihkan pencarian"
                title="Bersihkan pencarian"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => onCari('')}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
          <PresetUrut
            tableKey="keuangan_tagihan_crosstab"
            urutAktif={sort.urut}
            arahUrut={sort.arah}
            onUrut={sort.terapkan}
            wrapperClassName="flex-row items-center gap-1.5"
          />
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
      {/* Bilah pilihan: muncul bila ada tagihan terpilih. Tombol aksi batch
          kini di dalam popover yang otomatis terbuka saat gesture seleksi
          dilepas; chip jumlah dipakai untuk membukanya lagi. */}
      {selection.size > 0 && (
        <div className="flex items-center gap-2 border-b bg-primary/5 px-2 py-1 text-xs">
          <Popover open={popAksiBuka} onOpenChange={setPopAksiBuka}>
            {popAksiEl !== null && (
              <PopoverAnchor
                virtualRef={{ current: { getBoundingClientRect: () => popAksiEl.getBoundingClientRect() } }}
              />
            )}
            <PopoverTrigger asChild>
              <Button
                id="btn_batch_pilih_aksi"
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-xs font-medium"
                title="Tampilkan aksi untuk tagihan terpilih"
              >
                {selection.size} tagihan dipilih
                <ChevronDown size={13} className="text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              id="popover_aksi_batch"
              align="start"
              side="bottom"
              sideOffset={6}
              collisionPadding={12}
              className="w-48 p-1.5"
              /* Fokus dibiarkan di sel crosstab supaya Shift+panah bisa
                 langsung melanjutkan seleksi tanpa klik ulang. */
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="flex flex-col">
                <Button
                  id="btn_batch_bayar"
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start gap-2 px-2 text-xs"
                  disabled={batchBusy}
                  onClick={() => { setPopAksiBuka(false); onAksiBatch('bayar'); }}
                >
                  <Wallet size={14} />
                  Bayar
                </Button>
                <Button
                  id="btn_batch_ubah"
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start gap-2 px-2 text-xs"
                  disabled={batchBusy}
                  onClick={() => { setPopAksiBuka(false); onAksiBatch('ubah'); }}
                >
                  <Pencil size={14} />
                  Ubah
                </Button>
                <Button
                  id="btn_batch_hapus_tagihan"
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start gap-2 px-2 text-xs text-destructive hover:text-destructive"
                  disabled={batchBusy}
                  onClick={() => { setPopAksiBuka(false); onAksiBatch('hapus_tagihan'); }}
                >
                  <Trash2 size={14} />
                  Hapus Tagihan
                </Button>
                <Button
                  id="btn_batch_hapus_riwayat"
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start gap-2 px-2 text-xs text-destructive hover:text-destructive"
                  disabled={batchBusy}
                  onClick={() => { setPopAksiBuka(false); onAksiBatch('hapus_riwayat'); }}
                >
                  <Trash2 size={14} />
                  Hapus Riwayat
                </Button>
                <div className="my-1 h-px bg-border" />
                <Button
                  id="btn_batch_batal"
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 justify-start gap-2 px-2 text-xs"
                  onClick={() => { setPopAksiBuka(false); onBatalPilih(); }}
                >
                  <X size={14} />
                  Batal Pilih
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex-1" />
          <span className="pr-1 text-muted-foreground">klik kanan sel untuk aksi per tagihan</span>
        </div>
      )}

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
              onTambah={onTambah}
              selection={selection}
              onTogglePilih={onTogglePilih}
              onPilihBlok={onPilihBlok}
              onPilihSatu={onPilihSatu}
              onLepasBlok={onLepasBlok}
              onSeleksiRilis={seleksiDirilis}
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
