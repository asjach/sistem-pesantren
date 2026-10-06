import { useEffect, type RefObject } from 'react';
import { toast } from 'sonner';
import { isTauri } from '@/api/client';
import { copyText, tulisPolosSinkron } from '@/lib/clipboard';
import type { GridSelection } from './types';

interface Props {
  /** Wadah grid (.simpes-dsg); pembatas apakah event berasal dari tabel ini. */
  wrapRef: RefObject<HTMLDivElement>;
  /** Blok sel terpilih (range DSG) — penentu "salin teks" vs "salin tabel". */
  rangeRef: RefObject<GridSelection | null>;
  /** TSV blok terpilih untuk praduga tulis sinkron. */
  teksSalinan: () => string | null;
  /** Tulis clipboard via plugin desktop. */
  salinFisik: () => Promise<boolean>;
}

/**
 * Shortcut Ctrl/Cmd+C: tulis clipboard ditangani DSG (tanpa notifikasi).
 * Listener ini (capture: jalan SEBELUM handler DSG) menjaga tiga kasus
 * tepi agar toast tak menipu + clipboard tak tertimpa string kosong:
 * 1. Fokus di input/teks (kolom cari, filter, dialog): biarkan salin
 *    native — tahan DSG yang tetap menimpa clipboard dari sel aktif lama.
 * 2. Teks diseleksi manual (seret mouse) pada satu sel: salin teksnya apa
 *    adanya — tahan DSG yang menyalin sel aktif/gutter.
 * 3. Sel aktif di gutter (centang/aksi/nomor baris) tanpa blok: DSG
 *    menyalin kosong — tahan + beri petunjuk. Blok multi-sel tetap milik DSG.
 *
 * Dipasang sekali (deps `[]`) persis seperti sebelumnya; ref membuat handler
 * tetap membaca seleksi terbaru.
 */
export function useSalinClipboard({ wrapRef, rangeRef, teksSalinan, salinFisik }: Props): void {
  useEffect(() => {
    function saatSalin(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        e.stopPropagation();
        return;
      }
      const root = wrapRef.current;
      if (!root || !(t && root.contains(t))) return;
      if (root.querySelector('.dsg-active-cell-focus')) return; // sedang mengedit sel
      // Desktop: clipboardData webview tak andal — tulis via plugin sebelum
      // DSG sempat menimpa clipboard (wajib preventDefault sinkron; tulis
      // async di bawah, clipboard lama aman bila tak ada yang tersalin).
      if (isTauri()) {
        const r = rangeRef.current;
        const blokBanyak = !!r && (r.min.col !== r.max.col || r.min.row !== r.max.row);
        const sel = window.getSelection();
        if (!blokBanyak && sel && !sel.isCollapsed && sel.anchorNode && root.contains(sel.anchorNode)) {
          const teks = sel.toString();
          if (teks !== '') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            tulisPolosSinkron(e, teks);
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.debug(`[simpes-salin] tabel teks: ${teks.length} aksara`);
            }
            void copyText(teks).then((ok) => {
              if (ok) toast.success('Telah disalin ke clipboard.');
              else toast.error('Gagal menyalin.');
            });
            return;
          }
        }
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        // Tulis sinkron agar clipboard langsung terisi teks polos meski
        // tulis async plugin terlambat; TANPA text/html agar tempel
        // ke Excel tetap memakai TSV (grid utuh, bukan satu kolom).
        const praduga = teksSalinan();
        if (praduga != null && praduga !== '') {
          try {
            e.clipboardData?.setData('text/plain', praduga);
          } catch {
            /* abaikan — tulis ulang via plugin di bawah */
          }
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.debug(`[simpes-salin] tabel TSV: ${praduga.length} aksara`);
          }
        }
        void salinFisik().then((ok) => {
          if (!ok) toast.warning('Pilih sel data untuk menyalin.');
        });
        return;
      }
      const r = rangeRef.current;
      const blokBanyak = !!r && (r.min.col !== r.max.col || r.min.row !== r.max.row);
      const sel = window.getSelection();
      if (!blokBanyak && sel && !sel.isCollapsed && sel.anchorNode && root.contains(sel.anchorNode)) {
        const teks = sel.toString();
        if (teks !== '') {
          e.preventDefault();
          e.stopPropagation();
          try {
            e.clipboardData?.setData('text/plain', teks);
          } catch {
            /* abaikan — copyText menangani fallback */
          }
          void copyText(teks).then((ok) => {
            if (ok) toast.success('Telah disalin ke clipboard.');
            else toast.error('Gagal menyalin.');
          });
          return;
        }
      }
      const selAktif = root.querySelector('.dsg-active-cell');
      if (!selAktif) return;
      if (!blokBanyak) {
        const kunciKolom = selAktif.closest?.('[data-col-key]')?.getAttribute('data-col-key');
        if (kunciKolom === 'check' || kunciKolom === '__aksi' || kunciKolom == null) {
          e.preventDefault();
          e.stopPropagation();
          toast.warning('Pilih sel data untuk menyalin.');
          return;
        }
      }
      toast.success('Telah disalin ke clipboard.');
    }
    document.addEventListener('copy', saatSalin, true);
    return () => document.removeEventListener('copy', saatSalin, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
