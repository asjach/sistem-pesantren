import { describe, expect, it, vi } from 'vitest';

import TombolIkon from '@/components/TombolIkon';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { flattenAksi, metaAksi } from './actions';

describe('metaAksi', () => {
  it('jatuhan umum membaca `tip` TombolIkon agar label menu tidak generik', () => {
    const onClick = vi.fn();
    const m = metaAksi(
      <TombolIkon tip="Unduh berkas" onClick={onClick}>ikon</TombolIkon>,
    );

    expect(m.label).toBe('Unduh berkas');
    expect(m.onClick).toBe(onClick);
    expect(m.konfirmasi).toBeUndefined();
  });
});

describe('flattenAksi', () => {
  it('meneruskan Tooltip: tombol dihitung, bukan pembungkusnya', () => {
    const els = flattenAksi(
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button id="btn_a" onClick={() => {}}>A</Button>
          </TooltipTrigger>
          <TooltipContent><p>Keterangan.</p></TooltipContent>
        </Tooltip>
      </>,
    );

    expect(els).toHaveLength(1);
    expect(els[0].props.id).toBe('btn_a');
    // Handler tombol ikut sampai ke menu hamburger.
    expect(metaAksi(els[0]).onClick).toBeDefined();
  });
});
