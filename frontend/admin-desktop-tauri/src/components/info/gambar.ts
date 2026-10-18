/**
 * Gambar info tabel -> data URL.
 *
 * Alasan: gambar disandikan sebagai base64 di dalam `toolbar_preset.info_html`.
 * Alasannya praktis, bukan sekadar malas:
 *  - kolomnya `longText`, jadi tak perlu pipeline berkas + URL publik,
 *  - satu permintaan saja — tak ada aset yang harus ikut dibersihkan saat
 *    tabel dihapus, dan tak ada path lokal yang bocor ke dalam HTML,
 *  - `<img src="data:...">` jalan identik di desktop (WebView) maupun di
 *    browser dev, tanpa protokol `asset://` yang harus didaftarkan di
 *    capability Tauri.
 *
 * Batasnya nyata dan sering dilanggar: base64 menambah sekitar 33 persen
 * ukuran, dan `HtmlInfo::PANJANG_MAKS` (1,5 juta karakter) jadi plafon keras.
 * Karena itu gambar diperkecil dan dikompres ulang SEBELUM disandikan, bukan
 * bergantung pada ukuran berkas aslinya.
 *
 * Catatan jalur alternatif (tak dipakai di sini): `@tauri-apps/plugin-fs`
 * menulis berkas ke app-data lalu dibaca lewat protokol custom `asset://`
 * (scope + `convertFileSrc`), sehingga HTML cukup menyimpan
 * `<img src="asset://...">`. Itu/info tidak disimpan di database dan cocok
 * kalau info memuat banyak gambar atau gambar besar — tapi menambah
 * capability, perintah Rust, dan jalur kegagalan baru (berkas hilang vs URL
 * salah). Untuk satu info tabel per tabel, base64 jauh lebih murah
 * dipelihara.
 */

/** Sisi terpanjang hasil akhir (px). 1200 cukup untuk pratinjau di hover. */
export const SISI_GAMBAR_MAKS = 1200;

/** Mutu JPEG saat kompres ulang (0..1). */
export const MUTU_JPEG = 0.82;

/** Berkas di bawah ambang ini dibiarkan apa adanya — PNG kecil yang lossless
 *  (logo, garis) jadi lebih tajam dan tetap kecil. */
export const AMBANG_PNG_LANGSUNG = 256 * 1024;

/** Berkas di atas ini ditolak lebih awal, sebelum dibaca jadi base64. */
export const UKURAN_BERKAS_MAKS = 8 * 1024 * 1024;

/** Galat dengan pesan siap tampil untuk pengguna. */
export class GalatGambar extends Error {}

/** Tolak berkas yang tak bisa dipakai sebagai gambar info. */
export function validasiBerkas(berkas: File): void {
  if (!/^image\//.test(berkas.type)) {
    throw new GalatGambar('Berkas bukan gambar. Pilih berkas gambar (PNG, JPEG, WebP, atau GIF).');
  }
  if (berkas.size > UKURAN_BERKAS_MAKS) {
    const mbs = (UKURAN_BERKAS_MAKS / 1024 / 1024).toFixed(0);
    throw new GalatGambar(`Ukuran berkas melebihi batas ${mbs} MB.`);
  }
}

/** Sisi hasil setelah diperkecil, tak lebih dari `SISI_GAMBAR_MAKS`. */
export function sisiHasil(
  lebar: number,
  tinggi: number,
  maks = SISI_GAMBAR_MAKS,
): { w: number; h: number } {
  if (lebar <= 0 || tinggi <= 0) return { w: 0, h: 0 };
  const sisiTerpanjang = Math.max(lebar, tinggi);
  if (sisiTerpanjang <= maks) return { w: Math.round(lebar), h: Math.round(tinggi) };
  const rasio = maks / sisiTerpanjang;
  return { w: Math.max(1, Math.round(lebar * rasio)), h: Math.max(1, Math.round(tinggi * rasio)) };
}

/** Panjang data URL hasil, untuk menolak gambar yang masih terlalu besar. */
export function panjangDataUrl(base64: string): number {
  return base64.length + 23;
}

function bacaSebagaiDataUrl(berkas: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const pembaca = new FileReader();
    pembaca.onload = () => resolve(String(pembaca.result ?? ''));
    pembaca.onerror = () => reject(new GalatGambar('Gagal membaca berkas gambar.'));
    pembaca.readAsDataURL(berkas);
  });
}

function muatGambar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new GalatGambar('Gambar tak bisa dibaca (mungkin rusak).'));
    img.src = src;
  });
}

/**
 * Ubah berkas gambar jadi data URL yang layak disimpan: diperkecil ke
 * `SISI_GAMBAR_MAKS`, dikompres ulang ke JPEG kecuali PNG-nya sudah kecil.
 *
 * Melempar `GalatGambar` (pesan siap tampil) untuk berkas di luar aturan.
 */
export async function gambarKeDataUrl(berkas: File): Promise<string> {
  validasiBerkas(berkas);
  const asal = await bacaSebagaiDataUrl(berkas);

  // PNG kecil: tak perlu kanvas sama sekali (memuat + encode itu mahal).
  if (berkas.type === 'image/png' && berkas.size <= AMBANG_PNG_LANGSUNG) return asal;

  const img = await muatGambar(asal);
  const { w, h } = sisiHasil(img.naturalWidth, img.naturalHeight);
  if (w === 0 || h === 0) return asal;

  const kanvas = document.createElement('canvas');
  kanvas.width = w;
  kanvas.height = h;
  const konteks = kanvas.getContext('2d');
  if (konteks === null) return asal; // tak ada canvas: lebih baik asli daripada gagal
  konteks.drawImage(img, 0, 0, w, h);

  const jpeg = kanvas.toDataURL('image/jpeg', MUTU_JPEG);
  // JPEG kadang lebih besar dari PNG untuk gambar kecil yang rata; kalau
  // begitu simpan PNG sumber yang sama ukurannya.
  return jpeg.length < asal.length ? jpeg : asal;
}