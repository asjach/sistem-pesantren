import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type ComponentProps } from 'vitest';

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
    kelas: 'IA', tingkat: '1', jenjang_riwayat: ['MI'], foto_dokumen_id: null, foto_profil: false, status_akhir: 'aktif', aktif: true,
    sel: { '1-2025-07': selJul, '1-2025-08': selAgu },
    total_tagihan: 100000, total_terbayar: 0, tunggakan: 0,
    ...timpa,
  };
}

type EkstraProps = Partial<ComponentProps<typeof TagihanCrosstab>>;

function renderCrosstab(
  b: CrosstabBaris,
  onPilih = () => {},
  terpilihId: number | null = null,
  onTambah?: (baris: CrosstabBaris, kolom: CrosstabKolom, anchor: HTMLElement) => void,
  extra: EkstraProps = {},
) {
  return renderDenganTema(
    <TagihanCrosstab
      data={{ kolom: KOLOM, baris: [b], total: 1, per_page: 25, current_page: 1, last_page: 1 }}
      loading={false}
      terpilihId={terpilihId}
      onPilih={onPilih}
      onTambah={onTambah}
      emptyText="Kosong"
      {...extra}
    />,
  );
}

/** Sel terisi adalah teks biasa (span), bukan tombol — jadi query-nya lewat
 *  teks nominal, bukan role 'button'. Dua sel bernominal sama → urutannya
 *  mengikuti kolom (Jul index 0, Agu index 1). */
function selUji(i: number): HTMLElement {
  return screen.getAllByText('50.000')[i];
}

/** jsdom tak punya PointerEvent; MouseEvent bertipe pointer* dipakai supaya
 *  properti `button`/`ctrlKey`/`shiftKey` terbaca seperti di browser. */
function pointerEv(el: Element, tipe: 'pointerdown' | 'pointerup', o: { button?: number; ctrlKey?: boolean; shiftKey?: boolean } = {}) {
  fireEvent(el, new MouseEvent(tipe, {
    bubbles: true, cancelable: true,
    button: o.button ?? 0, ctrlKey: o.ctrlKey ?? false, shiftKey: o.shiftKey ?? false,
  }));
}

describe('warna sel crosstab menurut jatuh tempo', () => {
  it('terlambat merah + tebal', () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const merah = selUji(0);
    expect(merah.className).toContain('text-destructive');
    expect(merah.className).toContain('font-semibold');
  });

  it('belum jatuh tempo dibuat samar, bukan merah', () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const netral = selUji(1);
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
    expect(screen.getAllByText('50.000')).toHaveLength(2);
    for (const teks of screen.getAllByText('50.000')) {
      expect(teks.className).toContain('text-emerald-700');
      expect(teks.className).not.toContain('text-destructive');
    }
  });
});

describe('tooltip hover sel crosstab', () => {
  async function hoverSel(i: number) {
    await userEvent.hover(selUji(i));
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

describe('onPilih meneruskan data (keyboard)', () => {
  /* Klik kiri sudah dipakai untuk seleksi, jadi aksi per tagihan hanya lewat
     klik kanan (lihat describe berikut) atau aktivasi keyboard (Enter/Spasi). */
  it('Enter pada sel memanggil onPilih dengan nama & label', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    const selAgustus = selUji(1);
    selAgustus.focus();
    fireEvent.keyDown(selAgustus, { key: 'Enter' });
    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][0].id).toBe(2);
    expect(onPilih.mock.calls[0][1]).toMatchObject({ nama: 'Santri Uji', label: 'Infaq Bulanan · Agu 2025' });
    // Argumen ketiga = elemen sel, dipakai halaman sebagai jangkar popover.
    expect(onPilih.mock.calls[0][2]).toBe(selAgustus);
  });
});

