import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import TagihanCrosstab from '@/components/keuangan/TagihanCrosstab';
import { DeleteAction, EditAction } from '@/components/RowActions';
import { ArrowDownAZ, ArrowUpAZ, Info, Plus, RotateCcw, Search, TriangleAlert, X } from '@/icons';
import type { PetaArahKolom } from '@/lib/urut';
import { tanggal } from '@/lib/tanggal';
import type { PerPage } from '@/prefs';
import type {
  CrosstabKolom, CrosstabSel, CrosstabTagihan, Dispensasi, JenisTagihan, Tarif, TunggakanRow,
} from '@/api/keuangan';

/* Isi tiap tab halaman Keuangan.
 *
 * Semua state tetap dipegang halaman (bukan di dalam komponen tab) supaya
 * pencarian/urutan/pilihan tidak hilang saat berpindah tab — Radix melepas
 * isi tab yang tidak aktif. Komponen di sini murni menerima data + handler. */

export const FIELDS_JENIS: ExcelField[] = [
  { key: 'nama', label: 'Jenis Tagihan', kind: 'static' },
  { key: 'tipe', label: 'Tipe', kind: 'static', width: 90 },
  { key: 'lembaga', label: 'Lembaga', kind: 'static', width: 130 },
  { key: 'aktif', label: 'Status', kind: 'static', width: 80 },
];

export const FIELDS_TARIF: ExcelField[] = [
  { key: 'jenjang', label: 'Lembaga', kind: 'static', width: 90 },
  { key: 'tahun_ajaran', label: 'Tahun Ajaran', kind: 'static', width: 110 },
  { key: 'jenis', label: 'Jenis', kind: 'static' },
  { key: 'nominal', label: 'Nominal', kind: 'static', width: 110 },
  { key: 'aktif', label: 'Aktif', kind: 'static', width: 70 },
];

export const FIELDS_TUNGGAKAN: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'jumlah_tagihan', label: 'Jml Tagihan', kind: 'static', width: 100 },
  { key: 'total_tagihan', label: 'Total', kind: 'static', width: 110 },
  { key: 'terbayar', label: 'Terbayar', kind: 'static', width: 110 },
  { key: 'tunggakan', label: 'Tunggakan', kind: 'static', width: 110 },
  { key: 'terlambat_terlama', label: 'Lewat Sejak', kind: 'static', width: 120 },
];

export const FIELDS_DISPENSASI: ExcelField[] = [
  { key: 'nama', label: 'Dispensasi', kind: 'static' },
  { key: 'aturan', label: 'Aturan per Jenis', kind: 'static' },
  { key: 'santri', label: 'Santri', kind: 'static', width: 90 },
  { key: 'tahun_ajaran', label: 'TA', kind: 'static', width: 100 },
  { key: 'status', label: 'Status', kind: 'static', width: 80 },
];

/** State urut header satu tabel (dimiliki halaman, diteruskan ke tab). */
export interface SortTabel {
  urut: string[];
  arah: 'naik' | 'turun';
  terapkan: (nilai: string[], arah: 'naik' | 'turun', peta?: PetaArahKolom) => void;
}

/** Tab Jenis Tagihan: tabel + tombol tambah/ubah. */
export function JenisTab({ rows, loading, sort, efektifSuper, onTambah, onEdit }: {
  rows: JenisTagihan[];
  loading: boolean;
  sort: SortTabel;
  efektifSuper: boolean;
  onTambah: () => void;
  onEdit: (j: JenisTagihan) => void;
}) {
  return (
    <ExcelTable<JenisTagihan & { id: number }>
      tableKey="keuangan_jenis"
      fields={FIELDS_JENIS}
      rows={rows.map((j) => ({ ...j, id: j.id }))}
      urutAktif={sort.urut}
      arahUrut={sort.arah}
      onUrut={sort.terapkan}
      getValues={(r) => ({ nama: r.nama, tipe: r.tipe === 'bulanan' ? 'Bulanan' : 'Non-bulanan', lembaga: r.jenjang ?? 'Semua', aktif: r.is_active ? 'Aktif' : 'Nonaktif' })}
      loading={loading}
      emptyText="Belum ada jenis tagihan."
      canEdit={false}
      onCommit={async () => {}}
      onSaved={() => {}}
      renderActions={(j) => (
        (j.jenjang !== null || efektifSuper)
          ? <EditAction id={`btn_jenis_ubah_${j.id}`} onClick={() => onEdit(j)} />
          : null
      )}
      hideCheckbox
      addButtonLangsung
      addButton={<Button id="btn_jenis_tambah_buka" size="icon" variant="outline" aria-label="Tambah jenis tagihan" title="Tambah jenis tagihan" onClick={onTambah}><Plus size={16} /></Button>}
    />
  );
}

