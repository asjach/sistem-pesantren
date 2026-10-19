import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  beririsan,
  geserBlok,
  jepitBlok,
  kolomData,
  samaBlok,
  type BlokIsi,
  type ModeSeret,
} from './seretIsiSel';
import type { GridSelection } from './types';

/** Kelas DOM untuk umpan balik seret isi (dipasang langsung ke sel). */
const KELAS_SUMBER = 'simpes-dsg-seret-sumber';
const KELAS_TUJUAN = 'simpes-dsg-seret-tujuan';
const KELAS_BERGERAK = 'simpes-dsg-seret-isi';
const KELAS_PINDAH = 'simpes-dsg-seret-pindah';

/**
 * Ambang px sebelum seret dianggap serius — mencegah klik biasa ikut jadi
 * seret karena tangan bergetar. Sama nilainya dengan `AMBANG_SERET_PX` di
 * `useSeretKolomHeader`.
 */
const AMBANG_SERET_PX = 5;

/** Data yang dibutuhkan listener seret, dibaca saat gesture berjalan. */
export interface SumberSeretIsi {
  /** DAFTAR kunci kolom grid urut indeks (tanpa kolom gutter DSG). */
  kunciKolom: string[];
  /** Jumlah baris data grid. */
  jumlahBaris: number;
  /** Seleksi blok aktif; null = belum ada seleksi apa pun. */
  seleksi: GridSelection | null;
}

export interface SyaratSeretIsi {
  /** Izin gestur. Saat mati TIDAK ADA listener sama sekali, jadi perilaku
   *  klik lama (memilih sel, menyeret blok) tetap persis. */
  aktif: boolean;
  /** Gestur yang berlaku: 'salin' atau 'pindah'. `null` = tak ada seret isi
   *  sel yang diizinkan (sakelarnya belum dinyalakan). `aktif` true
   *  menjamin `mode` bukan null — pemanggil yang menjaga keduanya. */
  mode: ModeSeret | null;
  /** TRUE bila tabel boleh menulis (ada kolom editable + `canEdit`). */
  bisaTulis: boolean;
  /** Terapkan hasil seret. */
  onTerapkan: (sumber: BlokIsi, target: BlokIsi, mode: ModeSeret) => void;
}

/** Kandidat seret yang sedang diuji (belum melewati ambang gerak). */
interface Kandidat {
  x0: number;
  y0: number;
  sumber: BlokIsi;
  /** Sel yang dipegang kursor saat ditekan — penentu arah geser. */
  genggam: { row: number; kolom: number };
  mode: ModeSeret;
}

/** Badge "Salin"/"Pindahkan" hidup di `document.body`, bukan di dalam wadah
 *  grid: React mengelola anak-anaknya sendiri, dan simpul asing yang
 *  disisipkan ke dalam pohon itu bisa membuat rekonsiliasi salah sasaran. */
const KELAS_BADGE = 'simpes-dsg-seret-badge';

/**
 * Buang semua jejak visual seret dari DOM. Aman dipanggil kapan pun, termasuk
 * saat tak ada seret: hanya menyapu kelas milik fitur ini.
 */
export function bersihkanSeretIsi(wrap: HTMLElement | null): void {
  wrap?.classList.remove(KELAS_BERGERAK, KELAS_PINDAH);
  wrap?.querySelectorAll<HTMLElement>(`.${KELAS_SUMBER}, .${KELAS_TUJUAN}`)
    .forEach((el) => el.classList.remove(KELAS_SUMBER, KELAS_TUJUAN));
  if (typeof document !== 'undefined') {
    document.querySelector(`.${KELAS_BADGE}`)?.remove();
  }
}

/**
 * Seret ISI SEL: tekan-tahan blok terpilih lalu geser ke sel lain.
 *
 * CARA gesturnya satu saja untuk copy maupun move — yang membedakan cuma
 * akibat akhirnya, dan itu ditentukan `SyaratSeretIsi.mode` (sakelar aktif
 * di bilah Mode Ubah), bukan modifier keyboard. Jadi Ctrl/Cmd tak dipakai
 * lagi, dan `Ctrl+klik` sepenuhnya milik DSG (menu konteks,
 * `DataSheetGrid.js:644`).
 *
 * Sumber selalu blok seleksi yang sedang aktif (satu blok utuh; tak ada mode
 * "seret-mengisi" terpisah). Tekan di luar blok berarti pengguna sedang
 * memilih rentang baru — itu wewenang DSG, jadi event-nya dibiarkan lewat.
 *
 * PENTING — kenapa listener NATIVE fase CAPTURE, bukan prop React:
 * react-datasheet-grid memasang listener `mousedown` di level DOKUMEN yang
 * memanggil `preventDefault()` dan memulai mode seleksi. Handler React di
 * dalam grid tak pernah sampai ke sana, sedangkan capture pada wadah berjalan
 * lebih dulu — jadi kita sempat membaca seleksi yang masih utuh dan, kalau
 * gesture ini yang dipakai, menghentikan event agar drag-pilih blok DSG tak
 * ikut jalan.
 *
 * Selama seret, listener `pointermove/up` dipasang di `window` (bukan elemen)
 * agar kursor yang keluar area tabel tak memutus seret. `pointercancel`,
 * `blur`, dan Escape ikut membersihkan supaya tak ada seret "hantu".
 */
