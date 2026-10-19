/**
 * Perender markup ringkas untuk teks butir papan di kartu.
 *
 * Butir di papan disimpan sebagai teks yang boleh memuat markup markdown
 * sederhana (dipakai saat ditulis ke PETA-MODUL.md): `kode`, **tebal**, dan
 * tautan [teks](tujuan). Di kartu, markup itu TIDAK boleh tampil mentah —
 * tapi juga tidak perlu perender markdown penuh (tak ada dependensinya).
 * Jadi di sini hanya tiga pola yang didukung, dan SEBAGIAN di antaranya
 * sengaja dipertahankan apa adanya:
 *
 * - `kode`            -> potongan <code>
 * - **tebal**         -> potongan <strong>
 * - [teks](tujuan)    -> teks + tujuan, karena pratinjau tautan di kartu
 *                        tidak bisa diklik (kartu sendiri bisa diseret)
 * - sisanya           -> teks biasa
 */

/** Satu potongan teks butir: bagian bertipe `kode`/`tebal`/`tautan`, atau teks biasa. */
export type PotonganButir =
  | { jenis: 'teks'; isi: string }
  | { jenis: 'kode'; isi: string }
  | { jenis: 'tebal'; isi: string }
  | { jenis: 'tautan'; isi: string; tujuan: string };

/**
 * Pecah teks butir menjadi potongan yang bisa dirender.
 *
 * Sengaja memakai satu regex berjalan (bukan tiga pass) supaya urutan asli
 * teks terjaga dan tidak ada potongan yang tertukar posisinya.
 */
export function pecahButir(teks: string): PotonganButir[] {
  const pola = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const hasil: PotonganButir[] = [];
  let akhir = 0;
  let cocok: RegExpExecArray | null;

  while ((cocok = pola.exec(teks)) !== null) {
    if (cocok.index > akhir) {
      hasil.push({ jenis: 'teks', isi: teks.slice(akhir, cocok.index) });
    }

    if (cocok[1] !== undefined) {
      hasil.push({ jenis: 'kode', isi: cocok[1] });
    } else if (cocok[2] !== undefined) {
      hasil.push({ jenis: 'tebal', isi: cocok[2] });
    } else if (cocok[3] !== undefined && cocok[4] !== undefined) {
      hasil.push({ jenis: 'tautan', isi: cocok[3], tujuan: cocok[4] });
    }

    akhir = pola.lastIndex;
  }

  if (akhir < teks.length) {
    hasil.push({ jenis: 'teks', isi: teks.slice(akhir) });
  }

  return hasil;
}
