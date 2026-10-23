import { useMemo, useState } from 'react';
import type { CellProps } from 'react-datasheet-grid';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { ExcelField, GridRow } from '@/components/excel/types';
import { cn } from '@/lib/utils';
import type { RataKolom } from './kolom';

/** Nilai kosong untuk Radix Select: Radix menolak opsi berupa string kosong. */
const KOSONG = '__kosong__';

const RATA_STYLE: Record<RataKolom, string> = {
  kiri: 'justify-start text-left',
  tengah: 'justify-center text-center',
  kanan: 'justify-end text-right',
};

export interface SelSelectV2Data {
  field: ExcelField;
  rata: RataKolom;
  /** True = sel boleh membuka dropdown pada keadaan sekarang. */
  bisaSelect?: boolean;
  onSimpan?: (id: string | number, key: string, nilai: string | null) => void;
}

/** Sel `kind: 'select'` V2 untuk record lama.
 *
 *  V1 membuka dropdown Radix hanya saat sel disunting; V2 memakai tombol murah
 *  yang sudah tampil, lalu satu klik membuka daftar. Pilihan disimpan lewat
 *  antrean simpan yang sama dengan penyuntingan sel (`onSimpan`), sehingga
 *  validasi, toast, dan muat ulang tetap satu jalur.
 *
 *  `bolehSelect` dicek per baris; nilai yang tak ada di daftar pilihan tetap
 *  ditampilkan apa adanya agar data API lama tidak berubah diam-diam. */
export default function SelSelectV2({ rowData, columnData }: CellProps<GridRow, SelSelectV2Data>) {
  const { field: f, rata, bisaSelect = false, onSimpan } = columnData;
  const [buka, setBuka] = useState(false);
  const cur = (rowData[f.key] as string | null) ?? '';
  const opsi = f.choicesForRow?.(rowData.id) ?? f.choices ?? [];
  const label = useMemo(
    () => opsi.find((o) => o.value === cur)?.label ?? cur,
    [opsi, cur],
  );
  /** Nilai di luar daftar pilihan ikut ditampilkan sebagai opsi agar tidak
   *  hilang dari pandangan; memilihnya kembali tidak mengubah data. */
  const opsiTampil = useMemo(
    () => (cur !== '' && !opsi.some((o) => o.value === cur) ? [...opsi, { value: cur, label: cur }] : opsi),
    [opsi, cur],
  );
  const terkunci = !bisaSelect || onSimpan == null || f.bolehSelect?.(rowData.id) === false;

  /** Tampilan baca-saja (atau sel terkunci): teks label, tanpa kontrol. */
  if (terkunci) {
    return (
      <div
        data-col-key={f.key}
        className={cn('flex h-full w-full min-w-0 items-center px-2', RATA_STYLE[rata])}
      >
        <span className="min-w-0 truncate" title={label || undefined}>{label}</span>
      </div>
    );
  }

  return (
    <div data-col-key={f.key} className="flex h-full w-full min-w-0 items-center">
      <Select
        open={buka}
        onOpenChange={setBuka}
        value={cur === '' ? KOSONG : cur}
        onValueChange={(v) => onSimpan(rowData.id, f.key, v === KOSONG ? null : v)}
        tanpaAutoPilih
      >
        <SelectTrigger
          aria-label={f.label || f.key}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'h-full w-full min-w-0 gap-1 border-0 bg-transparent px-2 text-xs shadow-none',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            RATA_STYLE[rata],
          )}
        >
          <span className="min-w-0 truncate">{cur === '' ? 'Pilih…' : label}</span>
        </SelectTrigger>
        {buka ? (
          <SelectContent
            position="popper"
            align="start"
            sideOffset={4}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {opsiTampil.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        ) : null}
      </Select>
    </div>
  );
}
