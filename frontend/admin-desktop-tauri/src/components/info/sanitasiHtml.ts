/**
 * Sanitasi HTML info tabel — cermin aturan `App\Support\HtmlInfo` (backend).
 *
 * Isi info diketik di editor browser, disimpan di `toolbar_preset`, lalu
 * dirender sebagai HTML di bilah judul SETIAP tabel. Backend sudah menyaringnya
 * dengan allowlist ketat sebelum menyentuh DB, jadi sanitizer di sini adalah
 * lapisan kedua: ia melindungi peramban bila respons server ternyata berbeda
 * (proxy, cache, skema lama, atau backend yang belum punya `HtmlInfo`).
 *
 * Aturannya SAMA PERSIS dengan backend — kalau satu sisi melonggarkan, sisi
 * lain tak akan menutup celahnya:
 *  - tag/atribut di luar daftar dibuang total (allowlist, bukan blocklist),
 *  - `a[href]` hanya http/https/mailto — `javascript:` & `data:` ditolak,
 *  - `img[src]` hanya `data:image/{png,jpeg,webp,gif};base64,…` atau http/https;
 *    SVG ditolak karena bisa membawa skrip,
 *  - tanpa `style`/`class`/`id` dan tanpa seluruh `on*`.
 */

/** Batas panjang HTML info — cermin `App\Support\HtmlInfo::PANJANG_MAKS`.
 *  Base64 gambar penyumbang terbesar; editor menolak gambar yang membuat
 *  isi melewati batas ini sebelum menyisipkannya. */
export const PANJANG_HTML_MAKS = 1_500_000;

const TAG_BOLEH = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'a', 'img',
  'div', 'span', 'hr',
]);

const ATRIBUT_BOLEH: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
};

const SKEMA_HREF = new Set(['http', 'https', 'mailto']);

const TIPE_GAMBAR = /^image\/(png|jpeg|jpg|webp|gif)$/i;

/** Karakter tak boleh muncul di teks polos (tag tak bisa di-parse dari sana). */
const POLA_BUANG_NYAWA = /[<>&\u0000-\u001F]/;

/** Karakter kontrol + spasi: tak sah di dalam URL. */
const POLA_KONTROL_URL = /[\u0000-\u0020\u007F]/;

function skema(nilai: string): string {
  const p = nilai.indexOf(':');
  return p === -1 ? '' : nilai.slice(0, p).toLowerCase();
}

/** `data:image/png;base64,…` yang benar-benar base64 (bukan svg menyamar). */
function dataGambarValid(nilai: string): boolean {
  const cocok = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)[;,]/i.exec(nilai);
  if (cocok === null || !TIPE_GAMBAR.test(cocok[1])) return false;
  return /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]+={0,2}$/i.test(nilai);
}

function nilaiAman(tag: string, atribut: string, nilai: string): boolean {
  const v = nilai.trim();
  if (v === '') return false;

  const adalahUrl = (tag === 'img' && atribut === 'src') || (tag === 'a' && atribut === 'href');

  if (adalahUrl && POLA_KONTROL_URL.test(v)) return false;

  if (tag === 'img' && atribut === 'src') {
    return v.toLowerCase().startsWith('data:')
      ? dataGambarValid(v)
      : ['http', 'https'].includes(skema(v));
  }
  if (tag === 'a' && atribut === 'href') return SKEMA_HREF.has(skema(v));
  if (tag === 'img' && (atribut === 'width' || atribut === 'height')) return /^\d{1,4}$/.test(v);

  return !POLA_BUANG_NYAWA.test(v);
}

/** Bersihkan HTML info. String kosong/sel kosong -> `''` (tak ada isi). */
export function sanitasiHtml(html: string): string {
  if (html.trim() === '') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const badan = doc.body;

  const semua = Array.from(badan.querySelectorAll('*'));
  for (const el of semua) {
    const tag = el.tagName.toLowerCase();
    if (!TAG_BOLEH.has(tag)) continue;
    const boleh = ATRIBUT_BOLEH[tag] ?? new Set<string>();
    for (const at of Array.from(el.attributes)) {
      const nama = at.name.toLowerCase();
      if (!boleh.has(nama) || !nilaiAman(tag, nama, at.value)) el.removeAttribute(at.name);
    }
    if (tag === 'a') {

      el.setAttribute('rel', 'noopener noreferrer nofollow');
      if (el.hasAttribute('target')) el.setAttribute('target', '_blank');
    }
  }

  for (const el of semua) {
    if (!TAG_BOLEH.has(el.tagName.toLowerCase())) el.remove();
  }

  return badan.innerHTML;
}

/**
 * True bila HTML punya ISI yang bisa dilihat: teks, atau sekurang-kurangnya
 * satu gambar. `<p></p>` tidak — mengembalikannya "terisi" membuat tombol Info
 * muncul dengan kartu hover yang hampa.
 */
export function htmlAdaIsi(html: string | null | undefined): boolean {
  if (html == null || html.trim() === '') return false;
  if (/<img[\s>]/i.test(html)) return true;
  return sanitasiHtml(html).replace(/<[^>]*>/g, '').trim() !== '';
}
