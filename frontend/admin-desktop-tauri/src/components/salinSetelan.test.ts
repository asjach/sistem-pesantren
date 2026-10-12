import { beforeEach, describe, expect, it } from 'vitest';

import { isiSalinan, kosongkanSalinan, setelanUntukTujuan, simpanSalinan } from './salinSetelan';
import {
  LEBAR_KOMBO_MIN,
  LEBAR_KONTROL_MIN,
  LEBAR_LABEL_MAKS,
  TINGGI_KOMBO_MAKS,
} from '@/components/ukuranKombo';

describe('setelanUntukTujuan', () => {
  it('menyalin ukuran & gaya label apa adanya', () => {
    const { setelan, dilewati } = setelanUntukTujuan(
      { tinggi: 40, lebar: 300, lebarLabel: 60, lebarKontrol: 150, expandLabel: true, labelTransparan: false },
      {},
    );

    expect(setelan).toEqual({
      tinggi: 40, lebar: 300, lebarLabel: 60, lebarKontrol: 150, expandLabel: true, labelTransparan: false,
    });
    expect(dilewati).toEqual([]);
  });

  it('menjepit angka ke rentang sah (data lama / kotak lain yang jomplang)', () => {
    const { setelan } = setelanUntukTujuan(
      { tinggi: 999, lebar: 5, lebarLabel: 9999, lebarKontrol: 1 },
      {},
    );

    expect(setelan).toEqual({
      tinggi: TINGGI_KOMBO_MAKS, lebar: LEBAR_KOMBO_MIN, lebarLabel: LEBAR_LABEL_MAKS, lebarKontrol: LEBAR_KONTROL_MIN,
    });
  });

  it('kunci yang tak ada di sumber ikut hilang: tujuan dibuat sama dengan sumber', () => {
    const { setelan } = setelanUntukTujuan(
      { lebar: 200 },
      { setelanSekarang: { lebar: 400, labelTransparan: true, expandLabel: true } },
    );

    expect(setelan).toEqual({ lebar: 200 });
  });

  it('tipe input hanya ikut bila kotak tujuan boleh memilihnya', () => {
    const boleh = setelanUntukTujuan(
      { tipeKontrol: 'nominal' },
      { tipeDiizinkan: ['teks', 'nominal', 'tanggal'], tipeSekarang: 'teks' },
    );
    expect(boleh.setelan.tipeKontrol).toBe('nominal');
    expect(boleh.dilewati).toEqual([]);

    const takBoleh = setelanUntukTujuan(
      { tipeKontrol: 'nominal' },
      { tipeDiizinkan: ['teks'], tipeSekarang: 'teks' },
    );
    // Tipe lama kotak tujuan dipertahankan (bukan dihapus), dan dicatat dilewati.
    expect(takBoleh.setelan.tipeKontrol).toBeUndefined();
    expect(takBoleh.dilewati).toContain('tipeKontrol');
  });

  it('tipe TERSIMPAN kotak tujuan dipertahankan bila tipenya tak ikut disalin', () => {
    const { setelan } = setelanUntukTujuan(
      { tinggi: 30 },
      { setelanSekarang: { tipeKontrol: 'tanggal', tinggi: 40 }, tipeSekarang: 'tanggal' },
    );

    expect(setelan).toEqual({ tinggi: 30, tipeKontrol: 'tanggal' });
  });

  it('pengaturan tipe ikut hanya bila tipe akhirnya sama dengan tipe sumber', () => {
    // Tipe disalin (kotak tujuan boleh memilihnya) → pengaturan tipe ikut.
    const disalin = setelanUntukTujuan(
      { tipeKontrol: 'tanggal', tipe: { format: 'dd-mm-yyyy' } },
      { tipeDiizinkan: ['tanggal'], tipeSekarang: 'teks' },
    );
    expect(disalin.setelan.tipe).toEqual({ format: 'dd-mm-yyyy' });

    // Tipe tak boleh dipilih, TAPI kotak tujuan memang sudah bertipe sama
    // (mis. tipenya dipatok kode) → pengaturan tipe tetap sah.
    const terkunci = setelanUntukTujuan(
      { tipeKontrol: 'tanggal', tipe: { format: 'dd-mm-yyyy' } },
      { tipeDiizinkan: [], tipeSekarang: 'tanggal' },
    );
    expect(terkunci.setelan.tipe).toEqual({ format: 'dd-mm-yyyy' });
    expect(terkunci.dilewati).toContain('tipeKontrol');
    expect(terkunci.dilewati).not.toContain('tipe');
  });

  it('tipe berbeda → setelan tipe sumber dilewati', () => {
    const { setelan, dilewati } = setelanUntukTujuan(
      { tipeKontrol: 'nominal', tipe: { preset: '1500' } },
      { tipeDiizinkan: [], tipeSekarang: 'tanggal' },
    );

    expect(setelan.tipe).toBeUndefined();
    expect(dilewati).toContain('tipe');
  });

  it('tipe berganti tapi sumber tak punya setelan tipe → setelan tipe LAMA dibuang', () => {
    const { setelan } = setelanUntukTujuan(
      { tipeKontrol: 'tanggal' },
      {
        tipeDiizinkan: ['tanggal', 'nominal'],
        tipeSekarang: 'nominal',
        setelanSekarang: { tipeKontrol: 'nominal', tipe: { preset: '1500' } },
      },
    );

    // Preset rupiah milik tipe nominal: tak boleh tertinggal di kotak tanggal.
    expect(setelan).toEqual({ tipeKontrol: 'tanggal' });
  });

  it('nilai awal ikut hanya bila ada di opsi kotak tujuan', () => {
    const ada = setelanUntukTujuan({ nilaiDefault: 'Opsi A' }, { opsi: ['Opsi A', 'Opsi B'] });
    expect(ada.setelan.nilaiDefault).toBe('Opsi A');
    expect(ada.dilewati).toEqual([]);

    const takAda = setelanUntukTujuan(
      { nilaiDefault: 'Opsi Z' },
      { opsi: ['Opsi A'], setelanSekarang: { nilaiDefault: 'Opsi A' } },
    );
    // Nilai awal kotak tujuan sendiri dipertahankan, sumbernya cuma dicatat lewat.
    expect(takAda.setelan.nilaiDefault).toBe('Opsi A');
    expect(takAda.dilewati).toContain('nilaiDefault');
  });
});

describe('papan salin setelan', () => {
  beforeEach(() => {
    kosongkanSalinan();
  });

  it('menyimpan lalu mengosongkan isinya', () => {
    expect(isiSalinan()).toBeNull();

    simpanSalinan({ setelan: { tinggi: 30 }, label: 'Kelompok', nama: 'combobox' });
    expect(isiSalinan()).toEqual({ setelan: { tinggi: 30 }, label: 'Kelompok', nama: 'combobox' });

    // Salinan berikutnya menimpa yang lama, bukan menumpuk.
    simpanSalinan({ setelan: { lebar: 200 }, label: 'Urutkan', nama: 'combobox' });
    expect(isiSalinan()).toEqual({ setelan: { lebar: 200 }, label: 'Urutkan', nama: 'combobox' });

    kosongkanSalinan();
    expect(isiSalinan()).toBeNull();
  });
});
