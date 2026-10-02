/**
 * Salin teks ke clipboard — 3 lapis:
 * desktop (Tauri) dulu lewat plugin Rust (clipboard webview tak andal),
 * lalu navigator.clipboard, fallback textarea + execCommand untuk web
 * (localhost/HTTPS).
 */
import { isTauri } from '@/api/client';

/** Penanda agar listener global hanya terpasang sekali (aman dari
 *  double-mount StrictMode maupun evaluasi ulang modul saat HMR). */
let lepasPenyalinGlobal: (() => void) | null = null;

export async function copyText(text: string): Promise<boolean> {
  if (isTauri()) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
      return true;
    } catch {
      /* lanjut fallback web */
    }
  }
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

/** Teks polos → HTML TANPA atribut style/warna (fallback bila webview
 *  tetap menyimpan `text/html`). Escape dulu agar `<`/`&` tak jadi tag. */
export function teksKeHtmlPolos(teks: string): string {
  return teks
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

/**
 * Tulis sinkron ke event salin: `text/plain` + `text/html` tanpa style.
 * Wajib dipanggil sinkron di dalam handler `copy`/`cut` (sebelum return).
 */
export function tulisPolosSinkron(e: ClipboardEvent, teks: string): void {
  try {
    e.clipboardData?.setData('text/plain', teks);
  } catch {
    /* abaikan — tulis ulang via plugin di bawah */
  }
  try {
    e.clipboardData?.setData('text/html', teksKeHtmlPolos(teks));
  } catch {
    /* abaikan — plain sudah cukup */
  }
}

/**
 * Penyalin polos global khusus desktop (Tauri): cegah webview menulis
 * `text/html` beserta style (mis. warna putih mode gelap) sehingga tempelan
 * di aplikasi lain tak ikut berwarna. Hanya `text/plain` yang ditulis —
 * menyamai perilaku salin web yang benar.
 *
 * Dilewati untuk: input/textarea/select/contentEditable (bawaan sudah polos)
 * dan area tabel `.simpes-dsg` (punya penyalin TSV sendiri di ExcelTable).
 */
export function pasangPenyalinPolosDesktop(): () => void {
  if (lepasPenyalinGlobal) return lepasPenyalinGlobal;
  function saatSalinGlobal(e: ClipboardEvent) {
    // Cek di dalam handler (bukan saat pasang): internal Tauri bisa belum
    // tersedia saat App pertama di-mount sehingga listener tak terpasang.
    if (!isTauri()) return;
    if (e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.tagName === 'SELECT' ||
        t.isContentEditable)
    ) {
      return;
    }
    if (t && typeof t.closest === 'function' && t.closest('.simpes-dsg')) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const anchorEl =
      sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
    if (anchorEl?.closest?.('.simpes-dsg')) return;
    const teks = sel.toString();
    if (!teks) return;
    e.preventDefault();
    // Tahan handler lain di fase yang sama + cegah DSG (bubble di document)
    // menimpa clipboard dengan data sel basi + `text/html`-nya.
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    tulisPolosSinkron(e, teks);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[simpes-salin] global polos: ${teks.length} aksara`);
    }
    void copyText(teks);
  }
  document.addEventListener('copy', saatSalinGlobal, true);
  document.addEventListener('cut', saatSalinGlobal, true);
  const lepas = () => {
    document.removeEventListener('copy', saatSalinGlobal, true);
    document.removeEventListener('cut', saatSalinGlobal, true);
    if (lepasPenyalinGlobal === lepas) lepasPenyalinGlobal = null;
  };
  lepasPenyalinGlobal = lepas;
  return lepas;
}

// Daftarkan sekali di lingkup modul (bukan useEffect): efek App tidak jalan
// ulang saat HMR sehingga jendela dev lama tetap memakai handler basi.
if (typeof document !== 'undefined') pasangPenyalinPolosDesktop();
