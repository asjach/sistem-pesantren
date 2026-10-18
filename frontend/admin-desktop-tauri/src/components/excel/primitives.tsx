import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { CheckAllState } from './types';

/**
 * Satu sakelar gestur manipulasi tabel yang ditawarkan Mode Ubah.
 *
 *  Sakelar dikelompokkan lewat `grup`: dua sakelar dengan grup yang sama
 *  digambar berdampingan, dan antar-grup diberi garis pemisah. Copy & Move
 *  hidup dalam satu grup karena mereka SALING MATI — nanti grup baru
 *  cukup menambah `grup`, tanpa mengubah apa pun soal tata letak.
 */
export interface SakelarMode {
  /** Id elemen (NFR-05: snake_case). */
  id: string;
  label: string;
  /** Penjelasan singkat di tooltip — labelnya sengaja dibuat pendek. */
  hint?: string;
  /** Identitas kelompok. Sakelar bertanda `grup` sama dikumpulkan; grup
   *  berbeda dipisah garis. Absen = sakelar berdiri sendiri (masih dipisah
   *  garis dari sakelar lain). */
  grup?: string;
  checked: boolean;
  onCheckedChange: (nyala: boolean) => void;
}

/** Penanda mode (Ubah/Input) bergaya bilah status di badan halaman (bawah
 *  tabel): ikon + judul + tombol keluar; keterangan lengkap ada di tooltip.
 *
 *  `sakelar` (bila ada) digambar DI ATAS bilah status: sakelar gestur
 *  manipulasi yang berlaku selama mode ini hidup. */
export function PillMode({
  id,
  btnId,
  aksen,
  ikon,
  judul,
  petunjuk,
  sakelar,
  onKeluar,
}: {
  id: string;
  btnId: string;
  aksen: 'warning' | 'primary';
  ikon: ReactNode;
  judul: string;
  petunjuk: string;
  sakelar?: SakelarMode[];
  onKeluar: () => void;
}) {
  const warn = aksen === 'warning';
  return (
    <div className="flex flex-col items-end gap-1.5">
      {sakelar && sakelar.length > 0 && (
        <div className="flex flex-col gap-1 rounded-pil border border-foreground/30 bg-popover px-2.5 py-1.5 shadow-md">
          {sakelar.map((s, i) => {
            /* Garis pemisah antar-GRUP, bukan antar-item: sakelar copy &
               pindah (satu grup) duduk rapat, dan grup berikutnya dipisah
               garis. Sakelar tanpa `grup` dihitung grupnya sendiri lewat
               `id`, jadi tak pernah ikut menempel ke tetangganya. */
            const grupIni = s.grup ?? `~${s.id}`;
            const grupSebelum = i === 0 ? null : (sakelar[i - 1].grup ?? `~${sakelar[i - 1].id}`);
            return (
              <div key={s.id} className="contents">
                {grupIni !== grupSebelum && i > 0 && (
                  <Separator orientation="horizontal" className="my-1 h-px bg-border" />
                )}
                <label
                  htmlFor={s.id}
                  title={s.hint}
                  className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground select-none hover:text-foreground"
                >
                  <Checkbox
                    id={s.id}
                    checked={s.checked}
                    onCheckedChange={(c) => s.onCheckedChange(!!c)}
                  />
                  {s.label}
                </label>
              </div>
            );
          })}
        </div>
      )}
      <div
        id={id}
        role="status"
        title={petunjuk}
        className={cn(
          'inline-flex items-center gap-2 rounded-pil border px-3 py-1 text-xs',
          warn ? 'border-warning/40 bg-warning/10 text-warning-foreground' : 'border-primary/40 bg-primary/10 text-foreground',
        )}
      >
        {ikon}
        <span className="font-semibold">{judul}</span>
        <Button
          id={btnId}
          variant="outline"
          size="sm"
          className={cn(
            'h-6 px-2',
            warn
              ? 'border-warning/40 bg-transparent text-warning-foreground hover:bg-warning/10 hover:text-warning-foreground'
              : 'border-primary/40 bg-transparent hover:bg-primary/10',
          )}
          onClick={onKeluar}
        >
          Keluar mode
        </Button>
      </div>
    </div>
  );
}

/** Kerangka tabel saat memuat: menyerupai grid (baris header + baris data)
 *  agar area tabel tidak tampak seperti blok abu-abu kosong. Latarnya memakai
 *  warna sel tabel (`--part-tabel_sel-bg`) supaya tidak berbeda dari grid
 *  sungguhan saat data tiba. */
export function TabelMemuat({ rowH, baris = 14 }: { rowH: number; baris?: number }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[color:var(--part-tabel_sel-bg,var(--background))]" aria-hidden="true">
      <div className="h-[26px] shrink-0 border-b bg-muted/60" />
      <div className="flex min-h-0 flex-1 flex-col">
        {Array.from({ length: baris }).map((_, i) => (
          <div key={i} className="shrink-0 border-b border-border/50" style={{ height: rowH }} />
        ))}
      </div>
    </div>
  );
}

export const CheckAllContext = createContext<CheckAllState | null>(null);

export function CheckAllCell() {
  const ctx = useContext(CheckAllContext);
  if (!ctx) return null;
  const all = ctx.ids.length > 0 && ctx.ids.every((id) => ctx.checked.has(id));
  const some = ctx.ids.some((id) => ctx.checked.has(id));
  return (
    <span className="flex w-full items-center justify-center">
      <input
        type="checkbox"
        aria-label="Pilih semua baris"
        className="simpes-dsg-checkall"
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = some && !all;
        }}
        onChange={(e) => {
          const next = new Set<string | number>();
          if (e.target.checked) for (const id of ctx.ids) next.add(id);
          ctx.setChecked(next);
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </span>
  );
}
