import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import KomponenPage from './KomponenPage';
import { definisiTipe, KUNCI_TIPE_INPUT } from '@/components/tipeInput';
import { renderDenganTema } from '@/test/utils';

/** Halaman workshop komponen butuh pengguna super_admin. */
const { pengguna } = vi.hoisted(() => ({
  pengguna: { current: { permissions: [], roles: [{ name: 'super_admin' }] } as unknown as {
    permissions: string[];
    roles: { name: string }[];
  } | null },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: pengguna.current }) }));

vi.mock('@/api/preset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/preset')>();
  return {
    ...asli,
    listPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: { presets: [], aktif_preset_id: null, aktif_kolom: null, default_preset_id: null } })),
    listPresetTampil: vi.fn(async () => ({ pesan: 'ok', data: { opsi: [], tersedia: [] } })),
  };
});
vi.mock('@/api/urutPreset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/urutPreset')>();
  return {
    ...asli,
    muatUrutPreset: vi.fn(async () => ({ pesan: 'ok', data: { table_key: 'keanggotaan', opsi: [], tersedia: [] } })),
  };
});
vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'komponen_excel_demo', visibilitas: {}, lebar: {}, urutan: [], align: {} },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

/** Elemen penanda kehadiran satu komponen di daftar (tombol info ber-id `<id>`). */
const komponen = (id: string) => document.getElementById(id);

beforeEach(() => {
  pengguna.current = { permissions: [], roles: [{ name: 'super_admin' }] } as unknown as { permissions: string[]; roles: { name: string }[] };
});

describe('KomponenPage — kerangka tab', () => {
  it('memakai kerangka tab bersama halaman bertab lain', () => {
    renderDenganTema(<KomponenPage />);

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'ExcelTable',
      'Combobox',
      'LabeledInput',
      'Stepper',
    ]);

    expect(screen.getByRole('tab', { name: 'ExcelTable' })).toHaveAttribute('id', 'tab_komponen_excel_table');
    expect(screen.getByRole('tab', { name: 'Combobox' })).toHaveAttribute('id', 'tab_komponen_combobox');

    expect(screen.getByRole('tabpanel').className).toContain('simpes-panel-tab');
  });
});

describe('KomponenPage — pengelompokan komponen', () => {
  it('satu tab per komponen utama; tab awal ExcelTable', () => {
    renderDenganTema(<KomponenPage />);

    expect(screen.getByRole('tab', { name: 'ExcelTable' })).toHaveAttribute('data-state', 'active');

    expect(document.getElementById('denah_excel_area_1')).not.toBeNull();
    expect(komponen('info_labeled_combobox')).toBeNull();
    expect(komponen('info_labeled_text_input')).toBeNull();
    expect(komponen('info_labeled_stepper')).toBeNull();
  });

  it('varian tampil di tab yang sama dengan komponen utamanya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'Combobox' }));

    expect(komponen('info_preset_urut')).not.toBeNull();
    expect(komponen('info_preset_kolom')).not.toBeNull();
    expect(screen.getAllByText('varian dari LabeledCombobox')).toHaveLength(2);

    await klik.click(screen.getByRole('tab', { name: 'LabeledInput' }));
    expect(komponen('info_labeled_text_input')).not.toBeNull();
    expect(komponen('info_tipe_nominal')).not.toBeNull();
    expect(komponen('info_preset_urut')).toBeNull();
    expect(screen.getAllByText(/^tipe `\w+` — varian dari LabeledInput$/))
      .toHaveLength(KUNCI_TIPE_INPUT.length);

    await klik.click(screen.getByRole('tab', { name: 'Stepper' }));
    expect(komponen('info_labeled_stepper')).not.toBeNull();
    expect(screen.getByText('Belum ada varian dari LabeledStepper.')).toBeInTheDocument();
  });

  it('tab LabeledInput memuat contoh SELURUH tipe registry', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'LabeledInput' }));

    for (const kunci of KUNCI_TIPE_INPUT) {

      expect(komponen(`info_tipe_${kunci}`)).not.toBeNull();

      const input = document.getElementById(`demo_tipe_${kunci}`);
      expect(input).not.toBeNull();
      expect(input?.getAttribute('type')).toBe(definisiTipe(kunci)?.type ?? 'text');
    }

    expect(document.getElementById('btn_preset_demo_tipe_nominal')).not.toBeNull();
    expect(document.getElementById('btn_kalender_demo_tipe_tanggal')).not.toBeNull();
    expect(document.getElementById('btn_preset_demo_tipe_teks')).toBeNull();
    expect(document.getElementById('btn_kalender_demo_tipe_teks')).toBeNull();

    expect((document.getElementById('demo_tipe_tanggal') as HTMLInputElement).value).toBe('14/07/2026');
  });
});

