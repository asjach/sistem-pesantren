import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toSvg } from 'html-to-image';
import { ambilScreenshot, areaTerlihat, batasScreenshot, renderViewport, sertakanDalamScreenshot } from './screenshotAnotasi';

vi.mock('html-to-image', () => ({ toSvg: vi.fn() }));
let sumberGambar: string;
const svgUrl = (isi: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">${isi}</div></foreignObject></svg>`)}`;

beforeEach(() => {
  vi.mocked(toSvg).mockResolvedValue(svgUrl('<p>Halaman</p>'));
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    set src(value: string) { sumberGambar = value; queueMicrotask(() => this.onload?.()); }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function elemen(rect: DOMRect) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect);
  return el;
}

describe('screenshot area anotasi', () => {
  it('menghitung union asal–tujuan dengan padding, dibatasi viewport', () => {
    expect(batasScreenshot([{ left: 5, top: 6, right: 80, bottom: 30 }, { left: 40, top: 60, right: 200, bottom: 100 }])).toEqual({ left: 0, top: 0, width: 224, height: 124 });
  });
  it('menolak elemen di luar viewport atau sudah terlepas', () => {
    const el = elemen(new DOMRect(-100, -100, 10, 10));
    expect(() => areaTerlihat(el)).toThrow('harus terlihat');
    el.remove();
    expect(() => areaTerlihat(el)).toThrow('harus terlihat');
  });
  it('melakukan clip pada scroll container', () => {
    const parent = elemen(new DOMRect(20, 20, 100, 100));
    parent.style.overflowY = 'auto';
    const child = elemen(new DOMRect(30, 5, 50, 80));
    parent.appendChild(child);
    expect(areaTerlihat(child)).toEqual({ left: 30, top: 20, right: 80, bottom: 85 });
  });
  it('mengabaikan editor, overlay, serta seluruh turunannya tanpa mengabaikan dialog produk', () => {
    const ui = document.createElement('div');
    ui.setAttribute('data-anotasi-abaikan', '');
    ui.innerHTML = '<button>Kontrol</button>';
    document.body.appendChild(ui);
    expect(sertakanDalamScreenshot(ui)).toBe(false);
    expect(sertakanDalamScreenshot(ui.querySelector('button')!)).toBe(false);
    const dialog = document.createElement('div');
    dialog.setAttribute('data-slot', 'dialog-content');
    expect(sertakanDalamScreenshot(dialog)).toBe(true);
  });
  it('mengoreksi scroll pada clone dan memulihkan atribut UI asli', async () => {
    const parent = document.createElement('div');
    parent.scrollTop = 120;
    parent.scrollLeft = 30;
    parent.setAttribute('data-anotasi_capture_scroll', 'sebelumnya');
    document.body.appendChild(parent);
    vi.mocked(toSvg).mockResolvedValue(svgUrl('<div data-anotasi_capture_scroll="0"><p>Konten</p></div>'));
    await renderViewport();
    expect(parent.getAttribute('data-anotasi_capture_scroll')).toBe('sebelumnya');
    const hasil = decodeURIComponent(sumberGambar.split(',')[1]);
    expect(hasil).toContain('transform: translate(-30px, -120px)');
    expect(hasil).not.toContain('data-anotasi_capture_scroll');
  });
  it('memulihkan atribut sementara walau render gagal', async () => {
    const parent = document.createElement('div');
    parent.scrollTop = 80;
    document.body.appendChild(parent);
    vi.mocked(toSvg).mockRejectedValueOnce(new Error('gagal'));
    await expect(renderViewport()).rejects.toThrow('gagal');
    expect(parent.hasAttribute('data-anotasi_capture_scroll')).toBe(false);
  });
  it('mencegah capture bersamaan agar atribut sementara tidak tertukar', async () => {
    let selesai!: (svg: string) => void;
    vi.mocked(toSvg).mockImplementationOnce(() => new Promise((resolve) => { selesai = resolve; }));
    const pertama = renderViewport();
    await expect(renderViewport()).rejects.toThrow('sebelumnya masih diproses');
    selesai(svgUrl('<p>Selesai</p>'));
    await pertama;
    await expect(renderViewport()).resolves.toBeDefined();
  });
  it('menghasilkan PNG dengan metadata preview serta label asal dan tujuan', async () => {
    const ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(), strokeRect: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })));
    const asal = elemen(new DOMRect(30, 40, 40, 20));
    const tujuan = elemen(new DOMRect(100, 100, 100, 80));
    const hasil = await ambilScreenshot(asal, tujuan, true);
    expect(hasil.blob.type).toBe('image/png');
    expect(hasil.metadata).toMatchObject({ lebar: 218, tinggi: 216, preview_aktif: true });
    expect(ctx.fillText.mock.calls.some(([label]) => label === 'Asal')).toBe(true);
    expect(ctx.fillText.mock.calls.some(([label]) => label === 'Tujuan')).toBe(true);
  });
  it('gagal dengan jelas jika canvas tidak tersedia atau PNG terlalu besar', async () => {
    const asal = elemen(new DOMRect(10, 10, 40, 20));
    const ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(), strokeRect: vi.fn() };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(ambilScreenshot(asal, null, false)).rejects.toThrow('tidak mendukung');
    getContext.mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob([new Uint8Array(8 * 1024 * 1024 + 1)])));
    await expect(ambilScreenshot(asal, null, false)).rejects.toThrow('8 MB');
  });
});
