import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ExcelTabelV2 from './ExcelTabelV2';

vi.mock('@/theme', () => ({
  useTheme: () => ({ iconSet: 'lucide' }),
}));

function tampilkan() {
  return render(<ExcelTabelV2 judul="Daftar kelas" />);
}

describe('ExcelTabelV2', () => {
  it('menyusun pembungkus header, body, dan footer', () => {
    const { container } = tampilkan();
    const root = container.querySelector('[data-slot="excel-table"]');
    const header = container.querySelector('[data-slot="excel-table-header"]');
    const body = container.querySelector('[data-slot="excel-table-body"]');
    const footer = container.querySelector('[data-slot="excel-table-footer"]');

    expect(root).not.toBeNull();
    expect(root).toHaveAttribute('data-varian', 'v2');
    expect(header).toHaveAttribute('data-part', 'header_tabel');
    expect(footer).toHaveAttribute('data-part', 'kaki_tabel');
    expect(body).toBeEmptyDOMElement();
    expect(root).toContainElement(header as HTMLElement);
    expect(root).toContainElement(body as HTMLElement);
    expect(root).toContainElement(footer as HTMLElement);
  });

  it('menampilkan judul, area aksi kosong, dan trigger menu tanpa label visual', () => {
    const { container } = tampilkan();

    expect(screen.getByText('Daftar kelas')).toBeInTheDocument();

    const areaAksi = container.querySelector('[data-slot="excel-table-actions"]');
    expect(areaAksi).toBeEmptyDOMElement();

    const tombolMenu = screen.getByRole('button', { name: 'Menu lainnya' });
    expect(tombolMenu).toHaveAttribute('data-trigger', 'excel-table-menu');
    expect(tombolMenu.textContent).toBe('');
  });
});
