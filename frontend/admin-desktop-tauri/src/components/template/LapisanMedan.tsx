import { useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

import { mmKePx, pxKeMm } from '@/lib/template/satuan';
import { garisMagnet, tempel, type Kotak } from '@/lib/template/snap';
import { TIPE_TANDA, type Medan, type UkuranHalaman } from '@/lib/template/tipe';
import { cn } from '@/lib/utils';

const PEGANGAN = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

type ArahPegangan = (typeof PEGANGAN)[number];

interface LapisanMedanProps {
  medan: Medan[];
  halaman: number;
  ukuran: UkuranHalaman;
  /** Lebar kanvas dalam piksel CSS; bersama zoom menentukan skala px per mm. */
  lebarPx: number;
  zoom: number;
  terpilih: string | null;
  onPilih: (id: string | null) => void;
  /**
   * Perubahan posisi atau ukuran. `gabung` true selama satu gestur berjalan,
   * `selesai` true saat gestur berakhir supaya riwayat menutup satu langkah.
   */
  onKotak: (id: string, kotak: Partial<Kotak>, gabung: boolean, selesai: boolean) => void;
  /** Garis magnet yang sedang menempel, untuk digambar sebagai penanda. */
  onGaris: (garis: { x: number[]; y: number[] } | null) => void;
  /** Mode baca: kotak tidak bisa digeser dan pegangan resize disembunyikan. */
  modeBaca?: boolean;
  /**
   * Nilai contoh per "sumber.kunci" untuk setiap medan, supaya isi yang akan
   * tercetak terlihat langsung di kanvas tanpa perlu mencetak lebih dulu.
   */
  contoh?: Record<string, string>;
}

/** Gaya supaya garis dan kotak di kanvas sama dengan yang keluar di PDF. */
function gayaDekoratif(medan: Medan): CSSProperties {
  if (medan.tipe === 'garis') {
    return {
      borderTop: `${medan.gaya.tebal_mm}mm solid ${medan.gaya.warna}`,
      background: 'transparent',
    };
  }

  if (medan.tipe === 'kotak') {
    return {
      border: `${medan.gaya.tebal_mm}mm solid ${medan.gaya.warna}`,
      background: medan.gaya.isi ?? 'transparent',
    };
  }

  return {};
}

function kotakDari(medan: Medan): Kotak {
  return { x: medan.x, y: medan.y, w: medan.w, h: medan.h };
}

/** Lapisan kotak medan di atas halaman PDF: geser dan ubah ukuran. */
export default function LapisanMedan({
  medan,
  halaman,
  ukuran,
  zoom,
  terpilih,
  onPilih,
  onKotak,
  onGaris,
  modeBaca = false,
  contoh,
}: LapisanMedanProps) {
  const seretRef = useRef<{ id: string; mulaiX: number; mulaiY: number; kotak: Kotak } | null>(null);

  // Patokan magnet: tepi halaman plus tepi kotak lain di halaman yang sama.
  const magnet = garisMagnet(
    [ukuran],
    1,
    medan.filter((m) => m.halaman === halaman && m.id !== terpilih).map(kotakDari),
  );

  const mulaiSeret = useCallback(
    (e: ReactPointerEvent, m: Medan) => {
      onPilih(m.id);

      if (modeBaca) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      seretRef.current = { id: m.id, mulaiX: e.clientX, mulaiY: e.clientY, kotak: kotakDari(m) };
    },
    [modeBaca, onPilih],
  );

  const geser = useCallback(
    (e: ReactPointerEvent, m: Medan) => {
      const pangkal = seretRef.current;

      if (!pangkal || pangkal.id !== m.id) {
        return;
      }

      const geserX = pxKeMm(e.clientX - pangkal.mulaiX, zoom);
      const geserY = pxKeMm(e.clientY - pangkal.mulaiY, zoom);

      const hasil = tempel(
        { x: pangkal.kotak.x + geserX, y: pangkal.kotak.y + geserY, w: pangkal.kotak.w, h: pangkal.kotak.h },
        magnet,
      );

      onKotak(m.id, { x: hasil.kotak.x, y: hasil.kotak.y }, true, false);
      onGaris(hasil.garis.x.length > 0 || hasil.garis.y.length > 0 ? hasil.garis : null);
    },
    [magnet, onGaris, onKotak, zoom],
  );

  const selesaiSeret = useCallback(
    (e: ReactPointerEvent, m: Medan) => {
      if (!seretRef.current) {
        return;
      }

      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      seretRef.current = null;
      onGaris(null);
      onKotak(m.id, {}, false, true);
    },
    [onGaris, onKotak],
  );

  const mulaiResize = useCallback(
    (e: ReactPointerEvent, m: Medan, arah: ArahPegangan) => {
      e.preventDefault();
      e.stopPropagation();
      onPilih(m.id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const mulaiX = e.clientX;
      const mulaiY = e.clientY;
      const kotak = kotakDari(m);

      // Resize di window, bukan di elemen pegangan: pointer bisa keluar kotak
      // dan pegangan yang memuat event ikut bergeser.
      const bergerak = (ev: PointerEvent) => {
        const geserX = pxKeMm(ev.clientX - mulaiX, zoom);
        const geserY = pxKeMm(ev.clientY - mulaiY, zoom);
        const hasil = tempel(ubahPerArah(kotak, arah, geserX, geserY), magnet);
        onKotak(m.id, hasil.kotak, true, false);
      };

      const berhenti = () => {
        window.removeEventListener('pointermove', bergerak);
        window.removeEventListener('pointerup', berhenti);
        onGaris(null);
        onKotak(m.id, {}, false, true);
      };

      window.addEventListener('pointermove', bergerak);
      window.addEventListener('pointerup', berhenti);
    },
    [magnet, onGaris, onKotak, onPilih, zoom],
  );

  return (
    <div className="absolute inset-0" onPointerDown={() => onPilih(null)}>
      {medan
        .filter((m) => m.halaman === halaman)
        .map((m) => {
          const dipilih = m.id === terpilih;
          const gaya: CSSProperties = {
            left: mmKePx(m.x, zoom),
            top: mmKePx(m.y, zoom),
            width: mmKePx(m.w, zoom),
            height: mmKePx(m.h, zoom),
            // Garis dan kotak memakai gaya sendiri supaya pratinjau terlihat
            // sama dengan yang keluar di PDF.
            ...gayaDekoratif(m),
          };

          return (
            <div
              key={m.id}
              data-medan-id={m.id}
              style={gaya}
              onPointerDown={(e) => mulaiSeret(e, m)}
              onPointerMove={(e) => geser(e, m)}
              onPointerUp={(e) => selesaiSeret(e, m)}
              className={cn(
                'absolute touch-none',
                TIPE_TANDA.includes(m.tipe)
                  ? 'border border-dashed border-muted-foreground/60'
                  : dipilih
                    ? 'border-2 border-primary bg-primary/10'
                    : 'border border-primary/50 bg-primary/5 hover:bg-primary/10',
                modeBaca && 'pointer-events-none',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none absolute left-0 max-w-full truncate text-[10px] leading-none text-primary',
                  m.tipe === 'garis' ? '-top-4' : '',
                )}
                style={m.tipe === 'garis' ? { right: 0 } : undefined}
              >
                {m.label}
              </span>

              {contoh?.[m.kunci ?? ''] && (
                <span className="pointer-events-none block truncate text-[11px] leading-tight text-muted-foreground">
                  {contoh[m.kunci ?? '']}
                </span>
              )}

              {!modeBaca &&
                dipilih &&
                PEGANGAN.map((arah) => (
                  <span
                    key={arah}
                    role="presentation"
                    onPointerDown={(e) => mulaiResize(e, m, arah)}
                    className="absolute size-2 rounded-full border border-primary bg-background"
                    style={posisiPegangan(arah)}
                  />
                ))}
            </div>
          );
        })}
    </div>
  );
}

function posisiPegangan(arah: ArahPegangan): CSSProperties {
  switch (arah) {
    case 'nw':
      return { left: '-4px', top: '-4px' };
    case 'n':
      return { left: 'calc(50% - 4px)', top: '-4px' };
    case 'ne':
      return { right: '-4px', top: '-4px' };
    case 'e':
      return { right: '-4px', top: 'calc(50% - 4px)' };
    case 'se':
      return { right: '-4px', bottom: '-4px' };
    case 's':
      return { left: 'calc(50% - 4px)', bottom: '-4px' };
    case 'sw':
      return { left: '-4px', bottom: '-4px' };
    default:
      return { left: '-4px', top: 'calc(50% - 4px)' };
  }
}

/** Ubah satu sisi atau sudut kotak mengikuti arah pegangan dan geseran. */
function ubahPerArah(kotak: Kotak, arah: ArahPegangan, geserX: number, geserY: number): Kotak {
  const minimum = 1;
  const hasil: Kotak = { ...kotak };

  if (arah.includes('w')) {
    // Sisi kiri tidak boleh melewati sisi kanan.
    const xBaru = Math.min(kotak.x + geserX, kotak.x + kotak.w - minimum);
    hasil.w = kotak.w + (kotak.x - xBaru);
    hasil.x = xBaru;
  }

  if (arah.includes('e')) {
    hasil.w = Math.max(minimum, kotak.w + geserX);
  }

  if (arah.includes('n')) {
    const yBaru = Math.min(kotak.y + geserY, kotak.y + kotak.h - minimum);
    hasil.h = kotak.h + (kotak.y - yBaru);
    hasil.y = yBaru;
  }

  if (arah.includes('s')) {
    hasil.h = Math.max(minimum, kotak.h + geserY);
  }

  return hasil;
}
