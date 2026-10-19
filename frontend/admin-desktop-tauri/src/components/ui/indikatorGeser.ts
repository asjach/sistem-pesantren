import { useLayoutEffect, useRef, useState } from 'react';

export interface GeometriIndikator {
  left: number; top: number; width: number; height: number;
}

/** Melacak anak berstatus aktif di dalam wadah dan mengembalikan
 *  geometrinya untuk indikator geser (dianimasikan lewat transisi CSS).
 *  `status` = nilai `data-state` yang dilacak (`active` untuk Tabs,
 *  `on` untuk ToggleGroup). Pengukuran ulang dipicu perubahan atribut,
 *  anak, ukuran wadah, ukuran jendela, dan font yang selesai dimuat. */
export function useIndikatorGeser<T extends HTMLElement>(status: 'active' | 'on'): {
  refWadah: React.MutableRefObject<T | null>;
  geometri: GeometriIndikator | null;
} {
  const refWadah = useRef<T | null>(null);
  const [geometri, setGeometri] = useState<GeometriIndikator | null>(null);

  useLayoutEffect(() => {
    const wadah = refWadah.current;
    if (wadah === null) return;
    const ukur = () => {
      const aktif = wadah.querySelector<HTMLElement>(`[data-state="${status}"]`);
      if (aktif === null) { setGeometri(null); return; }
      const g: GeometriIndikator = {
        left: aktif.offsetLeft, top: aktif.offsetTop,
        width: aktif.offsetWidth, height: aktif.offsetHeight,
      };
      setGeometri((lama) =>
        lama !== null && lama.left === g.left && lama.top === g.top
        && lama.width === g.width && lama.height === g.height ? lama : g);
    };
    ukur();
    const mo = new MutationObserver(ukur);
    mo.observe(wadah, {
      attributes: true, attributeFilter: ['data-state'], subtree: true, childList: true,
    });
    const ro = new ResizeObserver(ukur);
    ro.observe(wadah);
    window.addEventListener('resize', ukur);
    if (document.fonts !== undefined) void document.fonts.ready.then(() => ukur());
    return () => {
      mo.disconnect(); ro.disconnect(); window.removeEventListener('resize', ukur);
    };
  }, [status]);

  return { refWadah, geometri };
}
