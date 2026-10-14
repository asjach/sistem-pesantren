import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PembayaranRow } from '@/api/keuangan';
import type { Dispensasi } from '@/api/keuangan';
import { renderDenganTema } from '@/test/utils';
import PopoverAksiTagihan, { type DataBayar, type DataTambah, type DataUbah, type TagihanAktif, type TambahCtx } from './PopoverAksiTagihan';
import type { AksiBatch } from './BatchAksiTagihan';

/** jsdom tak mengimplementasikan URL blob — stub sekali untuk seluruh file
 *  (tanpa restore: cleanup RTL meng-unmount setelah test selesai). */
URL.createObjectURL = () => 'blob:foto-uji';
URL.revokeObjectURL = () => {};

/** Byte dokumen (avatar): bawaan PNG 4 byte, tiap test yang butuh menimpa via mock. */
const ambilByte = vi.fn(async (_t?: unknown, _id?: unknown): Promise<Uint8Array> => new Uint8Array([137, 80, 78, 71]));
vi.mock('@/api/dokumen', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/dokumen')>();
  return { ...asli, ambilByteDokumen: (t: unknown, id: unknown) => ambilByte(t, id) };
});
/** Byte foto profil: bawaan gagal (404) supaya fallback inisial teruji eksplisit. */
const ambilFoto = vi.fn(async (_id?: unknown): Promise<Uint8Array> => { throw new Error('tak ada foto'); });
vi.mock('@/api/santri', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/santri')>();
  return { ...asli, ambilFotoProfilSantri: (id: unknown) => ambilFoto(id) };
});
/** Daftar dispensasi: kosong bawaan (tiap test yang butuh menimpa via mock). */
const daftarDispen = vi.fn(async (_p?: unknown): Promise<Dispensasi[]> => []);
const kuotaTerpakai = vi.fn(async (_ids?: unknown): Promise<Record<number, Record<number, number>>> => ({}));
vi.mock('@/api/keuangan', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/keuangan')>();
  return { ...asli, daftarDispensasi: (p: unknown) => daftarDispen(p), kuotaPakai: (ids: unknown) => kuotaTerpakai(ids) };
});

function tagihan(partial: Partial<TagihanAktif> = {}): TagihanAktif {
  return {
    id: 7, nama: 'Santri Uji', label: 'Infaq Bulanan · Jul 2025',
    ayah_nama: 'Bpk. Abdul', ibu_nama: 'Siti Aminah',
    santri_id: 7, fotoDokumenId: null, fotoProfil: false, kelas: '4B', jenjangRiwayat: ['MI'], jenisId: 1,
    nominal: 75000, terbayar: 20000, sisa: 55000, status: 'sebagian',
    potongan: 0, dispensasi_ids: null,
    terlambat: true, jatuhTempo: '2025-08-10', tahunAjaran: '2025/2026',
    tipe: 'bulanan', ...partial,
  };
}

/** Popover butuh jangkar elemen nyata (getBoundingClientRect). */
function jangkar(): HTMLElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () => new DOMRect(10, 10, 60, 20);
  document.body.appendChild(el);
  return el;
}

function pembayaran(partial: Partial<PembayaranRow> = {}): PembayaranRow {
  return {
    id: 1, tagihan_id: 7, jumlah: 20000, metode: 'tunai', kas: 'tunai_tu',
    no_kwitansi: 'KW-001', status: 'aktif', catatan: null,
    created_at: '2025-08-01T09:12:00', ...partial,
  };
}

function renderPopover(
  t: TagihanAktif,
  aksi: Partial<{
    onTutup: () => void;
    onBayar: (d: DataBayar) => Promise<void>;
    onUbah: (d: DataUbah) => Promise<void>;
    onHapus: () => Promise<void>;
    onHapusPembayaran: (id: number) => Promise<void>;
    onMuatRiwayat: () => void;
    onTambah: (d: DataTambah) => Promise<void>;
    jumlahTerpilih: number;
    jumlahTagihan: number;
    totalSisaTerpilih: number;
    onAksiBatch: (aksi: AksiBatch) => void;
    batchBusy: boolean;
    paksaBatch: boolean;
  }> = {},
  riwayat: Partial<{ rows: PembayaranRow[]; busy: boolean; error: string }> = {},
) {
  const p = {
    onTutup: vi.fn(),
    onBayar: vi.fn(() => Promise.resolve()),
    onUbah: vi.fn(() => Promise.resolve()),
    onHapus: vi.fn(() => Promise.resolve()),
    onHapusPembayaran: vi.fn(() => Promise.resolve()),
    onMuatRiwayat: vi.fn(),
    onTambah: vi.fn(() => Promise.resolve()),
    ...aksi,
  };
  const view = renderDenganTema(
    <PopoverAksiTagihan
      tagihan={t}
      tambah={null}
      anchor={jangkar()}
      riwayat={riwayat.rows ?? []}
      riwayatBusy={riwayat.busy ?? false}
      riwayatError={riwayat.error ?? ''}
      {...p}
    />,
  );
  return { ...p, view };
}

