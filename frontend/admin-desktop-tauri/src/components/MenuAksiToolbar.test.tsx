import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import MenuAksiToolbar from './MenuAksiToolbar';
import { renderDenganTema } from '@/test/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

describe('MenuAksiToolbar', () => {
  it('meneruskan tombol ber-Tooltip: label teks + klik memanggil onClick tombol', async () => {
    const user = userEvent.setup();
    const onSimpan = vi.fn();
    const onImport = vi.fn();
    renderDenganTema(
      <MenuAksiToolbar triggerId="btn_aksi_uji">
        <Button id="btn_simpan_uji" size="sm" variant="outline" onClick={onSimpan}>
          Simpan
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button id="btn_buka_import_uji" variant="outline" onClick={onImport}>
              Import
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Keterangan import.</p></TooltipContent>
        </Tooltip>
      </MenuAksiToolbar>,
    );

    await user.click(screen.getByRole('button', { name: 'Aksi' }));

    // Label diambil dari teks tombol, bukan id; konten tooltip tak jadi item.
    expect(screen.getByRole('menuitem', { name: 'Simpan' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'btn_buka_import_uji' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Keterangan import.' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onSimpan).not.toHaveBeenCalled();
  });
});
