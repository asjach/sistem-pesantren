import { useGridPrefs } from '@/components/GridPrefs';
import { useTheme } from '@/theme';
import { DENSITY_PX } from '@/prefs';
import { DensityMedium } from '@/icons';
import { cn } from '@/lib/utils';
import { tinggiBarisBerikut } from './tinggiBaris';

/** Tombol tinggi baris di kanan bawah tabel: sekali klik memutar nilai cepat
 *  (20 → 24 → 28 → 32 px). Nilainya GLOBAL untuk seluruh tabel, tetapi
 *  tombolnya tampil di tiap tabel (id dibedakan per `tableKey`). */
export default function TombolTinggiBaris({ tableKey }: { tableKey: string }) {
  const { density } = useTheme();
  const { rowH, setRowH } = useGridPrefs();
  const sekarang = rowH ?? DENSITY_PX[density];
  const berikut = tinggiBarisBerikut(sekarang);

  return (
    <button
      id={`btn_tinggi_baris_${tableKey}`}
      type="button"
      title={`Tinggi baris ${sekarang}px (berlaku semua tabel) — klik untuk ${berikut}px`}
      aria-label={`Tinggi baris ${sekarang} piksel, ubah ke ${berikut}`}
      onClick={() => setRowH(berikut)}
      className={cn(
        'flex h-6 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
      )}
    >
      <DensityMedium size={14} />
      <span className="tabular-nums">{sekarang}px</span>
    </button>
  );
}