describe('mode batch (banyak sel terpilih)', () => {
  /* Bilah pilihan sudah dihapus; aksi massal kini muncul di popover yang
     dibuka lewat KLIK KANAN saat lebih dari satu sel terpilih. */
  const onAksiBatch = vi.fn();

  it('>1 sel terpilih menampilkan aksi batch, bukan panel tagihan tunggal', () => {
    renderPopover(tagihan(), { jumlahTerpilih: 3, totalSisaTerpilih: 165000, onAksiBatch });
    expect(screen.getByText('3 sel dipilih')).toBeInTheDocument();
    // Nominal dipisah dari labelnya (satu simpul teks sendiri) supaya bisa
    // diberi tabular-nums & warna lebih tegas; dijaga di sini agar nilainya
    // tetap terbaca berpasangan dengan label "Total sisa".
    expect(screen.getByText('Total sisa')).toBeInTheDocument();
    expect(screen.getByText('Rp 165.000')).toBeInTheDocument();
    // Aksi massal tersedia…
    expect(screen.getByText('Bayar Lunas')).toBeInTheDocument();
    expect(screen.getByText('Ubah Massal')).toBeInTheDocument();
    expect(screen.getByText('Hapus Tagihan')).toBeInTheDocument();
    expect(screen.getByText('Hapus Riwayat Bayar')).toBeInTheDocument();
    // …dan panel tagihan tunggal tidak dirender.
    expect(screen.queryByText('Santri Uji')).toBeNull();
  });

  it('klik aksi batch meneruskan aksinya ke pemanggil', async () => {
    renderPopover(tagihan(), { jumlahTerpilih: 3, totalSisaTerpilih: 165000, onAksiBatch });
    await userEvent.click(screen.getByText('Bayar Lunas'));
    expect(onAksiBatch).toHaveBeenCalledWith('bayar');
    await userEvent.click(screen.getByText('Ubah Massal'));
    expect(onAksiBatch).toHaveBeenCalledWith('ubah');
    await userEvent.click(screen.getByText('Hapus Riwayat Bayar'));
    expect(onAksiBatch).toHaveBeenCalledWith('hapus_riwayat');
  });

  it('aksi merusak dipisah dari aksi aman dan diberi label peringatan', () => {
    /* Empat aksi dulu sederet tanpa pembeda, sehingga "Hapus Tagihan" gampang
       terklik saat niatnya "Bayar". Sekarang ada garis pemisah + label
       kelompok sebelum dua aksi yang menghapus permanen. */
    renderPopover(tagihan(), { jumlahTerpilih: 2, jumlahTagihan: 2, totalSisaTerpilih: 110000, onAksiBatch });
    expect(screen.getByText('Menghapus permanen')).toBeInTheDocument();

    const panel = document.getElementById('batch_aksi_tagihan')!;
    const baris = ['btn_batch_bayar', 'btn_batch_ubah', 'btn_batch_hapus_tagihan', 'btn_batch_hapus_riwayat']
      .map((id) => panel.querySelector(`#${id}`)!);
    expect(baris.every((el) => el !== null)).toBe(true);
    // Dua aksi terakhir bergaya destructive, dua pertama tidak.
    expect(baris[0].className).not.toContain('text-destructive');
    expect(baris[1].className).not.toContain('text-destructive');
    expect(baris[2].className).toContain('text-destructive');
    expect(baris[3].className).toContain('text-destructive');
    // Tiap aksi punya keterangan satu baris (bayar/ubah tidak boleh sekadar
    // satu kata tanpa konteks).
    expect(screen.getByText('Catat sisa 2 tagihan lunas')).toBeInTheDocument();
    expect(screen.getByText('Jatuh tempo & dispensasi')).toBeInTheDocument();
  });

  it('panel batch memakai lebar sendiri, bukan 32rem milik panel tunggal', () => {
    /* Panel tunggal butuh 32rem (foto + tab). Panel batch hanya menu; kalau
       ikut 32rem, tombolnya terentang ~500px di ruang kosong. Lebar kini
       diserahkan ke isi + wadah berlebar sendiri. */
    renderPopover(tagihan(), { jumlahTerpilih: 3, totalSisaTerpilih: 165000, onAksiBatch });
    const pop = document.getElementById('popover_aksi_tagihan')!;
    expect(pop.className).toContain('w-auto');
    expect(pop.className).not.toContain('w-[32rem]');
    expect(document.getElementById('batch_aksi_tagihan')!.className).toContain('w-64');
  });

  it('satu sel terpilih tetap memakai panel tagihan tunggal', () => {
    renderPopover(tagihan(), { jumlahTerpilih: 1, totalSisaTerpilih: 55000, onAksiBatch });
    expect(screen.queryByText(/tagihan dipilih/)).toBeNull();
    expect(screen.getByText('Santri Uji')).toBeInTheDocument();
  });
});

