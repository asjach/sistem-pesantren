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
    /** Sudah melewati ambang gerak (seretan sungguhan, bukan klik). */
    bergerak: false,
    /** Lepaskan listener seretan sebelumnya (mis. seretan baru mulai). */
    lepas: null as null | (() => void),
  });

  const mulaiSeret = useCallback((e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // Kursor seret dipasang di <body> selama seretan: pointer gampang keluar
    // dari gagang yang tipis saat diseret cepat, dan tanpa ini kursornya
    // berkedip balik ke panah di tengah seretan.
    document.body.style.cursor = 'col-resize';
    ref.current.mulaiX = e.clientX;
    ref.current.lebarAwal = lebar;
    ref.current.lebar = lebar;
    ref.current.bergerak = false;

    /* Seret BARU dianggap berjalan setelah pointer melewati ambang klik.
       Tanpa ini, mousedown pada kenop lipat langsung mematikan transisi +
       (saat terlipat) melompatkan lebar ke penuh seketika — klik buka/tutup
       polos jadi terasa instan. Ambang sama dengan `apakahKlik` di bawah. */
    const ambang = (ev: globalThis.MouseEvent) => {
      if (Math.abs(ev.clientX - ref.current.mulaiX) <= AMBANG_GESER_KLIK) return;
      ref.current.bergerak = true;
      setSeret(true);
      window.removeEventListener('mousemove', ambang);
      window.addEventListener('mousemove', geser);
      // Listener baru tak menerima event yang sedang berjalan — terapkan
      // gerakan pemicu ini langsung, atau satu langkah seret hilang.
      geser(ev);
    };
    const geser = (ev: globalThis.MouseEvent) => {
      const w = Math.min(SIDEBAR_LEBAR_MAX, Math.max(0, Math.round(ref.current.lebarAwal + (ev.clientX - ref.current.mulaiX))));
      ref.current.lebar = w;
      setSeretLebar(w);
      setSeretSembunyi(w <= SIDEBAR_SNAP_HIDE);
    };
    const selesai = () => {
      window.removeEventListener('mousemove', ambang);
      window.removeEventListener('mousemove', geser);
      window.removeEventListener('mouseup', selesai);
      document.body.style.cursor = '';
      ref.current.lepas = null;
      // Klik murni (tak melewati ambang): jangan sentuh apa pun — handler
      // klik pemanggil (mis. lipat/buka) yang bertindak dengan transisi utuh.
      if (!ref.current.bergerak) return;
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
    window.addEventListener('mousemove', ambang);
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

/** Jarak pointer maksimal (px) antara `mousedown` dan klik yang masih dibaca
 *  sebagai klik. Dipakai elemen yang merangkap tombol + gagang seret. */
export const AMBANG_GESER_KLIK = 3;

/**
 * Klik atau penutup seretan?
 *
 * `xMousedown` = posisi pointer saat `mousedown`, atau `null` bila tak ada
 * mousedown sama sekali — aktivasi keyboard/AT, yang selalu klik.
 *
 * Ambang jarak dipilih dibanding flag "pernah bergerak" karena flag serupa
 * bertahan melewati seretan yang dilepas di luar elemen (klik tak pernah
 * terjadi untuk menghabiskannya) dan bisa menelan aktivasi keyboard berikutnya.
 * Harga pilihannya: seretan yang dilepas tepat di titik awalnya tetap terbaca
 * sebagai klik.
 */
export function apakahKlik(xMousedown: number | null, xKlik: number): boolean {
  if (xMousedown === null) return true;
  return Math.abs(xKlik - xMousedown) <= AMBANG_GESER_KLIK;
}