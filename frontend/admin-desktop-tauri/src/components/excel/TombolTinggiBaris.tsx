import { Button } from '@/components/ui/button';
import { useGridPrefs } from '@/components/GridPrefs';
import { TINGGI_BARIS_BAWAAN, tinggiBarisBerikut } from './tinggiBaris';
import { useTinggiBaris } from './useTinggiBaris';
import { DensityMedium } from '@/icons';

/** Tombol tinggi baris di kanan bawah tabel: sekali klik memutar nilai cepat
 *  (20 → 24 → 28 → 32 px).
 *
 *  Nilainya PER TABEL (pref `simpes_grid_<tableKey>_rowh_dasar`), bukan
 *  global: tabel padat boleh berdampingan dengan tabel yang lega. Tabel yang
 *  belum pernah diklik mengikuti slider "Tinggi sel" di Pengaturan → Tampilan
 *  (sekarang berarti "bawaan"), lalu 24px. */
export default function TombolTinggiBaris({ tableKey }: { tableKey: string }) {
  const { rowH } = useGridPrefs();
  const { dasar, setDasar } = useTinggiBaris(tableKey);
  const sekarang = dasar ?? rowH ?? TINGGI_BARIS_BAWAAN;
  const berikut = tinggiBarisBerikut(sekarang);

  return (
    <Button
      id={`btn_tinggi_baris_${tableKey}`}
      type="button"
      variant="outline"
      size="sm"
      title={`Tinggi baris ${sekarang}px (tabel ini) — klik untuk ${berikut}px`}
      aria-label={`Tinggi baris ${sekarang} piksel, ubah ke ${berikut}`}
      onClick={() => setDasar(berikut)}
    >
      <DensityMedium size={14} />
      <span className="text-[10px] tabular-nums">{sekarang}px</span>
    </Button>
  );
}