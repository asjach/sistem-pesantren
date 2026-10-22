import type { ComponentProps } from 'react';
import BilahToolbarV2 from './BilahToolbarV2';
import TableFooterV2 from './TableFooterV2';

type Props = ComponentProps<typeof BilahToolbarV2>;

/**
 * ExcelTabelV2. Tahap ini menyusun tiga zona layout dan kerangka toolbar;
 * isi tiap zona ditambahkan bertahap.
 */
export default function ExcelTabelV2(props: Props) {
  return (
    <div
      data-slot="excel-table"
      data-varian="v2"
      className="relative flex min-h-0 flex-1 flex-col"
    >
      <BilahToolbarV2 {...props} />

      <div
        data-slot="excel-table-body"
        /* Sementara: hijau = area tabel; hapus setelah identifikasi visual. */
        className="flex min-h-0 flex-1 flex-col border border-emerald-600 bg-emerald-500/20"
      />

      <TableFooterV2 />
    </div>
  );
}
