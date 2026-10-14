import { screen, waitFor } from '@testing-library/react';
import { renderDenganTema } from '@/test/utils';
import { describe, expect, it } from 'vitest';
import { CariGlobalProvider } from '@/hooks/useCariGlobal';
import { TopBarSearch, TopBarSearchProvider, useTopBarSearchCtx } from '@/components/TopBarSearch';

function SlotCari() {
  const ctx = useTopBarSearchCtx();
  return <div data-testid='slot' ref={(el) => ctx?.setEl(el)} />;
}

describe('slot', () => {
  it('portal muncul setelah slot terpasang', async () => {
    renderDenganTema(
      <CariGlobalProvider>
        <TopBarSearchProvider>
          <SlotCari />
          <TopBarSearch value='' onChange={() => {}} placeholder='Cari nama / ayah / ibu…' />
        </TopBarSearchProvider>
      </CariGlobalProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('slot').children.length).toBeGreaterThan(0));
    console.log('ISI SLOT: ' + screen.getByTestId('slot').innerHTML.slice(0, 160));
    expect(document.getElementById('input_cari_topbar')).toBeTruthy();
  });
});