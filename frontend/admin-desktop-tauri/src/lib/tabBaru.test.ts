import { beforeEach, describe, expect, it, vi } from 'vitest';

const tauri = vi.fn(() => false);
vi.mock('@/api/client', () => ({ isTauri: () => tauri() }));

/** Jendela Tauri palsu: mencatat pembuatan lalu memicu event `created`. */
interface JendelaPalsu {
  label: string;
  opsi: Record<string, unknown>;
  _fire: (ev: string) => void;
}
const dibuat: JendelaPalsu[] = [];

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: class {
    label: string;
    opsi: Record<string, unknown>;
    private h: Record<string, () => void> = {};
    constructor(label: string, opsi: Record<string, unknown>) {
      this.label = label;
      this.opsi = opsi;
      dibuat.push(this as unknown as JendelaPalsu);
      // Setelah `once` terpasang (dipanggil sinkron setelah constructor).
      setTimeout(() => this.h['tauri://created']?.(), 0);
    }
    once(ev: string, cb: () => void) {
      this.h[ev] = cb;
    }
    _fire(ev: string) {
      this.h[ev]?.();
    }
  },
}));

const { bukaDiTabBaru } = await import('./tabBaru');

beforeEach(() => {
  tauri.mockReturnValue(false);
  dibuat.length = 0;
  window.open = vi.fn(() => ({}) as Window) as unknown as typeof window.open;
});

describe('bukaDiTabBaru', () => {
  it('di web: membuka tab browser ke rute yang diminta', async () => {
    const hasil = await bukaDiTabBaru('/santri/7/profil', 'Profil: Ahmad');

    expect(hasil).toBe('dibuka');
    expect(window.open).toHaveBeenCalledWith(
      '/santri/7/profil',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('di web: melapor gagal bila popup diblokir browser', async () => {
    window.open = vi.fn(() => null) as unknown as typeof window.open;
    expect(await bukaDiTabBaru('/santri/7/profil', 'Profil')).toBe('gagal');
  });

  it('di Tauri: membuat jendela webview dengan label berprefiks app- dan path relatif', async () => {
    tauri.mockReturnValue(true);

    const hasil = await bukaDiTabBaru('/santri/7/profil', 'Profil: Ahmad');

    expect(hasil).toBe('dibuka');
    expect(dibuat).toHaveLength(1);
    // Label harus cocok glob capability `app-*` di capabilities/default.json.
    expect(dibuat[0].label).toMatch(/^app-tab-\d+$/);
    // Path tanpa garis miring depan agar tetap di dalam app.
    expect(dibuat[0].opsi.url).toBe('santri/7/profil');
    expect(dibuat[0].opsi.title).toBe('Profil: Ahmad');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('di Tauri: label unik tiap pembukaan (Tauri menolak label ganda)', async () => {
    tauri.mockReturnValue(true);

    await bukaDiTabBaru('/santri/7/profil', 'a');
    await bukaDiTabBaru('/santri/7/profil', 'b');

    expect(dibuat.map((j) => j.label)).toHaveLength(2);
    expect(dibuat[0].label).not.toBe(dibuat[1].label);
  });
});
