/**
 * Geser posisi kolom lewat seret pada JUDUL kolom.
 *
 * Aturan bisnis (murni, tanpa DOM) supaya bisa diuji terpisah dari grid:
 * - `pindahKolom` memindahkan satu key dari indeks `dari` ke indeks `ke`
 *   dengan pola splice (bukan tukar posisi): kolom lain bergeser mengisi
 *   celah, persis seperti geser baris di aplikasi spreadsheet.
 * - `indeksSisip` menerjemahkan posisi kursor (px) menjadi indeks sisip,
 *   memakai titik tengah tiap kolom: kursor di separuh kiri kolom N berarti
 *   "sebelum N", di separuh kanan berarti "sesudah N".
 * - `tandaSisip` memberi garis indikator: di kiri kolom ke-`sisip`, atau di
 *   kanan kolom terakhir bila menyisip di ujung.
 *
 * Seret TIDAK boleh mengubah daftar yang tak terlihat: key yang tidak ada di
 * `terlihat` diabaikan, dan key di luar daftar itu tak pernah disisipkan.
 */

/** Bungkus indeks ke rentang valid `[0, panjang]` (indeks sisip boleh == n). */
function jepit(i: number, panjang: number): number {
  if (!Number.isFinite(i)) return 0;
  return Math.min(panjang, Math.max(0, Math.round(i)));
}

/**
 * Pindahkan `dari` ke posisi `ke` (indeks sisip pada daftar TANPA item yang
 * dipindah). Mengembalikan salinan baru; masukan tak diubah.
 *
 * `ke` dihitung pada daftar setelah item diangkat, sama seperti hasil
 * `indeksSisip` yang dijalankan sambil item sumber masih di tempat asalnya —
 * karena itu indeksnya disesuaikan lebih dulu bila `ke > dari`.
 */
export function pindahKolom(
  terlihat: readonly string[],
  dari: number,
  ke: number,
): string[] {
  const n = terlihat.length;
  if (n === 0) return [...terlihat];
  const asal = jepit(dari, n - 1);
  const tujuan = jepit(ke, n);
  const sisa = terlihat.filter((_, i) => i !== asal);

  const sisip = tujuan > asal ? tujuan - 1 : tujuan;
  sisa.splice(jepit(sisip, sisa.length), 0, terlihat[asal]);
  return sisa;
}

/**
 * Terjemahkan indeks sisip pada POTONGAN kolom yang terukur menjadi indeks
 * sisip pada DAFTAR PENUH kolom.
 *
 * Perlu karena DSG mem-`virtualize` kolom secara mendatar: hanya kolom yang
 * sedang terlihat (plus sedikit cadangan) yang ada di DOM. Penyeret judul
 * karena itu hanya bisa mengukur potongan itu, sementara hasil geseran harus
 * ditulis ke daftar penuh — tanpa terjemahan ini, `indeksSisip` yang bernilai
 * kecil (mis. 0 saat kursor di kiri potongan) dipakai langsung sebagai indeks
 * daftar penuh, dan kolom dari ujung kanan tabel meloncat ke kolom awal.
 *
 * `iFull[j]` = indeks kolom ke-j dari potongan di daftar penuh. Indeks di
 * ujung kanan potongan (`j === iFull.length`) berarti "sesudah kolom terakhir
 * yang terukur" → satu langkah setelah indeksnya.
 *
 * @param iFull        Indeks di daftar penuh, sejajar kolom yang terukur.
 * @param sisipLokal   Indeks sisip di dalam potongan (0..jumlah terukur).
 */
export function sisipKePenuh(iFull: readonly number[], sisipLokal: number): number {
  if (iFull.length === 0) return 0;
  const j = jepit(Number.isFinite(sisipLokal) ? sisipLokal : 0, iFull.length);
  return j >= iFull.length ? iFull[iFull.length - 1] + 1 : iFull[j];
}

/**
 * Indeks sisip dari posisi kursor X relatif terhadap daftar kolom.
 *
 * `batas[i]` = offset kiri kolom ke-i; `lebar[i]` = lebarnya. Kursor sebelum
 * titik tengah kolom i → sisip di i; setelahnya → i + 1. Di luar area kolom,
 * hasilnya dijepit ke 0 atau jumlah kolom.
 */
export function indeksSisip(
  batas: readonly number[],
  lebar: readonly number[],
  x: number,
): number {
  const n = Math.min(batas.length, lebar.length);
  if (n === 0) return 0;
  for (let i = 0; i < n; i += 1) {
    const tengah = batas[i] + lebar[i] / 2;
    if (x < tengah) return i;
  }
  return n;
}

