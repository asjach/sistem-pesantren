import type { ReactNode } from 'react';
import type { VisToolbar } from '@/components/kelolaTabel/jenis';

export interface ToolbarTabelProps<T extends { id: string | number }> {
  tableKey: string;
  showToolbar: boolean;
  awalanToolbar?: ReactNode;
  akhirToolbar?: ReactNode;
  tengah?: ReactNode;
  checkedCount: number;
  checkedRows: T[];
  renderBulkActions?: (checkedRows: T[], clearSelection: () => void) => ReactNode;
  clearSelection: () => void;
  visToolbar: VisToolbar;
}

export default function ToolbarTabel<T extends { id: string | number }>({
  tableKey,
  showToolbar,
  awalanToolbar,
  akhirToolbar,
  tengah,
  checkedCount,
  checkedRows,
  renderBulkActions,
  clearSelection,
  visToolbar,
}: ToolbarTabelProps<T>) {
  if (!showToolbar) return null;

  const infoTampil = visToolbar.info;
  const adaInfoHalaman = tengah !== undefined && tengah !== null;
  const adaInfoSeleksi = checkedCount > 0;
  const tengahTampil = infoTampil && (adaInfoHalaman || adaInfoSeleksi);

  return (
    <div
      data-part="toolbar_tabel"
      id={`toolbar_tabel_${tableKey}`}
      className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-2 border-b bg-background px-3 py-2"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2">
        {checkedRows.length > 0 && renderBulkActions ? (
          <div className="flex flex-nowrap items-center gap-1.5 [&>*]:shrink-0">
            {renderBulkActions(checkedRows, clearSelection)}
          </div>
        ) : null}
        {awalanToolbar}
      </div>

      {tengahTampil ? (
        <div className="flex max-w-full shrink-0 self-center flex-col items-center gap-0.5 rounded-full border bg-muted/60 px-4 py-1 text-center">
          {adaInfoHalaman ? (
            <span className="max-w-[32rem] truncate text-[11px] text-muted-foreground">{tengah}</span>
          ) : null}
          {adaInfoSeleksi ? (
            <span id={`grid_info_${tableKey}`} className="flex max-w-[32rem] items-center gap-1.5 truncate text-[11px] font-medium text-primary">
              <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full bg-primary" />
              {checkedCount} baris dipilih
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-2 gap-y-2">
        {akhirToolbar}
      </div>
    </div>
  );
}
