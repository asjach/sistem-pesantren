/** Format tanggal tampilan: dd-mm-yyyy (menerima ISO date/datetime). */
export function tanggal(v: string | null | undefined): string {
  if (!v) return '-';
  const iso = v.slice(0, 10);
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}