describe('ringkasan tagihan', () => {
  it('memuat nama, orang tua, tagihan, dibayar, dan sisa', () => {
    renderPopover(tagihan());
    expect(screen.getByText('Santri Uji')).toBeInTheDocument();
    expect(screen.getByText('Ayah: Bpk. Abdul')).toBeInTheDocument();
    expect(screen.getByText('Ibu: Siti Aminah')).toBeInTheDocument();
    expect(screen.getByText('Kelas 4B (MI)')).toBeInTheDocument();
    expect(screen.getByText('Infaq Bulanan · Jul 2025')).toBeInTheDocument();
    expect(screen.getByText('Rp 75.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 20.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 55.000')).toBeInTheDocument();
  });

  it('ayah kosong hanya menampilkan garis putus di barisnya', () => {
    renderPopover(tagihan({ ayah_nama: null, ibu_nama: 'Siti Aminah' }));
    expect(screen.getByText('Ayah: —')).toBeInTheDocument();
    expect(screen.getByText('Ibu: Siti Aminah')).toBeInTheDocument();
  });

  it('ayah dan ibu kosong keduanya garis putus', () => {
    renderPopover(tagihan({ ayah_nama: null, ibu_nama: null }));
    expect(screen.getByText('Ayah: —')).toBeInTheDocument();
    expect(screen.getByText('Ibu: —')).toBeInTheDocument();
  });

  it('badge status mengikuti kondisi tagihan', () => {
    const { unmount } = renderDenganTema(
      <PopoverAksiTagihan tagihan={tagihan({ terlambat: true })} tambah={null} anchor={jangkar()}
        riwayat={[]} riwayatBusy={false} riwayatError=""
        onTutup={() => {}} onBayar={async () => {}} onUbah={async () => {}} onHapus={async () => {}} onHapusPembayaran={async () => {}} onMuatRiwayat={() => {}} onTambah={async () => {}} />,
    );
    expect(screen.getByText('Tunggakan')).toBeInTheDocument();
    unmount();

    renderDenganTema(
      <PopoverAksiTagihan tagihan={tagihan({ terlambat: false, status: 'lunas', sisa: 0 })} tambah={null} anchor={jangkar()}
        riwayat={[]} riwayatBusy={false} riwayatError=""
        onTutup={() => {}} onBayar={async () => {}} onUbah={async () => {}} onHapus={async () => {}} onHapusPembayaran={async () => {}} onMuatRiwayat={() => {}} onTambah={async () => {}} />,
    );
    expect(screen.getByText('Lunas')).toBeInTheDocument();
  });

  it('jenjang ganda digabung (MI-MD)', () => {
    renderPopover(tagihan({ kelas: '4B', jenjangRiwayat: ['MI', 'MD'] }));
    expect(screen.getByText('Kelas 4B (MI-MD)')).toBeInTheDocument();
  });

  it('tombol tutup di kanan atas memanggil onTutup', async () => {
    const onTutup = vi.fn();
    renderPopover(tagihan(), { onTutup });

    await userEvent.click(screen.getByRole('button', { name: 'Tutup' }));

    expect(onTutup).toHaveBeenCalledTimes(1);
  });
});

