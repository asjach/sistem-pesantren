/** Event jendela untuk membuka dialog standar tampilan dari TopBar. */
export const EVENT_STANDAR_TAMPILAN = 'simpes:standar-tampilan';

export function bukaStandarTampilan(): void {
  window.dispatchEvent(new CustomEvent(EVENT_STANDAR_TAMPILAN));
}
