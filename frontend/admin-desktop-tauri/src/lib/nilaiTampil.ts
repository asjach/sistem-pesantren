/** Format tampil kolom dari kamus label (bawaan: apa adanya). */
export function formatNilai(v: string | null | undefined, format: string | null | undefined): string {
  if (v == null || v === '') return '';
  switch (format) {
    case 'angka': {
      const n = Number(String(v).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? new Intl.NumberFormat('id-ID').format(n) : String(v);
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
