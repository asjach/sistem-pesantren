import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

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

/** Masuk ke sel lain saat tahan-geser.
 *  `fireEvent.pointerEnter` adalah satu-satunya bentuk yang sampai ke handler
 *  React `onPointerEnter` di jsdom ini; modifier (ctrl/alt) TIDAK terbaca
 *  (selalu null) — cabang modifier diuji lewat helper murni, bukan DOM. */
function pointerMasuk(el: Element) {
  fireEvent.pointerEnter(el);
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

describe('aksi per tagihan lewat keyboard', () => {

  it('Enter pada sel melaporkan aksi dengan nama & label', () => {
    const onAksiKanan = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onAksiKanan });
    const selAgustus = selUji(1);
    selAgustus.focus();
    fireEvent.keyDown(selAgustus, { key: 'Enter' });
    expect(onAksiKanan).toHaveBeenCalledTimes(1);
    expect(onAksiKanan.mock.calls[0][0].id).toBe(2);
    expect(onAksiKanan.mock.calls[0][1]).toMatchObject({ nama: 'Santri Uji', label: 'Infaq Bulanan · Agu 2025' });

    expect(onAksiKanan.mock.calls[0][3]).toMatchObject({ left: expect.any(Number), top: expect.any(Number) });
  });
});

describe('sel tagihan: klik kanan = aksi, klik kiri = seleksi', () => {
  it('klik kanan melaporkan sel + kolom + rect selnya', () => {
    const onAksiKanan = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onAksiKanan });
    const selJuli = selUji(0);
    fireEvent.contextMenu(selJuli);
    expect(onAksiKanan).toHaveBeenCalledTimes(1);
    expect(onAksiKanan.mock.calls[0][0].id).toBe(1);
    expect(onAksiKanan.mock.calls[0][2].key).toBe('1-2025-07');
    expect(onAksiKanan.mock.calls[0][3]).toMatchObject({ left: expect.any(Number), top: expect.any(Number) });
  });

  it('klik kanan TIDAK mengubah pilihan — hanya melaporkan aksi per tagihan', () => {
    const onAksiKanan = vi.fn();
    const onKlikSel = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onAksiKanan, onKlikSel });
    fireEvent.contextMenu(selUji(0));
    expect(onAksiKanan).toHaveBeenCalledTimes(1);
    expect(onAksiKanan.mock.calls[0][0].id).toBe(1);
    expect(onAksiKanan.mock.calls[0][1]).toMatchObject({ nama: 'Santri Uji' });
    expect(onAksiKanan.mock.calls[0][2].jenis_id).toBe(1);

    expect(onKlikSel).not.toHaveBeenCalled();
  });

  it('tak ada penanda ring di sel mana pun, termasuk setelah klik kiri/kanan', () => {

    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, {});
    fireEvent(selUji(0), new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    fireEvent(selUji(0), new MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
    expect(selUji(0).className).not.toContain('ring-1');
    fireEvent.contextMenu(selUji(1));
    expect(selUji(0).className).not.toContain('ring-1');
    expect(selUji(1).className).not.toContain('ring-1');
  });

  it('memulai drag di sel lain melepas titik-awal milik klik kiri sebelumnya', () => {

    renderDenganTema(
      <TagihanCrosstab
        data={{
          kolom: KOLOM,
          baris: [baris(sel({}), sel({ id: 2 })), baris(sel({ id: 3 }), sel({ id: 4 }), { santri_id: 8, nama: 'Santri Dua' })],
          total: 2, per_page: 25, current_page: 1, last_page: 1,
        }}
        loading={false}
        terpilihId={null}
        onPilih={() => {}}
        emptyText="Kosong"
      />,
    );

    const A = selUji(0), B = selUji(2);

    fireEvent(A, new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    fireEvent(A, new MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
    expect(A.className).not.toContain('ring-1');

    fireEvent(B, new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    expect(A.className).not.toContain('ring-1');
    expect(B.className).not.toContain('ring-1');
  });

  it('klik kanan tidak memunculkan menu browser (preventDefault)', () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    const peristiwa = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fireEvent(selUji(0), peristiwa);
    expect(peristiwa.defaultPrevented).toBe(true);
  });

  it('Ctrl+klik (contextmenu macOS) tidak membuka aksi per tagihan', () => {
    const onAksiKanan = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onAksiKanan });
    fireEvent(selUji(0), new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(onAksiKanan).not.toHaveBeenCalled();
  });

  it('klik kiri biasa hanya memindah anchor, tidak membuka aksi per tagihan', () => {
    const onPilih = vi.fn();
    const onAksiKanan = vi.fn();
    const onKlikSel = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih, null, undefined, { onAksiKanan, onKlikSel });
    pointerEv(selUji(0), 'pointerup');
    expect(onKlikSel).toHaveBeenCalledTimes(1);
    expect(onKlikSel.mock.calls[0][0].sel.id).toBe(1);
    expect(onKlikSel.mock.calls[0][0].jenisId).toBe(1);

    expect(onKlikSel.mock.calls[0][0].santriId).toBe(7);
    expect(onKlikSel.mock.calls[0][0].key).toBe('1-2025-07');

    expect(onAksiKanan).not.toHaveBeenCalled();
    expect(onPilih).not.toHaveBeenCalled();
  });

  it('tak ada overlay cincin ber-radius di atas sel (dihapus atas permintaan)', () => {

    render(
      <TagihanCrosstab
        data={{ kolom: KOLOM, baris: [baris(sel({}), sel({ id: 2 }))], total: 1, per_page: 25, current_page: 1, last_page: 1 }}
        loading={false}
        terpilihId={2}
        onPilih={() => {}}
        emptyText="Kosong"
      />,
    );
    expect(document.getElementById('cincin_sel_tagihan')).toBeNull();

    expect(selUji(1).className).not.toContain('ring-2');
  });

  it('tanpa terpilihId juga tidak ada overlay', () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    expect(document.getElementById('cincin_sel_tagihan')).toBeNull();
  });

  it('sel tagihan tak pernah ber-border-radius (penanda membulat tak kembali)', () => {

    const berRadius = (el: Element) => /(^|\s)rounded(-|\s|$)/.test(el.className);
    const { container } = render(
      <TagihanCrosstab
        data={{ kolom: KOLOM, baris: [baris(sel({}), sel({ id: 2 }))], total: 1, per_page: 25, current_page: 1, last_page: 1 }}
        loading={false}
        terpilihId={2}
        onPilih={() => {}}
        emptyText="Kosong"
      />,
    );
    const selBerRadius = () => [...container.querySelectorAll('[id^="btn_tagihan_sel_"]')]
      .filter(berRadius)
      .map((e) => e.id);
    expect(selBerRadius()).toEqual([]);

    fireEvent(selUji(0), new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    fireEvent(selUji(0), new MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
    expect(selBerRadius()).toEqual([]);

    fireEvent.contextMenu(selUji(1));
    expect(selBerRadius()).toEqual([]);

    expect(document.getElementById('cincin_sel_tagihan')).toBeNull();
  });

  it('hover memakai garis DALAM (inset), bukan outline luar — pemilih ganda saat sel terpilih lalu di-hover', () => {

    const selUji = (i: number) => document.querySelectorAll<HTMLElement>('[id^="btn_tagihan_sel_"]')[i];
    renderCrosstab(baris(sel({}), sel({ id: 2 })));

    expect(selUji(0).className).not.toContain('hover:outline');
    expect(selUji(0).className).toContain('hover:shadow-[inset_0_0_0_1px_var(--ring)]');
    expect(selUji(1).className).not.toContain('hover:outline');

    fireEvent(selUji(0), new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    fireEvent(selUji(0), new MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
    expect(selUji(0).style.boxShadow).not.toBe('');
    expect(selUji(0).className).not.toContain('hover:shadow-[inset');

    expect(selUji(0).className).not.toContain('hover:outline');
  });

  it('sel terpilih diberi overlay latar, sel tak terpilih tidak', () => {

    render(
      <TagihanCrosstab
        data={{ kolom: KOLOM, baris: [baris(sel({}), sel({ id: 2 }))], total: 1, per_page: 25, current_page: 1, last_page: 1 }}
        loading={false}
        terpilihId={null}
        onPilih={() => {}}
        emptyText="Kosong"
      />,
    );

    expect(selUji(0).style.backgroundImage).toBe('');
    expect(selUji(1).style.backgroundImage).toBe('');

    fireEvent(selUji(0), new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    fireEvent(selUji(0), new MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
    expect(selUji(0).style.backgroundImage).toContain('linear-gradient');
    expect(selUji(1).style.backgroundImage).toBe('');

    expect(selUji(0).style.backgroundColor).toBe('');
  });

  it('blok yang sedang digeser memakai overlay tipis yang sama, bukan latar pekat', () => {

    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    fireEvent(selUji(0), new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    fireEvent.pointerEnter(selUji(1));

    expect(selUji(0).style.backgroundImage).toContain('linear-gradient');
    expect(selUji(1).style.backgroundImage).toContain('linear-gradient');

    expect(selUji(0).style.backgroundColor).toBe('');
    expect(selUji(1).style.backgroundColor).toBe('');
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

    selJuli.getBoundingClientRect = () => ({
      left: 570, top: 190, width: 60, height: 20, right: 630, bottom: 210, x: 570, y: 190,
      toJSON: () => ({}),
    }) as DOMRect;
    await userEvent.hover(selJuli);
    await screen.findByRole('tooltip');

    fireEvent.contextMenu(selJuli);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());

    fireEvent.mouseMove(selJuli, { clientX: 601, clientY: 200 });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('tooltip')).toBeNull();

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
  it('klik kiri (pointerup) memanggil onKlikSel (anchor pindah)', () => {
    const onKlikSel = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onKlikSel });
    pointerEv(selUji(1), 'pointerup');
    expect(onKlikSel).toHaveBeenCalledTimes(1);
    expect(onKlikSel.mock.calls[0][0].sel.id).toBe(2);
  });

  it('Ctrl+Klik memanggil onTogglePilih (tambah/lepas satu sel)', () => {
    const onTogglePilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onTogglePilih });
    pointerEv(selUji(1), 'pointerup', { ctrlKey: true });
    expect(onTogglePilih).toHaveBeenCalledTimes(1);
    expect(onTogglePilih.mock.calls[0][0].sel.id).toBe(2);
  });

  it('Shift+Klik memilih blok dari anchor (onPilihBlok)', () => {
    const onPilihBlok = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onPilihBlok });
    pointerEv(selUji(0), 'pointerup');
    pointerEv(selUji(1), 'pointerup', { shiftKey: true });
    expect(onPilihBlok).toHaveBeenCalledTimes(1);

    expect(onPilihBlok.mock.calls[0][0]).toHaveLength(2);
  });

  it('tahan-geser memilih blok (irisan), bukan memindah anchor', () => {
    const onPilihIrisan = vi.fn();
    const onKlikSel = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onPilihIrisan, onKlikSel });
    const [jul, agu] = screen.getAllByText('50.000');
    pointerEv(jul, 'pointerdown');
    fireEvent.pointerEnter(agu);
    pointerEv(agu, 'pointerup');

    expect(onPilihIrisan).toHaveBeenCalled();
    const blok = onPilihIrisan.mock.calls.at(-1)![0] as { key: string }[];
    expect(blok.map((g) => g.key)).toEqual(['1-2025-07', '1-2025-08']);

    expect(onKlikSel).not.toHaveBeenCalled();
  });

  it('klik keyboard (Enter) tetap membuka aksi per tagihan', () => {
    const onAksiKanan = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onAksiKanan });
    fireEvent.keyDown(selUji(0), { key: 'Enter' });
    expect(onAksiKanan).toHaveBeenCalledTimes(1);
  });

  it('tombol tengah/kanan tidak memicu seleksi', () => {
    const onKlikSel = vi.fn();
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih, null, undefined, { onKlikSel });
    const selJuli = selUji(0);
    pointerEv(selJuli, 'pointerup', { button: 1 });
    pointerEv(selJuli, 'pointerup', { button: 2 });
    expect(onKlikSel).not.toHaveBeenCalled();
    expect(onPilih).not.toHaveBeenCalled();
  });

  it('tahan-geser tanpa modifier memakai irisan (bukan menambah/mengurangi)', () => {
    const onPilihIrisan = vi.fn();
    const onTambahBlok = vi.fn();
    const onLepasBlok = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onPilihIrisan, onTambahBlok, onLepasBlok });
    const [jul, agu] = screen.getAllByText('50.000');

    pointerEv(jul, 'pointerdown');
    pointerMasuk(agu);
    expect(onPilihIrisan).toHaveBeenCalledTimes(1);
    expect(onTambahBlok).not.toHaveBeenCalled();
    expect(onLepasBlok).not.toHaveBeenCalled();
    pointerEv(agu, 'pointerup');
  });

  it('pelepasan setelah geser melapor sekali sebagai multi-select', () => {
    const onSeleksiRilis = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onSeleksiRilis });
    const [jul, agu] = screen.getAllByText('50.000');
    pointerEv(jul, 'pointerdown');
    pointerMasuk(agu);
    pointerEv(agu, 'pointerup');

    expect(onSeleksiRilis).toHaveBeenCalledTimes(1);
    expect(onSeleksiRilis.mock.calls[0][1]).toBe(true);
  });

  it('klik tunggal (tanpa geser) melapor multi = false', () => {
    const onSeleksiRilis = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onSeleksiRilis });
    const [jul] = screen.getAllByText('50.000');
    pointerEv(jul, 'pointerdown');
    pointerEv(jul, 'pointerup');

    expect(onSeleksiRilis).toHaveBeenCalledTimes(1);
    expect(onSeleksiRilis.mock.calls[0][1]).toBe(false);
  });

  it('pointerdown mengabari pemanggil bahwa drag dimulai', () => {
    const onMulaiGeser = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onMulaiGeser });
    pointerEv(selUji(0), 'pointerdown');
    expect(onMulaiGeser).toHaveBeenCalledTimes(1);
  });

  it('sorotan mengikuti prop selection, bukan blok mentah yang digeser', () => {

    const onPilihIrisan = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, {
      onPilihIrisan,
      selection: new Set([`7\u00001-2025-07`]),
    });
    const [jul, agu] = screen.getAllByText('50.000');
    pointerEv(jul, 'pointerdown');
    pointerMasuk(agu);
    expect(onPilihIrisan).toHaveBeenCalled();

    expect(agu.style.boxShadow).toBe('');
    expect(jul.style.boxShadow).not.toBe('');
  });

  it('geser menyerahkan blok MENTAH ke onPilihIrisan (halaman yang mengiriskan)', () => {
    const onPilihIrisan = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onPilihIrisan });
    const [jul, agu] = screen.getAllByText('50.000');
    pointerEv(jul, 'pointerdown');
    pointerMasuk(agu);

    expect(onPilihIrisan).toHaveBeenCalledTimes(1);
    expect(onPilihIrisan.mock.calls[0][0].map((x: { sel: { id: number } }) => x.sel.id)).toEqual([1, 2]);
  });

  it('pelepasan drag tidak memanggil onKlikSel (blok tidak diganti satu sel)', () => {
    const onKlikSel = vi.fn();
    const onSeleksiRilis = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onKlikSel, onSeleksiRilis });
    const [jul, agu] = screen.getAllByText('50.000');
    pointerEv(jul, 'pointerdown');
    pointerMasuk(agu);
    pointerEv(agu, 'pointerup');

    expect(onKlikSel).not.toHaveBeenCalled();
    expect(onSeleksiRilis.mock.calls[0][1]).toBe(true);
  });

  it('klik tunggal melapor sebagai BUKAN multi-select', () => {
    const onSeleksiRilis = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onSeleksiRilis });
    pointerEv(selUji(0), 'pointerup');
    expect(onSeleksiRilis).toHaveBeenCalledTimes(1);
    expect(onSeleksiRilis.mock.calls[0][1]).toBe(false);
  });

  it('geser menggambar pratinjau persegi panjang, termasuk sel kosong', () => {
    const onPratinjau = vi.fn();

    const b = baris(sel({}), sel({ id: 2 }));
    renderCrosstab({ ...b, sel: { '1-2025-07': b.sel['1-2025-07'] } }, () => {}, null, () => {}, { onPratinjau });
    const jul = screen.getAllByText('50.000')[0];
    pointerEv(jul, 'pointerdown');

    const aguKosong = document.getElementById('td_tagihan_kosong_7_1-2025-08')!;
    pointerMasuk(aguKosong);

    expect(onPratinjau).toHaveBeenCalled();
    const grid = onPratinjau.mock.calls[0][0] as { santriId: number; key: string }[];
    expect(grid.map((g) => g.key)).toEqual(['1-2025-07', '1-2025-08']);
  });

  it('Ctrl+Klik memanggil onTogglePilih (tambah/lepas satu sel)', () => {
    const onTogglePilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, null, undefined, { onTogglePilih });
    pointerEv(selUji(1), 'pointerup', { ctrlKey: true });
    expect(onTogglePilih).toHaveBeenCalledTimes(1);
    expect(onTogglePilih.mock.calls[0][0].sel.id).toBe(2);
  });
});

