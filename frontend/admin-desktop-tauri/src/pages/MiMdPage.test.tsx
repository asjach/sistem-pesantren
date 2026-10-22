import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const uji = vi.hoisted(() => ({
  data: {
    lembaga: { mi_id: 'MI', md_id: 'MD' },
    tahun_ajaran: '2026/2027',
    mi_only: [{ santri_id: 1, nama: 'Ahmad', jk: 'L', nis_mi: '001', kelas_mi: '1A' }],
    md_semua: [{ santri_id: 2, nama: 'Bilal', jk: 'L', nis_md: '002', kelas_md: '1B', juga_mi: false }],
    beda_kelas: [{ santri_id: 3, nama: 'Cahya', jk: 'P', kelas_mi: '2A', kelas_md: '2B' }],
  },
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, roles: [{ name: 'super_admin' }], lembagas: [], permissions: [] },
    loading: false,
  }),
}));
vi.mock('@/api/auth', () => ({ bisa: () => true }));
vi.mock('@/api/siklus', () => ({
  listMiMd: vi.fn(async () => uji.data),
  samakanKelasMiMd: vi.fn(async () => ({ pesan: 'ok', gagal: [] })),
  daftarkanMdMiMd: vi.fn(async () => ({ pesan: 'ok', gagal: [] })),
  hapusMdMiMd: vi.fn(async () => ({ pesan: 'ok', gagal: [] })),
}));
vi.mock('@/hooks/useFilterGlobalAktif', () => ({
  useFilterGlobalAktif: () => ({
    tahunAjaranNames: ['2026/2027'],
    semesters: ['1'],
    tingkat: [],
    kelas: [],
    loading: false,
  }),
}));
vi.mock('@/components/VisibilitasFilter', () => ({ PengaturanHalaman: () => null }));
vi.mock('@/components/TopBarSearch', () => ({ TopBarSearch: () => null }));
vi.mock('@/components/santri/useAksiProfilSantri', () => ({
  useAksiProfilSantri: () => ({ aksiProfil: () => null, dialogProfil: null }),
}));
vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizableAutoHidePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => null,
}));
vi.mock('@/components/excelV2/ExcelTabelV2', () => ({
  default: (props: {
    tableKey: string;
    rail?: boolean;
    header?: ReactNode;
    rows: unknown[];
    renderActions?: unknown;
    renderBulkActions?: unknown;
  }) => (
    <div
      data-testid={`v2-${props.tableKey}`}
      data-rail={String(!!props.rail)}
      data-aksi={String(typeof props.renderActions === 'function')}
      data-bulk={String(typeof props.renderBulkActions === 'function')}
      data-baris={String(props.rows.length)}
    >
      {props.header}
    </div>
  ),
}));

import MiMdPage from './MiMdPage';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MiMdPage — migrasi ke ExcelTabelV2', () => {
  it('merender tiga panel V2 dengan rail hanya di MI Only', async () => {
    render(<MiMdPage />);

    const mi = await screen.findByTestId('v2-mi_md_mi');
    const md = screen.getByTestId('v2-mi_md_md');
    const beda = screen.getByTestId('v2-mi_md_beda');

    expect(mi).toHaveAttribute('data-rail', 'true');
    expect(md).toHaveAttribute('data-rail', 'false');
    expect(beda).toHaveAttribute('data-rail', 'false');

    expect(mi).toHaveTextContent('MI Only');
    expect(md).toHaveTextContent('MD Semua');
    expect(beda).toHaveTextContent('Perbandingan Kelas');

    expect(mi).toHaveAttribute('data-aksi', 'true');
    expect(md).toHaveAttribute('data-aksi', 'true');
    expect(beda).toHaveAttribute('data-aksi', 'true');
    expect(mi).toHaveAttribute('data-bulk', 'true');
    expect(md).toHaveAttribute('data-bulk', 'true');
    expect(beda).toHaveAttribute('data-bulk', 'true');

    expect(mi).toHaveAttribute('data-baris', '1');
    expect(md).toHaveAttribute('data-baris', '1');
    expect(beda).toHaveAttribute('data-baris', '1');
  });
});