describe('sel tagihan: klik kanan = aksi, klik kiri = seleksi', () => {
  it('klik kanan melaporkan sel + jangkar elemen sel', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    const selJuli = selUji(0);
    fireEvent.contextMenu(selJuli);
    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][0].id).toBe(1);
    expect(onPilih.mock.calls[0][2]).toBe(selJuli);
  });

  it('klik kanan sekaligus men-select sel itu saja (onPilihSatu)', () => {
    const onPilihSatu = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onPilihSatu });
    fireEvent.contextMenu(selUji(0));
    expect(onPilihSatu).toHaveBeenCalledTimes(1);
    expect(onPilihSatu.mock.calls[0][0].id).toBe(1);
    expect(onPilihSatu.mock.calls[0][1]).toBe(1); // jenis_id kolom
  });

  it('klik kanan tidak memunculkan menu browser (preventDefault)', () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    const peristiwa = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fireEvent(selUji(0), peristiwa);
    expect(peristiwa.defaultPrevented).toBe(true);
  });

  /* Di macOS, Ctrl+Klik memicu contextmenu (gestur klik-kanan sistem). Karena
     Ctrl+Klik dimaksudkan untuk toggle seleksi, contextmenu ber-ctrl/meta
     harus diabaikan supaya toggle di pointerup yang jalan. */
  it('Ctrl+klik (contextmenu macOS) tidak membuka aksi per tagihan', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    fireEvent(selUji(0), new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(onPilih).not.toHaveBeenCalled();
  });

  it('klik kiri biasa hanya memilih satu sel, tidak membuka aksi per tagihan', () => {
    const onPilih = vi.fn();
    const onPilihSatu = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih, null, undefined, { onPilihSatu });
    pointerEv(selUji(0), 'pointerup');
    expect(onPilihSatu).toHaveBeenCalledTimes(1);
    expect(onPilihSatu.mock.calls[0][0].id).toBe(1);
    expect(onPilih).not.toHaveBeenCalled();
  });

  /* Cincin sel aktif (dari klik kanan) digambar sebagai satu overlay, bukan
     class ring di tiap sel. Mengoper `terpilihId` ke baris membuat props SEMUA
     baris berubah tiap klik, sehingga memo tak berlaku dan ribuan elemen
     dirender ulang -- itu yang membuat popover terlambat ~250ms. */
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
    const selTerpilih = selUji(1);
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
    const selJuli = selUji(0);
    await userEvent.hover(selJuli);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await userEvent.click(selJuli);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('klik kanan juga menutup kartu hover', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    const selJuli = selUji(0);
    await userEvent.hover(selJuli);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    fireEvent.contextMenu(selJuli);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('kartu tak muncul lagi karena jitter kecil, tapi muncul setelah pointer bergerak jauh', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    const selJuli = selUji(0);
    // jsdom tak punya layout -> semua rect 0,0. Beri rect palsu supaya
    // ambang "pointer harus bergerak jauh" benar-benar teruji.
    selJuli.getBoundingClientRect = () => ({
      left: 570, top: 190, width: 60, height: 20, right: 630, bottom: 210, x: 570, y: 190,
      toJSON: () => ({}),
    }) as DOMRect;
    await userEvent.hover(selJuli);
    await screen.findByRole('tooltip');

    // Klik kanan membuka popover → kartu ditutup dan posisi klik dicatat.
    fireEvent.contextMenu(selJuli);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());

    // Gerak < 6px dari titik klik → masih ditekan.
    fireEvent.mouseMove(selJuli, { clientX: 601, clientY: 200 });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Gerak jauh → kartu hidup lagi.
    fireEvent.mouseMove(selJuli, { clientX: 640, clientY: 200 });
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  });
});

describe('popover terbuka mematikan kartu hover', () => {
  it('kartu tak muncul saat popover untuk sel lain sedang terbuka', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, 99);
    await userEvent.hover(selUji(0));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('kartu muncul lagi setelah popover ditutup (terpilihId null)', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null);
    await userEvent.hover(selUji(0));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  });
});

