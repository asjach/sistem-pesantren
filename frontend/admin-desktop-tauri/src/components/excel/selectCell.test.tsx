import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CellProps } from 'react-datasheet-grid';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/theme';
import { SelectCell, SelectRadixCell } from './cells';
import { INPUT_ROW_ID } from './helpers';
import type { GridRow, SelectColData } from './types';

const PILIHAN = [
  { value: '1', label: 'Infaq Bulanan' },
  { value: '2', label: 'SPP' },
];

/** Render sel dropdown seperti grid saat sel aktif (`focus`). */
function renderSel(
  rowData: Partial<GridRow> = {},
  columnData: Partial<SelectColData> = {},
) {
  const setRowData = vi.fn();
  const props = {
    rowData: { id: 9, checked: false, ...rowData } as GridRow,
    setRowData,
    columnData: { fieldKey: 'jenis', choices: PILIHAN, ...columnData } as SelectColData,
    focus: true,
    stopEditing: vi.fn(),
    disabled: false,
    columnIndex: 1,
  } as unknown as CellProps<GridRow, SelectColData>;

  render(<SelectCell {...props} />);

  return { setRowData, select: screen.getByLabelText('jenis') as HTMLSelectElement };
}

describe('SelectCell — opsi pertama harus benar-benar bisa dipilih', () => {
  it('sel kosong diawali opsi petunjuk, bukan opsi pertama yang "sudah terpilih"', () => {
    const { select } = renderSel({ jenis: '' });

    // Tanpa opsi kosong, browser menampilkan opsi pertama seolah terpilih
    // padahal nilainya tak cocok — klik pertama jadi tak menghasilkan apa-apa.
    expect(select.value).toBe('');
    expect(select.options).toHaveLength(PILIHAN.length + 1);
    expect(select.options[0].value).toBe('');
    expect(select.options[0].disabled).toBe(true);
    expect(select.options[0].textContent).toBe('Pilih…');
    expect(select.options[1].value).toBe('1');
  });

  it('memilih nilai PERTAMA tetap mengirim perubahan', async () => {
    const { select, setRowData } = renderSel({ jenis: '' });

    await userEvent.selectOptions(select, '1');

    expect(setRowData).toHaveBeenCalledTimes(1);
    expect(setRowData).toHaveBeenCalledWith(expect.objectContaining({ jenis: '1' }));
  });

  it('baris input memakai pilihan `choicesInput` dengan petunjuk yang sama', async () => {
    const { select, setRowData } = renderSel(
      { id: INPUT_ROW_ID, jenis: '' },
      { choicesInput: [{ value: '7', label: 'Daftar Ulang' }] },
    );

    // `choicesInput` menggantikan `choices` di baris input: petunjuk + 1 pilihan.
    expect(select.options).toHaveLength(2);
    expect(select.options[0].textContent).toBe('Pilih…');
    expect(select.options[1].textContent).toBe('Daftar Ulang');

    await userEvent.selectOptions(select, '7');
    expect(setRowData).toHaveBeenCalledWith(expect.objectContaining({ jenis: '7' }));
  });

  it('nilai yang sudah cocok tidak menambah opsi kosong', () => {
    const { select } = renderSel({ jenis: '2' });

    expect(select.value).toBe('2');
    expect(select.options).toHaveLength(PILIHAN.length);
    expect(select.options[0].value).toBe('1');
  });

  it('nilai lama di luar daftar tampil apa adanya, tak tersamar jadi opsi pertama', () => {
    const { select } = renderSel({ jenis: '9' });

    expect(select.value).toBe('');
    expect(select.options[0].textContent).toBe('9');
    expect(select.options[0].disabled).toBe(true);
    // Pilihan sah berikutnya tetap satu langkah dari nilai lama.
    expect(select.options[1].value).toBe('1');
  });

  it('petunjuk bisa diganti per kolom', () => {
    const { select } = renderSel({ jenis: '' }, { placeholder: 'Pilih jenis tagihan…' });

    expect(select.options[0].textContent).toBe('Pilih jenis tagihan…');
  });

  it('choicesForRow menggantikan choices untuk baris data', () => {
    const { select } = renderSel({ id: 9, jenis: '5' }, {
      choices: PILIHAN,
      choicesForRow: (id) => [{ value: '5', label: `Baris ${id}` }],
    });

    expect(select.options).toHaveLength(1);
    expect(select.options[0].textContent).toBe('Baris 9');
  });
});

describe('SelectRadixCell — pilihan per baris', () => {
  it('menampilkan label dari choicesForRow', () => {
    const props = {
      rowData: { id: 9, checked: false, jenis: '5' } as GridRow,
      setRowData: vi.fn(),
      columnData: {
        fieldKey: 'jenis',
        choices: [],
        choicesForRow: (id: number | string) => [{ value: '5', label: `Mapel ${id}` }],
      } as SelectColData,
      focus: true,
      stopEditing: vi.fn(),
      disabled: false,
      columnIndex: 1,
    } as unknown as CellProps<GridRow, SelectColData>;

    render(<ThemeProvider><SelectRadixCell {...props} /></ThemeProvider>);

    expect(screen.getByRole('button', { name: 'jenis' }).textContent).toContain('Mapel 9');
  });
});
