import { isTauri } from '@/api/client';

/** Hasil membuka tab/jendela baru. */
export type HasilTabBaru = 'dibuka' | 'gagal';

/** Penomoran label jendela++; Tauri menolak label yang sudah dipakai. */
let nomorJendela = 0;

/**
 * Buka `path` (rute aplikasi, mis. `/santri/7/profil`) di tab baru.
 *
 * - Desktop Tauri: jendela webview baru. Label berprefiks `app-` agar
 *   capability `app-*` di src-tauri/capabilities/default.json ikut berlaku —
 *   tanpa itu jendela baru tidak punya izin baca store/pengaturan.
 * - Web (dev atau pemakaian lewat browser): tab browser biasa.
 *
 * Rute memakai BrowserRouter; di Tauri path app selalu jatuh ke index.html
 * (resolver aset Tauri), sehingga router di dalam webview yang menanganinya.
 */
export async function bukaDiTabBaru(path: string, judul: string): Promise<HasilTabBaru> {
  if (isTauri()) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      nomorJendela += 1;
      // Path relatif tanpa garis miring depan: Tauri menerjemahkannya ke
      // tauri://localhost/<path>, bukan ke host di luar app.
      const win = new WebviewWindow(`app-tab-${nomorJendela}`, {
        url: path.replace(/^\//, ''),
        title: judul,
        width: 760,
        height: 900,
        minWidth: 480,
        minHeight: 420,
      });
      return new Promise<HasilTabBaru>((selesai) => {
        win.once('tauri://created', () => selesai('dibuka'));
        win.once('tauri://error', () => selesai('gagal'));
      });
    } catch {
      return 'gagal';
    }
  }
  // Popup bisa diblokir browser; dalam hal itu pengguna bisa membuka manual.
  const tab = window.open(path, '_blank', 'noopener,noreferrer');
  return tab ? 'dibuka' : 'gagal';
}