/** Tab Tarif: tabel + tombol tambah/ubah/hapus. */
export function TarifTab({ rows, loading, sort, onTambah, onEdit, onHapus }: {
  rows: Tarif[];
  loading: boolean;
  sort: SortTabel;
  onTambah: () => void;
  onEdit: (t: Tarif) => void;
  onHapus: (t: Tarif) => void;
}) {
  return (
    <ExcelTable<Tarif & { id: number }>
      tableKey="keuangan_tarif"
      fields={FIELDS_TARIF}
      rows={rows.map((t) => ({ ...t, id: t.id }))}
      urutAktif={sort.urut}
      arahUrut={sort.arah}
      onUrut={sort.terapkan}
      getValues={(r) => ({
        jenjang: r.jenjang, tahun_ajaran: r.tahun_ajaran,
        jenis: r.jenis?.nama ?? null, nominal: r.nominal.toLocaleString('id'),
        aktif: r.is_active ? 'Ya' : 'Tidak',
      })}
      loading={loading}
      emptyText="Belum ada tarif."
      canEdit={false}
      onCommit={async () => {}}
      onSaved={() => {}}
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

/** Tab Tunggakan: tabel baca-saja (urut dari header). */
export function TunggakanTab({ rows, loading, sort }: {
  rows: TunggakanRow[];
  loading: boolean;
  sort: SortTabel;
}) {
  return (
    <ExcelTable<TunggakanRow & { id: number }>
      tableKey="keuangan_tunggakan"
      fields={FIELDS_TUNGGAKAN}
      rows={rows.map((w) => ({ ...w, id: w.santri_id }))}
      urutAktif={sort.urut}
      arahUrut={sort.arah}
      onUrut={sort.terapkan}
      getValues={(r) => ({
        nama: r.nama, jumlah_tagihan: String(r.jumlah_tagihan),
        total_tagihan: r.total_tagihan.toLocaleString('id'),
        terbayar: r.terbayar.toLocaleString('id'),
        tunggakan: r.tunggakan.toLocaleString('id'),
        terlambat_terlama: r.tanpa_jatuh_tempo ? 'Tanpa batas' : tanggal(r.terlambat_terlama),
      })}
      loading={loading}
      emptyText="Tidak ada tagihan yang lewat jatuh tempo."
      canEdit={false}
      onCommit={async () => {}}
      onSaved={() => {}}
      renderActions={() => null}
      hideCheckbox
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

/** Tab Tagihan: bilah alat (cari/urut/filter) + crosstab + pager.
 *  Popover aksi sel dititipkan lewat `popover` agar strukturnya sama seperti
 *  sebelumnya (di dalam wadah gulir crosstab) tanpa memindahkan logikanya. */
export function TagihanTab({
  crosstab, loading, terpilihId, total,
  cari, onCari, urut, onUrut, arah, onArah, terlambat, onTerlambat,
  onPilih, onReset, onBukaGenerate, pager, popover,
}: {
  crosstab: CrosstabTagihan | null;
  loading: boolean;
  terpilihId: number | null;
  total: number;
  cari: string;
  onCari: (v: string) => void;
  urut: string;
  onUrut: (v: string) => void;
  arah: 'naik' | 'turun';
  onArah: (v: 'naik' | 'turun') => void;
  terlambat: boolean;
  onTerlambat: (v: boolean) => void;
  onPilih: (
    sel: CrosstabSel,
    meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => void;
  onReset: () => void;
  onBukaGenerate: () => void;
  pager: {
    page: number;
    lastPage: number;
    perPage: PerPage;
    onPage: (p: number) => void;
    onPerPage: (pp: PerPage) => void;
  };
  popover?: ReactNode;
}) {
  return (
    <>
      {/* Bilah alat tagihan: cari | urut | filter | aksi. */}
      <div className="rounded-xl border bg-card p-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="inp_tagihan_cari"
              placeholder="Cari nama / NIS / NISN…"
              className="w-64 pl-8 pr-8"
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
          <div className="flex items-center gap-1.5">
            <Select
              value={urut === '' ? 'nama' : urut}
              onValueChange={(v) => onUrut(v === 'nama' ? '' : v)}
            >
              <SelectTrigger
                id="sel_tagihan_urut"
                size="sm"
                aria-label="Urutkan baris"
                title="Urutkan baris"
                className="w-[168px]"
              >
                <SelectValue placeholder="Urutkan: nama" />
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="contain-layout will-change-transform">
                <SelectItem value="nama">Urutkan: nama</SelectItem>
                <SelectItem value="total">Total tagihan</SelectItem>
                <SelectItem value="bayar">Terbayar</SelectItem>
                <SelectItem value="sisa">Tunggakan</SelectItem>
              </SelectContent>
            </Select>
            <Button
              id="btn_tagihan_arah"
              size="icon"
              variant="outline"
              aria-label={arah === 'naik' ? 'Arah urutan: naik' : 'Arah urutan: turun'}
              title={arah === 'naik' ? 'Arah: naik (klik untuk turun)' : 'Arah: turun (klik untuk naik)'}
              onClick={() => onArah(arah === 'naik' ? 'turun' : 'naik')}
            >
              {arah === 'naik' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
            </Button>
          </div>
          <div className="flex-1" />
          {(cari !== '' || urut !== '' || arah !== 'naik' || terlambat) && (
            <Button
              id="btn_tagihan_reset"
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              title="Kembalikan pencarian, urutan, dan filter ke awal"
              onClick={onReset}
            >
              <RotateCcw size={14} />
              Atur ulang
            </Button>
          )}
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
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-dashed pt-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Info size={13} className="shrink-0" />
            Klik sel nominal untuk bayar, ubah, atau lihat riwayat.
          </span>
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Arti warna sel">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Lunas</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" />Tunggakan</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" />Belum Aktif</span>
          </span>
          <span className="ml-auto tabular-nums">
            {total > 0 ? total + ' santri' : 'Belum ada data'}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <TagihanCrosstab
          data={crosstab}
          loading={loading}
          terpilihId={terpilihId}
          emptyText="Belum ada tagihan."
          onPilih={onPilih}
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
    </>
  );
}
