import { ACTIONS_MIN_W, AUTOFIT_BUFFER, AUTOFIT_MAX_W } from './helpers';

/** Span pengukur teks (dibuat malas, dipakai bersama semua tabel). */
let probe: HTMLSpanElement | null = null;

/** Ukur lebar teks memakai span tersembunyi dengan SELURUH properti font
 *  nyata dari sel. Canvas tidak cukup: `font-variant-numeric: tabular-nums`
 *  (dipakai sel) tidak bisa direpresentasikan canvas sehingga hasilnya
 *  ~8px lebih sempit dan teks panjang (mis. email) jadi terpotong. */
export function measureTextWidth(text: string, cs: CSSStyleDeclaration): number {
  if (!probe) {
    probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'absolute';
    probe.style.left = '-10000px';
    probe.style.top = '0';
    probe.style.whiteSpace = 'pre';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);
  }
  probe.style.fontFamily = cs.fontFamily;
  probe.style.fontSize = cs.fontSize;
  probe.style.fontWeight = cs.fontWeight;
  probe.style.fontStyle = cs.fontStyle;
  probe.style.fontVariantNumeric = cs.fontVariantNumeric;
  probe.style.fontFeatureSettings = cs.fontFeatureSettings;
  probe.style.letterSpacing = cs.letterSpacing;
  probe.textContent = text;
  return probe.getBoundingClientRect().width;
}

/** Lepas span pengukur (dipakai saat tabel terakhir dilepas). */
export function bersihkanProbe() {
  probe?.remove();
  probe = null;
}

/** Lebar kolom Aksi diukur dari tombol yang benar-benar dirender — jumlah
 *  tombol bergantung role/baris sehingga tidak bisa dihitung dari data.
 *  Mengembalikan null bila kolom Aksi sedang tidak dirender (virtualisasi). */
export function measureActionsWidth(root: HTMLElement | null): number | null {
  if (!root) return null;
  let content = 0;
  let pad = 24;
  for (const box of Array.from(root.querySelectorAll<HTMLElement>('.simpes-dsg-actions'))) {
    const kids = Array.from(box.children) as HTMLElement[];
    if (kids.length === 0) continue;
    const first = kids[0].getBoundingClientRect();
    const last = kids[kids.length - 1].getBoundingClientRect();
    content = Math.max(content, last.right - first.left);
    const cell = box.closest<HTMLElement>('.dsg-cell');
    if (cell) {
      const cs = getComputedStyle(cell);
      pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    }
  }
  if (content <= 0) return null;
  return Math.min(AUTOFIT_MAX_W, Math.max(ACTIONS_MIN_W, Math.ceil(content) + pad + AUTOFIT_BUFFER));
}
