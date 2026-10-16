import { Component, type ErrorInfo, type ReactNode } from 'react';
/* Ikon dari SET STATIS (lucide), bukan `@/icons` yang dinamis: komponen itu
   membaca `useTheme()`, sedangkan batas galat harus tetap bisa menggambar
   tampilannya walau yang gagal justru provider tema (dan di akar aplikasi tak
   ada provider apa pun di atasnya). */
import setIkon from '@/icons/lucide';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const RefreshCw = setIkon.RefreshCw;
const RotateCcw = setIkon.RotateCcw;

/**
 * Batas galat render: menahan galat dari pohon di bawahnya supaya aplikasi
 * tidak jadi layar kosong.
 *
 * Sebelum ini tak ada satu pun batas galat: galat render apa pun (mis. DSG
 * membaca kolom yang tak ada lagi) melempar ke akar React, React melepas
 * SELURUH pohon, dan pengguna hanya melihat jendela kosong tanpa penjelasan —
 * satu-satunya jalan keluar adalah menutup aplikasi. Dengan batas ini galat
 * terkurung di bagian yang gagal saja.
 *
 * Dipasang berlapis (lihat `App.tsx` dan `main.tsx`):
 * - per HALAMAN (di dalam `<main>`, kuncinya = path rute) — kerangka aplikasi
 *   (sidebar, topbar, ribbon) tetap hidup dan pengguna bisa pindah halaman;
 *   berpindah rute otomatis melepas batasnya (kunci berubah);
 * - di AKAR aplikasi (di `main.tsx`) — jaring terakhir bila kerangka/providernya
 *   sendiri yang gagal; tampilannya memenuhi jendela.
 */
interface Props {
  children: ReactNode;
  /** Judul tampilan galat. */
  judul?: string;
  /** Satu kalimat penjelas: bagian mana yang gagal & apa akibatnya. */
  keterangan?: ReactNode;
  /** Tampilan memenuhi seluruh jendela (dipakai jaring terluar di akar). */
  penuhLayar?: boolean;
  /** Timpa aksi "Muat ulang" — dipakai tes agar tak benar-benar memuat ulang. */
  onMuatUlang?: () => void;
  /** Aksi "keluar dari bagian yang gagal" — dipakai panel/dialog yang bisa
   *  ditutup: tanpa ini pengguna hanya bisa memuat ulang seluruh aplikasi
   *  padahal cukup menutup dialognya. Tombolnya hanya muncul bila diisi. */
  onTutup?: () => void;
  /** Label tombol tutup (bawaan "Tutup"). */
  labelTutup?: string;
  className?: string;
}

interface State {
  galat: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { galat: null };

  static getDerivedStateFromError(galat: Error): State {
    return { galat };
  }

  componentDidCatch(galat: Error, info: ErrorInfo): void {
    /* React sudah mencetak galatnya sendiri. Baris ini MENAMBAH jejak komponen
       dalam satu log yang mudah dicari ("[SIMPES] galat render") — di aplikasi
       desktop pengguna tak membuka devtools, jadi log ini yang jadi pegangan
       saat menelusuri laporan. */
    console.error('[SIMPES] galat render:', galat.message, info.componentStack);
  }

  /** Buang galat yang tertangkap lalu coba render ulang anaknya. */
  private coba = (): void => {
    this.setState({ galat: null });
  };

  private muatUlang = (): void => {
    if (this.props.onMuatUlang) this.props.onMuatUlang();
    else window.location.reload();
  };

  render(): ReactNode {
    const { galat } = this.state;
    const { children, judul, keterangan, penuhLayar, onTutup, labelTutup, className } = this.props;
    if (!galat) return children;

    return (
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto bg-background p-4',
          penuhLayar && 'h-screen w-screen',
          className,
        )}
      >
        <div
          id="tampilan_galat"
          role="alert"
          aria-labelledby="judul_galat"
          data-part="tampilan_galat"
          className="w-full max-w-2xl rounded-lg border border-destructive/40 bg-card p-4"
        >
          <h2 id="judul_galat" className="text-sm font-medium text-destructive">
            {judul ?? 'Terjadi kesalahan saat menampilkan bagian ini'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {keterangan ?? (
              penuhLayar
                ? 'Aplikasi gagal dimuat. Simpan pekerjaan lain Anda, lalu muat ulang.'
                : 'Halaman ini berhenti di tengah jalan; sisa aplikasi (menu, halaman lain) tetap bisa dipakai.'
            )}
          </p>

          <pre
            id="pesan_galat"
            dir="ltr"
            className="mt-3 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 text-left text-[11px] whitespace-pre-wrap text-foreground"
          >
            {galat.message || String(galat)}
          </pre>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button id="btn_coba_lagi" type="button" variant="default" size="sm" onClick={this.coba}>
              <RotateCcw />
              Coba lagi
            </Button>
            <Button id="btn_muat_ulang" type="button" variant="outline" size="sm" onClick={this.muatUlang}>
              <RefreshCw />
              Muat ulang aplikasi
            </Button>
            {onTutup ? (
              <Button id="btn_tutup_galat" type="button" variant="ghost" size="sm" onClick={onTutup}>
                {labelTutup ?? 'Tutup'}
              </Button>
            ) : null}
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            Bila berulang, catat pesan di atas dan laporkan langkah yang sedang dikerjakan sebelum galat muncul.
          </p>
        </div>
      </div>
    );
  }
}
