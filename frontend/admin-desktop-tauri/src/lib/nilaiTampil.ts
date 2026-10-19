/** Baca angka dari teks gaya INDONESIA, atau `null` bila memang bukan angka.

 *  Aturan (seluruh aplikasi memakai locale `id-ID`):
  - titik = pemisah RIBUAN  -> dibuang       (`2.500` -> 2500)
  - koma = pemisah DESIMAL  -> jadi titik    (`1,5`   -> 1.5)
  - hanya digit/titik/koma/minus yang dipakai; sisanya (`Rp`, spasi) dibuang

 *  Mengembalikan `null` - BUKAN 0 - saat tak ada digit tersisa, supaya pemanggil
 *  bisa menampilkan nilai aslinya. Dulu cabang ini memakai `Number('')` yang
 *  bernilai 0, sehingga teks seperti `abc` tampil sebagai "0".

 *  Ambiguitas `20.5`: diperlakukan sebagai ribuan (205) mengikuti locale `id-ID`,
 *  konsisten dengan seluruh tampilan lain. Angka desimal dari aplikasi ini
 *  ditulis dengan koma (`20,5`).
 */
function angkaDari(v: string | number): number | null {
  const s = String(v)
    .replace(/[^\d.,-]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');

  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Format isi sel kolom (bawaan: apa adanya). */
export function formatNilai(v: string | null | undefined, format: string | null | undefined): string {
  if (v == null || v === '') return '';
  switch (format) {
    case 'angka': {
      const n = angkaDari(v);
      return n === null ? String(v) : new Intl.NumberFormat('id-ID').format(n);
    }
    case 'tanggal': {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
      return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
    }
    case 'ya_tidak': {
      const s = String(v).trim().toLowerCase();
      if (['ya', '1', 'true', 'y'].includes(s)) return 'Ya';
      if (['tidak', '0', 'false', 't', ''].includes(s)) return 'Tidak';
      return String(v);
    }
    default:
      return String(v);
  }
}

/** Kode snake_case → Proper Case berspasi (`santri_baru` → `Santri Baru`).
 *  Hanya untuk TAMPILAN (grid/dialog); kode asli tetap dipakai di API,
 *  filter, dan file import. */
export function formatStatus(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return s;
  return s.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

/** Nama tahun ajaran dari FK string atau objek relasi `{ nama }`.
 *  Jebakan Laravel: relasi `tahunAjaran` di-snake-case jadi `tahun_ajaran`
 *  dan menimpa atribut string FK, sehingga sel bisa berisi objek. */
export function namaTahunAjaran(v: unknown): string | null {
  if (typeof v === 'string') return v === '' ? null : v;
  if (v && typeof v === 'object') {
    const n = (v as { nama?: unknown }).nama;
    if (typeof n === 'string') return n === '' ? null : n;
  }
  return null;
}

/** Kode/nama lembaga dari FK string atau objek relasi `{ jenjang, nama }`. */
export function namaLembaga(v: unknown, jenjang?: string | null): string | null {
  if (typeof v === 'string') return v === '' ? null : v;
  if (v && typeof v === 'object') {
    const o = v as { jenjang?: unknown; nama?: unknown };
    if (typeof o.jenjang === 'string' && o.jenjang !== '') return o.jenjang;
    if (typeof o.nama === 'string' && o.nama !== '') return o.nama;
  }
  return jenjang ?? null;
}
