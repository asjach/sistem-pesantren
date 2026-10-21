import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PapanKolom } from './PapanKolom';
import type { AksiButir } from './PapanKolom';
import type { KartuPapan } from '@/lib/papan';
import { renderDenganTema } from '@/test/utils';

/** Kartu contoh: satu poin milik sub-modul E.3. */
function kartu(ubah: Partial<KartuPapan> = {}): KartuPapan {
  return {
    id: 128,
    kode: 'E.3',
    nama: 'Rekap & Tutup Buku Kas',
    status: 'todo',
    deskripsi: 'Ekspor rekap per kas.',
    keterangan: null,
    subpoin: [],
    subKode: 'E.3',
    subNama: 'Rekap & Tutup Buku Kas',
    modulKode: 'E',
    modulNama: 'Keuangan',
    statusSub: 'todo',
    ...ubah,
  };
}

/** Aksi tiruan; tiap tes bisa mengambil alih satu bagiannya. */
function aksi(ubah: Partial<AksiButir> = {}): AksiButir {
  return {
    onSimpanTeks: vi.fn(async () => {}),
    onSimpanSubpoin: vi.fn(async () => {}),
    onHapus: vi.fn(async () => {}),
    ...ubah,
  };
}

function pasang(
  daftar: KartuPapan[] = [kartu()],
  { bolehUbah = false, a }: { bolehUbah?: boolean; a?: AksiButir } = {},
) {
  const hasil = renderDenganTema(
    <PapanKolom
      kartu={daftar}
      tampilkanModul={false}
      onPindah={vi.fn()}
      bolehUbah={bolehUbah}
      aksiButir={() => a ?? aksi()}
      idAwalan="uji"
    />,
  );

  // Baris poin baru dirender setelah kartu sub-modul dibuka.
  document.querySelectorAll<HTMLElement>('[id^="btn_lipat_sub_"]').forEach((tombol) => {
    fireEvent.click(tombol);
  });

  return hasil;
}

/** Masuk mode sunting poin lewat pensil di baris. */
function mulaiUbah(id = 128) {
  fireEvent.click(document.getElementById(`btn_ubah_papan_butir_${id}`)!);
}

describe('BarisPoin - gerbang izin ubah', () => {
  it('tanpa izin ubah tidak ada pensil maupun kontrol sunting', () => {
    pasang([kartu()], { bolehUbah: false });

    expect(document.getElementById('btn_ubah_papan_butir_128')).toBeNull();
    expect(document.getElementById('kartu_papan_butir_128')?.textContent).toContain(
      'Ekspor rekap per kas.',
    );
  });

  it('dengan izin ubah pensil baris muncul', () => {
    pasang([kartu()], { bolehUbah: true });

    expect(document.getElementById('btn_ubah_papan_butir_128')).not.toBeNull();
  });
});

describe('BarisPoin - checklist subpoin', () => {
  it('mencentang subpoin langsung menyimpan', async () => {
    const onSimpanSubpoin = vi.fn(async () => {});
    pasang([kartu({ subpoin: [
      { teks: 'Langkah satu.', selesai: false },
      { teks: 'Langkah dua.', selesai: true },
    ] })], { bolehUbah: true, a: aksi({ onSimpanSubpoin }) });

    fireEvent.click(document.getElementById('cek_subpoin_128_0')!);

    await vi.waitFor(() => {
      expect(onSimpanSubpoin).toHaveBeenCalledWith([
        { teks: 'Langkah satu.', selesai: true },
        { teks: 'Langkah dua.', selesai: true },
      ]);
    });
  });

  it('pilihan Sudah nonaktif selama ada subpoin belum selesai', () => {
    pasang([kartu({ subpoin: [
      { teks: 'Satu.', selesai: true },
      { teks: 'Dua.', selesai: false },
    ] })], { bolehUbah: true });
    mulaiUbah();

    const opsi = document.querySelector('#status_butir_128 option[value="done"]') as HTMLOptionElement;
    expect(opsi.disabled).toBe(true);
  });

  it('pilihan Sudah aktif saat semua subpoin selesai', () => {
    pasang([kartu({ subpoin: [
      { teks: 'Satu.', selesai: true },
      { teks: 'Dua.', selesai: true },
    ] })], { bolehUbah: true });
    mulaiUbah();

    const opsi = document.querySelector('#status_butir_128 option[value="done"]') as HTMLOptionElement;
    expect(opsi.disabled).toBe(false);
  });
});

