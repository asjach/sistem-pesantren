import { fireEvent } from '@testing-library/react';
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
    status: 'akan',
    deskripsi: 'Ekspor rekap per kas.',
    subpoin: [],
    subKode: 'E.3',
    subNama: 'Rekap & Tutup Buku Kas',
    modulKode: 'E',
    modulNama: 'Keuangan',
    statusSub: 'akan',
    ...ubah,
  };
}

/** Aksi tiruan; tiap tes bisa mengambil alih satu bagiannya. */
function aksi(ubah: Partial<AksiButir> = {}): AksiButir {
  return {
    onSimpanTeks: vi.fn(async () => {}),
    onSimpanStatus: vi.fn(async () => {}),
    onNaik: vi.fn(async () => {}),
    onTurun: vi.fn(async () => {}),
    onHapus: vi.fn(async () => {}),
    ...ubah,
  };
}

function pasang(
  daftar: KartuPapan[] = [kartu()],
  { bolehUbah = false, a }: { bolehUbah?: boolean; a?: AksiButir } = {},
) {
  return renderDenganTema(
    <PapanKolom
      kartu={daftar}
      tampilkanModul={false}
      onPindah={vi.fn()}
      bolehUbah={bolehUbah}
      aksiButir={() => a ?? aksi()}
      idAwalan="uji"
    />,
  );
}

/** Buka panel rincian kartu pertama. */
function buka(id = 128) {
  fireEvent.click(document.getElementById(`btn_buka_papan_butir_${id}`)!);
}

describe('PapanKolom - gerbang izin ubah', () => {
  it('tanpa izin ubah, panel rincian tidak punya satu pun kontrol sunting', () => {
    pasang([kartu()], { bolehUbah: false });
    buka();

    // Rincian tetap terbaca penuh - yang hilang hanya kendali mengubahnya.
    const rincian = document.getElementById('rincian_butir_128');
    expect(rincian?.textContent).toContain('Ekspor rekap per kas.');
    expect(document.getElementById('btn_ubah_butir_papan')).toBeNull();
    expect(document.getElementById('btn_hapus_butir_papan')).toBeNull();
    expect(document.getElementById('btn_naik_butir_papan')).toBeNull();
    expect(document.getElementById('btn_status_sudah')).toBeNull();
  });

  it('dengan izin ubah, kontrol sunting muncul', () => {
    pasang([kartu()], { bolehUbah: true });
    buka();

    expect(document.getElementById('btn_ubah_butir_papan')).not.toBeNull();
    // Tombol status menawarkan ketiga kolom LAIN, bukan status yang kini
    // dipegang poin itu - memindah ke kolom yang sama tidak ada artinya.
    expect(document.getElementById('btn_status_sudah')).not.toBeNull();
    expect(document.getElementById('btn_status_sedang')).not.toBeNull();
    expect(document.getElementById('btn_status_ditunda')).not.toBeNull();
    expect(document.getElementById('btn_status_akan')).toBeNull();
  });
});