describe('KomponenPage — tab ExcelTable', () => {
  it('menampilkan tiga blok: denah, inventaris fitur, contoh hidup', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getByText('1. Denah ExcelTable')).toBeInTheDocument();
    expect(screen.getByText('2. Di mana pengaturannya?')).toBeInTheDocument();
    expect(screen.getByText('3. Cakupan pengaturan: global / halaman / tabel')).toBeInTheDocument();
    expect(screen.getByText('4. Sumbu klasifikasi lain (selain cakupan)')).toBeInTheDocument();
    expect(screen.getByText('5. Sumbu mana yang perlu ditampilkan visual?')).toBeInTheDocument();
    expect(screen.getByText('6. Usulan bentuk pengaturan: 3 rumah, 1 pintu masing-masing')).toBeInTheDocument();
    expect(screen.getByText('7. Bentuk rumah GLOBAL: halaman, panel, menu, atau dialog?')).toBeInTheDocument();
    expect(screen.getByText('8. Klasifikasi lengkap: mana ke mana')).toBeInTheDocument();
    expect(screen.getByText('9. Rekomendasi perbaikan')).toBeInTheDocument();
    expect(screen.getByText('10. Inventaris fitur')).toBeInTheDocument();
    expect(screen.getByText('11. Contoh hidup')).toBeInTheDocument();
  });

  it('memetakan lima jalan masuk pengaturan + 4 tab dialog Kelola Tabel', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // Setelan global di TopBar; gerigi tabel membuka setelan tabel itu saja.
    const jalanMasuk = within(screen.getByRole('columnheader', { name: 'Jalan masuk' }).closest('table')!);
    expect(jalanMasuk.getByText('TopBar → "Pengaturan tampilan"')).toBeInTheDocument();
    expect(jalanMasuk.getByText('Gerigi di ujung kanan bilah judul tabel')).toBeInTheDocument();
    expect(jalanMasuk.getByText('Bilah judul — dropdown Kolom / Urutkan')).toBeInTheDocument();
    expect(jalanMasuk.getByText('Klik kanan header/baris')).toBeInTheDocument();
    expect(jalanMasuk.getByText('TopBar — menu "Kelola tabel"')).toBeInTheDocument();
    expect(screen.queryByText('Footer — tombol gerigi')).not.toBeInTheDocument();

    expect(screen.getByText('Tab "Umum" → Visibilitas komponen tabel')).toBeInTheDocument();
    expect(screen.getByText('Tab "Umum" → Tampilan di perangkat ini')).toBeInTheDocument();
    expect(screen.getByText('Tab "Info"')).toBeInTheDocument();
    expect(screen.getByText('Tab "Kolom"')).toBeInTheDocument();
    expect(screen.getByText('Tab "Urutan"')).toBeInTheDocument();
    expect(screen.queryByText('Tab "Filter Tabel"')).not.toBeInTheDocument();
    expect(screen.queryByText('Tab "Nama & Perataan"')).not.toBeInTheDocument();
    expect(screen.getAllByText('TabKolom.tsx')).toHaveLength(1);

    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(2);
  });

  it('mengklasifikasi pengaturan ke cakupan global / halaman / tabel', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getAllByText('GLOBAL').length).toBe(2);
    expect(screen.getAllByText('HALAMAN').length).toBe(2);
    expect(screen.getAllByText('TABEL INI').length).toBe(2);

    // Tinggi global menjadi bawaan; tinggi khusus tabel tersimpan terpisah.

    expect(screen.getByText('Bawaan tinggi baris sel')).toBeInTheDocument();
    expect(screen.getByText('pref perangkat (useGridPrefs.setRowH) — standar server "standar pesantren" menang bila ada')).toBeInTheDocument();
    expect(screen.getAllByText('pref perangkat — tinggiDasarKey(tableKey)')).toHaveLength(2);

    expect(screen.getByText('Perataan kolom (standar)')).toBeInTheDocument();

    expect(screen.getAllByText('Filter mana yang tampil (topBar)').length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(6);
  });

  it('memetakan lima sumbu klasifikasi selain cakupan', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getAllByText('Siapa yang boleh mengubah').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Di mana nilainya disimpan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Objek yang diatur').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Kapan berlaku').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sifat perubahan').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('mengubah DATA')).toBeInTheDocument();

    expect(screen.getByText('perangkat (pref lokal)')).toBeInTheDocument();
    expect(screen.getByText('sesi berjalan saja')).toBeInTheDocument();
  });

  it('menilai sumbu mana yang perlu penanda visual', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getAllByText('perlu').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('tidak perlu').length).toBe(3);

    expect(screen.getByText('Sifat perubahan (tampilan vs mengubah DATA)')).toBeInTheDocument();
    expect(screen.getAllByText('prioritas tinggi')).toHaveLength(2);

    expect(screen.getByText(/TIDAK KONSISTEN: dari 9 kontrol di popover/)).toBeInTheDocument();
  });

  it('mengusulkan tiga rumah pengaturan tanpa tumpang tindih', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getByText('Pengaturan Aplikasi (global)')).toBeInTheDocument();

    expect(screen.getByText('Halaman (KODE, bukan DB)')).toBeInTheDocument();
    expect(screen.getByText('Kelola Tabel')).toBeInTheDocument();

    expect(screen.getByText('Satu setelan, satu rumah')).toBeInTheDocument();
    expect(screen.getByText('Global tidak boleh punya pintu di dalam tabel')).toBeInTheDocument();

    expect(screen.getByText(/Tidak ada "preset kolom", "urutan", "nama header" di sini/)).toBeInTheDocument();
    expect(screen.getByText(/Tinggi baris bawaan, huruf, warna/)).toBeInTheDocument();
  });

  it('mengklasifikasi seluruh pengaturan dengan kunci penyimpanannya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getByText('pref perangkat — useGridPrefs.setRowH')).toBeInTheDocument();
    expect(screen.getByText('SERVER — toolbar_preset.align per table_key')).toBeInTheDocument();
    expect(screen.getAllByText('state sesi — lib/filterHalaman.ts (KONFIGURASI_FILTER_HALAMAN)')).toHaveLength(2);
    expect(screen.queryByText(/SERVER — pengaturan_tabel.filter/)).not.toBeInTheDocument();

    // Setelan global sudah dipindah; hanya komponen custom masih dua cakupan.
    const tinggiBawaan = screen.getByText('Tinggi baris sel (bawaan)').closest('tr')!;
    expect(within(tinggiBawaan).getByText('sudah tepat')).toBeInTheDocument();
    const komponenCustom = screen.getByText('Lebar/tinggi/label komponen custom').closest('tr')!;
    expect(within(komponenCustom).getByText('perlu dipindah')).toBeInTheDocument();

    expect(screen.getByText('Tema & mode (gelap/terang/sistem)')).toBeInTheDocument();
    expect(screen.getByText('Matriks izin role × modul')).toBeInTheDocument();

    expect(screen.getAllByText('Mode Ubah (auto-save sel)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/BUKAN pengaturan: ini MODE KERJA/).length).toBeGreaterThanOrEqual(1);
  });

  it('membandingkan lima bentuk rumah global dan menyarankan hibrida', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getByText('A. Halaman khusus penuh')).toBeInTheDocument();
    expect(screen.getByText('B. Panel samping geser (sheet)')).toBeInTheDocument();
    expect(screen.getByText('C. Perluas menu pengguna di TopBar')).toBeInTheDocument();
    expect(screen.getByText('D. Dialog "Pengaturan Tampilan"')).toBeInTheDocument();
    expect(screen.getByText('E. Pertahankan di footer tabel (status quo)')).toBeInTheDocument();

    expect(screen.getAllByText('disarankan')).toHaveLength(1);
    expect(screen.getAllByText('kurang')).toHaveLength(2);

    expect(screen.getByText('Saran: hibrida (panel + 1 jalan pintas)')).toBeInTheDocument();
    expect(screen.getByText(/Tombol tinggi baris cepat/)).toBeInTheDocument();
  });

  it('rekomendasi menyebut bukti kode dan usulannya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getByText('Dulu: setelan global tersembunyi di gerigi SETIAP tabel')).toBeInTheDocument();
    expect(screen.getByText(/ExcelTable.tsx:.*tombolPengaturanTampil.*TopBar.tsx:.*SheetPengaturanTampilan/)).toBeInTheDocument();

    expect(screen.getByText('Satu pintu untuk setelan global: TopBar → "Pengaturan tampilan".')).toBeInTheDocument();

    expect(screen.getByText(/SELESAI: setelan global hanya di TopBar/)).toBeInTheDocument();
    expect(screen.getByText('Tombol terlihat berlabel di ujung bilah judul, plus menu overflow.')).toBeInTheDocument();
  });

  it('denah punya satu penanda per area, id-nya snake_case', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    for (let no = 1; no <= 21; no++) {
      expect(document.getElementById(`denah_excel_area_${no}`)).not.toBeNull();
    }
    expect(document.getElementById('denah_excel_area_0')).toBeNull();
    expect(document.getElementById('denah_excel_area_22')).toBeNull();
    expect(screen.getByRole('button', { name: 'Keterangan area 21: Gerigi "Pengaturan tabel"' })).toHaveAttribute('id', 'denah_excel_area_21');
  });

  it('inventaris memuat baris kunci dengan jumlah pemakaiannya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    const tabel = screen.getAllByRole('table');
    const inventaris = within(
      tabel.find((t) => within(t).queryByText('Fitur') !== null)!,
    );
    expect(inventaris.getByText('Paginasi di kaki')).toBeInTheDocument();
    expect(inventaris.getByText('pager')).toBeInTheDocument();
    expect(inventaris.getByText('Kolom centang + pilih semua')).toBeInTheDocument();
    expect(inventaris.getByText('renderBulkActions')).toBeInTheDocument();
    expect(inventaris.getByText('Dipakai')).toBeInTheDocument();
    const paginasi = within(inventaris.getByText('Paginasi di kaki').closest('tr')!);
    expect(paginasi.getByText('20 halaman (21 titik render)')).toBeInTheDocument();
  });

  it('contoh hidup merender ExcelTable & menghormati sakelar prop', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getByText('Contoh ExcelTabelV2')).toBeInTheDocument();
    expect(document.getElementById('btn_aksi_komponen_excel_demo')).not.toBeNull();
    expect(document.getElementById('contoh_excel_tercentang')).toHaveTextContent('0');

    expect(document.getElementById('pager')).not.toBeNull();
    await klik.click(document.getElementById('contoh_excel_pager')!);
    expect(document.getElementById('pager')).toBeNull();
  });
});