describe('avatar santri', () => {
  it('tanpa foto apa pun menampilkan inisial', () => {
    ambilByte.mockClear();
    ambilFoto.mockClear();
    renderPopover(tagihan({ fotoDokumenId: null, fotoProfil: false }));
    expect(screen.getByText('SU')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(ambilByte).not.toHaveBeenCalled();
    expect(ambilFoto).not.toHaveBeenCalled();
  });

  it('menampilkan foto dari dokumen (tingkat pertama)', async () => {
    ambilByte.mockClear();
    ambilFoto.mockClear();
    renderPopover(tagihan({ fotoDokumenId: 11, fotoProfil: true }));
    const img = await screen.findByAltText('Foto Santri Uji');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'blob:foto-uji');
    expect(ambilByte).toHaveBeenCalledWith('santri', 11);
    // Dokumen berhasil → foto profil tak diminta.
    expect(ambilFoto).not.toHaveBeenCalled();
  });

  it('dokumen gagal → jatuh ke foto profil', async () => {
    ambilByte.mockClear();
    ambilFoto.mockClear();
    ambilByte.mockRejectedValueOnce(new Error('Forbidden'));
    ambilFoto.mockResolvedValueOnce(new Uint8Array([137, 80, 78, 71]));
    renderPopover(tagihan({ fotoDokumenId: 12, fotoProfil: true }));
    expect(await screen.findByAltText('Foto Santri Uji')).toBeInTheDocument();
    expect(ambilFoto).toHaveBeenCalledWith(7);
  });

  it('semua tingkat gagal kembali ke inisial', async () => {
    ambilByte.mockClear();
    ambilFoto.mockClear();
    ambilByte.mockRejectedValueOnce(new Error('Forbidden'));
    ambilFoto.mockRejectedValueOnce(new Error('tak ada foto'));
    renderPopover(tagihan({ fotoDokumenId: 12, fotoProfil: true }));
    expect(await screen.findByText('SU')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('tab aksi', () => {
  it('memuat tiga tab dengan ikon dan label', () => {
    renderPopover(tagihan());
    for (const label of ['Detail', 'Bayar', 'Ubah']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('tab', { name: 'Hapus' })).not.toBeInTheDocument();
  });

  it('tab awal adalah Detail', () => {
    renderPopover(tagihan());
    expect(screen.getByRole('tab', { name: 'Detail' })).toHaveAttribute('data-state', 'active');
  });

  it('berpindah tab menampilkan panel yang sesuai', async () => {
    renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    expect(screen.getByLabelText('Nominal')).toBeInTheDocument();
  });
});

/** Radix memasang `pointer-events: none` di body selagi dropdown terbuka,
 *  jadi userEvent menolak klik tanpa `pointerEventsCheck: 0`. */
const klikSelect = (el: Element) => userEvent.click(el, { pointerEventsCheck: 0 });

describe('panel bayar', () => {
  it('jumlah defaultnya sisa tagihan dan bisa diubah', async () => {
    const { onBayar } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Bayar' }));
    const input = screen.getByLabelText('Jumlah pembayaran');
    expect(input).toHaveValue('55.000');

    await userEvent.clear(input);
    await userEvent.type(input, '25000');
    await userEvent.click(document.getElementById('btn_bayar_simpan') as HTMLElement);
    await waitFor(() => expect(onBayar).toHaveBeenCalledTimes(1));
    expect(onBayar).toHaveBeenCalledWith({ jumlah: 25000, metode: 'tunai', kas: 'tunai_tu' });
  });

  it('nominal bayar = LabeledInput tipe nominal: panel nominal cepat menambah nilai tanpa menutup popover', async () => {
    const { onBayar, onTutup } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Bayar' }));

    // Kotak nominal: label "Bayar" menyatu di dalam kotak + tombol kalkulator
    // (id diturunkan dari htmlFor).
    const tombolPreset = document.getElementById('btn_preset_inp_bayar_jumlah');
    expect(tombolPreset).not.toBeNull();
    const input = screen.getByLabelText('Jumlah pembayaran');
    expect(input).toHaveValue('55.000');

    // Turunkan dulu ke Rp 20.000 agar penambahan preset tetap di bawah sisa
    // (Rp 55.000) — di atas sisa tombol Simpan memang dinonaktifkan.
    await userEvent.clear(input);
    await userEvent.type(input, '20000');

    // Buka panel nominal cepat (popover BERSARANG di dalam popover aksi) lalu
    // tambah Rp 5.000 — nominal selalu ditambahkan ke nilai berjalan.
    await userEvent.click(tombolPreset as HTMLElement);
    const cepat = await screen.findByRole('group', { name: 'Nominal cepat' });
    await userEvent.click(within(cepat).getByRole('button', { name: '5.000' }));

    await waitFor(() => expect(input).toHaveValue('25.000'));
    // Interaksi di panel bersarang tidak boleh menutup popover aksi (klik luar
    // Radix soal "branch") — popover terkontrol, jadi tertutup = onTutup jalan.
    expect(onTutup).not.toHaveBeenCalled();

    // Nilai hasil tombol tetap terkirim lewat jalur normal.
    await userEvent.click(document.getElementById('btn_bayar_simpan') as HTMLElement);
    await waitFor(() => expect(onBayar).toHaveBeenCalledWith(
      expect.objectContaining({ jumlah: 25000 }),
    ));
  });

  it('tombol Penuh sudah dihapus — field tetap terisi sisa saat dibuka', async () => {
    // Aturan main: field nominal sudah default ke sisa tagihan saat panel dibuka,
    // jadi tombol pintas "Penuh" tidak perlu lagi (memperkecil baris input).
    renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Bayar' }));
    expect(screen.queryByRole('button', { name: 'Penuh' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Jumlah pembayaran')).toHaveValue('55.000');
  });

  it('nominal melebihi sisa ditolak beserta pesan', async () => {
    const { onBayar } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Bayar' }));
    const input = screen.getByLabelText('Jumlah pembayaran');
    await userEvent.clear(input);
    await userEvent.type(input, '999999');
    expect(screen.getByText(/Isi Rp 1 sampai Rp 55.000/)).toBeInTheDocument();
    expect(document.getElementById('btn_bayar_simpan')).toBeDisabled();
    expect(onBayar).not.toHaveBeenCalled();
  });

    it('label Metode dan Posisi Kas ada', async () => {
    renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Bayar' }));
    expect(screen.getByText('Metode')).toBeInTheDocument();
    expect(screen.getByText('Posisi Kas')).toBeInTheDocument();
    expect(screen.getByLabelText('Metode pembayaran')).toBeInTheDocument();
    expect(screen.getByLabelText('Kas tujuan')).toBeInTheDocument();
  });

  it('pilihan kas ikut metode: tunai hanya Kas TU', async () => {
    renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Bayar' }));
    await klikSelect(screen.getByLabelText('Kas tujuan'));
    const opsi = screen.getAllByRole('option').map((o) => o.textContent);
    expect(opsi).toEqual(['Kas TU']);
  });

  it('ganti ke transfer → pilihan kas jadi bank, dan kas terpilih ikut berubah', async () => {
    const { onBayar } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Bayar' }));
    expect(screen.getByLabelText('Kas tujuan')).toHaveTextContent('Kas TU');

    await klikSelect(screen.getByLabelText('Metode pembayaran'));
    await klikSelect(screen.getByRole('option', { name: 'Transfer' }));

    // Nilai kas lama (tunai_tu) tidak ada di pilihan transfer → ambil yang pertama.
    expect(screen.getByLabelText('Kas tujuan')).toHaveTextContent('Bank Pesantren');

    await klikSelect(screen.getByLabelText('Kas tujuan'));
    const opsi = screen.getAllByRole('option').map((o) => o.textContent);
    expect(opsi).toEqual(['Bank Pesantren', 'Bank Jenjang']);
    await userEvent.keyboard('{Escape}'); // tutup dropdown sebelum klik Simpan

    await userEvent.click(document.getElementById('btn_bayar_simpan') as HTMLElement);
    await waitFor(() => expect(onBayar).toHaveBeenCalledWith(
      expect.objectContaining({ metode: 'transfer', kas: 'bank_pesantren' }),
    ));
  });

  it('kembali ke tunai → kas kembali jadi Kas TU', async () => {
    renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Bayar' }));
    await klikSelect(screen.getByLabelText('Metode pembayaran'));
    await klikSelect(screen.getByRole('option', { name: 'Transfer' }));
    expect(screen.getByLabelText('Kas tujuan')).toHaveTextContent('Bank Pesantren');

    await klikSelect(screen.getByLabelText('Metode pembayaran'));
    await klikSelect(screen.getByRole('option', { name: 'Tunai' }));
    expect(screen.getByLabelText('Kas tujuan')).toHaveTextContent('Kas TU');
  });

  it('tagihan lunas menyembunyikan form bayar', async () => {
    renderPopover(tagihan({ status: 'lunas', sisa: 0, terbayar: 75000 }));
    await userEvent.click(screen.getByRole('tab', { name: 'Bayar' }));
    expect(screen.queryByLabelText('Jumlah pembayaran')).toBeNull();
    expect(screen.getByText(/sudah lunas/)).toBeInTheDocument();
  });
});

describe('panel ubah', () => {
  it('mengisi form dari nilai tagihan dan mengirim nilai baru', async () => {
    const { onUbah } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));

    const nominal = screen.getByLabelText('Nominal');
    expect(nominal).toHaveValue(75000);

    await userEvent.clear(nominal);
    await userEvent.type(nominal, '80000');
    await userEvent.click(document.getElementById('btn_ubah_simpan') as HTMLElement);
    await waitFor(() => expect(onUbah).toHaveBeenCalledTimes(1));
    // TA & jatuh tempo dikirim ulang apa adanya (backend menghitung ulang
    // yang bulanan; yang non-bulanan dipertahankan).
    expect(onUbah).toHaveBeenCalledWith({ nominal: 80000, tahun_ajaran: '2025/2026', jatuh_tempo: '2025-08-10' });
  });

  it('nominal di bawah nilai terbayar ditolak', async () => {
    const { onUbah } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    const nominal = screen.getByLabelText('Nominal');
    await userEvent.clear(nominal);
    await userEvent.type(nominal, '10000');
    expect(screen.getByText(/Minimal Rp 20.000/)).toBeInTheDocument();
    expect(document.getElementById('btn_ubah_simpan')).toBeDisabled();
    expect(onUbah).not.toHaveBeenCalled();
  });

  it('ubah meneruskan tahun ajaran & jatuh tempo asli (tak bisa diubah)', async () => {
    const { onUbah } = renderPopover(tagihan({ tipe: 'non_bulanan', jatuhTempo: '2025-09-15' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    // Tak ada lagi kontrol Tahun Ajaran / Jatuh Tempo di tab Ubah.
    expect(screen.queryByLabelText('Tahun ajaran')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Jatuh Tempo')).not.toBeInTheDocument();
    const nominal = screen.getByLabelText('Nominal');
    await userEvent.clear(nominal);
    await userEvent.type(nominal, '80000');
    await userEvent.click(document.getElementById('btn_ubah_simpan') as HTMLElement);
    await waitFor(() => expect(onUbah).toHaveBeenCalledTimes(1));
    expect(onUbah).toHaveBeenCalledWith({ nominal: 80000, tahun_ajaran: '2025/2026', jatuh_tempo: '2025-09-15' });
  });
});

describe('tombol hapus sejajar tab', () => {
  it('bukan tab, melainkan tombol biasa', () => {
    renderPopover(tagihan());
    expect(screen.queryByRole('tab', { name: 'Hapus' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hapus tagihan' })).toBeInTheDocument();
  });

  it('klik langsung membuka konfirmasi dan meneruskan saat dikonfirmasi', async () => {
    const { onHapus } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('button', { name: 'Hapus tagihan' }));
    // Tetap di tab Detail (bukan pindah tab); konfirmasi tampil di area konten.
    expect(screen.getByRole('tab', { name: 'Detail' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText(/tidak bisa dibatalkan/)).toBeInTheDocument();

    await userEvent.click(document.getElementById('btn_hapus_konfirmasi') as HTMLElement);
    await waitFor(() => expect(onHapus).toHaveBeenCalledTimes(1));
  });

  it('Batal menutup konfirmasi tanpa menghapus', async () => {
    const { onHapus } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('button', { name: 'Hapus tagihan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.getByRole('button', { name: 'Hapus tagihan' })).toBeInTheDocument();
    expect(onHapus).not.toHaveBeenCalled();
  });
});

describe('panel detail pembayaran', () => {
  it('meminta riwayat sekali saat popover dibuka', async () => {
    const { onMuatRiwayat } = renderPopover(tagihan());
    await waitFor(() => expect(onMuatRiwayat).toHaveBeenCalledTimes(1));
  });

  it('menampilkan daftar pembayaran', async () => {
    renderPopover(tagihan(), {}, {
      rows: [pembayaran(), pembayaran({ id: 2, jumlah: 35000, metode: 'transfer', kas: 'bank_lembaga', no_kwitansi: null, created_at: '2025-08-05T14:30:00' })],
    });
    // Cakupan assertion ke daftar riwayat saja: nominal yang sama bisa muncul
    // juga di ringkasan ("Dibayar").
    const daftar = within(screen.getByRole('list'));
    expect(daftar.getByText('Rp 20.000')).toBeInTheDocument();
    expect(daftar.getByText('Rp 35.000')).toBeInTheDocument();
    expect(daftar.getByText(/Tunai · Kas TU · KW-001/)).toBeInTheDocument();
    expect(daftar.getByText(/Transfer · Bank Jenjang/)).toBeInTheDocument();
    expect(daftar.getByText('01 Agu 2025 09:12')).toBeInTheDocument();
  });

  it('menampilkan keadaan proses', async () => {
    const { view } = renderPopover(tagihan(), {}, { busy: true });
    expect(screen.getByText('Memuat riwayat…')).toBeInTheDocument();
    view.unmount();
  });

  it('menampilkan keadaan kosong', async () => {
    const { view } = renderPopover(tagihan(), {}, { busy: false });
    expect(screen.getByText(/Belum ada pembayaran/)).toBeInTheDocument();
    view.unmount();
  });

  it('menampilkan pesan galat', async () => {
    renderPopover(tagihan(), {}, { error: 'Gagal memuat riwayat.' });
    expect(screen.getByText('Gagal memuat riwayat.')).toBeInTheDocument();
  });

  it('menampilkan dispensasi yang menempel (nama + potongan)', async () => {
    daftarDispen.mockResolvedValueOnce([{ id: 9, nama: 'Anak Pegawai' } as Dispensasi]);
    renderPopover(tagihan({ potongan: 10000, dispensasi_ids: [9] }));
    expect(await screen.findByText('Anak Pegawai · −Rp 10.000')).toBeInTheDocument();
  });

  it('tanpa dispensasi menampilkan garis putus', () => {
    renderPopover(tagihan({ potongan: 0, dispensasi_ids: null }));
    expect(screen.getByText('Dispensasi').closest('div')).toHaveTextContent('—');
  });
});

describe('tanpa tagihan / jangkar', () => {
  it('tidak merender apa pun', () => {
    const { container } = renderDenganTema(
      <PopoverAksiTagihan tagihan={null} tambah={null} anchor={null}
        riwayat={[]} riwayatBusy={false} riwayatError=""
        onTutup={() => {}} onBayar={async () => {}} onUbah={async () => {}} onHapus={async () => {}} onHapusPembayaran={async () => {}} onMuatRiwayat={() => {}} onTambah={async () => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('mode tambah (sel kosong)', () => {
  function tambahCtx(timpa: Partial<TambahCtx> = {}): TambahCtx {
    return {
      nama: 'Santri Uji', label: 'Infaq Bulanan · Agu 2025',
      santri_id: 7, jenjang: 'MI', ayah_nama: 'Bpk. Abdul', ibu_nama: 'Siti Aminah',
      jenis_id: 1, periode: '2025-08', tipe: 'bulanan',
      tahunAjaran: '2025/2026', nominalAwal: 50000, ...timpa,
    };
  }

  function renderTambah(ctx: TambahCtx, onTambah = vi.fn(() => Promise.resolve())) {
    renderDenganTema(
      <PopoverAksiTagihan
        tagihan={null}
        tambah={ctx}
        anchor={jangkar()}
        riwayat={[]} riwayatBusy={false} riwayatError=""
        onTutup={() => {}}
        onBayar={async () => {}}
        onUbah={async () => {}}
        onHapus={async () => {}}
        onTambah={onTambah}
        onHapusPembayaran={async () => {}}
        onMuatRiwayat={() => {}}
      />,
    );
    return onTambah;
  }

  it('menampilkan ringkasan santri + label sel tanpa tab aksi', () => {
    renderTambah(tambahCtx());
    expect(screen.getByText('Santri Uji')).toBeInTheDocument();
    expect(screen.getByText(/Tambah tagihan/)).toBeInTheDocument();
    expect(screen.getByText(/Infaq Bulanan · Agu 2025/)).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('nominal terisi dari tarif; simpan memanggil onTambah', async () => {
    const onTambah = renderTambah(tambahCtx());
    expect(screen.getByDisplayValue('50000')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(onTambah).toHaveBeenCalledTimes(1);
    expect(onTambah).toHaveBeenCalledWith({ nominal: 50000, jatuh_tempo: null });
  });

  it('nominal di bawah 1 mengunci simpan', async () => {
    const onTambah = renderTambah(tambahCtx({ nominalAwal: null }));
    const simpan = screen.getByRole('button', { name: 'Simpan' });
    expect(simpan).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Nominal tagihan baru'), '0');
    expect(screen.getByText('Isi nominal minimal Rp 1.')).toBeInTheDocument();
    expect(simpan).toBeDisabled();
    await userEvent.click(simpan).catch(() => {});
    expect(onTambah).not.toHaveBeenCalled();
  });

  it('bulanan otomatis tanggal 10; non-bulanan minta tanggal manual', async () => {
    renderTambah(tambahCtx());
    expect(screen.getByText(/Otomatis: tanggal 10/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Jatuh Tempo')).not.toBeInTheDocument();
  });

  it('non-bulanan mengirim jatuh tempo terisi', async () => {
    const onTambah = renderTambah(tambahCtx({
      tipe: 'non_bulanan', periode: null, label: 'Pendaftaran · sekali', nominalAwal: 100000,
    }));
    const tgl = screen.getByLabelText('Jatuh Tempo');
    fireEvent.change(tgl, { target: { value: '2025-09-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(onTambah).toHaveBeenCalledWith({ nominal: 100000, jatuh_tempo: '2025-09-01' });
  });

  it('tanpa tahun ajaran tunggal simpan dikunci', () => {
    renderTambah(tambahCtx({ tahunAjaran: null }));
    expect(screen.getByText(/Pilih satu tahun ajaran/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
  });
});

describe('tab Ubah — dispensasi', () => {
  const PAKET: Dispensasi[] = [
    {
      id: 11, nama: 'Prestasi', keterangan: null, tahun_ajaran: '2025/2026', is_active: true,
      kuota_bulan: null, grup: null,
      aturan: [{ id: 1, dispensasi_id: 11, jenis_id: 1, tipe: 'persen', nilai: 50 }],
      santri_ids: [7],
    },
    {
      id: 12, nama: 'Anak Pegawai', keterangan: null, tahun_ajaran: '2025/2026', is_active: true,
      kuota_bulan: null, grup: null,
      aturan: [{ id: 2, dispensasi_id: 12, jenis_id: 1, tipe: 'nominal', nilai: 10000 }],
      santri_ids: [9],
    },
  ];

  async function bukaUbah() {
    renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
  }

  it('semua paket bisa dipilih; bukan-penerima otomatis terdaftar', async () => {
    daftarDispen.mockResolvedValue(PAKET);
    await bukaUbah();
    // Daftar lintas TA: hanya jenis + aktif yang dikirim.
    await waitFor(() => expect(daftarDispen).toHaveBeenCalledWith(
      expect.objectContaining({ jenis_id: 1, is_active: true }),
    ));
    expect(daftarDispen).not.toHaveBeenCalledWith(expect.objectContaining({ tahun_ajaran: expect.anything() }));
    await userEvent.click(screen.getByLabelText('Dispensasi tagihan'));
    expect(screen.getByRole('option', { name: 'Prestasi · 50%' })).toBeInTheDocument();
    const opsi = screen.getByRole('option', { name: /Anak Pegawai/ });
    expect(opsi).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(opsi);
    expect(screen.getByText(/santri otomatis jadi penerima/)).toBeInTheDocument();
  });

  it('memilih paket menyesuaikan nominal + pratinjau, simpan mengirim ids', async () => {
    const p = { onUbah: vi.fn(() => Promise.resolve()) };
    daftarDispen.mockResolvedValue(PAKET);
    renderPopover(tagihan(), p);
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    await userEvent.click(screen.getByLabelText('Dispensasi tagihan'));
    await userEvent.click(screen.getByRole('option', { name: 'Prestasi · 50%' }));
    // Kotor 75.000 − 50% → 37.500, input dikunci mengikuti paket.
    expect(screen.getByDisplayValue('37500')).toBeInTheDocument();
    expect(screen.getByText(/Rp 75.000.*Rp 37.500.*Prestasi/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('37500')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(p.onUbah).toHaveBeenCalledWith(expect.objectContaining({
      nominal: 37500, dispensasi_ids: [11],
    }));
  });

  it('paket kuota habis dinonaktifkan; yang menempel tetap bisa dipilih', async () => {
    daftarDispen.mockResolvedValue([
      { ...PAKET[0], kuota_bulan: 1 },
      { ...PAKET[1], kuota_bulan: 1 },
    ]);
    kuotaTerpakai.mockResolvedValue({ 7: { 11: 1 } });
    await bukaUbah();
    await userEvent.click(screen.getByLabelText('Dispensasi tagihan'));
    // Prestasi kuota 1 sudah terpakai 1 → habis; Anak Pegawai sisa → aktif.
    expect(screen.getByRole('option', { name: /Prestasi.*kuota habis/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: /Anak Pegawai/ })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('pilihan se-grup menggantikan jejak (pratinjau gabung)', async () => {
    const ganjil: Dispensasi = {
      id: 21, nama: 'Ganjil', keterangan: null, tahun_ajaran: '2025/2026', is_active: true,
      kuota_bulan: null, grup: 'prestasi',
      aturan: [{ id: 21, dispensasi_id: 21, jenis_id: 1, tipe: 'bebas', nilai: 0 }],
      santri_ids: [7],
    };
    const genap: Dispensasi = { ...ganjil, id: 22, nama: 'Genap', aturan: [{ id: 22, dispensasi_id: 22, jenis_id: 1, tipe: 'bebas', nilai: 0 }] };
    daftarDispen.mockResolvedValue([ganjil, genap]);
    const p = { onUbah: vi.fn(() => Promise.resolve()) };
    renderPopover(tagihan({ nominal: 0, potongan: 75000, terbayar: 0, dispensasi_ids: [21] }), p);
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    await userEvent.click(screen.getByLabelText('Dispensasi tagihan'));
    await userEvent.click(screen.getByRole('option', { name: 'Genap · Bebas' }));
    // Kotor 75.000 → bebas (genap ganti ganjil) → 0.
    expect(screen.getByText(/Rp 75\.000.*Genap/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(p.onUbah).toHaveBeenCalledWith(expect.objectContaining({
      nominal: 0, dispensasi_ids: [22],
    }));
  });

  it('tanpa dispensasi mengembalikan kotor dan mengirim ids kosong', async () => {
    const p = { onUbah: vi.fn(() => Promise.resolve()) };
    daftarDispen.mockResolvedValue(PAKET);
    renderPopover(tagihan({ nominal: 37500, potongan: 37500, dispensasi_ids: [11] }), p);
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    expect(screen.getByText(/potongan Rp 37.500/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Dispensasi tagihan'));
    await userEvent.click(screen.getByRole('option', { name: /Tanpa dispensasi/ }));
    expect(screen.getByText(/Kembali kotor Rp 75.000/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(p.onUbah).toHaveBeenCalledWith(expect.objectContaining({
      nominal: 75000, dispensasi_ids: [],
    }));
  });

  it('tanpa disentuh mengirim tanpa kunci ids (jalur lama)', async () => {
    let terkirim: DataUbah | undefined;
    const p = { onUbah: vi.fn(async (d: DataUbah) => { terkirim = d; }) };
    daftarDispen.mockResolvedValue(PAKET);
    renderPopover(tagihan(), p);
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(terkirim?.nominal).toBe(75000);
    expect(terkirim && 'dispensasi_ids' in terkirim).toBe(false);
  });
});