describe('PapanKolom - menyunting poin', () => {
  it('menyimpan teks baru lewat onSimpanTeks', async () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    buka();

    fireEvent.click(document.getElementById('btn_ubah_butir_papan')!);
    const kotak = document.getElementById('input_ubah_butir') as HTMLTextAreaElement;
    // Draf dimulai dari teks yang ada, bukan kosong.
    expect(kotak.value).toBe('Ekspor rekap per kas.');

    fireEvent.change(kotak, { target: { value: 'Ekspor rekap harian.' } });
    fireEvent.click(document.getElementById('btn_simpan_butir_papan')!);

    expect(onSimpanTeks).toHaveBeenCalledWith('Ekspor rekap harian.', []);
  });

  it('teks kosong tidak disimpan dan kembali ke mode baca', () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    buka();

    fireEvent.click(document.getElementById('btn_ubah_butir_papan')!);
    const kotak = document.getElementById('input_ubah_butir') as HTMLTextAreaElement;
    fireEvent.change(kotak, { target: { value: '   ' } });

    // Tombol simpan mati saat draf kosong, jadi tidak ada yang terkirim.
    expect((document.getElementById('btn_simpan_butir_papan') as HTMLButtonElement).disabled).toBe(true);
    expect(onSimpanTeks).not.toHaveBeenCalled();
  });

  it('tombol batal menutup mode ubah tanpa mengirim apa pun', () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    buka();

    fireEvent.click(document.getElementById('btn_ubah_butir_papan')!);
    fireEvent.click(document.getElementById('btn_batal_ubah_butir')!);

    expect(document.getElementById('input_ubah_butir')).toBeNull();
    expect(onSimpanTeks).not.toHaveBeenCalled();
  });

  it('hapus perlu konfirmasi dulu', () => {
    const onHapus = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onHapus }) });
    buka();

    fireEvent.click(document.getElementById('btn_hapus_butir_papan')!);
    // Belum terhapus: masih menunggu penegasan.
    expect(onHapus).not.toHaveBeenCalled();

    fireEvent.click(document.getElementById('btn_yakin_hapus_butir')!);
    expect(onHapus).toHaveBeenCalled();
  });

  it('batal di konfirmasi hapus tidak menghapus apa pun', () => {
    const onHapus = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onHapus }) });
    buka();

    fireEvent.click(document.getElementById('btn_hapus_butir_papan')!);
    fireEvent.click(document.getElementById('btn_batal_hapus_butir')!);

    expect(onHapus).not.toHaveBeenCalled();
    expect(document.getElementById('btn_hapus_butir_papan')).not.toBeNull();
  });

  it('tombol status mengirim status yang dipilih', () => {
    const onSimpanStatus = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanStatus }) });
    buka();

    fireEvent.click(document.getElementById('btn_status_sudah')!);

    expect(onSimpanStatus).toHaveBeenCalledWith('sudah');
  });

  it('tombol naik dan turun meneruskan aksinya', () => {
    const onNaik = vi.fn(async () => {});
    const onTurun = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onNaik, onTurun }) });
    buka();

    fireEvent.click(document.getElementById('btn_naik_butir_papan')!);
    fireEvent.click(document.getElementById('btn_turun_butir_papan')!);

    expect(onNaik).toHaveBeenCalled();
    expect(onTurun).toHaveBeenCalled();
  });

  it('galat dari server ditampilkan di panel, bukan ditelan', async () => {
    const onSimpanTeks = vi.fn(async () => {
      throw new Error('Gagal menyimpan ke server.');
    });
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    buka();

    fireEvent.click(document.getElementById('btn_ubah_butir_papan')!);
    fireEvent.change(document.getElementById('input_ubah_butir')!, {
      target: { value: 'Teks baru.' },
    });
    fireEvent.click(document.getElementById('btn_simpan_butir_papan')!);

    // Pesannya harus terlihat pengguna - kegagalan simpan yang senyap
    // membuat orang mengira perubahannya tersimpan.
    await vi.waitFor(() => {
      expect(document.getElementById('rincian_butir_128')?.textContent).toContain(
        'Gagal menyimpan ke server.',
      );
    });
  });

  it('menambah subpoin dan menyimpannya bersama isi poin', async () => {
    const onSimpanTeks = vi.fn(async () => {});
    pasang([kartu()], { bolehUbah: true, a: aksi({ onSimpanTeks }) });
    buka();
    fireEvent.click(document.getElementById('btn_ubah_butir_papan')!);
    fireEvent.click(document.getElementById('btn_tambah_subpoin')!);
    fireEvent.change(document.getElementById('input_subpoin_0')!, {
      target: { value: 'Periksa saldo tiap kas.' },
    });
    fireEvent.click(document.getElementById('btn_simpan_butir_papan')!);

    await vi.waitFor(() => {
      expect(onSimpanTeks).toHaveBeenCalledWith('Ekspor rekap per kas.', ['Periksa saldo tiap kas.']);
    });
  });
});
