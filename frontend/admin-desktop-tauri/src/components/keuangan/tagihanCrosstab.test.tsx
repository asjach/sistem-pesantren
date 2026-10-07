import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderDenganTema } from '@/test/utils';
import type { CrosstabBaris, CrosstabKolom, CrosstabSel } from '@/api/keuangan';
import TagihanCrosstab from './TagihanCrosstab';

const KOLOM: CrosstabKolom[] = [
  { key: '1-2025-07', jenis_id: 1, jenis_nama: 'Infaq Bulanan', tipe: 'bulanan', periode: '2025-07' },
  { key: '1-2025-08', jenis_id: 1, jenis_nama: 'Infaq Bulanan', tipe: 'bulanan', periode: '2025-08' },
];

function sel(partial: Partial<CrosstabSel>): CrosstabSel {
  return {
    id: 1, nominal: 50000, terbayar: 0, sisa: 50000,
    status: 'belum', jatuh_tempo: '2025-08-10', terlambat: false, tahun_ajaran: '2025/2026', ...partial,
  };
}

function baris(selJul: CrosstabSel, selAgu: CrosstabSel, timpa: Partial<CrosstabBaris> = {}): CrosstabBaris {
  return {
    santri_id: 7, nama: 'Santri Uji', jenjang: 'MI',
    ayah_nama: 'Ayah Uji', ibu_nama: 'Ibu Uji',
    kelas: 'IA', tingkat: '1', status_akhir: 'aktif', aktif: true,
    sel: { '1-2025-07': selJul, '1-2025-08': selAgu },
    total_tagihan: 100000, total_terbayar: 0, tunggakan: 0,
    ...timpa,
  };
}

function renderCrosstab(b: CrosstabBaris, onPilih = () => {}) {
  return renderDenganTema(
    <TagihanCrosstab
      data={{ kolom: KOLOM, baris: [b], total: 1, per_page: 25, current_page: 1, last_page: 1 }}
      loading={false}
      terpilihId={null}
      onPilih={onPilih}
      emptyText="Kosong"
    />,
  );
}

describe('warna sel crosstab menurut jatuh tempo', () => {
  it('terlambat merah + tebal', () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const merah = screen.getAllByRole('button', { name: '50.000' })[0];
    expect(merah.className).toContain('text-destructive');
    expect(merah.className).toContain('font-semibold');
  });

  it('belum jatuh tempo dibuat samar, bukan merah', () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const netral = screen.getAllByRole('button', { name: '50.000' })[1];
    expect(netral.className).not.toContain('text-destructive');
    // Samar: teks pudar, bukan warna penuh seperti sel tunggakan.
    expect(netral.className).toContain('text-muted-foreground/50');
    expect(netral.className).toContain('bg-muted/20');
  });

  it('lunas hijau walau jatuh tempo sudah lewat', () => {
    renderCrosstab(baris(
      sel({ status: 'lunas', sisa: 0, terbayar: 50000 }),
      sel({ id: 2, status: 'lunas', sisa: 0, terbayar: 50000 }),
    ));
    for (const tombol of screen.getAllByRole('button')) {
      expect(tombol.className).toContain('text-emerald-700');
      expect(tombol.className).not.toContain('text-destructive');
    }
  });
});

describe('tooltip hover sel crosstab', () => {
  async function hoverSel(i: number) {
    const tombol = screen.getAllByRole('button', { name: '50.000' })[i];
    await userEvent.hover(tombol);
    return screen.getByRole('tooltip');
  }

  it('menampilkan nama, tarif, nominal, terbayar, sisa, dan periode bulanan', async () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const tip = await hoverSel(0);
    expect(tip).toHaveTextContent('Santri Uji');
    expect(tip).toHaveTextContent('Nama Tarif');
    expect(tip).toHaveTextContent('Infaq Bulanan');
    expect(tip).toHaveTextContent('Periode');
    expect(tip).toHaveTextContent('Jul 2025');
    expect(tip).toHaveTextContent('Rp 50.000');
  });

});

