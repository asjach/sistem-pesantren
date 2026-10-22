import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderDenganTema } from '@/test/utils';

const v2 = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
}));

/** Grid V2 mengukur tinggi wadah; di jsdom tingginya 0 sehingga badan grid tak
 *  digambar. Tes ini memeriksa kontrak TabelRingkas → ExcelTabelV2 (pemetaan
 *  kolom/baris dan sakelar baca-saja), bukan mesin grid. */
vi.mock('@/components/excelV2/ExcelTabelV2', () => ({
  default: (props: {
    tableKey: string;
    header?: ReactNode;
    akhirToolbar?: ReactNode;
    fields: { key: string; label: string }[];
    rows: { id: string }[];
    getValues: (row: { id: string }) => Record<string, string | null>;
    emptyText?: string;
    maxRows?: number;
    hideCheckbox?: boolean;
    hideActions?: boolean;
    hidePreset?: boolean;
  }) => {
    v2.props = props;
    const isi = props.rows.length === 0
      ? <p>{props.emptyText}</p>
      : props.rows.map((r) => {
        const nilai = props.getValues(r);
        return (
          <p key={r.id}>
            {props.fields.map((f) => `${f.label}: ${nilai[f.key] ?? '—'}`).join(' | ')}
          </p>
        );
      });
    return (
      <div data-table={props.tableKey}>
        <div>{props.header}</div>
        {props.akhirToolbar}
        {isi}
      </div>
    );
  },
}));

import TabelRingkas from './TabelRingkas';

beforeEach(() => {
  vi.clearAllMocks();
  v2.props = null;
});

describe('TabelRingkas — tabel baca-saja', () => {
  it('meneruskan judul, kolom, dan nilai baris ke ExcelTabelV2', () => {
    const { container } = renderDenganTema(
      <TabelRingkas
        tableKey="uji"
        judul="Per tahun ajaran"
        kolom={[{ key: 'ta', label: 'Tahun ajaran' }, { key: 'jumlah', label: 'JML' }]}
        baris={[['2026/2027', 12], ['2025/2026', 10]]}
      />,
    );

    expect(v2.props?.tableKey).toBe('uji');
    expect(container.textContent).toContain('Per tahun ajaran');
    expect(container.textContent).toContain('Tahun ajaran: 2026/2027');
    expect(container.textContent).toContain('JML: 12');
    expect(container.textContent).toContain('Tahun ajaran: 2025/2026');
  });

  it('selalu baca-saja: tanpa centang, tanpa Aksi, tanpa preset kolom', () => {
    renderDenganTema(
      <TabelRingkas
        tableKey="uji"
        judul="Per kelas"
        kolom={[{ key: 'kelas', label: 'Kelas' }]}
        baris={[['VII-A']]}
      />,
    );

    expect(v2.props).toMatchObject({
      hideCheckbox: true,
      hideActions: true,
      hidePreset: true,
    });
  });

  it('meneruskan aksi tambahan di sisi kanan judul', () => {
    renderDenganTema(
      <TabelRingkas
        tableKey="uji"
        judul="Per tingkat"
        kolom={[{ key: 'tingkat', label: 'Tingkat' }]}
        baris={[['VII']]}
        aksi={<span>12 santri</span>}
      />,
    );

    expect(v2.props?.akhirToolbar).not.toBeNull();
    expect(document.body.textContent).toContain('12 santri');
  });

  it('meneruskan batas tinggi dan teks kosong', () => {
    renderDenganTema(
      <TabelRingkas
        tableKey="uji"
        judul="Usia per tingkat"
        kolom={[{ key: 'tingkat', label: 'Tingkat' }]}
        baris={[]}
        maxRows={5}
        emptyText="Belum ada data usia (tgl lahir kosong)."
      />,
    );

    expect(v2.props).toMatchObject({
      maxRows: 5,
      emptyText: 'Belum ada data usia (tgl lahir kosong).',
    });
    expect(document.body.textContent).toContain('Belum ada data usia (tgl lahir kosong).');
  });
});
