import { describe, expect, it, vi } from 'vitest';
import {
  bulanDariTampilan,
  bulanIni,
  bulanKeTampilan,
  bulanLengkap,
  FORMAT_TANGGAL_BAWAAN,
  maskBulan,
  pecahBulan,
  rakitBulan,
  formatTanggalPola,
  geserBulan,
  hariIniIso,
  hariPertamaBulan,
  jumlahHari,
  maskTanggal,
  pecahIso,
  polaTanggal,
  POLA_FORMAT_TANGGAL,
  rakitIso,
  tanggalDariTampilan,
  tanggalKeTampilan,
  tanggalLengkap,
} from './tanggal';

describe('hariIniIso', () => {
  it('memakai hari Jakarta meskipun tanggal UTC masih sehari sebelumnya', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-18T18:30:00Z'));
      expect(hariIniIso()).toBe('2026-10-19');
    } finally { vi.useRealTimers(); }
  });
});

describe('pecahIso', () => {
  it('memecah ISO tanggal & datetime', () => {
    expect(pecahIso('2026-10-12')).toEqual({ tahun: 2026, bulan: 10, hari: 12 });
    expect(pecahIso('2026-10-12T08:30:00Z')).toEqual({ tahun: 2026, bulan: 10, hari: 12 });
  });

  it('menolak yang tak lengkap, di luar rentang, atau tak ada di kalender', () => {
    expect(pecahIso('')).toBeNull();
    expect(pecahIso(null)).toBeNull();
    expect(pecahIso(undefined)).toBeNull();
    expect(pecahIso('12/10/2026')).toBeNull();
    expect(pecahIso('1899-12-31')).toBeNull();
    expect(pecahIso('2026-13-01')).toBeNull();
    expect(pecahIso('2026-02-31')).toBeNull();
  });
});

describe('rakitIso', () => {
  it('merakit ISO dengan nol di depan', () => {
    expect(rakitIso(2026, 1, 5)).toBe('2026-01-05');
  });

  it('menolak tanggal yang tak ada di kalender', () => {
    expect(rakitIso(2026, 2, 29)).toBeNull();
    expect(rakitIso(2024, 2, 29)).toBe('2024-02-29');
    expect(rakitIso(2026, 4, 31)).toBeNull();
    expect(rakitIso(2026, 0, 1)).toBeNull();
  });
});

describe('jumlahHari', () => {
  it('menghitung panjang bulan, termasuk Februari kabisat', () => {
    expect(jumlahHari(2026, 2)).toBe(28);
    expect(jumlahHari(2024, 2)).toBe(29);
    expect(jumlahHari(2026, 4)).toBe(30);
    expect(jumlahHari(2026, 12)).toBe(31);
    expect(jumlahHari(2026, 13)).toBe(0);
  });
});

describe('hariPertamaBulan', () => {
  it('memberi indeks hari minggu (0 = Minggu) tanggal 1', () => {

    expect(hariPertamaBulan(2026, 10)).toBe(4);

    expect(hariPertamaBulan(2026, 3)).toBe(0);
  });
});

describe('geserBulan', () => {
  it('melewati batas tahun', () => {
    expect(geserBulan(2026, 1, -1)).toEqual({ tahun: 2025, bulan: 12 });
    expect(geserBulan(2026, 12, 1)).toEqual({ tahun: 2027, bulan: 1 });
    expect(geserBulan(2026, 10, 3)).toEqual({ tahun: 2027, bulan: 1 });
    expect(geserBulan(2026, 10, -3)).toEqual({ tahun: 2026, bulan: 7 });
  });
});

describe('tanggalKeTampilan', () => {
  it('ISO → dd/mm/yyyy', () => {
    expect(tanggalKeTampilan('2026-07-14')).toBe('14/07/2026');
    expect(tanggalKeTampilan('2026-10-12T08:30')).toBe('12/10/2026');
  });

  it('nilai kosong/bukan ISO dibiarkan apa adanya', () => {
    expect(tanggalKeTampilan('')).toBe('');
    expect(tanggalKeTampilan('kapan-kapan')).toBe('kapan-kapan');
  });
});

describe('tanggalDariTampilan', () => {
  it('dd/mm/yyyy → ISO', () => {
    expect(tanggalDariTampilan('12/10/2026')).toBe('2026-10-12');
    expect(tanggalDariTampilan('1/2/2026')).toBe('2026-02-01');
  });

  it('kosong selama belum lengkap atau tanggalnya tak ada', () => {
    expect(tanggalDariTampilan('')).toBe('');
    expect(tanggalDariTampilan('12/1')).toBe('');
    expect(tanggalDariTampilan('31/02/2026')).toBe('');
    expect(tanggalDariTampilan('12/10/26')).toBe('');
  });
});

