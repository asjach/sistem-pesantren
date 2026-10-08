import { Button } from '@/components/ui/button';
import { useGridPrefs } from '@/components/GridPrefs';
import { useTheme } from '@/theme';
import { DENSITY_PX } from '@/prefs';
import { DensityMedium } from '@/icons';
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
    <Button
      id={`btn_tinggi_baris_${tableKey}`}
      type="button"
      variant="outline"
      size="sm"
      title={`Tinggi baris ${sekarang}px (berlaku semua tabel) — klik untuk ${berikut}px`}
      aria-label={`Tinggi baris ${sekarang} piksel, ubah ke ${berikut}`}
      onClick={() => setRowH(berikut)}
    >
      <DensityMedium size={14} />
      <span className="text-[10px] tabular-nums">{sekarang}px</span>
    </Button>
  );
}
