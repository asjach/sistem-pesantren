import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import BilahToolbarV2 from './BilahToolbarV2';
import GridV2 from './GridV2';
import TableFooterV2 from './TableFooterV2';
import { susunKolom } from './kolom';
import { useToolbarPresetState } from '@/components/excel/useToolbarPreset';
import type { ExcelField, GridRow } from '@/components/excel/types';

export interface ExcelTabelV2Props<T extends { id: string | number }> {
  judul: string;
  tableKey: string;
  fields: ExcelField[];
  rows: T[];
  /** Petakan baris domain ke nilai field grid. */
  getValues: (row: T) => Record<string, string | null>;
  loading?: boolean;
  emptyText?: string;
  /** Isi kolom Aksi per baris (sudah digerbang izin oleh halaman). */
  renderActions?: (row: T) => ReactNode;
  /** Tombol aksi halaman di area aksi toolbar. */
  aksi?: ReactNode;
  /** Isi subzona kiri area filter. */
  filter?: ReactNode;
  /** Kontrol paginasi di kanan footer. */
  pager?: ReactNode;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  onUrut?: (nilai: string[], arah: 'naik' | 'turun', arahKolom?: Record<string, 'naik' | 'turun'>) => void;
  /** Dipanggil saat preset kolom dipilih. V2 menerapkan sendiri kolom yang
   *  tampil; halaman boleh memakai presetId untuk mencatat preset aktif. */
  onApplyPreset: (keys: string[] | null, presetId?: number | null) => void;
  /** Kabarkan baris tercentang setiap pilihan berubah (urut tabel). */
  onCheckedChange?: (rows: T[]) => void;
  /** Baris dipilih lewat sel aktif (klik/panah), bukan centang. Dipakai tabel
   *  pemilih yang panel sebelahnya mengikuti baris. */
  onBarisKlik?: (row: T) => void;
  /** Id baris yang disorot; hanya berarti bersama onBarisKlik. */
  barisAktifId?: T['id'] | null;
  /** Tabel ringkas baca-saja: sembunyikan kolom centang. */
  hideCheckbox?: boolean;
  /** Tabel ringkas baca-saja: sembunyikan kolom Aksi. */
  hideActions?: boolean;
  /** Tabel ringkas baca-saja: sembunyikan pemilih preset kolom. */
  hidePreset?: boolean;
}

/**
 * ExcelTabelV2 — tabel gaya baru.
 *
 *  Tiga zona: toolbar, badan (grid), footer. Komponen ini berdiri sendiri dan
 *  tidak memakai ExcelTable lama; integrasi ke halaman lain menyusul setelah
 *  tampilannya disetujui. Tahap ini baca-saja.
 */
export default function ExcelTabelV2<T extends { id: string | number }>({
  judul,
  tableKey,
  fields,
  rows,
  getValues,
  loading = false,
  emptyText = 'Belum ada data.',
  renderActions,
  aksi,
  filter,
  pager,
  urutAktif,
  arahUrut,
  onUrut,
  onApplyPreset,
  onCheckedChange,
  onBarisKlik,
  barisAktifId,
  hideCheckbox = false,
  hideActions = false,
  hidePreset = false,
}: ExcelTabelV2Props<T>) {
  const [dipilih, setDipilih] = useState<Set<string | number>>(() => new Set());
  /** Susunan kolom dari preset. null = semua kolom, urutan asli halaman. */
  const [kolomPreset, setKolomPreset] = useState<string[] | null>(null);

  /** Setelan tabel milik pengguna: judul, label kolom, dan perataan. */
  const { judulDb, labelDb, alignDb } = useToolbarPresetState(tableKey);
  const judulTampil = judulDb?.trim() || judul;

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const dipilihRef = useRef(dipilih);
  dipilihRef.current = dipilih;
  const onCheckedChangeRef = useRef(onCheckedChange);
  onCheckedChangeRef.current = onCheckedChange;
  const onBarisKlikRef = useRef(onBarisKlik);
  onBarisKlikRef.current = onBarisKlik;

  const nilai = useMemo<GridRow[]>(
    () => rows.map((r) => ({ id: r.id, checked: false, ...getValues(r) })),
    [rows, getValues],
  );

  /** Semua jalur ubah pilihan lewat sini supaya halaman selalu menerima satu
   *  kabar dengan baris domain (bukan id grid). */
  const terapkanPilih = useCallback((baru: Set<string | number>) => {
    setDipilih(baru);
    const domain = rowsRef.current.filter((r) => baru.has(r.id));
    onCheckedChangeRef.current?.(domain);
  }, []);

  const togglePilih = useCallback((id: string | number) => {
    const baru = new Set(dipilihRef.current);
    if (baru.has(id)) baru.delete(id);
    else baru.add(id);
    terapkanPilih(baru);
  }, [terapkanPilih]);

  const togglePilihSemua = useCallback((centang: boolean) => {
    terapkanPilih(centang ? new Set(rowsRef.current.map((r) => r.id)) : new Set());
  }, [terapkanPilih]);

  /** Id baris dari grid dipetakan kembali ke baris domain halaman. */
  const tanganiBarisAktif = useCallback((id: string | number) => {
    const sumber = rowsRef.current.find((r) => r.id === id);
    if (sumber) onBarisKlikRef.current?.(sumber);
  }, []);

  const terapkanPreset = useCallback((keys: string[] | null, presetId?: number | null) => {
    setKolomPreset(keys && keys.length > 0 ? keys : null);
    onApplyPreset(keys, presetId);
  }, [onApplyPreset]);

  const fieldsTampil = useMemo(() => susunKolom(fields, kolomPreset), [fields, kolomPreset]);

  return (
    <div
      data-slot="excel-table"
      data-varian="v2"
      className="relative flex min-h-0 flex-1 flex-col border border-border bg-card"
    >
      <BilahToolbarV2
        judul={judulTampil}
        tableKey={tableKey}
        fields={fields}
        aksi={aksi}
        filter={filter}
        hidePreset={hidePreset}
        urutAktif={urutAktif}
        arahUrut={arahUrut}
        onUrut={onUrut}
        onApplyPreset={terapkanPreset}
      />

      <GridV2
        tableKey={tableKey}
        fields={fieldsTampil}
        rows={nilai}
        loading={loading}
        emptyText={emptyText}
        renderActions={hideActions ? undefined : renderActions ? (id) => {
          const sumber = rows.find((r) => r.id === id);
          return sumber ? renderActions(sumber) : null;
        } : undefined}
        hideCheckbox={hideCheckbox}
        labelDb={labelDb}
        alignDb={alignDb}
        dipilih={dipilih}
        onTogglePilih={togglePilih}
        onTogglePilihSemua={togglePilihSemua}
        barisAktifId={barisAktifId ?? null}
        onBarisAktif={onBarisKlik ? tanganiBarisAktif : undefined}
      />

      <TableFooterV2 jumlah={rows.length} dipilih={dipilih.size} pager={pager} />
    </div>
  );
}
