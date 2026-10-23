/** Padding horizontal pembungkus judul `.simpes-dsg-v2-headtitle` (8px kiri
 *  + 8px kanan) yang TIDAK terbaca dari sel header (sel header `padding: 0`).
 *  Wajib ikut dihitung AutoFit/lebar awal kolom — kalau tidak, kolom yang
 *  lebarnya ditentukan judul meleset ~8px dan huruf terakhir membungkus ke
 *  baris kedua ("Jenjan g", "Semest er"). WAJIB sinkron dengan CSS. */
export const PAD_JUDUL_X = 16;

/** Tinggi minimum baris header agar judul (termasuk yang membungkus beberapa
 *  baris) tidak meluber: hitung jumlah baris teks × line-height + padding judul.
 *  Tidak bergantung tinggi baris saat ini sehingga stabil (tidak loop). */
export function ukurPerluTinggiHeader(akar: HTMLElement): number {
  let maks = 0;
  akar.querySelectorAll<HTMLElement>(
    '.dsg-row-header .simpes-dsg-v2-headtitle',
  ).forEach((ht) => {
    const cs = getComputedStyle(ht);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 || 15;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    let baris = 1;

    const judul = ht.querySelector('.simpes-dsg-v2-teks-judul');
    const node = judul?.firstChild
      ?? Array.from(ht.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
      );
    if (node) {
      const r = document.createRange();
      r.selectNodeContents(node);
      baris = Math.max(1, r.getClientRects().length);
    }
    maks = Math.max(maks, Math.ceil(baris * lh + pad));
  });
  return maks;
}
