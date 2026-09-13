import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from '@/icons';
import { PER_PAGE_OPTIONS, normalizePerPage, type PerPage } from '@/prefs';

interface Props {
  page: number;
  lastPage: number;
  total: number;
  onPage: (p: number) => void;
  perPage: PerPage;
  onPerPage: (pp: PerPage) => void;
}

/** Pagination bawaan semua halaman tabel (default 100/halaman, persisten). */
export default function Pager({ page, lastPage, total, onPage, perPage, onPerPage }: Props) {
  if (total <= 100) return null;
  return (
    <div id="pager" className="flex flex-wrap items-center gap-2 py-2">
      <Button
        id="btn_page_prev"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft data-icon="inline-start" size={16} /> Sebelumnya
      </Button>
      <span className="text-sm text-muted-foreground">
        Hal {page} / {lastPage} · {total} data
      </span>
      <Select value={String(perPage)} onValueChange={(v) => onPerPage(normalizePerPage(v))}>
        <SelectTrigger
          id="select_per_page"
          aria-label="Baris per halaman"
          title="Baris per halaman"
          className="h-6 w-24"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PER_PAGE_OPTIONS.map((o) => (
            <SelectItem key={o} value={String(o)}>
              {o} / hal
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        id="btn_page_next"
        variant="outline"
        size="sm"
        disabled={page >= lastPage}
        onClick={() => onPage(page + 1)}
      >
        Berikutnya <ChevronRight data-icon="inline-end" size={16} />
      </Button>
    </div>
  );
}
