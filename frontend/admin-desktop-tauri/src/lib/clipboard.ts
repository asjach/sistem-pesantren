/**
 * Salin teks ke clipboard — 2 lapis agar jalan di web (localhost/HTTPS)
 * maupun webview Tauri (tanpa prompt, tanpa plugin tambahan).
 * navigator.clipboard dulu, fallback textarea + execCommand.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* lanjut fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Baris-baris string → TSV siap tempel ke Excel/Sheets. */
export function toTSV(header: string[], rows: string[][]): string {
  const cell = (v: string) => v.replace(/[\t\r\n]+/g, ' ').trim();
  return [header, ...rows].map((r) => r.map(cell).join('\t')).join('\n');
}
