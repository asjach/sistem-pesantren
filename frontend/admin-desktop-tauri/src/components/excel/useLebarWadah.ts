import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Lebar EFEKTIF area gulir tabel (px) — dasar fitur "lebar mengisi wadah".
 *
 * Yang diukur adalah `.dsg-container` (kotak isi scroller DSG), bukan pembungkus
 * luar, karena `clientWidth` scroller SUDAH memotong lebar scrollbar vertikal
 * bila ada. Memakai lebar pembungkus akan membuat tabel lebih lebar beberapa
 * piksel dari area yang bisa dilihat → gulir horizontal muncul sendiri padahal
 * tabel baru saja dipas-kan ke wadahnya.
 *
 * Catatan tema: `index.css` menyembunyikan scrollbar DSG
 * (`.dsg-container::-webkit-scrollbar { width: 0 }`) dan memakai scrollbar
 * melayang, jadi selisihnya biasanya 0 — pengukuran ini tetap benar bila
 * scrollbar native muncul lagi (mis. di Windows, atau bila CSS itu diubah).
 *
 * Observer dipasang ulang saat node scroller BERGANTI (DSG me-remount grid
 * ketika tanda tinggi baris berubah), dan ResizeObserver pada node itu menangkap
 * perubahan kotak isi — termasuk saat scrollbar vertikal muncul/hilang akibat
 * jumlah baris berubah. `0` = belum terukur; pemanggil memakai lebar basis.
 */
export function useLebarWadah(
  wrapRef: RefObject<HTMLElement | null>,
  aktif: boolean,
): number {
  const [lebar, setLebar] = useState(0);

  useLayoutEffect(() => {
    if (!aktif) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    let node: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    const lepas = () => {
      ro?.disconnect();
      ro = null;
      node = null;
    };
    const pasang = () => {
      const target = wrap.querySelector<HTMLElement>('.dsg-container') ?? wrap;
      if (target === node) return;
      lepas();
      node = target;
      const ukur = () => setLebar(target.clientWidth);
      ukur();
      if (typeof ResizeObserver === 'undefined') return;
      ro = new ResizeObserver(ukur);
      ro.observe(target);
    };

    pasang();
    if (typeof MutationObserver === 'undefined') return lepas;
    // Scroller DSG diganti saat grid di-remount → observer lama mati bersama
    // node lama, jadi pasang ulang pada node yang sekarang.
    const mo = new MutationObserver(pasang);
    mo.observe(wrap, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      lepas();
    };
  }, [aktif, wrapRef]);

  return aktif ? lebar : 0;
}