describe('pemilihan sel lewat pointer (bukan onClick)', () => {
  it('klik kiri (pointerup) memanggil onPilihSatu', () => {
    const onPilihSatu = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onPilihSatu });
    pointerEv(selUji(1), 'pointerup');
    expect(onPilihSatu).toHaveBeenCalledTimes(1);
    expect(onPilihSatu.mock.calls[0][0].id).toBe(2);
  });

  it('Ctrl+Klik memanggil onTogglePilih (tambah/lepas satu sel)', () => {
    const onTogglePilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onTogglePilih });
    pointerEv(selUji(1), 'pointerup', { ctrlKey: true });
    expect(onTogglePilih).toHaveBeenCalledTimes(1);
    expect(onTogglePilih.mock.calls[0][0].id).toBe(2);
  });

  it('Shift+Klik memilih blok dari anchor (onPilihBlok)', () => {
    const onPilihBlok = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onPilihBlok });
    pointerEv(selUji(0), 'pointerup'); // klik biasa dulu → anchor di Jul
    pointerEv(selUji(1), 'pointerup', { shiftKey: true });
    expect(onPilihBlok).toHaveBeenCalledTimes(1);
    // Blok persegi dari Jul ke Agu = kedua sel.
    expect(onPilihBlok.mock.calls[0][0]).toHaveLength(2);
  });

  it('tahan-geser memilih blok, bukan pilih satu sel', () => {
    const onPilihBlok = vi.fn();
    const onPilihSatu = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onPilihBlok, onPilihSatu });
    const [jul, agu] = screen.getAllByText('50.000');
    pointerEv(jul, 'pointerdown');
    fireEvent.pointerEnter(agu); // masuk ke sel lain → geser = blok
    pointerEv(agu, 'pointerup');
    expect(onPilihBlok).toHaveBeenCalledTimes(1);
    expect(onPilihSatu).not.toHaveBeenCalled();
  });

  it('klik keyboard (Enter) tetap membuka aksi per tagihan', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    fireEvent.keyDown(selUji(0), { key: 'Enter' });
    expect(onPilih).toHaveBeenCalledTimes(1);
  });

  it('tombol tengah/kanan tidak memicu seleksi', () => {
    const onPilihSatu = vi.fn();
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih, null, undefined, { onPilihSatu });
    const selJuli = selUji(0);
    pointerEv(selJuli, 'pointerup', { button: 1 });
    pointerEv(selJuli, 'pointerup', { button: 2 });
    expect(onPilihSatu).not.toHaveBeenCalled();
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

describe('TagihanCrosstab — sel kosong bisa tambah tagihan', () => {
  /** Baris dengan sel Agustus kosong (tanpa tagihan). */
  function barisKosongAgu(): CrosstabBaris {
    const b = baris(sel({}), sel({ id: 2 }));
    return { ...b, sel: { '1-2025-07': b.sel['1-2025-07'] } };
  }

  it('tanpa onTambah: sel kosong tetap titik inert', () => {
    renderCrosstab(barisKosongAgu());
    expect(screen.getByText('·')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tambah tagihan/ })).not.toBeInTheDocument();
  });

  it('dengan onTambah: tombol tambah memanggil dengan baris + kolom + jangkar', () => {
    const onTambah = vi.fn();
    renderCrosstab(barisKosongAgu(), () => {}, null, onTambah);
    const tombol = screen.getByRole('button', { name: 'Tambah tagihan Infaq Bulanan · Agu 2025 untuk Santri Uji' });
    fireEvent.click(tombol);
    expect(onTambah).toHaveBeenCalledTimes(1);
    expect(onTambah.mock.calls[0][0]).toMatchObject({ santri_id: 7, nama: 'Santri Uji' });
    expect(onTambah.mock.calls[0][1]).toMatchObject({ jenis_id: 1, periode: '2025-08' });
    expect(onTambah.mock.calls[0][2]).toBe(tombol);
  });
});