export function useSeretIsiSel(
  wrapRef: React.RefObject<HTMLDivElement>,
  syarat: SyaratSeretIsi,
  sumber: SumberSeretIsi,
) {
  /** Cermin syarat — listener dipasang sekali, isinya selalu terbaru. */
  const syaratRef = useRef(syarat);
  syaratRef.current = syarat;
  /** Cermin sumber (kunci kolom, jumlah baris, seleksi). */
  const sumberRef = useRef(sumber);
  sumberRef.current = sumber;
  /** Bersihkan listener seret yang sedang berjalan. */
  const bersihRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !syarat.aktif) return;

    /** Sel grid di bawah titik kursor; null bila tak ada (di luar tabel). */
    const selDiTitik = (x: number, y: number): { row: number; kolom: number } | null => {

      const titik = typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(x, y)
        : [];
      for (const el of titik) {
        const sel = el.closest?.('.dsg-cell') as HTMLElement | null;
        if (!sel) continue;
        const baris = sel.closest('.dsg-row:not(.dsg-row-header)') as HTMLElement | null;
        if (!baris) continue;
        const key = el.closest?.('[data-col-key]')?.getAttribute('data-col-key')
          ?? sel.querySelector('[data-col-key]')?.getAttribute('data-col-key')
          ?? null;
        if (key === null) continue;

        const nomor = Number.parseInt(baris.querySelector('.dsg-cell-gutter')?.textContent ?? '', 10);
        if (!Number.isFinite(nomor)) continue;
        const kolom = sumberRef.current.kunciKolom.indexOf(key);
        if (kolom < 0) continue;
        return { row: nomor - 1, kolom };
      }
      return null;
    };

    /** Tandai sel-sel sebuah blok dengan kelas (langsung ke DOM, bukan lewat
     *  React — DSG merender sel di `useMemo` yang tak dihitung ulang saat
     *  state seret berubah, jadi kelas dari prop tak pernah sampai ke DOM).
     *
     *  Sel dicari lewat `data-col-key`, BUKAN lewat indeks anak baris: DSG
     *  memvirtualisasi kolom mendatar, sehingga anak baris hanya memuat
     *  potongan kolom yang terlihat. Indeks anak jadi tak lagi sama dengan
     *  indeks kolom grid begitu tabel digulir ke samping. */
    const tandai = (blok: BlokIsi | null, kelas: string): void => {
      wrap.querySelectorAll<HTMLElement>(`.${kelas}`).forEach((el) => el.classList.remove(kelas));
      if (!blok) return;
      const kunci = new Set(blok.kolom.map((c) => sumberRef.current.kunciKolom[c]).filter(Boolean));
      wrap.querySelectorAll<HTMLElement>('.dsg-row:not(.dsg-row-header)').forEach((baris) => {
        const nomor = Number.parseInt(baris.querySelector('.dsg-cell-gutter')?.textContent ?? '', 10);
        const r = nomor - 1;
        if (!Number.isFinite(nomor) || r < blok.r0 || r > blok.r1) return;
        baris.querySelectorAll<HTMLElement>('[data-col-key]').forEach((isi) => {
          if (!kunci.has(isi.getAttribute('data-col-key') ?? '')) return;
          (isi.closest('.dsg-cell') as HTMLElement | null)?.classList.add(kelas);
        });
      });
    };

    /** Badge kecil yang mengikuti kursor: "Salin" atau "Pindahkan". */
    const gambarBadge = (x: number, y: number, mode: ModeSeret): void => {
      if (typeof document === 'undefined') return;
      let el = document.querySelector<HTMLElement>(`.${KELAS_BADGE}`);
      if (!el) {
        el = document.createElement('div');
        el.className = KELAS_BADGE;
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
      }
      el.textContent = mode === 'pindah' ? 'Pindahkan' : 'Salin';
      el.dataset.mode = mode;
      el.style.transform = `translate(${x + 12}px, ${y + 18}px)`;
    };

    /** Kursor dibedakan per mode lewat kelas pada wadah grid. */
    const gambarMode = (mode: ModeSeret): void => {
      wrap.classList.toggle(KELAS_PINDAH, mode === 'pindah');
    };

    /** Susun kandidat dari titik tekan; null bila tak layak jadi seret. */
    const dariTitik = (e: MouseEvent): Kandidat | null => {
      const s = syaratRef.current;
      const sum = sumberRef.current;
      if (!s.aktif || s.mode === null || !s.bisaTulis) return null;
      if (sum.jumlahBaris <= 0 || sum.seleksi === null) return null;
      const target = e.target as HTMLElement | null;

      if (target?.closest('.simpes-dsg-resizer')) return null;

      if (target?.closest('input, textarea, select, button, a')) return null;
      const key = target?.closest('[data-col-key]')?.getAttribute('data-col-key') ?? null;
      if (key === null) return null;
      if (key === 'check' || key === '__aksi') return null;

      const jangkar = selDiTitik(e.clientX, e.clientY);
      if (jangkar === null) return null;

      const sel = sum.seleksi;
      const kolom = kolomData(sum.kunciKolom, sel.min.col, sel.max.col);
      if (kolom.length === 0) return null;
      const blok: BlokIsi = {
        r0: Math.max(0, Math.min(sel.min.row, sel.max.row)),
        r1: Math.max(0, Math.max(sel.min.row, sel.max.row)),
        kolom,
      };

      if (jangkar.row < blok.r0 || jangkar.row > blok.r1 || !blok.kolom.includes(jangkar.kolom)) {
        return null;
      }

      return { x0: e.clientX, y0: e.clientY, sumber: blok, genggam: jangkar, mode: s.mode };
    };

    const mulaiSeret = (k: Kandidat) => {
      let jalan = false;
      let target: BlokIsi | null = null;

      const geser = (e: { clientX: number; clientY: number; preventDefault(): void }) => {
        if (!jalan) {
          if (Math.abs(e.clientX - k.x0) < AMBANG_SERET_PX
            && Math.abs(e.clientY - k.y0) < AMBANG_SERET_PX) return;
          jalan = true;
          wrap.classList.add(KELAS_BERGERAK);
          tandai(k.sumber, KELAS_SUMBER);
        }
        gambarBadge(e.clientX, e.clientY, k.mode);
        gambarMode(k.mode);
        const sum = sumberRef.current;
        const jangkar = selDiTitik(e.clientX, e.clientY);
        const baru = jangkar === null
          ? null
          : jepitBlok(geserBlok(k.sumber, k.genggam, jangkar), sum.kunciKolom, sum.jumlahBaris);
        if (baru === null || target === null || !samaBlok(baru, target)) {
          target = baru;
          tandai(baru, KELAS_TUJUAN);
        }
        e.preventDefault();
      };

      const lepas = () => {
        bersih();
        bersihkanSeretIsi(wrap);
        if (!jalan) return;
        const t = target;
        if (t === null || samaBlok(t, k.sumber)) return;

        if (k.mode === 'pindah' && beririsan(t, k.sumber)) {
          toast.error('Blok tak bisa dipindahkan ke dalam dirinya sendiri.');
          return;
        }
        syaratRef.current.onTerapkan(k.sumber, t, k.mode);
      };

      /** Batal tanpa menulis apa pun (Escape, pointercancel, blur). */
      const batal = () => {
        bersih();
        bersihkanSeretIsi(wrap);
      };

      function bersih() {
        window.removeEventListener('pointermove', geser, true);
        window.removeEventListener('pointerup', lepas, true);
        window.removeEventListener('mousemove', geserMouse, true);
        window.removeEventListener('mouseup', lepasMouse, true);
        window.removeEventListener('pointercancel', batal, true);
        window.removeEventListener('blur', batal);
        window.removeEventListener('keydown', tombol, true);
        bersihRef.current = null;
      }

      let terakhir = 0;
      const sekaliPerGerak = <T,>(fn: (e: T) => void) => (e: T & { timeStamp: number }) => {
        const t = e.timeStamp || Date.now();
        if (t === terakhir) return;
        terakhir = t;
        fn(e);
      };
      const geserMouse = sekaliPerGerak(geser);
      const lepasMouse = sekaliPerGerak(lepas);

      const tombol = (e: KeyboardEvent) => {
        if (e.key === 'Escape') batal();
      };

      bersihRef.current?.();
      bersihRef.current = bersih;
      window.addEventListener('pointermove', geser, true);
      window.addEventListener('pointerup', lepas, true);
      window.addEventListener('mousemove', geserMouse, true);
      window.addEventListener('mouseup', lepasMouse, true);
      window.addEventListener('pointercancel', batal, true);
      window.addEventListener('blur', batal);
      window.addEventListener('keydown', tombol, true);
    };

    const tekan = (e: MouseEvent) => {

      if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
      const k = dariTitik(e);
      if (k === null) return;

      e.preventDefault();
      e.stopPropagation();
      mulaiSeret(k);
    };

    wrap.addEventListener('mousedown', tekan, true);
    return () => {
      wrap.removeEventListener('mousedown', tekan, true);
      bersihRef.current?.();
      bersihRef.current = null;
      bersihkanSeretIsi(wrap);
    };
  }, [syarat.aktif, syarat.mode, syarat.bisaTulis, wrapRef]);

  useEffect(() => () => {
    bersihRef.current?.();
    bersihkanSeretIsi(wrapRef.current);
  }, [wrapRef]);
}