describe('BarisPoin - menyunting poin di baris', () => {
  it('menyimpan teks baru lewat onSimpanTeks', async () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    mulaiUbah();

    const kotak = document.getElementById('input_ubah_butir_128') as HTMLTextAreaElement;
    // Draf dimulai dari teks yang ada, bukan kosong.
    expect(kotak.value).toBe('Ekspor rekap per kas.');

    fireEvent.change(kotak, { target: { value: 'Ekspor rekap harian.' } });
    fireEvent.click(document.getElementById('btn_simpan_butir_128')!);

    expect(onSimpanTeks).toHaveBeenCalledWith('Ekspor rekap harian.');
  });

  it('menampilkan requirement poin bila terisi', () => {
    pasang([kartu({ keterangan: 'Catatan rinci per kas.' })]);

    const baris = document.getElementById('kartu_papan_butir_128');
    expect(baris?.textContent).toContain('Requirement');
    expect(baris?.textContent).toContain('Catatan rinci per kas.');
  });

  it('menyimpan requirement bersama poin', async () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu({ keterangan: 'Catatan lama.' })], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    mulaiUbah();

    const kotak = document.getElementById('input_keterangan_butir_128') as HTMLTextAreaElement;
    expect(kotak.value).toBe('Catatan lama.');

    fireEvent.change(kotak, { target: { value: 'Catatan baru.' } });
    fireEvent.click(document.getElementById('btn_simpan_butir_128')!);

    await vi.waitFor(() => {
      expect(onSimpanTeks).toHaveBeenCalledWith('Ekspor rekap per kas.', undefined, 'Catatan baru.');
    });
  });

  it('mengosongkan requirement mengirim string kosong', async () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu({ keterangan: 'Catatan lama.' })], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    mulaiUbah();

    fireEvent.change(document.getElementById('input_keterangan_butir_128')!, {
      target: { value: '' },
    });
    fireEvent.click(document.getElementById('btn_simpan_butir_128')!);

    await vi.waitFor(() => {
      expect(onSimpanTeks).toHaveBeenCalledWith('Ekspor rekap per kas.', undefined, '');
    });
  });

  it('tombol simpan mati selama teks belum berubah', () => {
    pasang([kartu()], { bolehUbah: true });
    mulaiUbah();

    expect((document.getElementById('btn_simpan_butir_128') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(document.getElementById('input_ubah_butir_128')!, {
      target: { value: 'Ekspor rekap harian.' },
    });

    expect((document.getElementById('btn_simpan_butir_128') as HTMLButtonElement).disabled).toBe(false);
  });

  it('mengubah status lewat pilihan di editor dan menyimpannya bersama teks', async () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    mulaiUbah();

    const pilih = document.getElementById('status_butir_128') as HTMLSelectElement;
    expect(pilih.value).toBe('todo');

    fireEvent.change(pilih, { target: { value: 'done' } });
    expect((document.getElementById('btn_simpan_butir_128') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(document.getElementById('btn_simpan_butir_128')!);
    await vi.waitFor(() => {
      expect(onSimpanTeks).toHaveBeenCalledWith('Ekspor rekap per kas.', 'done');
    });
  });

  it('teks kosong tidak disimpan dan tombol simpan mati', () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    mulaiUbah();

    fireEvent.change(document.getElementById('input_ubah_butir_128')!, {
      target: { value: '   ' },
    });

    expect((document.getElementById('btn_simpan_butir_128') as HTMLButtonElement).disabled).toBe(true);
    expect(onSimpanTeks).not.toHaveBeenCalled();
  });

  it('tombol batal menutup editor tanpa mengirim apa pun', () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    mulaiUbah();

    fireEvent.click(document.getElementById('btn_batal_butir_128')!);

    expect(document.getElementById('input_ubah_butir_128')).toBeNull();
    expect(onSimpanTeks).not.toHaveBeenCalled();
  });

  it('hapus perlu konfirmasi di popover', async () => {
    const user = userEvent.setup();
    const onHapus = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onHapus }) });
    mulaiUbah();

    await user.click(document.getElementById('btn_hapus_butir_128')!);
    // Belum terhapus: masih menunggu penegasan.
    expect(onHapus).not.toHaveBeenCalled();

    fireEvent.click(document.getElementById('btn_yakin_hapus_butir_128')!);
    await vi.waitFor(() => expect(onHapus).toHaveBeenCalled());
  });

  it('batal di konfirmasi hapus tidak menghapus apa pun', async () => {
    const user = userEvent.setup();
    const onHapus = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onHapus }) });
    mulaiUbah();

    await user.click(document.getElementById('btn_hapus_butir_128')!);
    fireEvent.click(document.getElementById('btn_batal_hapus_butir_128')!);

    expect(onHapus).not.toHaveBeenCalled();
    expect(document.getElementById('btn_hapus_butir_128')).not.toBeNull();
  });

  it('galat dari server ditampilkan di baris, bukan ditelan', async () => {
    const onSimpanTeks = vi.fn(async () => {
      throw new Error('Gagal menyimpan ke server.');
    });
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    mulaiUbah();

    fireEvent.change(document.getElementById('input_ubah_butir_128')!, {
      target: { value: 'Teks baru.' },
    });
    fireEvent.click(document.getElementById('btn_simpan_butir_128')!);

    // Pesannya harus terlihat pengguna - kegagalan simpan yang senyap
    // membuat orang mengira perubahannya tersimpan.
    await vi.waitFor(() => {
      expect(document.getElementById('kartu_papan_butir_128')?.textContent).toContain(
        'Gagal menyimpan ke server.',
      );
    });
  });

  it('menyimpan satu subpoin lewat tombol simpan baris', async () => {
    const onSimpanTeks = vi.fn(async () => {});
    const onSimpanSubpoin = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks, onSimpanSubpoin }) });
    mulaiUbah();

    fireEvent.click(document.getElementById('btn_tambah_subpoin_128')!);
    fireEvent.change(document.getElementById('input_subpoin_128_0')!, {
      target: { value: 'Periksa saldo tiap kas.' },
    });
    fireEvent.click(document.getElementById('btn_simpan_subpoin_128_0')!);

    await vi.waitFor(() => {
      expect(onSimpanSubpoin).toHaveBeenCalledWith([
        { teks: 'Periksa saldo tiap kas.', selesai: false },
      ]);
    });
    expect(onSimpanTeks).not.toHaveBeenCalled();
  });

  it('simpan utama hanya mengirim teks poin, bukan subpoin', async () => {
    const onSimpanTeks = vi.fn(async () => {});
    const onSimpanSubpoin = vi.fn(async () => {});
    pasang([kartu({ subpoin: [{ teks: 'Langkah lama.', selesai: false }] })], {
      bolehUbah: true,
      a: aksi({ onSimpanTeks, onSimpanSubpoin }),
    });
    mulaiUbah();

    fireEvent.change(document.getElementById('input_ubah_butir_128')!, {
      target: { value: 'Teks baru.' },
    });
    fireEvent.change(document.getElementById('input_subpoin_128_0')!, {
      target: { value: 'Draf lain.' },
    });
    fireEvent.click(document.getElementById('btn_simpan_butir_128')!);

    await vi.waitFor(() => expect(onSimpanTeks).toHaveBeenCalledWith('Teks baru.'));
    expect(onSimpanSubpoin).not.toHaveBeenCalled();
  });

  it('menyimpan satu subpoin tidak ikut mengirim draf baris lain', async () => {
    const onSimpanSubpoin = vi.fn(async () => {});
    pasang([kartu({ subpoin: [
      { teks: 'Langkah satu.', selesai: false },
      { teks: 'Langkah dua.', selesai: false },
    ] })], {
      bolehUbah: true,
      a: aksi({ onSimpanSubpoin }),
    });
    mulaiUbah();

    fireEvent.change(document.getElementById('input_subpoin_128_0')!, {
      target: { value: 'Draf satu.' },
    });
    fireEvent.change(document.getElementById('input_subpoin_128_1')!, {
      target: { value: 'Langkah dua baru.' },
    });
    fireEvent.click(document.getElementById('btn_simpan_subpoin_128_1')!);

    await vi.waitFor(() => {
      expect(onSimpanSubpoin).toHaveBeenCalledWith([
        { teks: 'Langkah satu.', selesai: false },
        { teks: 'Langkah dua baru.', selesai: false },
      ]);
    });
  });

  it('menghapus subpoin tersimpan langsung menyimpan daftar baru', async () => {
    const onSimpanSubpoin = vi.fn(async () => {});
    pasang([kartu({ subpoin: [
      { teks: 'Langkah satu.', selesai: false },
      { teks: 'Langkah dua.', selesai: true },
    ] })], {
      bolehUbah: true,
      a: aksi({ onSimpanSubpoin }),
    });
    mulaiUbah();

    fireEvent.click(document.getElementById('btn_hapus_subpoin_128_0')!);

    await vi.waitFor(() => {
      expect(onSimpanSubpoin).toHaveBeenCalledWith([{ teks: 'Langkah dua.', selesai: true }]);
    });
  });
});
