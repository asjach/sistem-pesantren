import { useEffect, useRef } from 'react';

/** Cocokkan huruf pintasan tanpa peduli besar-kecil. */
function tombol(kunci: string): string {
  return kunci.toLowerCase();
}

/** Elemen yang sedang menerima ketikan: input, textarea, select, atau editor
 *  kaya (contenteditable). Pintasan papan-ketik TIDAK boleh menyergapnya. */
export function sedangMengetik(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Label pintasan untuk DITAMPILKAN di tombol: "⌘N" di macOS, "Ctrl+N" di
 *  Windows/Linux. Dipakai bareng `usePintasanBaru` agar chip di tombol selalu
 *  cocok dengan tombol yang benar-benar ditangkap handler di bawah. */
export function labelPintasan(kunci: string): string {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
  return `${mac ? '⌘' : 'Ctrl+'}${kunci.toUpperCase()}`;
}

export interface PintasanBaruProps {
  /** Kunci utama pintasan, mis. 'n'. Dibaca case-insensitive. */
  kunci: string;
  /** Aktifkan pintasan ini (mis. hanya bila pengguna berhak menambah). */
  aktif: boolean;
  /** Dijalankan saat pintasan terpicu (sudah `preventDefault`). */
  onPicu: () => void;
  /** Blokir saat overlay (dialog/dropdown/palet) sedang terbuka — pemanggil
   *  biasanya mengoper penanda seperti `tambahOpen`. */
  terhalang?: boolean;
}

/**
 * Pintasan Ctrl/Cmd + <kunci> untuk aksi utama halaman (mis. "+ Entri").
 *
 * Perilaku yang dijaga:
 * - **Fokus di kolom isian** → diabaikan, kecuali di dalam grid Excel-table
 *   (`.simpes-dsg`), tempat sel aktif bukan kolom ketik. Tanpa aturan ini,
 *   Ctrl/Cmd+N di kolom cari ikut membuka dialog.
 * - **Overlay terbuka** (`[role="dialog"]/[role="menu"]/[role="listbox"]`,
 *   mis. palet perintah Ctrl/Cmd+K) → diabaikan agar dialognya tidak
 *   bertumpuk.
 * - `aktif === false` atau `terhalang === true` → diabaikan.
 *
 * Handler menempel di `window` (bukan `document` capture) supaya berjalan
 * setelah handler editor/grid yang lebih spesifik, dan membaca properti
 * terbaru lewat ref agar tak perlu dipasang ulang tiap render.
 */
export function usePintasanBaru({ kunci, aktif, onPicu, terhalang = false }: PintasanBaruProps): void {
  const picuRef = useRef(onPicu);
  picuRef.current = onPicu;
  const aktifRef = useRef(aktif);
  aktifRef.current = aktif;
  const terhalangRef = useRef(terhalang);
  terhalangRef.current = terhalang;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!aktifRef.current || terhalangRef.current) return;
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== tombol(kunci)) return;
      const t = e.target as HTMLElement | null;
      if (sedangMengetik(t) && !t?.closest?.('.simpes-dsg')) return;
      if (t?.closest?.('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      e.preventDefault();
      picuRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kunci]);
}