describe('klik sel tetap meneruskan data', () => {
  it('memanggil onPilih dengan nama & label', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })), onPilih);
    screen.getAllByRole('button', { name: '50.000' })[0].click();
    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][1]).toMatchObject({ nama: 'Santri Uji' });
  });
});
describe('sel tagihan: klik kiri = klik kanan', () => {
  it('klik kiri melaporkan sel + jangkar elemen sel', async () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    const tombol = screen.getAllByRole('button', { name: '50.000' })[1];
    await userEvent.click(tombol);
    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][0].id).toBe(2);
    expect(onPilih.mock.calls[0][1]).toMatchObject({ nama: 'Santri Uji', label: 'Infaq Bulanan · Agu 2025' });
    // Argumen ketiga = elemen sel, dipakai halaman sebagai jangkar popover.
    expect(onPilih.mock.calls[0][2]).toBe(tombol);
  });

  it('klik kanan melapor dengan cara yang sama', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    const tombol = screen.getAllByRole('button', { name: '50.000' })[0];
    fireEvent.contextMenu(tombol);
    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][0].id).toBe(1);
    expect(onPilih.mock.calls[0][2]).toBe(tombol);
  });

  it('klik kanan tidak memunculkan menu browser (preventDefault)', () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    const tombol = screen.getAllByRole('button', { name: '50.000' })[0];
    const peristiwa = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fireEvent(tombol, peristiwa);
    expect(peristiwa.defaultPrevented).toBe(true);
  });

  /* Cincin sel terpilih digambar sebagai satu overlay, bukan class ring di
     tiap sel. Mengoper `terpilihId` ke baris membuat props SEMUA baris
     berubah tiap klik, sehingga memo tak berlaku dan ribuan tombol dirender
     ulang -- itu yang membuat popover terlambat ~250ms. */
  it('sel terpilih digarisbawahi overlay tunggal, bukan class ring di sel', () => {
    render(
      <TagihanCrosstab
        data={{ kolom: KOLOM, baris: [baris(sel({}), sel({ id: 2 }))], total: 1, per_page: 25, current_page: 1, last_page: 1 }}
        loading={false}
        terpilihId={2}
        onPilih={() => {}}
        emptyText="Kosong"
      />,
    );
    const selTerpilih = screen.getAllByRole('button', { name: '50.000' })[1];
    expect(selTerpilih.className).not.toContain('ring-2');

    const cincin = document.getElementById('cincin_sel_tagihan');
    expect(cincin).not.toBeNull();
    // Tak boleh menutupi selnya sendiri, atau sel tak bisa diklik.
    expect(cincin?.className).toContain('pointer-events-none');
  });

  it('tanpa terpilihId tidak ada overlay', () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    expect(document.getElementById('cincin_sel_tagihan')).toBeNull();
  });
});

describe('kartu hovervs popover: tak boleh menumpuk', () => {
  it('klik kiri menutup kartu hover', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    const tombol = screen.getAllByRole('button', { name: '50.000' })[0];
    await userEvent.hover(tombol);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await userEvent.click(tombol);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('klik kanan juga menutup kartu hover', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    const tombol = screen.getAllByRole('button', { name: '50.000' })[0];
    await userEvent.hover(tombol);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    fireEvent.contextMenu(tombol);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('kartu tak muncul lagi karena jitter kecil, tapi muncul setelah pointer bergerak jauh', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    const tombol = screen.getAllByRole('button', { name: '50.000' })[0];
    // jsdom tak punya layout -> semua rect 0,0. Beri rect palsu supaya
    // ambang "pointer harus bergerak jauh" benar-benar teruji.
    tombol.getBoundingClientRect = () => ({
      left: 570, top: 190, width: 60, height: 20, right: 630, bottom: 210, x: 570, y: 190,
      toJSON: () => ({}),
    }) as DOMRect;
    await userEvent.hover(tombol);
    await screen.findByRole('tooltip');

    fireEvent.click(tombol);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());

    // Gerak < 6px dari titik klik → masih ditekan.
    fireEvent.mouseMove(tombol, { clientX: 601, clientY: 200 });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Gerak jauh → kartu hidup lagi.
    fireEvent.mouseMove(tombol, { clientX: 640, clientY: 200 });
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  });
});

