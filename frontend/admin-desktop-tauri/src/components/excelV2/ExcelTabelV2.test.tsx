import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ExcelTabelV2 from './ExcelTabelV2';

vi.mock('@/theme', () => ({
  useTheme: () => ({ iconSet: 'lucide' }),
}));

vi.mock('@/components/PresetUrut', () => ({
  default: ({ tableKey }: { tableKey: string }) => <span data-testid="preset-urut">{tableKey}</span>,
}));
vi.mock('@/components/PresetKolom', () => ({
  default: ({ tableKey }: { tableKey: string }) => <span data-testid="preset-kolom">{tableKey}</span>,
}));

function tampilkan() {
  return render(
    <ExcelTabelV2
      judul="Daftar kelas"
      tableKey="daftar_kelas"
      fields={[]}
      onApplyPreset={() => {}}
    />,
  );
}

describe('ExcelTabelV2', () => {
  it('menyusun pembungkus toolbar, body, dan footer', () => {
    const { container } = tampilkan();
    const root = container.querySelector('[data-slot="excel-table"]');
    const toolbar = container.querySelector('[data-slot="excel-table-toolbar"]');
    const body = container.querySelector('[data-slot="excel-table-body"]');
    const footer = container.querySelector('[data-slot="table-footer"]');

    expect(root).not.toBeNull();
    expect(root).toHaveAttribute('data-varian', 'v2');
    expect(toolbar).not.toBeNull();
    expect(footer).toHaveAttribute('data-part', 'kaki_tabel');
    expect(body).toBeEmptyDOMElement();
    expect(root).toContainElement(toolbar as HTMLElement);
    expect(root).toContainElement(body as HTMLElement);
    expect(root).toContainElement(footer as HTMLElement);
  });

  it('menampilkan judul, area aksi kosong, dan trigger menu tanpa label visual', () => {
    const { container } = tampilkan();

    expect(screen.getByText('Daftar kelas')).toBeInTheDocument();

    const areaAksi = container.querySelector('[data-slot="excel-table-actions"]');
    expect(areaAksi).toBeEmptyDOMElement();

    const tombolFilter = screen.getByRole('button', { name: 'Area filter' });
    expect(tombolFilter).toHaveAttribute('data-trigger', 'excel-table-filter');
    expect(tombolFilter.textContent).toBe('');

    const tombolMenu = screen.getByRole('button', { name: 'Menu lainnya' });
    expect(tombolMenu).toHaveAttribute('data-trigger', 'excel-table-menu');
    expect(tombolMenu.textContent).toBe('');
  });

  it('membuka area filter selebar toolbar saat tombol diklik', async () => {
    const user = userEvent.setup();
    const { container } = tampilkan();
    const tombol = screen.getByRole('button', { name: 'Area filter' });

    expect(container.querySelector('[data-slot="excel-table-filter-area"]')).toBeNull();
    expect(tombol).toHaveAttribute('aria-expanded', 'false');

    await user.click(tombol);
    const area = container.querySelector('[data-slot="excel-table-filter-area"]');
    const kiri = area?.querySelector('[data-slot="excel-table-filter-left"]');
    const kanan = area?.querySelector('[data-slot="excel-table-filter-right"]');
    expect(area).not.toBeNull();
    expect(kiri).toBeEmptyDOMElement();
    expect(kanan?.querySelector('[data-testid="preset-urut"]')).not.toBeNull();
    expect(kanan?.querySelector('[data-testid="preset-kolom"]')).not.toBeNull();
    expect(tombol).toHaveAttribute('aria-expanded', 'true');

    await user.click(tombol);
    expect(container.querySelector('[data-slot="excel-table-filter-area"]')).toBeNull();
    expect(tombol).toHaveAttribute('aria-expanded', 'false');
  });
});