describe('TagihanCrosstab — kolom Santri', () => {
  it('menampilkan orang tua & kelas di bawah nama', () => {
    renderCrosstab(baris(sel({ nominal: 1000 }), sel({ nominal: 1000 }), {
      ayah_nama: 'Ayah Uji', ibu_nama: 'Ibu Uji', tingkat: '4', kelas: '4B',
    }));

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

describe('TagihanCrosstab — sel kosong tanpa tombol tambah', () => {
  /** Baris dengan sel Agustus kosong (tanpa tagihan). */
  function barisKosongAgu(): CrosstabBaris {
    const b = baris(sel({}), sel({ id: 2 }));
    return { ...b, sel: { '1-2025-07': b.sel['1-2025-07'] } };
  }

  it('sel kosong tetap titik inert (tambah satuan diganti Buat Massal)', () => {
    renderCrosstab(barisKosongAgu());
    expect(screen.getByText('·')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Tambah tagihan/ })).not.toBeInTheDocument();

    expect(document.getElementById('td_tagihan_kosong_7_1-2025-08')).not.toBeNull();
  });

  it('klik kanan sel kosong memanggil onAksiKosong dengan sel + kolom + jangkar', () => {
    const onAksiKosong = vi.fn();
    renderCrosstab(barisKosongAgu(), () => {}, null, undefined, { onAksiKosong });
    const td = document.getElementById('td_tagihan_kosong_7_1-2025-08')!;
    fireEvent.contextMenu(td);
    expect(onAksiKosong).toHaveBeenCalledTimes(1);
    const [sel, kolom, jangkar] = onAksiKosong.mock.calls[0];
    expect(sel).toMatchObject({ santriId: 7, key: '1-2025-08', jenisId: 1 });
    expect(kolom).toMatchObject({ jenis_id: 1, periode: '2025-08' });
    expect(jangkar).toBe(td);
  });
});
