import { Button } from '@/components/ui/button';
import { MoreVertical } from '@/icons';

/** Toolbar ExcelTabelV2: judul, area aksi, dan trigger menu. */
export default function BilahHeaderV2({ judul }: { judul: string }) {
  return (
    <div
      data-slot="excel-table-header"
      data-part="header_tabel"
      /* Sementara: biru = toolbar; hapus setelah identifikasi visual. */
      className="flex h-8 shrink-0 items-center border-b border-border bg-sky-500/25 pl-2 pr-0"
    >
      <div className="min-w-0 truncate text-xs font-medium">{judul}</div>

      <div
        data-slot="excel-table-actions"
        className="flex min-w-0 flex-1 items-center"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        data-trigger="excel-table-menu"
        aria-label="Menu lainnya"
        title="Menu lainnya"
        className="!h-full !w-6"
      >
        <MoreVertical size={14} />
      </Button>
    </div>
  );
}
