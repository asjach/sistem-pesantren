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
