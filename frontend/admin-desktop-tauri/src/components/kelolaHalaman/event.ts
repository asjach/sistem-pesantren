/** Event jendela untuk membuka dialog "Kelola Halaman" (urutan tab) dari
 *  mana pun, mis. menu klik kanan bilah judul. */
export const EVENT_KELOLA_HALAMAN = 'simpes:kelola-halaman';

/** Buka dialog Kelola Halaman (urutan tab halaman gabungan). */
export function bukaKelolaHalaman(): void {
  window.dispatchEvent(new CustomEvent(EVENT_KELOLA_HALAMAN));
}
