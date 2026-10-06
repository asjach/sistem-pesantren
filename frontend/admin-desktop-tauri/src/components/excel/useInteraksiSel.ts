import { useRef, type Dispatch, type MouseEvent, type MutableRefObject, type RefObject, type SetStateAction } from 'react';

interface Props<T extends { id: string | number }> {
  hideCheckbox: boolean;
  /** Wadah grid (.simpes-dsg). */
  wrapRef: RefObject<HTMLDivElement>;
  /** Baris domain aktif (untuk memetakan id centang). */
  rowsRef: MutableRefObject<T[]>;
  /** Mode Edit aktif. */
  editing: boolean;
  /** Mode Input aktif (baris input ikut diperiksa). */
  showInput: boolean;
  setCheckedIds: Dispatch<SetStateAction<Set<T['id']>>>;
}

/**
 * Interaksi sel grid: mencegah drag-seleksi dimulai dari sel centang,
 * toggle centang sekali klik, dan menutup editor lama saat pindah sel.
 * Semua handler stabil secara perilaku (dibuat per render, sama seperti
 * sebelumnya) dan hanya membaca ref.
 */
export function useInteraksiSel<T extends { id: string | number }>({
  hideCheckbox,
  wrapRef,
  rowsRef,
  editing,
  showInput,
  setCheckedIds,
}: Props<T>) {
  /** Posisi mousedown terakhir: klik setelah drag-seleksi bukan maksud mencentang. */
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  /** Mousedown di sel centang (termasuk tepat di kotak) = niat mencentang,
   *  bukan menyeleksi: cegah DSG memasang anchor/drag-seleksi dari sel ini.
   *  Toggle tetap jalan sekali via onClick di bawah (mousedown asli yang
   *  diblokir tak sampai ke input, jadi tak ada toggle ganda). Klik kanan &
   *  kontrol lain dikecualikan agar menu konteks tetap bekerja. */
  function cegahSeleksiSelCentang(e: MouseEvent): void {
    if (hideCheckbox || e.button !== 0) return;
    const t = e.target as HTMLElement | null;
    if (!t || t.closest?.('select, textarea, button, a')) return;
    const sel = t.closest?.('.dsg-cell');
    if (!sel || !wrapRef.current?.contains(sel)) return;
    const box = sel.querySelector('input.dsg-checkbox, input.simpes-dsg-checkall');
    if (!box || (box as HTMLInputElement).disabled) return;
    e.preventDefault();
    e.stopPropagation();
  }

  /** Klik sel centang (area maupun tepat di kotak): toggle 1× via `checkedIds`
   *  sendiri memakai `data-row-id` — deterministik, tanpa lewat DSG (jalur
   *  bawaannya butuh 2× klik dan berbalapan dengan flip browser). Header
   *  pilih-semua memakai jalur `onChange`-nya sendiri. Baris nonaktif dan
   *  hasil drag (>4px) dilewati. */
  function toggleCheckByCell(e: MouseEvent): void {
    if (hideCheckbox) return;
    const d = downPosRef.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
    const t = e.target as HTMLElement | null;
    if (!t || t.closest?.('select, textarea, button, a')) return;
    const sel = t.closest?.('.dsg-cell');
    if (!sel || !wrapRef.current?.contains(sel)) return;
    const box = sel.querySelector<HTMLInputElement>('input.dsg-checkbox, input.simpes-dsg-checkall');
    if (!box || box.disabled) return;
    if (box.classList.contains('simpes-dsg-checkall')) {
      // Header pilih-semua: biarkan onChange alaminya yang bekerja. Klik
      // sintetis di sini justru men-toggle balik (true→false) sebelum change
      // terbaca, sehingga check/uncheck-all tampak tidak berfungsi.
      return;
    }
    const rowId = box.dataset.rowId;
    const row = rowsRef.current.find((r) => String(r.id) === rowId);
    if (!row) return;
    const id = row.id;
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Klik/pindah ke sel lain saat ada editor terbuka: tutup dulu editor lama
   *  (memicu commit + auto-save), lalu DSG memindahkan sel aktif. Tanpa ini
   *  input lama tetap fokus sehingga ketikan lanjut masuk ke sel sebelumnya. */
  function closeEditorOnOtherCell(e: MouseEvent): void {
    if (!editing && !showInput) return;
    const aktif = document.activeElement as HTMLElement | null;
    if (!aktif || !(aktif.classList.contains('dsg-input') || aktif.classList.contains('simpes-dsg-select'))) {
      return;
    }
    const targetCell = (e.target as HTMLElement).closest?.('.dsg-cell') ?? null;
    if (targetCell && targetCell === aktif.closest('.dsg-cell')) return;
    aktif.blur();
  }

  return { downPosRef, cegahSeleksiSelCentang, toggleCheckByCell, closeEditorOnOtherCell };
}
