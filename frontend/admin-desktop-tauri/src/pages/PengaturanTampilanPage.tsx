import { isTauri } from '../api/client';
import { useTheme } from '@/theme';
import { DEFAULT_PREFS } from '@/prefs';
import { Badge } from '@/components/ui/badge';

/** Pengaturan → Tampilan: ringkasan tema aktif + tautan lokasi pengaturan kini.
 *  Kontrol tema/warna/ikon dipindah ke menu akun; kontrol tabel ke ribbon Tabel. */
export default function PengaturanTampilanPage() {
  const { theme, mode } = useTheme();
  return (
    <div className="flex flex-col gap-6">
      <p id="info_pengaturan" className="text-sm text-muted-foreground">
        Tema aktif: <b className="text-foreground">{theme}</b> · Bawaan:{' '}
        <b className="text-foreground">{DEFAULT_PREFS.theme}</b> · Mode:{' '}
        <b className="text-foreground">{mode}</b> ·{' '}
        <Badge variant="secondary">{isTauri() ? 'desktop' : 'web'}</Badge>
      </p>

      <section className="flex w-full max-w-none flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Pengaturan tampilan</h2>
        <p className="text-sm text-muted-foreground">
          Pengaturan tema, kaya warna UI, set ikon, dan mode terang/gelap kini ada di
          <b> menu akun</b> (kanan atas). Pengaturan teks &amp; ukuran tabel (font, ukuran,
          warna sel/header, tinggi baris, kerapatan) ada di ribbon tab <b>Tabel</b>.
        </p>
      </section>
    </div>
  );
}
