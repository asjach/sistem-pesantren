import { useEffect, useRef, type RefObject } from 'react';

/** Info blok yang dikirim ke halaman saat salin/tempel lewat papan ketik. */
export interface PeristiwaBlok {
  /** Blok sel yang jadi sasaran (indeks baris/kolom grid). */
  blok: { r0: number; r1: number; kolom: number[] };
  /** Kunci kolom grid urut indeks — penerjemah indeks → key. */
  kunciKolom: string[];
}

interface Props {
  /** Izin gestur: HANYA saat Mode Ubah menyala DAN fitur ini dipakai tabel. */
  aktif: boolean;
  /** Blok seleksi aktif (atau sel aktif tunggal); null = tak ada sasaran. */
  blokAktif: () => PeristiwaBlok['blok'] | null;
  /** Kunci kolom grid urut indeks (dibaca saat event, selalu terbaru). */
  kunciKolom: () => string[];
  /** Salin blok terpilih ke papan klip internal halaman. */
  onSalin: (p: PeristiwaBlok) => void;
  /** Tempel isi papan klip internal halaman ke blok sasaran. */
  onTempel: (p: PeristiwaBlok) => void;
}

/** Elemen yang punya salin/tempel bawaannya sendiri — jangan direbut. */
function sedangMengetik(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return el.tagName === 'INPUT'
    || el.tagName === 'TEXTAREA'
    || el.tagName === 'SELECT'
    || el.isContentEditable === true;
}

/**
 * Ctrl/Cmd+C dan Ctrl/Cmd+V untuk SALIN/TEMPEL BLOK SEL lewat papan klip
 * internal aplikasi — pelengkap seret isi sel, bukan penyalin TSV ke luar.
 *
 * Gerbangnya Mode Ubah: menyalin & menempel merusak data tabel, jadi tak boleh
 * kepicu dari tabel yang sedang dibaca. Saat tabel TIDAK memakai fitur ini
 * (`aktif` false), tak ada listener yang dipasang sama sekali sehingga
 * Ctrl+C tetap milik penyalin TSV (`useSalinClipboard`) dan tempel bawaan
 * DSG untuk kolom editable.
 *
 * Kenapa CAPTURE di document: penyalin TSV `useSalinClipboard` juga capture di
 * document; dengan `stopImmediatePropagation` di sini, Ctrl+C tidak pernah
 * sampai ke sana saat Mode Ubah menyala (juga mencegah event `copy` lahir,
 * karena `preventDefault` pada keydown menahannya di browser).
 *
 * `preventDefault` dipanggil SEBELUM `onSalin`/`onTempel` supaya Ctrl+C/V tak
 * bocor ke clipboard sistem; halaman yang memutuskan isi pesannya (mis. "belum
 * ada sel yang disalin"), jadi tak ada toast ganda dari sisi sini.
 */
export function useSalinTempelBlok(
  wrapRef: RefObject<HTMLDivElement>,
  {
    aktif,
    blokAktif,
    kunciKolom,
    onSalin,
    onTempel,
  }: Props,
): void {
  /** Cermin handler — listener dipasang sekali, isinya selalu terbaru. */
  const ref = useRef({ blokAktif, kunciKolom, onSalin, onTempel });
  ref.current = { blokAktif, kunciKolom, onSalin, onTempel };

  useEffect(() => {
    if (!aktif) return;

    function saatTombol(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const kunci = e.key?.toLowerCase();
      if (kunci !== 'c' && kunci !== 'v') return;

      if (sedangMengetik(e.target)) return;
      const root = wrapRef.current;
      if (!root) return;

      if (root.querySelector('.dsg-active-cell-focus')) return;

      const blok = ref.current.blokAktif();
      if (blok === null) return;

      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
      const p: PeristiwaBlok = { blok, kunciKolom: ref.current.kunciKolom() };

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      if (kunci === 'c') ref.current.onSalin(p);
      else ref.current.onTempel(p);
    }

    document.addEventListener('keydown', saatTombol, true);
    return () => document.removeEventListener('keydown', saatTombol, true);
  }, [aktif, wrapRef]);
}