describe('KomponenPage — lebar kolom daftar', () => {
  /** Wadah daftar tab aktif: satu-satunya yang memasang variabel lebar kolom. */
  const wadah = () => document.querySelector<HTMLElement>('[style*="--lebar-kolom-nama"]');
  /** Lebar kolom nama yang sedang dipakai (dibaca dari variabel CSS-nya). */
  const lebarTampil = () => wadah()?.style.getPropertyValue('--lebar-kolom-nama');
  const gagang = () => screen.getByRole('separator', { name: 'Lebar kolom nama komponen' });
  /** Tab ExcelTable kini tab PERTAMA; gagang lebar kolom nama ada di tab
   *  Combobox, jadi tiap tes di blok ini membuka tab itu lebih dulu. */
  const bukaCombobox = async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'Combobox' }));
  };

  it('header & setiap baris memakai template kolom yang sama', async () => {
    await bukaCombobox();

    const gridKolom = [...(screen.getByRole('tabpanel').querySelectorAll<HTMLElement>('div'))]
      .filter((d) => d.className.includes('var(--lebar-kolom-nama)'));

    expect(gridKolom).toHaveLength(4);
    for (const g of gridKolom) {
      expect(g.className).toContain('sm:grid-cols-[var(--lebar-kolom-nama)_1fr]');
      expect(g.className).toContain('gap-3');
    }
  });

  it('gagang duduk di batas kolom: selebar celah & ikut padding header', async () => {
    await bukaCombobox();
    const header = wadah()?.firstElementChild as HTMLElement;
    const g = gagang();

    expect(header.contains(g)).toBe(true);
    expect(header.className).toContain('relative');
    expect(g.className).toContain('inset-y-0');

    expect(g.className).toContain('w-3');

    expect(g.style.left).toContain('0.5rem');
    expect(header.className).toContain('p-2');
  });

  it('gagang digeser mouse mengubah lebar kolom (dan kursor jadi col-resize)', async () => {
    await bukaCombobox();
    const g = gagang();
    expect(lebarTampil()).toBe('240px');
    expect(g).toHaveAttribute('aria-valuenow', '240');
    expect(g).toHaveAttribute('aria-valuemin', '120');
    expect(g).toHaveAttribute('aria-valuemax', '480');

    fireEvent.mouseDown(g, { button: 0, clientX: 300 });
    expect(document.body.style.cursor).toBe('col-resize');
    fireEvent.mouseMove(window, { clientX: 360 });
    expect(lebarTampil()).toBe('300px');

    fireEvent.mouseUp(window);
    expect(document.body.style.cursor).toBe('');
    expect(gagang()).toHaveAttribute('aria-valuenow', '300');
  });

  it('lebar dijepit ke rentang yang masuk akal saat diseret jauh', async () => {
    await bukaCombobox();

    fireEvent.mouseDown(gagang(), { button: 0, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 0 });
    expect(lebarTampil()).toBe('120px');
    fireEvent.mouseMove(window, { clientX: 5000 });
    expect(lebarTampil()).toBe('480px');
    fireEvent.mouseUp(window);
  });

  it('panah menggeser 16px (Shift 48px), Home mengembalikan bawaan', async () => {
    await bukaCombobox();
    const g = gagang();

    fireEvent.keyDown(g, { key: 'ArrowRight' });
    expect(lebarTampil()).toBe('256px');
    fireEvent.keyDown(g, { key: 'ArrowRight', shiftKey: true });
    expect(lebarTampil()).toBe('304px');
    fireEvent.keyDown(g, { key: 'ArrowLeft' });
    expect(lebarTampil()).toBe('288px');
    fireEvent.keyDown(g, { key: 'Home' });
    expect(lebarTampil()).toBe('240px');
  });

  it('klik dua kali mengembalikan lebar bawaan', async () => {
    await bukaCombobox();

    fireEvent.mouseDown(gagang(), { button: 0, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 400 });
    fireEvent.mouseUp(window);
    expect(lebarTampil()).toBe('340px');

    fireEvent.doubleClick(gagang());
    expect(lebarTampil()).toBe('240px');
  });

  it('lebar yang disetel berlaku juga di tab lain', async () => {
    const klik = userEvent.setup();
    await bukaCombobox();

    fireEvent.mouseDown(gagang(), { button: 0, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 350 });
    fireEvent.mouseUp(window);
    expect(lebarTampil()).toBe('290px');

    await klik.click(screen.getByRole('tab', { name: 'Stepper' }));
    expect(lebarTampil()).toBe('290px');
  });
});
