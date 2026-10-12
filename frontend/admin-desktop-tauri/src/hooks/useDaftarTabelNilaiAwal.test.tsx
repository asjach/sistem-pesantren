import { waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import PresetUrut from '@/components/PresetUrut';
import { renderDenganTema } from '@/test/utils';
import { muatKomponenCustom } from '@/api/komponenCustom';
import { resetSetelanKomponen, setelanKomponen, simpanSetelanKomponen } from '@/components/komponenCustom';

/* Setelan komponen custom disimpan di server; API-nya dimock agar tes bisa
   menyemai setelan lewat store klien tanpa jaringan. */
vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

beforeEach(() => {
  resetSetelanKomponen();
});
import { useDaftarTabel } from './useDaftarTabel';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
});

vi.mock('@/api/urutPreset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/urutPreset')>();
  return {
    ...asli,
    muatUrutPreset: vi.fn(async () => ({
      pesan: 'ok',
      data: {
        table_key: 'uji_int',
        opsi: [
          { kode: ['nama'], label: 'Nama' },
          { kode: ['kelas'], label: 'Kelas' },
        ],
        tersedia: [],
      },
    })),
  };
});

/** Harness: `useDaftarTabel` + `PresetUrut` seperti di halaman tabel nyata. */
function Harness({ dicatat }: { dicatat: (urut: string[]) => void }) {
  const d = useDaftarTabel<{ id: number }>({
    tableKey: 'uji_int',
    search: '',
    deps: [],
    ambil: async (a) => {
      dicatat(a.urut);
      return { data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 };
    },
  });
  return (
    <PresetUrut tableKey="uji_int" urutAktif={d.urut} arahUrut={d.arahUrut} onUrut={d.terapkanUrut} />
  );
}

describe('useDaftarTabel + PresetUrut — nilai awal dari popover', () => {
  it('muat terakhir memakai urutan nilai awal', async () => {
    // Server sudah menyimpan nilai awal; komponen memuatnya sekali saat tampil.
    vi.mocked(muatKomponenCustom).mockResolvedValueOnce({
      pesan: 'ok',
      data: { peta: { '|select_urut_uji_int': { nilaiDefault: 'Kelas' } } },
    });
    const calls: string[][] = [];
    renderDenganTema(<Harness dicatat={(u) => calls.push(u)} />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    // Beri waktu semua efek/async selesai supaya terlihat request TERAKHIR.
    await new Promise((r) => setTimeout(r, 300));

    // Default diterapkan, dan muat ulang sesudahnya TIDAK boleh menimpanya
    // dengan urutan kosong (dulu: muat terakhir = [] sehingga tabel tak urut).
    expect(calls).toContainEqual(['kelas']);
    expect(calls[calls.length - 1]).toEqual(['kelas']);
  });
});
