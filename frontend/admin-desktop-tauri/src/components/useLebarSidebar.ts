import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import {
  SIDEBAR_LEBAR_DEFAULT,
  SIDEBAR_LEBAR_MAX,
  SIDEBAR_LEBAR_MIN,
  SIDEBAR_SNAP_HIDE,
  clampSidebarLebar,
} from '@/prefs';

interface Opsi {
  /** Lebar tersimpan (px) dari pref. */
  lebar: number;
  /** Simpan lebar final — dipanggil sekali, saat seretan selesai. */
  setLebar: (px: number) => void;
  /** Lipat/buka navigasi. */
  setCollapsed: (v: boolean) => void;
}

export interface LebarSidebar {
  /**>true selama seretan berjalan — animasi lebar dimatikan agar tidak tertinggal. */
  seret: boolean;
  /**>true bila seretan sudah menyentuh/melewati ambang "mentok ke pinggir". */
  seretSembunyi: boolean;
  /** Lebar untuk render navigasi (0 saat terlipat). */
  lebarTampil: (collapsed: boolean) => number;
  /** Handler `mousedown` pada gagang seret. */
  mulaiSeret: (e: MouseEvent<HTMLElement>) => void;
  /** Handler keyboard gagang (pola separator ARIA). */
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  /** Klik ganda gagang → lebar bawaan. */
  resetLebar: () => void;
}

/**
 * Seret lebar navigasi kiri.
 *
 * Gagang menempel tepi kanan panel; lebar = lebar tersimpan + geseran pointer.
 * Seretan ke kiri-mentok (≤ `SIDEBAR_SNAP_HIDE`) menyembunyikan navigasi
 * seketika, dan menarik lagi ke kanan membukanya kembali. Status lipatan
 * BARU dipersist saat pointer dilepas — jadi tak ada tulis pref berulang di
 * tengah seretan. Lebar lama sengaja disimpan saat disembunyikan agar dibuka
 * kembali ke lebar yang sama.
 *
 * Keyboard (pola separator ARIA): ←/→ menggeser 16px (Shift = 48px), panah
 * kiri melewati lebar MIN menyembunyikan navigasi, Home mengembalikan bawaan.
 */
export function useLebarSidebar({ lebar, setLebar, setCollapsed }: Opsi): LebarSidebar {
  const [seret, setSeret] = useState(false);
  const [seretLebar, setSeretLebar] = useState(SIDEBAR_LEBAR_DEFAULT);
  const [seretSembunyi, setSeretSembunyi] = useState(false);
  const ref = useRef({
    mulaiX: 0,
    lebarAwal: SIDEBAR_LEBAR_DEFAULT,
    /** Lebar terakhir selama seretan (0..MAX, boleh < min saat mentok). */
    lebar: SIDEBAR_LEBAR_DEFAULT,
    /** Lepaskan listener seretan sebelumnya (mis. seretan baru mulai). */
    lepas: null as null | (() => void),
  });

  const mulaiSeret = useCallback((e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    ref.current.mulaiX = e.clientX;
    ref.current.lebarAwal = lebar;
    ref.current.lebar = lebar;
    setSeret(true);
    setSeretLebar(lebar);
    setSeretSembunyi(false);

    const geser = (ev: globalThis.MouseEvent) => {
      const w = Math.min(SIDEBAR_LEBAR_MAX, Math.max(0, Math.round(ref.current.lebarAwal + (ev.clientX - ref.current.mulaiX))));
      ref.current.lebar = w;
      setSeretLebar(w);
      setSeretSembunyi(w <= SIDEBAR_SNAP_HIDE);
    };
    const selesai = () => {
      window.removeEventListener('mousemove', geser);
      window.removeEventListener('mouseup', selesai);
      ref.current.lepas = null;
      const w = ref.current.lebar;
      setSeret(false);
      setSeretSembunyi(false);
      if (w <= SIDEBAR_SNAP_HIDE) {
        // Mentok ke pinggir → sembunyikan; lebar lama disimpan utk dibuka lagi.
        setCollapsed(true);
      } else {
        setCollapsed(false);
        setLebar(clampSidebarLebar(w));
      }
    };
    ref.current.lepas?.();
    ref.current.lepas = selesai;
    window.addEventListener('mousemove', geser);
    window.addEventListener('mouseup', selesai);
  }, [lebar, setLebar, setCollapsed]);

  const resetLebar = useCallback(() => {
    setCollapsed(false);
    setLebar(SIDEBAR_LEBAR_DEFAULT);
  }, [setCollapsed, setLebar]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    const langkah = e.shiftKey ? 48 : 16;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const baru = lebar - langkah;
      // Ambang sembunyi untuk keyboard = lebar MIN: panah kiri melewati
      // lebar terkecil menyembunyikan navigasi, karena nilai di bawah MIN
      // tidak bisa dicapai (clamp) sehingga tak akan pernah ≤ ambang snap.
      if (baru < SIDEBAR_LEBAR_MIN) setCollapsed(true);
      else { setCollapsed(false); setLebar(clampSidebarLebar(baru)); }
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCollapsed(false);
      setLebar(clampSidebarLebar(lebar + langkah));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      resetLebar();
    }
  }, [lebar, resetLebar, setCollapsed, setLebar]);

  useEffect(() => () => { ref.current.lepas?.(); }, []);

  const lebarTampil = useCallback(
    (collapsed: boolean) => {
      if (seret) return seretSembunyi ? 0 : seretLebar;
      return collapsed ? 0 : lebar;
    },
    [seret, seretLebar, seretSembunyi, lebar],
  );

  return { seret, seretSembunyi, lebarTampil, mulaiSeret, onKeyDown, resetLebar };
}