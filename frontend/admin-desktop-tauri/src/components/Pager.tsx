import { Button } from '@/components/ui/button';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { ChevronLeft, ChevronRight } from '@/icons';
import { PER_PAGE_ALL, PER_PAGE_OPTIONS, normalizePerPage, type PerPage } from '@/prefs';

interface Props {
  page: number;
  lastPage: number;
  /** Jumlah seluruh baris. Tidak lagi ditampilkan di kanan bawah (posisi itu
   *  kini dipakai tombol tinggi baris); tetap diterima agar pemanggil utuh. */
  total: number;
  onPage: (p: number) => void;
  perPage: PerPage;
  onPerPage: (pp: PerPage) => void;
}

/** Pagination bawaan semua halaman tabel (default 50/halaman, persisten).
 *  Tak ditampilkan bila seluruh data masuk dalam satu halaman — kecuali pada
 *  pilihan "Semua", kontrol tetap tampil agar bisa dikembalikan. */
export default function Pager({ page, lastPage, onPage, perPage, onPerPage }: Props) {
  return (
    <div id="pager" className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 border-t border-border px-0 py-0">
      <div className="flex min-w-0 items-center gap-2">
        <ToggleGroup
          id="group_per_page"
          type="single"
          value={String(perPage)}
          onValueChange={(value) => { if (value) onPerPage(normalizePerPage(value)); }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Jumlah data per halaman"
        >
          {PER_PAGE_OPTIONS.map((o) => (
            <ToggleGroupItem
              key={o}
              id={`btn_per_page_${o}`}
              value={String(o)}
              aria-label={o === PER_PAGE_ALL ? 'Semua data' : `${o} data per halaman`}
              title={o === PER_PAGE_ALL ? 'Semua data' : `${o} data per halaman`}
              className="w-7 justify-center px-0 text-[11px]"
            >
              {o === PER_PAGE_ALL ? 'All' : o}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex h-6 items-center justify-center gap-2 rounded-none border-x">
        <Button
          id="btn_page_prev"
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
          title="Halaman sebelumnya"
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <span className="flex h-6 items-center text-xs text-muted-foreground">
          Hal {page} / {Math.max(1, lastPage)}
        </span>
        <Button
          id="btn_page_next"
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page >= lastPage}
          aria-label="Halaman berikutnya"
          title="Halaman berikutnya"
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
