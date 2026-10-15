import { useMemo, type ReactNode } from 'react';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { cn } from '@/lib/utils';

export interface RingkasKolom {
  /** Kunci kolom (unik dalam tabel ini). */
  key: string;
  label: string;
  /** Lebar kolom awal (px); bila kosong memakai hasil pengukuran isi. */
  width?: number;
  align?: 'left' | 'center' | 'right';
}

interface TabelRingkasProps {
  /** Kunci unik tabel (persist lebar/tinggi/tampilan + sumber perintah ribbon). */
  tableKey: string;
  judul: string;
  kolom: RingkasKolom[];
  /** Isi baris: urut sesuai `kolom`. */
  baris: (string | number | null)[][];
  /** Batas tinggi N baris; kosong = tabel mengisi penuh tinggi wadah (flex-1). */
  maxRows?: number;
  emptyText?: string;
  /** Konten tambahan di sisi kanan judul (mis. jumlah data). */
  aksi?: ReactNode;
  /** Kelas tambahan untuk <section> (mis. penempatan grid / tinggi penuh). */
  className?: string;
}

/** Tabel ringkas baca-saja (rekap/laporan) memakai grid standar ExcelTable
 *  tanpa kolom centang & Aksi, agar seluruh kontrol ribbon "Tabel" berlaku
 *  (ukuran huruf sel, tinggi baris, header, beku kolom, AutoFit, salin TSV).
 *
 *  Judul tabel dan konten `aksi` diserahkan ke bilah judul ExcelTable — bukan
 *  digambar `<header>` sendiri — supaya gerigi "Pengaturan tabel ini" punya
 *  tempat di ujung kanan dan Kelola Tabel tetap terjangkau. */
export default function TabelRingkas({
  tableKey,
  judul,
  kolom,
  baris,
  maxRows,
  emptyText = 'Belum ada data.',
  aksi,
  className,
}: TabelRingkasProps) {
  const fields = useMemo<ExcelField[]>(
    () =>
      kolom.map((k) => ({
        key: k.key,
        label: k.label,
        kind: 'static',
        ...(k.width != null ? { width: k.width } : {}),
      })),
    [kolom],
  );
  const rows = useMemo(
    () => baris.map((b, i) => ({ id: `r${i}`, b })),
    [baris],
  );
  const getValues = useMemo(
    () => (row: { id: string; b: (string | number | null)[] }) => {
      const out: Record<string, string | null> = {};
      kolom.forEach((k, j) => {
        const v = row.b[j];
        out[k.key] = v == null || v === '' ? null : String(v);
      });
      return out;
    },
    [kolom],
  );

  return (
    <section className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ExcelTable
          tableKey={tableKey}
          /* Judul TIDAK lagi digambar `<header>` sendiri: ia diserahkan ke
             bilah judul ExcelTable supaya tabel ini punya tempat untuk gerigi
             "Pengaturan tabel ini" di ujung kanan — kalau judul digambar
             sendiri, bilah judul ExcelTable tak pernah dirender (tak ada
             header/filter/kontrol lain) sehingga geriginya hilang. */
          header={<span>{judul}</span>}
          akhirToolbar={aksi}
          fields={fields}
          rows={rows}
          getValues={getValues}
          canEdit={false}
          onCommit={async () => {}}
          onSaved={() => {}}
          renderActions={() => null}
          maxRows={maxRows}
          emptyText={emptyText}
          hideCheckbox
          hideActions
          hidePreset
        />
      </div>
    </section>
  );
}