describe('pemilihan sel pada pointerdown (bukan click)', () => {
  /* jsdom tak punya PointerEvent; fireEvent.pointerDown membuat Event biasa
     tanpa `button`. Pakai MouseEvent bertipe pointerdown supaya `button`
     terbaca seperti di browser. */
  const pointerDown = (el: Element, button: number) =>
    fireEvent(el, new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button }));

  /* Radix DismissableLayer membatalkan pointerdown saat popover sudah terbuka,
     sehingga browser tak melempar `click` → pindah sel harus terjadi di
     pointerdown, kalau tidak pengguna harus klik dua kali. */
  it('pointerdown tombol kiri langsung memanggil onPilih', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    pointerDown(screen.getAllByRole('button', { name: '50.000' })[0], 0);
    expect(onPilih).toHaveBeenCalledTimes(1);
  });

  it('pointerdown + click dalam satu gesture tetap satu pemanggilan', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    const tombol = screen.getAllByRole('button', { name: '50.000' })[0];
    pointerDown(tombol, 0);
    fireEvent.click(tombol);
    expect(onPilih).toHaveBeenCalledTimes(1);
  });

  it('klik keyboard (tanpa pointerdown) tetap memilih', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    fireEvent.click(screen.getAllByRole('button', { name: '50.000' })[0]);
    expect(onPilih).toHaveBeenCalledTimes(1);
  });

  it('tombol tengah/kanan tidak memicu pemilihan di pointerdown', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    const tombol = screen.getAllByRole('button', { name: '50.000' })[0];
    pointerDown(tombol, 1);
    pointerDown(tombol, 2);
    expect(onPilih).not.toHaveBeenCalled();
  });
});

describe('TagihanCrosstab — kolom Santri', () => {
  it('menampilkan orang tua & kelas di bawah nama', () => {
    renderCrosstab(baris(sel({ nominal: 1000 }), sel({ nominal: 1000 }), {
      ayah_nama: 'Ayah Uji', ibu_nama: 'Ibu Uji', tingkat: '4', kelas: '4B',
    }));
    // Baris kecil berisi "Ayah · Ibu · kelas" — tingkat tidak ikut (sudah
    // tercermin dari nama kelas).
    expect(screen.getByText(/Ayah Uji · Ibu Uji · 4B/)).toBeInTheDocument();
    expect(screen.queryByText(/4 4B/)).not.toBeInTheDocument();
    expect(screen.getByText(/Ayah Uji/).className).toMatch(/text-\[8px\]/);
  });

  it('beranda titik hijau saat aktif dan merah saat sudah Pindah/Keluar', () => {
    const { unmount } = renderCrosstab(baris(sel({ nominal: 1000 }), sel({ nominal: 1000 }), { aktif: true, status_akhir: 'naik' }));
    const hijau = screen.getByTitle('Aktif');
    expect(hijau.className).toMatch(/bg-emerald-500/);
    unmount();

    renderCrosstab(baris(sel({ nominal: 1000 }), sel({ nominal: 1000 }), { aktif: false, status_akhir: 'pindah_keluar' }));
    const merah = screen.getByTitle(/Tidak aktif/);
    expect(merah.className).toMatch(/bg-destructive/);
  });

  it('baris tanpa kelas maupun orang tua tidak menambah baris kosong', () => {
    renderCrosstab(baris(sel({ nominal: 1000 }), sel({ nominal: 1000 }), {
      ayah_nama: null, ibu_nama: null, tingkat: null, kelas: null,
    }));
    expect(screen.getByText('Santri Uji')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});