describe('maskTanggal', () => {
  it('menyisipkan "/" sendiri sambil diketik', () => {
    expect(maskTanggal('1')).toBe('1');
    expect(maskTanggal('12')).toBe('12');
    expect(maskTanggal('121')).toBe('12/1');
    expect(maskTanggal('1210')).toBe('12/10');
    expect(maskTanggal('12102026')).toBe('12/10/2026');
  });

  it('idempoten: teksnya sendiri tidak berubah', () => {
    expect(maskTanggal('12/10/2026')).toBe('12/10/2026');
    expect(maskTanggal('12/1')).toBe('12/1');
  });

  it('menerima tempelan ISO apa adanya (bukan 20/26/1012)', () => {
    expect(maskTanggal('2026-10-12')).toBe('12/10/2026');
    expect(maskTanggal('2026-10-12T08:30')).toBe('12/10/2026');
    expect(maskTanggal('2026/1/5')).toBe('05/01/2026');
  });

  it('membuang karakter lain & memotong di 8 digit', () => {
    expect(maskTanggal('12-10-2026')).toBe('12/10/2026');
    expect(maskTanggal('abc')).toBe('');
    expect(maskTanggal('123456789')).toBe('12/34/5678');
  });
});

describe('tanggalLengkap', () => {
  it('hanya benar saat pola dd/mm/yyyy penuh', () => {
    expect(tanggalLengkap('12/10/2026')).toBe(true);
    expect(tanggalLengkap('12/1')).toBe(false);
    expect(tanggalLengkap('')).toBe(false);
  });
});

describe('formatTanggalPola', () => {
  it('pola bawaan berperilaku sama dengan fungsi dd/mm/yyyy lama', () => {
    const f = formatTanggalPola(FORMAT_TANGGAL_BAWAAN);
    expect(f.tampil('2026-10-12')).toBe('12/10/2026');
    expect(f.nilai('12/10/2026')).toBe('2026-10-12');
    expect(f.ketik('12102026')).toBe('12/10/2026');
    expect(f.ketik('2026-10-12')).toBe('12/10/2026');
    expect(f.lengkap('31/02/2026')).toBe(true);
    expect(f.takSah('31/02/2026')).toBe(true);
    expect(f.takSah('12/10/2026')).toBe(false);
  });

  it('pola yyyy-mm-dd: tampil ISO & hari 1 digit belum jadi nilai', () => {
    const f = formatTanggalPola('yyyy-mm-dd');
    expect(f.tampil('2026-10-12')).toBe('2026-10-12');
    expect(f.nilai('2026-10-12')).toBe('2026-10-12');
    expect(f.ketik('20261012')).toBe('2026-10-12');

    expect(f.ketik('2026101')).toBe('2026-10-1');
    expect(f.nilai('2026-10-1')).toBe('');
    expect(f.nilai(`${f.ketik('2026101')}2`)).toBe('2026-10-12');
  });

  it('tempelan ISO dibaca sebagai ISO di pola apa pun', () => {
    expect(formatTanggalPola('dd-mm-yyyy').ketik('2026-10-12')).toBe('12-10-2026');
    expect(formatTanggalPola('dd.mm.yyyy').ketik('2026-10-12T08:30')).toBe('12.10.2026');
    expect(formatTanggalPola('yyyy-mm-dd').ketik('2026-1-5')).toBe('2026-01-05');
  });

  it('pola ber-nama bulan: dd Mmm yyyy', () => {
    const f = formatTanggalPola('dd Mmm yyyy');
    expect(f.tampil('2026-10-12')).toBe('12 Okt 2026');
    expect(f.nilai('12 Okt 2026')).toBe('2026-10-12');
    expect(f.nilai('12 okt 2026')).toBe('2026-10-12');
    expect(f.ketik('12okt2026')).toBe('12 Okt 2026');

    expect(f.nilai('12 Xyz 2026')).toBe('');
    expect(f.takSah('12 Xyz 2026')).toBe(true);
    expect(f.takSah('12 Okt 2026')).toBe(false);
  });
});

