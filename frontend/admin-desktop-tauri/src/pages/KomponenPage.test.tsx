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

/* Komponen di dalam halaman memanggil API (daftar preset kolom & urutan). */
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

/* Tab ExcelTable memuat ExcelTable hidup, yang butuh preset toolbar & urut
   (`tableKey: komponen_excel_demo`). */
vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'komponen_excel_demo', visibilitas: {}, lebar: {}, urutan: [], align: {} },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

/* Stub jsdom untuk react-datasheet-grid (pola sama `ExcelTable.test.tsx`):
   DSG asli mengukur lebar DOM yang selalu 0 di jsdom. */
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

    // ExcelTable tab PERTAMA (peta fitur komponen terbesar).
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'ExcelTable',
      'Combobox',
      'LabeledInput',
      'Stepper',
    ]);
    // Id elemen snake_case (NFR-05).
    expect(screen.getByRole('tab', { name: 'ExcelTable' })).toHaveAttribute('id', 'tab_komponen_excel_table');
    expect(screen.getByRole('tab', { name: 'Combobox' })).toHaveAttribute('id', 'tab_komponen_combobox');
    // Panel tab berbingkai — penanda kerangka bersama (`KELAS_PANEL_TAB`).
    expect(screen.getByRole('tabpanel').className).toContain('simpes-panel-tab');
  });
});

