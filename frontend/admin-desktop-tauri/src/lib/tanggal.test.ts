import { describe, expect, it } from 'vitest';
import {
  geserBulan,
  hariIniIso,
  hariPertamaBulan,
  jumlahHari,
  maskTanggal,
  pecahIso,
  rakitIso,
  tanggalDariTampilan,
  tanggalKeTampilan,
  tanggalLengkap,
} from './tanggal';

describe('hariIniIso', () => {
  it('memakai tanggal LOKAL dalam bentuk ISO', () => {
    const d = new Date();
    const lokal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(hariIniIso()).toBe(lokal);
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
    expect(rakitIso(2026, 2, 29)).toBeNull(); // 2026 bukan kabisat
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
    // 12 Oktober 2026 = Senin → tanggal 1 = Kamis (4).
    expect(hariPertamaBulan(2026, 10)).toBe(4);
    // 1 Maret 2026 = Minggu.
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