describe('kotak bulan: teks `mm/yyyy` ⇄ nilai `YYYY-MM`', () => {
  it('pecahBulan: membaca YYYY-MM (tanggal penuh dipotong), menolak yang tak sah', () => {
    expect(pecahBulan('2026-10')).toEqual({ tahun: 2026, bulan: 10 });
    expect(pecahBulan('2026-10-12')).toEqual({ tahun: 2026, bulan: 10 });
    expect(pecahBulan('2026-1')).toEqual({ tahun: 2026, bulan: 1 });
    expect(pecahBulan('')).toBeNull();
    expect(pecahBulan(null)).toBeNull();
    expect(pecahBulan(undefined)).toBeNull();
    expect(pecahBulan('10/2026')).toBeNull();
    expect(pecahBulan('2026-13')).toBeNull();
    expect(pecahBulan('2026-00')).toBeNull();
    expect(pecahBulan('1899-10')).toBeNull();
  });

  it('rakitBulan: nilai TANPA bagian hari, di luar rentang ditolak', () => {
    expect(rakitBulan(2026, 1)).toBe('2026-01');
    expect(rakitBulan(2026, 12)).toBe('2026-12');
    expect(rakitBulan(2026, 13)).toBeNull();
    expect(rakitBulan(2026, 0)).toBeNull();
    expect(rakitBulan(1800, 1)).toBeNull();
  });

  it('bulanIni memakai bulan LOKAL berformat YYYY-MM', () => {
    expect(bulanIni()).toBe(hariIniIso().slice(0, 7));
  });

  it('bulanKeTampilan: YYYY-MM → mm/yyyy; nilai yang bukan bulan dibiarkan', () => {
    expect(bulanKeTampilan('2026-10')).toBe('10/2026');
    expect(bulanKeTampilan('')).toBe('');
    expect(bulanKeTampilan('entah')).toBe('entah');
  });

  it('bulanDariTampilan: mm/yyyy → YYYY-MM; kosong selama belum lengkap/tak sah', () => {
    expect(bulanDariTampilan('10/2026')).toBe('2026-10');
    expect(bulanDariTampilan('1/2026')).toBe('2026-01');
    expect(bulanDariTampilan('10/26')).toBe('');
    expect(bulanDariTampilan('')).toBe('');
    expect(bulanDariTampilan('13/2026')).toBe('');
    expect(bulanLengkap('13/2026')).toBe(true);
    expect(bulanLengkap('10/2')).toBe(false);
  });

  it('maskBulan: menyisipkan "/" sendiri & menerima tempelan ISO', () => {
    expect(maskBulan('1')).toBe('1');
    expect(maskBulan('10')).toBe('10');
    expect(maskBulan('102')).toBe('10/2');
    expect(maskBulan('102026')).toBe('10/2026');
    expect(maskBulan('2026-10')).toBe('10/2026');
    expect(maskBulan('2026-10-12')).toBe('10/2026');

    expect(maskBulan('10/2026')).toBe('10/2026');
    expect(maskBulan('1234567')).toBe('12/3456');
  });
});

describe('kotak bulan — ketikan cepat nama bulan', () => {
  it('maskBulan menjaga hurufnya & membesarkan huruf pertama', () => {
    expect(maskBulan('o')).toBe('O');
    expect(maskBulan('okt')).toBe('Okt');
    expect(maskBulan('OKT')).toBe('Okt');
    expect(maskBulan('oktober')).toBe('Oktober');

    expect(maskBulan('okt26')).toBe('Okt 26');
    expect(maskBulan('okt 2026')).toBe('Okt 2026');
    expect(maskBulan('okt202')).toBe('Okt 202');
    expect(maskBulan('okt2026')).toBe('Okt 2026');
    expect(maskBulan('okt20261')).toBe('Okt 2026');

    expect(maskBulan('12 Okt 2026')).toBe('Okt 2026');
    expect(maskBulan('1-sep-2025')).toBe('Sep 2025');
  });

  it('bulanDariTampilan membaca nama bulan (boleh dipotong) + tahun', () => {
    expect(bulanDariTampilan('okt 2026')).toBe('2026-10');
    expect(bulanDariTampilan('okt2026')).toBe('2026-10');
    expect(bulanDariTampilan('Oktober 2026')).toBe('2026-10');
    expect(bulanDariTampilan('sept26')).toBe('2026-09');
    expect(bulanDariTampilan('mei-2025')).toBe('2025-05');
    expect(bulanDariTampilan('jan/2020')).toBe('2020-01');
  });

  it('tahun dua digit: <= 49 dibaca 20yy, sisanya 19yy', () => {
    expect(bulanDariTampilan('okt26')).toBe('2026-10');
    expect(bulanDariTampilan('okt49')).toBe('2049-10');
    expect(bulanDariTampilan('okt50')).toBe('1950-10');
    expect(bulanDariTampilan('okt98')).toBe('1998-10');
  });

  it('nama bulan tak dikenal / belum penuh → kosong, tapi tetap dinilai lengkap', () => {
    expect(bulanDariTampilan('Xyz 2026')).toBe('');

    expect(bulanDariTampilan('ju 2026')).toBe('');

    expect(bulanDariTampilan('okt 2')).toBe('');
    expect(bulanDariTampilan('okt 202')).toBe('');
    expect(bulanLengkap('okt 26')).toBe(true);
    expect(bulanLengkap('Xyz 2026')).toBe(true);
    expect(bulanLengkap('okt 2')).toBe(false);
    expect(bulanLengkap('okt')).toBe(false);
  });
});

describe('polaTanggal', () => {
  it('hanya menerima pola terdaftar; sisanya kembali ke bawaan', () => {
    expect(POLA_FORMAT_TANGGAL[0].kunci).toBe(FORMAT_TANGGAL_BAWAAN);
    expect(polaTanggal('dd.mm.yyyy')).toBe('dd.mm.yyyy');
    expect(polaTanggal('mm-dd-yyyy')).toBe(FORMAT_TANGGAL_BAWAAN);
    expect(polaTanggal(undefined)).toBe(FORMAT_TANGGAL_BAWAAN);
    expect(polaTanggal(7)).toBe(FORMAT_TANGGAL_BAWAAN);
  });
});