/**
 * Apakah pelepasan kursor masih layak dianggap "menyusun ulang kolom"?
 *
 * `null` = BUKAN pelepasan yang sah; pembatalan, bukan perpindahan. Dipakai
 * untuk menahan dua kasus yang dulu diam-diam memindahkan kolom:
 *
 * - melepas di bilah toolbar atas / area data bawah (jauh dari sabuk header);
 * - melepas jauh di luar tepi kiri/kanan deretan kolom.
 *
 * Rentang mendatar diambil dari SEL HEADER YANG TERUKUR (`batas` + `lebar`),
 * bukan lebar `.dsg-row-header` — elemen itu hanya selebar rel kiri dan tak
 * mencakup kolom lengket kanan, sehingga memakainya meloloskan pelepasan di
 * x=50 sebagai sah (terbukti di browser).
 *
 * @param header  Kotak sabuk header (koordinat viewport).
 * @param batas   Tepi kiri tiap kolom, sejajar urutan yang terlihat.
 * @param lebar   Lebar tiap kolom, sejajar `batas`.
 * @param x       `clientX` saat tombol dilepas.
 * @param y       `clientY` saat tombol dilepas.
 */
export function lepasSah(
  header: { top: number; bottom: number; height: number } | null,
  batas: readonly number[],
  lebar: readonly number[],
  x: number,
  y: number,
): boolean {
  if (!header || header.height <= 0) return false;
  if (y < header.top - header.height || y > header.bottom + header.height) return false;
  if (batas.length === 0 || lebar.length === 0) return false;
  const kiri = batas[0];
  const kanan = batas[batas.length - 1] + lebar[lebar.length - 1];
  const toleransi = 16;
  return x >= kiri - toleransi && x <= kanan + toleransi;
}

/**
 * Geseran visual tiap kolom untuk PRATINJAU LANGSUNG saat seret.
 *
 * Kolom yang berpindah slot digeser dengan `transform: translateX(dx)` sejauh
 * selisih antara posisi slot TUJUANNYA dan posisi yang SEDANG terlihat, jadi
 * kolom lain tampak memberi ruang sambil pointer bergerak (bukan baru setelah
 * tombol dilepas).
 *
 * Posisi tujuan dihitung dari LEBAR kolom dalam susunan tujuan (menempel
 * rapat dari titik awal yang sama), bukan dari memindahkan posisi lama antar
 * kolom: kolom berlebar tidak sama akan saling menumpuk bila posisinya
 * sekadar ditukar. Karena `dx` selalu relatif terhadap posisi TATA LETAK
 * (yang sudah diukur sekali saat seret dimulai), hasilnya tetap benar walau
 * grid digulir horizontal di tengah seret.
 *
 * @param kiri    Posisi kiri tata letak tiap kolom (diukur saat seret mulai,
 *                 tanpa transform pratinjau).
 * @param lebar    Lebar tiap kolom, sejajar `kiri`.
 * @param sesudah  Urutan tujuan (permutasi dari kolom yang terukur).
 * @returns dx per key; key tanpa dx = tak perlu digeser.
 */
export function dxPerKolom(
  kiri: Readonly<Record<string, number>>,
  lebar: Readonly<Record<string, number>>,
  sesudah: readonly string[],
): Record<string, number> {
  const terukur = sesudah.filter((k) => kiri[k] !== undefined && lebar[k] !== undefined);
  if (terukur.length === 0) return {};
  const out: Record<string, number> = {};

  let x = Math.min(...terukur.map((k) => kiri[k] ?? 0));
  for (const k of terukur) {
    const d = Math.round(x - (kiri[k] ?? 0));
    if (d !== 0) out[k] = d;
    x += lebar[k] ?? 0;
  }
  return out;
}

/**
 * Tanda garis sisip untuk `sisip`, sebagai indeks kolom acuan + sisi mana.
 * `sisip === n` (ujung kanan) memakai kolom terakhir dengan sisi `kanan`.
 * Mengembalikan null bila tak ada kolom untuk dijadikan acuan.
 */
export function tandaSisip(
  jumlah: number,
  sisip: number,
): { indeks: number; sisi: 'kiri' | 'kanan' } | null {
  if (jumlah <= 0) return null;
  const s = jepit(sisip, jumlah);
  if (s >= jumlah) return { indeks: jumlah - 1, sisi: 'kanan' };
  return { indeks: s, sisi: 'kiri' };
}
