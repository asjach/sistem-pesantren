import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PembayaranRow } from '@/api/keuangan';
import type { Dispensasi } from '@/api/keuangan';
import type { TahunAjaran } from '@/api/master';
import { renderDenganTema } from '@/test/utils';
import PopoverAksiTagihan, { type DataBayar, type DataTambah, type DataUbah, type TagihanAktif, type TambahCtx } from './PopoverAksiTagihan';

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
    santri_id: 7, jenisId: 1,
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

const DAFTAR_TA: TahunAjaran[] = [
  { nama: '2025/2026', is_aktif: true } as TahunAjaran,
  { nama: '2024/2025', is_aktif: false } as TahunAjaran,
];

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
      daftarTA={DAFTAR_TA}
      riwayat={riwayat.rows ?? []}
      riwayatBusy={riwayat.busy ?? false}
      riwayatError={riwayat.error ?? ''}
      {...p}
    />,
  );
  return { ...p, view };
}

describe('ringkasan tagihan', () => {
  it('memuat nama, ayah, ibu, tagihan, dibayar, dan sisa', () => {
    renderPopover(tagihan());
    expect(screen.getByText('Santri Uji')).toBeInTheDocument();
    expect(screen.getByText('Ayah')).toBeInTheDocument();
    expect(screen.getByText('Bpk. Abdul')).toBeInTheDocument();
    expect(screen.getByText('Ibu')).toBeInTheDocument();
    expect(screen.getByText('Siti Aminah')).toBeInTheDocument();
    expect(screen.getByText('Infaq Bulanan · Jul 2025')).toBeInTheDocument();
    expect(screen.getByText('Rp 75.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 20.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 55.000')).toBeInTheDocument();
    expect(screen.getByText('Jatuh tempo 10 Agu 2025')).toBeInTheDocument();
  });

  it('ayah kosong ditandai garis putus, ibu tetap tampil', () => {
    renderPopover(tagihan({ ayah_nama: null, ibu_nama: 'Siti Aminah' }));
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Siti Aminah')).toBeInTheDocument();
  });

  it('ayah dan ibu kosong keduanya ditandai garis putus', () => {
    renderPopover(tagihan({ ayah_nama: null, ibu_nama: null }));
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('badge status mengikuti kondisi tagihan', () => {
    const { unmount } = renderDenganTema(
      <PopoverAksiTagihan tagihan={tagihan({ terlambat: true })} tambah={null} anchor={jangkar()} daftarTA={DAFTAR_TA}
        riwayat={[]} riwayatBusy={false} riwayatError=""
        onTutup={() => {}} onBayar={async () => {}} onUbah={async () => {}} onHapus={async () => {}} onHapusPembayaran={async () => {}} onMuatRiwayat={() => {}} onTambah={async () => {}} />,
    );
    expect(screen.getByText('Tunggakan')).toBeInTheDocument();
    unmount();

    renderDenganTema(
      <PopoverAksiTagihan tagihan={tagihan({ terlambat: false, status: 'lunas', sisa: 0 })} tambah={null} anchor={jangkar()} daftarTA={DAFTAR_TA}
        riwayat={[]} riwayatBusy={false} riwayatError=""
        onTutup={() => {}} onBayar={async () => {}} onUbah={async () => {}} onHapus={async () => {}} onHapusPembayaran={async () => {}} onMuatRiwayat={() => {}} onTambah={async () => {}} />,
    );
    expect(screen.getByText('Lunas')).toBeInTheDocument();
  });

  it('tanpa batas jatuh tempo menampilkan keterangan itu', () => {
    renderPopover(tagihan({ jatuhTempo: null }));
    expect(screen.getByText('Tanpa batas jatuh tempo')).toBeInTheDocument();
  });

  it('tombol tutup di kanan atas memanggil onTutup', async () => {
    const onTutup = vi.fn();
    renderPopover(tagihan(), { onTutup });

    await userEvent.click(screen.getByRole('button', { name: 'Tutup' }));

    expect(onTutup).toHaveBeenCalledTimes(1);
  });
});

describe('tab aksi', () => {
  it('memuat empat tab dengan ikon dan label', () => {
    renderPopover(tagihan());
    for (const label of ['Bayar', 'Ubah', 'Hapus', 'Detail']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('tab awal adalah Bayar', () => {
    renderPopover(tagihan());
    expect(screen.getByRole('tab', { name: 'Bayar' })).toHaveAttribute('data-state', 'active');
  });

  it('berpindah tab menampilkan panel yang sesuai', async () => {
    renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    expect(screen.getByLabelText('Nominal')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Hapus' }));
    expect(screen.getByText(/tidak bisa dibatalkan/)).toBeInTheDocument();
  });
});

/** Radix memasang `pointer-events: none` di body selagi dropdown terbuka,
 *  jadi userEvent menolak klik tanpa `pointerEventsCheck: 0`. */
const klikSelect = (el: Element) => userEvent.click(el, { pointerEventsCheck: 0 });

describe('panel bayar', () => {
  it('jumlah defaultnya sisa tagihan dan bisa diubah', async () => {
    const { onBayar } = renderPopover(tagihan());
    const input = screen.getByLabelText('Jumlah pembayaran');
    expect(input).toHaveValue(55000);

    await userEvent.clear(input);
    await userEvent.type(input, '25000');
    await userEvent.click(document.getElementById('btn_bayar_simpan') as HTMLElement);
    await waitFor(() => expect(onBayar).toHaveBeenCalledTimes(1));
    expect(onBayar).toHaveBeenCalledWith({ jumlah: 25000, metode: 'tunai', kas: 'tunai_tu' });
  });

  it('tombol Penuh sudah dihapus — field tetap terisi sisa saat dibuka', () => {
    // Aturan main: field nominal sudah default ke sisa tagihan saat panel dibuka,
    // jadi tombol pintas "Penuh" tidak perlu lagi (memperkecil baris input).
    renderPopover(tagihan());
    expect(screen.queryByRole('button', { name: 'Penuh' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Jumlah pembayaran')).toHaveValue(55000);
  });

  it('nominal melebihi sisa ditolak beserta pesan', async () => {
    const { onBayar } = renderPopover(tagihan());
    const input = screen.getByLabelText('Jumlah pembayaran');
    await userEvent.clear(input);
    await userEvent.type(input, '999999');
    expect(screen.getByText(/Isi Rp 1 sampai Rp 55.000/)).toBeInTheDocument();
    expect(document.getElementById('btn_bayar_simpan')).toBeDisabled();
    expect(onBayar).not.toHaveBeenCalled();
  });

  it('label Metode dan Posisi Kas ada', () => {
    renderPopover(tagihan());
    expect(screen.getByText('Metode')).toBeInTheDocument();
    expect(screen.getByText('Posisi Kas')).toBeInTheDocument();
    expect(screen.getByLabelText('Metode pembayaran')).toBeInTheDocument();
    expect(screen.getByLabelText('Kas tujuan')).toBeInTheDocument();
  });

  it('pilihan kas ikut metode: tunai hanya Kas TU', async () => {
    renderPopover(tagihan());
    await klikSelect(screen.getByLabelText('Kas tujuan'));
    const opsi = screen.getAllByRole('option').map((o) => o.textContent);
    expect(opsi).toEqual(['Kas TU']);
  });

  it('ganti ke transfer → pilihan kas jadi bank, dan kas terpilih ikut berubah', async () => {
    const { onBayar } = renderPopover(tagihan());
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
    await klikSelect(screen.getByLabelText('Metode pembayaran'));
    await klikSelect(screen.getByRole('option', { name: 'Transfer' }));
    expect(screen.getByLabelText('Kas tujuan')).toHaveTextContent('Bank Pesantren');

    await klikSelect(screen.getByLabelText('Metode pembayaran'));
    await klikSelect(screen.getByRole('option', { name: 'Tunai' }));
    expect(screen.getByLabelText('Kas tujuan')).toHaveTextContent('Kas TU');
  });

  it('tagihan lunas menyembunyikan form bayar', () => {
    renderPopover(tagihan({ status: 'lunas', sisa: 0, terbayar: 75000 }));
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
    // Bulanan mengabaikan jatuh tempo manual (aturannya tanggal 10).
    expect(onUbah).toHaveBeenCalledWith({ nominal: 80000, tahun_ajaran: '2025/2026', jatuh_tempo: null });
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

  it('jatuh tempo otomatis untuk jenis bulanan', async () => {
    renderPopover(tagihan({ tipe: 'bulanan' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    expect(screen.getByText(/otomatis: tanggal 10 bulan berjalan/)).toBeInTheDocument();
  });

  it('jatuh tempo bisa diisi untuk jenis non-bulanan', async () => {
    const { onUbah } = renderPopover(tagihan({ tipe: 'non_bulanan', jatuhTempo: null }));
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    const tempo = screen.getByLabelText('Jatuh Tempo');
    await userEvent.type(tempo, '2025-09-15');
    await userEvent.click(document.getElementById('btn_ubah_simpan') as HTMLElement);
    await waitFor(() => expect(onUbah).toHaveBeenCalledTimes(1));
    expect(onUbah).toHaveBeenCalledWith({ nominal: 75000, tahun_ajaran: '2025/2026', jatuh_tempo: '2025-09-15' });
  });
});

describe('panel hapus', () => {
  it('menyatakan tindakan tak bisa dibatalkan dan meneruskan saat dikonfirmasi', async () => {
    const { onHapus } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Hapus' }));
    expect(screen.getByText(/tidak bisa dibatalkan/)).toBeInTheDocument();

    await userEvent.click(document.getElementById('btn_hapus_konfirmasi') as HTMLElement);
    await waitFor(() => expect(onHapus).toHaveBeenCalledTimes(1));
  });

  it('Batal mengembalikan ke tab Bayar tanpa menghapus', async () => {
    const { onHapus } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Hapus' }));
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.getByRole('tab', { name: 'Bayar' })).toHaveAttribute('data-state', 'active');
    expect(onHapus).not.toHaveBeenCalled();
  });
});

describe('panel detail pembayaran', () => {
  it('meminta riwayat saat tab dibuka', async () => {
    const { onMuatRiwayat } = renderPopover(tagihan());
    expect(onMuatRiwayat).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(onMuatRiwayat).toHaveBeenCalled();
  });

  it('menampilkan daftar pembayaran', async () => {
    renderPopover(tagihan(), {}, {
      rows: [pembayaran(), pembayaran({ id: 2, jumlah: 35000, metode: 'transfer', kas: 'bank_lembaga', no_kwitansi: null, created_at: '2025-08-05T14:30:00' })],
    });
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
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
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(screen.getByText('Memuat riwayat…')).toBeInTheDocument();
    view.unmount();
  });

  it('menampilkan keadaan kosong', async () => {
    const { view } = renderPopover(tagihan(), {}, { busy: false });
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(screen.getByText(/Belum ada pembayaran/)).toBeInTheDocument();
    view.unmount();
  });

  it('menampilkan pesan galat', async () => {
    renderPopover(tagihan(), {}, { error: 'Gagal memuat riwayat.' });
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(screen.getByText('Gagal memuat riwayat.')).toBeInTheDocument();
  });
});

describe('tanpa tagihan / jangkar', () => {
  it('tidak merender apa pun', () => {
    const { container } = renderDenganTema(
      <PopoverAksiTagihan tagihan={null} tambah={null} anchor={null} daftarTA={DAFTAR_TA}
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
        daftarTA={DAFTAR_TA}
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
    await waitFor(() => expect(daftarDispen).toHaveBeenCalledWith(
      expect.objectContaining({ tahun_ajaran: '2025/2026', jenis_id: 1, is_active: true }),
    ));
    await userEvent.click(screen.getByLabelText('Dispensasi tagihan'));
    expect(screen.getByRole('option', { name: 'Prestasi · 50%' })).toBeInTheDocument();
    const opsi = screen.getByRole('option', { name: /Anak Pegawai.*otomatis terdaftar/ });
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
    expect(screen.getByRole('option', { name: /Anak Pegawai.*otomatis terdaftar/ })).not.toHaveAttribute('aria-disabled', 'true');
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
