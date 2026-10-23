import { toSvg } from 'html-to-image';
import { BATAS_GAMBAR, type GambarAnotasi } from './anotasiData';

export interface DraftScreenshot {
  blob: Blob;
  metadata: Omit<GambarAnotasi, 'berkas'>;
}

type Kotak = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>;

async function batasiWaktu<T>(proses: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([proses, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Screenshot terlalu lama diproses. Coba area yang lebih kecil.')), 20_000);
    })]);
  } finally { clearTimeout(timer!); }
}

/** Clip ke viewport dan scroll container, bukan sekadar bounding box elemen. */
export function areaTerlihat(elemen: Element): Kotak {
  const rect = elemen.getBoundingClientRect();
  let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
  let right = Math.min(window.innerWidth, rect.right), bottom = Math.min(window.innerHeight, rect.bottom);
  for (let parent = elemen.parentElement; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent);
    const box = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
    if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
  }
  if (!elemen.isConnected || right <= left || bottom <= top) throw new Error('Asal dan tujuan harus terlihat. Atur scroll, lalu coba lagi.');
  return { left, top, right, bottom };
}

export function batasScreenshot(kotak: Kotak[]) {
  const left = Math.max(0, Math.floor(Math.min(...kotak.map((r) => r.left)) - 24));
  const top = Math.max(0, Math.floor(Math.min(...kotak.map((r) => r.top)) - 24));
  const right = Math.min(window.innerWidth, Math.ceil(Math.max(...kotak.map((r) => r.right)) + 24));
  const bottom = Math.min(window.innerHeight, Math.ceil(Math.max(...kotak.map((r) => r.bottom)) + 24));
  return { left, top, width: right - left, height: bottom - top };
}

export function sertakanDalamScreenshot(node: HTMLElement) {
  return !node.closest?.('[data-anotasi-abaikan]');
}

let renderAktif = false;

/** Hindari dua operasi memakai atribut clone sementara secara bersamaan. */
export async function renderViewport(): Promise<HTMLImageElement> {
  if (renderAktif) throw new Error('Screenshot sebelumnya masih diproses. Tunggu sebentar lalu coba lagi.');
  renderAktif = true;
  try { return await renderViewportSekali(); }
  finally { renderAktif = false; }
}

/** SVG tidak menyimpan scrollTop. Koreksi hanya clone, tanpa menggeser UI asli. */
async function renderViewportSekali(): Promise<HTMLImageElement> {
  const atribut = 'data-anotasi_capture_scroll';
  const scroll: { elemen: Element; lama: string | null; x: number; y: number }[] = [];
  for (const elemen of [document.documentElement, ...Array.from(document.body.querySelectorAll('*'))]) {
    if (!sertakanDalamScreenshot(elemen as HTMLElement)) continue;
    const x = elemen === document.documentElement ? window.scrollX : elemen.scrollLeft;
    const y = elemen === document.documentElement ? window.scrollY : elemen.scrollTop;
    if (!x && !y) continue;
    scroll.push({ elemen, lama: elemen.getAttribute(atribut), x, y });
    elemen.setAttribute(atribut, String(scroll.length - 1));
  }
  let svg: string;
  try {
    svg = await batasiWaktu(toSvg(document.documentElement, {
      width: window.innerWidth, height: window.innerHeight,
      preferredFontFormat: 'woff2', filter: sertakanDalamScreenshot,
    }));
  } finally {
    for (const { elemen, lama } of scroll) {
      if (lama === null) elemen.removeAttribute(atribut);
      else elemen.setAttribute(atribut, lama);
    }
  }
  const clone = new DOMParser().parseFromString(decodeURIComponent(svg.slice(svg.indexOf(',') + 1)), 'image/svg+xml');
  if (clone.querySelector('parsererror')) throw new Error('Render halaman tidak dapat dibuat menjadi gambar.');
  for (const [index, { x, y }] of scroll.entries()) {
    const container = clone.querySelector(`[${atribut}="${index}"]`);
    if (!container) continue;
    // Komposisi transform mempertahankan translate asli dan layout flex/grid.
    for (const child of Array.from(container.children)) {
      const style = (child as HTMLElement | SVGElement).style;
      if (style && child.localName !== 'style') {
        const awal = style.getPropertyValue('transform');
        style.setProperty('transform', `translate(${-x}px, ${-y}px)${awal && awal !== 'none' ? ` ${awal}` : ''}`);
      }
    }
    container.removeAttribute(atribut);
  }
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  return batasiWaktu(new Promise((resolve, reject) => {
    const gambar = new Image();
    gambar.onload = () => resolve(gambar);
    gambar.onerror = () => reject(new Error('Browser tidak dapat merender screenshot halaman ini.'));
    gambar.src = url;
  }));
}

export async function ambilScreenshot(asal: Element, tujuan: Element | null, previewAktif: boolean): Promise<DraftScreenshot> {
  if (window.innerWidth > 4096 || window.innerHeight > 4064) throw new Error('Ukuran area terlalu besar. Perkecil window lalu coba lagi.');
  const kotak = [areaTerlihat(asal), ...(tujuan ? [areaTerlihat(tujuan)] : [])];
  const area = batasScreenshot(kotak);
  // Seluruh UI anotasi dikecualikan oleh filter; tidak perlu menutup dialog produk.
  const gambar = await renderViewport();
  const canvas = document.createElement('canvas');
  canvas.width = area.width;
  canvas.height = area.height + 28;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pembuatan screenshot.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(gambar, area.left, area.top, area.width, area.height, 0, 28, area.width, area.height);
  ctx.fillStyle = '#0f172a';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Asal: biru${tujuan ? ' · Tujuan: jingga' : ''}${previewAktif ? ' · Preview aktif' : ''}`, 6, 18, Math.max(1, canvas.width - 12));
  kotak.forEach((box, index) => {
    const x = box.left - area.left, y = box.top - area.top + 28;
    ctx.strokeStyle = index ? '#b45309' : '#2563eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, Math.max(0, box.right - box.left - 2), Math.max(0, box.bottom - box.top - 2));
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillRect(x, y, 50, 17);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(index ? 'Tujuan' : 'Asal', x + 3, y + 12);
  });
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Screenshot gagal dibuat.')), 'image/png'));
  if (blob.size > BATAS_GAMBAR) throw new Error('Screenshot melebihi batas 8 MB. Perkecil area lalu coba lagi.');
  return { blob, metadata: { lebar: canvas.width, tinggi: canvas.height, dibuat: new Date().toISOString(), preview_aktif: previewAktif } };
}
