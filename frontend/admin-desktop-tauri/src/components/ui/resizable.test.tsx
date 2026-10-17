import { describe, expect, it } from 'vitest';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup, PemisahGeser } from './resizable';
import { renderDenganTema } from '@/test/utils';

/** Standar pemisah yang berlaku untuk SEMUA resizable di aplikasi:
 *  strip 8px berlatar permukaan tabel (`--part-tabel_sel-bg` → `--background`),
 *  garis 1px `bg-border`
 *  yang menyala `primary` saat hover/ditarik, plus knob `withHandle`. */
function garisPemisah(el: Element): HTMLElement {
  return el.firstElementChild as HTMLElement;
}

describe('ResizableHandle — standar pemisah', () => {
  it('horizontal: strip 8px berlatar permukaan tabel, garis 1px, knob ikut', () => {
    const { container } = renderDenganTema(
      <ResizablePanelGroup orientation="horizontal" id="uji_grup_horizontal">
        <ResizablePanel id="uji_kiri">Kiri</ResizablePanel>
        <ResizableHandle withHandle id="gagang_uji_horizontal" />
        <ResizablePanel id="uji_kanan">Kanan</ResizablePanel>
      </ResizablePanelGroup>,
    );

    const handle = container.querySelector('[data-slot="resizable-handle"]');
    expect(handle).not.toBeNull();
    const kelas = (handle as HTMLElement).className;
    expect(kelas).toContain('w-2');
    expect(kelas).toContain('var(--part-tabel_sel-bg');
    expect(kelas).toContain('cursor-col-resize');
    expect(kelas).toContain('group');

    const garis = garisPemisah(handle as Element);
    expect(garis.className).toContain('w-px');
    expect(garis.className).toContain('bg-border');
    expect(garis.className).toContain('group-hover:bg-primary');

    // Anak kedua = knob pegangan (withHandle).
    expect((handle as HTMLElement).children.length).toBe(2);
  });

  it('vertikal: strip 8px + garis horizontal (bukan w-px)', () => {
    const { container } = renderDenganTema(
      <ResizablePanelGroup orientation="vertical" id="uji_grup_vertikal">
        <ResizablePanel id="uji_atas">Atas</ResizablePanel>
        <ResizableHandle withHandle orientation="vertical" id="gagang_uji_vertikal" />
        <ResizablePanel id="uji_bawah">Bawah</ResizablePanel>
      </ResizablePanelGroup>,
    );

    const handle = container.querySelector('[data-slot="resizable-handle"]');
    const kelas = (handle as HTMLElement).className;
    expect(kelas).toContain('h-2');
    expect(kelas).toContain('var(--part-tabel_sel-bg');
    expect(kelas).toContain('cursor-row-resize');

    const garis = garisPemisah(handle as Element);
    expect(garis.className).toContain('h-px');
    expect(garis.className).toContain('bg-border');
    expect(garis.className).toContain('group-hover:bg-primary');
  });

  /* Halaman yang menggeser panelnya SENDIRI (mis. Dispensasi) memakai
     `PemisahGeser`; tampilannya harus identik dengan handle panel group. */
  it('PemisahGeser memakai markup & kelas standar yang sama', () => {
    const { container } = renderDenganTema(
      <PemisahGeser id="gagang_uji_geser" orientation="horizontal" withHandle aria-label="Uji geser" />,
    );

    const el = container.querySelector('[data-slot="resizable-handle"]') as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.getAttribute('role')).toBe('separator');
    // Pemisah dua kolom = garis vertikal.
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.className).toContain('w-2');
    expect(el.className).toContain('var(--part-tabel_sel-bg');

    const garis = garisPemisah(el);
    expect(garis.className).toContain('w-px');
    expect(garis.className).toContain('group-hover:bg-primary');
    expect(el.children.length).toBe(2);
  });

  it('PemisahGeser vertikal: strip 8px + garis horizontal', () => {
    const { container } = renderDenganTema(
      <PemisahGeser id="gagang_uji_geser_v" orientation="vertical" aria-label="Uji geser vertikal" />,
    );

    const el = container.querySelector('[data-slot="resizable-handle"]') as HTMLElement;
    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
    expect(el.className).toContain('h-2');
    expect(el.className).toContain('cursor-row-resize');
    expect(garisPemisah(el).className).toContain('h-px');
  });
});
