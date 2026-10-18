import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSalinTempelBlok, type PeristiwaBlok } from './useSalinTempelBlok';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** Wadah grid tiruan dengan satu sel aktif di dalamnya. */
function buatWadah() {
  const wrap = document.createElement('div');
  wrap.className = 'simpes-dsg';
  const sel = document.createElement('div');
  sel.className = 'dsg-cell';
  const isi = document.createElement('span');
  isi.setAttribute('data-col-key', 'senin');
  sel.appendChild(isi);
  wrap.appendChild(sel);
  document.body.appendChild(wrap);
  return { wrap, isi };
}

const BLOK = { r0: 0, r1: 1, kolom: [2, 3] };

function pasang(aktif: boolean, opts: {
  blokAktif?: () => typeof BLOK | null;
  onSalin?: () => void;
  onTempel?: () => void;
} = {}) {
  const { wrap, isi } = buatWadah();
  const onSalin = vi.fn<(p: PeristiwaBlok) => void>(opts.onSalin ?? (() => {}));
  const onTempel = vi.fn<(p: PeristiwaBlok) => void>(opts.onTempel ?? (() => {}));
  const blokAktif = vi.fn(opts.blokAktif ?? (() => BLOK));
  renderHook(() => useSalinTempelBlok(
    { current: wrap },
    { aktif, blokAktif, kunciKolom: () => ['__kelas', '__slot', 'senin', 'selasa'], onSalin, onTempel },
  ));
  return { wrap, isi, onSalin, onTempel, blokAktif };
}

function tekan(el: Element, key: string, mod: { ctrlKey?: boolean; metaKey?: boolean } = { ctrlKey: true }) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mod });
  el.dispatchEvent(e);
  return e;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('useSalinTempelBlok', () => {
  it('Ctrl+C memanggil onSalin dengan blok aktif', () => {
    const { isi, onSalin } = pasang(true);
    const e = tekan(isi, 'c');
    expect(onSalin).toHaveBeenCalledTimes(1);
    expect(onSalin.mock.calls[0][0].blok).toEqual(BLOK);
    expect(e.defaultPrevented).toBe(true);
  });

  it('Cmd (metaKey) juga berlaku', () => {
    const { isi, onSalin } = pasang(true);
    tekan(isi, 'c', { metaKey: true });
    expect(onSalin).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+V memanggil onTempel', () => {
    const { isi, onTempel } = pasang(true);
    tekan(isi, 'v');
    expect(onTempel).toHaveBeenCalledTimes(1);
  });

  it('saat aktif=false tidak ada listener (Mode Ubah belum menyala)', () => {
    const { isi, onSalin, onTempel } = pasang(false);
    tekan(isi, 'c');
    tekan(isi, 'v');
    expect(onSalin).not.toHaveBeenCalled();
    expect(onTempel).not.toHaveBeenCalled();
  });

  it('tanpa modifier tidak memicu apa-apa', () => {
    const { isi, onSalin } = pasang(true);
    tekan(isi, 'c', { ctrlKey: false });
    expect(onSalin).not.toHaveBeenCalled();
  });

  it('tombol lain (mis. Ctrl+X) tidak memicu', () => {
    const { isi, onSalin, onTempel } = pasang(true);
    tekan(isi, 'x');
    expect(onSalin).not.toHaveBeenCalled();
    expect(onTempel).not.toHaveBeenCalled();
  });

  it('fokus di input tidak direbut (salin/tempel bawaan)', () => {
    const { wrap, onSalin } = pasang(true);
    const input = document.createElement('input');
    wrap.appendChild(input);
    tekan(input, 'c');
    expect(onSalin).not.toHaveBeenCalled();
  });

  /* Di WebView nyata, sel DSG tak fokusable sehingga setelah klik sel fokus
     tetap di <body> dan `e.target` keydown = body. Listener HARUS tetap jalan
     di kasus itu — gerbangnya "ada blok aktif", bukan containment target. */
  it('keydown dari body (fokus tak pindah ke sel) tetap memicu', () => {
    const { onSalin } = pasang(true);
    tekan(document.body, 'c');
    expect(onSalin).toHaveBeenCalledTimes(1);
  });

  it('tanpa blok aktif (grid ini tak sedang dipakai) diabaikan', () => {
    const { onSalin } = pasang(true, { blokAktif: () => null });
    tekan(document.body, 'c');
    expect(onSalin).not.toHaveBeenCalled();
  });

  it('Ctrl+V tanpa blok aktif → tak memanggil onTempel', () => {
    const { isi, onTempel } = pasang(true, { blokAktif: () => null });
    tekan(isi, 'v');
    expect(onTempel).not.toHaveBeenCalled();
  });

  it('sedang mengedit sel (active-cell-focus) tidak direbut', () => {
    const { wrap, isi, onSalin } = pasang(true);
    const fokus = document.createElement('div');
    fokus.className = 'dsg-active-cell-focus';
    wrap.appendChild(fokus);
    tekan(isi, 'c');
    expect(onSalin).not.toHaveBeenCalled();
  });
});
