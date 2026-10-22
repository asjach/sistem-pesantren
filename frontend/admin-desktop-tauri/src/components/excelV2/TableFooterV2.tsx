import type { ReactNode } from 'react';

interface Props {
  /** Jumlah baris yang sedang tampil. */
  jumlah: number;
  /** Jumlah baris terpilih. */
  dipilih: number;
  /** Kontrol paginasi halaman. */
  pager?: ReactNode;
}

/** Footer ExcelTabelV2: ringkasan baris di kiri, paginasi di kanan. */
export default function TableFooterV2({ jumlah, dipilih, pager }: Props) {
  return (
    <div
      data-slot="table-footer"
      data-part="kaki_tabel"
      className="flex h-8 shrink-0 items-center gap-3 border-t border-border bg-muted/40 px-2 text-xs text-muted-foreground"
    >
      <span data-slot="table-footer-jumlah">
        {jumlah} baris
        {dipilih > 0 && ` · ${dipilih} dipilih`}
      </span>

      {pager && <div data-slot="table-footer-pager" className="ml-auto flex items-center">{pager}</div>}
    </div>
  );
}