describe('KomponenPage — pengelompokan komponen', () => {
  it('satu tab per komponen utama; tab awal ExcelTable', () => {
    renderDenganTema(<KomponenPage />);

    expect(screen.getByRole('tab', { name: 'ExcelTable' })).toHaveAttribute('data-state', 'active');
    // Tab ExcelTable ter-mount; tab lain belum di-mount saat tidak aktif.
    expect(document.getElementById('denah_excel_area_1')).not.toBeNull();
    expect(komponen('info_labeled_combobox')).toBeNull();
    expect(komponen('info_labeled_text_input')).toBeNull();
    expect(komponen('info_labeled_stepper')).toBeNull();
  });

  it('varian tampil di tab yang sama dengan komponen utamanya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'Combobox' }));

    // Combobox: LabeledCombobox + varian PresetUrut & PresetKolom.
    expect(komponen('info_preset_urut')).not.toBeNull();
    expect(komponen('info_preset_kolom')).not.toBeNull();
    expect(screen.getAllByText('varian dari LabeledCombobox')).toHaveLength(2);

    // Teks: LabeledInput + satu baris varian per TIPE di registry.
    await klik.click(screen.getByRole('tab', { name: 'LabeledInput' }));
    expect(komponen('info_labeled_text_input')).not.toBeNull();
    expect(komponen('info_tipe_nominal')).not.toBeNull();
    expect(komponen('info_preset_urut')).toBeNull();
    expect(screen.getAllByText(/^tipe `\w+` — varian dari LabeledInput$/))
      .toHaveLength(KUNCI_TIPE_INPUT.length);

    // Stepper: tanpa varian.
    await klik.click(screen.getByRole('tab', { name: 'Stepper' }));
    expect(komponen('info_labeled_stepper')).not.toBeNull();
    expect(screen.getByText('Belum ada varian dari LabeledStepper.')).toBeInTheDocument();
  });

  it('tab LabeledInput memuat contoh SELURUH tipe registry', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'LabeledInput' }));

    for (const kunci of KUNCI_TIPE_INPUT) {
      // Tiap tipe = satu baris varian dengan tombol keterangan sendiri.
      expect(komponen(`info_tipe_${kunci}`)).not.toBeNull();
      // Contohnya kotak hidup dengan atribut native tipe itu.
      const input = document.getElementById(`demo_tipe_${kunci}`);
      expect(input).not.toBeNull();
      expect(input?.getAttribute('type')).toBe(definisiTipe(kunci)?.type ?? 'text');
    }

    // Tipe dengan aksi kanan memakai tombolnya sendiri; tipe polos tidak.
    expect(document.getElementById('btn_preset_demo_tipe_nominal')).not.toBeNull();
    expect(document.getElementById('btn_kalender_demo_tipe_tanggal')).not.toBeNull();
    expect(document.getElementById('btn_preset_demo_tipe_teks')).toBeNull();
    expect(document.getElementById('btn_kalender_demo_tipe_teks')).toBeNull();

    // Contoh tanggal = kotak ber-mask: nilai ISO contohnya tampil dd/mm/yyyy.
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

  it('memetakan empat jalan masuk pengaturan + 3 tab dialog Kelola Tabel', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // Empat jalan masuk: footer, dropdown toolbar, menu klik kanan, Kelola Tabel.
    expect(screen.getByText('Footer — tombol gerigi')).toBeInTheDocument();
    expect(screen.getByText('Toolbar — dropdown Kolom / Urutkan')).toBeInTheDocument();
    expect(screen.getByText('Klik kanan header/baris')).toBeInTheDocument();
    expect(screen.getByText('TopBar — menu "Kelola tabel"')).toBeInTheDocument();

    // Isi dialog: tab dengan komponen sumbernya. Tab "Nama & Perataan" dulu
    // terpisah; kini dilebur ke "Kolom" karena keduanya mengatur setelan per
    // TABEL (bukan per preset), jadi satu penanda cukup. Tab "Filter Tabel"
    // ikut hilang karena sakelar filter toolbar kini jadi sakelar komponen
    // tabel di tab "Umum".
    expect(screen.getByText('Tab "Umum"')).toBeInTheDocument();
    expect(screen.getByText('Tab "Kolom"')).toBeInTheDocument();
    expect(screen.getByText('Tab "Urutan"')).toBeInTheDocument();
    expect(screen.queryByText('Tab "Filter Tabel"')).not.toBeInTheDocument();
    expect(screen.queryByText('Tab "Nama & Perataan"')).not.toBeInTheDocument();
    expect(screen.getAllByText('TabKolom.tsx')).toHaveLength(1);

    // Tabel pengaturan: jalan masuk + isi dialog (denah & inventaris bukan <table>).
    // Jumlah tepatnya diperiksa di tes lain; di sini cukuplah pastikan ada.
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(2);
  });

  it('mengklasifikasi pengaturan ke cakupan global / halaman / tabel', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // Badge cakupan muncul di ringkasan DAN judul rincian (2× per cakupan).
    expect(screen.getAllByText('GLOBAL').length).toBe(2);
    expect(screen.getAllByText('HALAMAN').length).toBe(2);
    expect(screen.getAllByText('TABEL INI').length).toBe(2);

    // Bukti kunci utamanya: tinggi baris global walau tombolnya per tabel.
    // (Nama juga muncul di blok klasifikasi lengkap, jadi boleh >1.)
    expect(screen.getAllByText('Tinggi baris sel').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('pref perangkat (GridPrefs.tsx:33 GLOBAL_ROWH_KEY)').length).toBeGreaterThanOrEqual(1);
    // Perataan: kontrol di menu konteks, tapi tersimpan per TABEL di server.
    expect(screen.getByText('Perataan kolom (standar)')).toBeInTheDocument();
    // Filter halaman disimpan dengan page_key (juga ada di klasifikasi lengkap).
    expect(screen.getAllByText('Filter mana yang tampil (topBar)').length).toBeGreaterThanOrEqual(1);

    // Tiga tabel cakupan + tabel pengaturan lain (jumlah <table> bertambah).
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(6);
  });

  it('memetakan lima sumbu klasifikasi selain cakupan', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // Nama sumbu juga muncul di blok penilaian visual, jadi boleh >1.
    expect(screen.getAllByText('Siapa yang boleh mengubah').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Di mana nilainya disimpan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Objek yang diatur').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Kapan berlaku').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sifat perubahan').length).toBeGreaterThanOrEqual(1);

    // Sumbu "sifat" memisahkan setelan tampilan dari yang mengubah DATA.
    expect(screen.getByText('mengubah DATA')).toBeInTheDocument();
    // Sumbu penyimpanan memisahkan server / perangkat / sesi.
    expect(screen.getByText('perangkat (pref lokal)')).toBeInTheDocument();
    expect(screen.getByText('sesi berjalan saja')).toBeInTheDocument();
  });

  it('menilai sumbu mana yang perlu penanda visual', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // Tiga sumbu dinilai "perlu", tiga "tidak perlu" — sumbu "kapan berlaku"
    // tak lagi perlu penanda sejak dialog Kelola Tabel tersimpan sendiri.
    expect(screen.getAllByText('perlu').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('tidak perlu').length).toBe(3);

    // Sifat perubahan (mengubah DATA) = prioritas tertinggi.
    expect(screen.getByText('Sifat perubahan (tampilan vs mengubah DATA)')).toBeInTheDocument();
    expect(screen.getAllByText('prioritas tinggi')).toHaveLength(2);
    // Cakupan disebut tidak konsisten di kode saat ini (bukti konkret).
    expect(screen.getByText(/TIDAK KONSISTEN: dari 9 kontrol di popover/)).toBeInTheDocument();
  });

  it('mengusulkan tiga rumah pengaturan tanpa tumpang tindih', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    expect(screen.getByText('Pengaturan Aplikasi (global)')).toBeInTheDocument();
    // Halaman kini bukan rumah ber-DB: setelannya murni dari kode.
    expect(screen.getByText('Halaman (KODE, bukan DB)')).toBeInTheDocument();
    expect(screen.getByText('Kelola Tabel')).toBeInTheDocument();

    // Aturan kunci: kunci penyimpanan yang menentukan rumahnya.
    expect(screen.getByText('Satu setelan, satu rumah')).toBeInTheDocument();
    expect(screen.getByText('Global tidak boleh punya pintu di dalam tabel')).toBeInTheDocument();
    // Setiap rumah menyebut batas tegasnya (teks "Bukan di sini:" terpisah
    // dari isinya, jadi dicocokkan lewat isi batasnya).
    expect(screen.getByText(/Tidak ada "preset kolom", "urutan", "nama header" di sini/)).toBeInTheDocument();
    expect(screen.getByText(/Tinggi baris, huruf, warna/)).toBeInTheDocument();
  });

  it('mengklasifikasi seluruh pengaturan dengan kunci penyimpanannya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // Tiap baris menyebut kunci penyimpanan sebagai bukti.
    expect(screen.getByText('pref perangkat — GridPrefs.tsx:33 GLOBAL_ROWH_KEY')).toBeInTheDocument();
    expect(screen.getByText('SERVER — toolbar_preset.align per table_key')).toBeInTheDocument();
    expect(screen.getAllByText(/SERVER — pengaturan_tabel.filter/).length).toBeGreaterThanOrEqual(1);

    // Status "perlu dipindah" menandai setelan global yang kini di dalam tabel.
    expect(screen.getAllByText('perlu dipindah').length).toBeGreaterThanOrEqual(8);

    // Tema & ikon sudah tepat tempatnya (di TopBar).
    expect(screen.getByText('Tema & mode (gelap/terang/sistem)')).toBeInTheDocument();
    expect(screen.getByText('Matriks izin role × modul')).toBeInTheDocument();

    // Fitur yang bukan pengaturan ikut dicatat (Mode Ubah/Input).
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

    // Penilaian: satu disarankan, dua kurang.
    expect(screen.getAllByText('disarankan')).toHaveLength(1);
    expect(screen.getAllByText('kurang')).toHaveLength(2);

    // Saran hibrida mempertahankan tombol tinggi baris cepat di tabel.
    expect(screen.getByText('Saran: hibrida (panel + 1 jalan pintas)')).toBeInTheDocument();
    expect(screen.getByText(/Tombol tinggi baris cepat/)).toBeInTheDocument();
  });

  it('rekomendasi menyebut bukti kode dan usulannya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // Temuan tingkat tertinggi: pengaturan global tidak dibedakan dari per-tabel.
    expect(screen.getByText('Pengaturan global vs per-tabel tidak dibedakan di UI')).toBeInTheDocument();
    expect(screen.getByText('GridPrefs.tsx:33-35 (GLOBAL_ROWH_KEY / GLOBAL_HEADER_H_KEY)')).toBeInTheDocument();
    // Tiap temuan punya usulan konkret (teks panjang di dalam <p>).
    expect(screen.getByText(/Beri penanda: kelompok yang global diberi label/)).toBeInTheDocument();
    // Temuan yang sudah dikerjakan menampilkan statusnya (label "Status:"
    // berada di span terpisah, jadi dicocokkan lewat isinya).
    expect(screen.getByText(/SELESAI: 10 setelan global dipindah ke panel Sheet/)).toBeInTheDocument();
    expect(screen.getByText(/Tambahkan tombol kecil berlabel/)).toBeInTheDocument();
  });

  it('denah punya satu penanda per area, id-nya snake_case', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // Area 1..20 punya tombol keterangan sendiri (NFR-05: id snake_case).
    for (const no of [1, 5, 12, 20]) {
      expect(document.getElementById(`denah_excel_area_${no}`)).not.toBeNull();
    }
    expect(document.getElementById('denah_excel_area_0')).toBeNull();
    expect(document.getElementById('denah_excel_area_21')).toBeNull();
  });

  it('inventaris memuat baris kunci dengan jumlah pemakaiannya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // Nama fitur + prop sumbernya (kolom "Prop / Komponen sumber").
    // getByText bisa ambigu ("pager" juga muncul di popover denah), jadi
    // pencarian dibatasi ke tabel inventaris — dikenali dari header "Fitur"
    // (dua tabel lain di tab ini: jalan masuk pengaturan & isi dialog).
    const tabel = screen.getAllByRole('table');
    const inventaris = within(
      tabel.find((t) => within(t).queryByText('Fitur') !== null)!,
    );
    expect(inventaris.getByText('Paginasi di kaki')).toBeInTheDocument();
    expect(inventaris.getByText('pager')).toBeInTheDocument();
    expect(inventaris.getByText('Kolom centang + pilih semua')).toBeInTheDocument();
    expect(inventaris.getByText('renderBulkActions')).toBeInTheDocument();
    expect(inventaris.getByText('Dipakai')).toBeInTheDocument();
    expect(inventaris.getByText('19 halaman')).toBeInTheDocument();
  });

  it('contoh hidup merender ExcelTable & menghormati sakelar prop', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'ExcelTable' }));

    // ExcelTable hidup ter-render: bilah judul, tombol Aksi (addButton
    // dibungkus MenuAksiToolbar → jadi menu hamburger), dan penghitung centang.
    expect(screen.getByText('Contoh ExcelTable')).toBeInTheDocument();
    expect(document.getElementById('btn_aksi_komponen_excel_demo')).not.toBeNull();
    expect(document.getElementById('contoh_excel_tercentang')).toHaveTextContent('0');

    // Sakelar pager mematikan/menyalakan paginasi di kaki tabel.
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
    // Header + komponen utama + 2 varian di tab Combobox.
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

    // Anak header (jadi setinggi header) & header-nya sendiri jangkar posisinya.
    expect(header.contains(g)).toBe(true);
    expect(header.className).toContain('relative');
    expect(g.className).toContain('inset-y-0');
    // Lebarnya = celah antar kolom (gap-3) sehingga hanya menutupi celah.
    expect(g.className).toContain('w-3');
    // Batas kolom = lebar kolom + padding kiri header (p-2 = 0.5rem).
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
    expect(lebarTampil()).toBe('300px'); // 240 + 60

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
