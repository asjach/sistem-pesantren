/** Format tanggal tampilan: dd-mm-yyyy (menerima ISO date/datetime). */
export function tanggal(v: string | null | undefined): string {
  if (!v) return '-';
  const iso = v.slice(0, 10);
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/* ---------- Kalender: nama bulan & hari ---------- */

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

export const NAMA_BULAN_SINGKAT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
] as const;

/** Nama hari dengan MINGGU di indeks 0 — sejajar `Date#getDay()`. */
export const NAMA_HARI = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
] as const;

/** Header kolom kalender: minggu dulu (urutan hari versi `id-ID`). */
export const NAMA_HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

/** Rentang tahun yang dianggap sah (di luar ini = salah ketik). */
const TAHUN_MIN = 1900;
const TAHUN_MAX = 2200;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/* ---------- Tanggal: ISO ⇄ bagian angka ---------- */

/** ISO hari operasional pesantren (Asia/Jakarta), terlepas dari zona OS. */
export function hariIniIso(): string {
  const bagian = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const nilai = (tipe: Intl.DateTimeFormatPartTypes) => bagian.find((b) => b.type === tipe)?.value ?? '';
  return `${nilai('year')}-${nilai('month')}-${nilai('day')}`;
}

/** Jumlah hari satu bulan (1–12); `bulan` di luar rentang = 0. */
export function jumlahHari(tahun: number, bulan: number): number {
  if (bulan < 1 || bulan > 12) return 0;
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
}

/** Indeks hari minggu tanggal 1 (0 = Minggu) — offset kolom pertama grid. */
export function hariPertamaBulan(tahun: number, bulan: number): number {
  return new Date(Date.UTC(tahun, bulan - 1, 1)).getUTCDay();
}

/** Pecah ISO `YYYY-MM-DD` (datetime dipotong) jadi angkanya; `null` bila tak
 *  sah — termasuk tanggal yang tak ada di kalender (mis. 31 Februari). */
export function pecahIso(iso: string | null | undefined): { tahun: number; bulan: number; hari: number } | null {
  if (iso == null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m === null) return null;
  const tahun = Number(m[1]);
  const bulan = Number(m[2]);
  const hari = Number(m[3]);
  if (tahun < TAHUN_MIN || tahun > TAHUN_MAX) return null;
  if (hari < 1 || hari > jumlahHari(tahun, bulan)) return null;
  return { tahun, bulan, hari };
}

/** Rakit ISO `YYYY-MM-DD` dari angka; `null` bila tanggalnya tak ada. */
export function rakitIso(tahun: number, bulan: number, hari: number): string | null {
  if (tahun < TAHUN_MIN || tahun > TAHUN_MAX) return null;
  if (hari < 1 || hari > jumlahHari(tahun, bulan)) return null;
  return `${String(tahun).padStart(4, '0')}-${pad2(bulan)}-${pad2(hari)}`;
}

/** Geser bulan sejumlah langkah (mis. `-1`) → `{ tahun, bulan }`. */
export function geserBulan(tahun: number, bulan: number, langkah: number): { tahun: number; bulan: number } {
  const total = tahun * 12 + (bulan - 1) + langkah;
  return { tahun: Math.floor(total / 12), bulan: ((total % 12) + 12) % 12 + 1 };
}

/* ---------- Pola format tanggal kotak (dd/mm/yyyy, yyyy-mm-dd, ...) ---------- */

/** Bagian tanggal yang boleh dipakai di sebuah pola. */
type BagianPola = 'hari' | 'bulan' | 'tahun' | 'bulan_nama';

/** Kata kunci pola → bagian tanggal & lebar isinya (jumlah karakter tetap). */
const KATA_POLA: readonly { kata: string; bagian: BagianPola; lebar: number }[] = [
  { kata: 'yyyy', bagian: 'tahun', lebar: 4 },
  { kata: 'Mmm', bagian: 'bulan_nama', lebar: 3 },
  { kata: 'dd', bagian: 'hari', lebar: 2 },
  { kata: 'mm', bagian: 'bulan', lebar: 2 },
];

/** Pola format tanggal yang boleh dipilih pengguna di popover kotak. */
export interface PolaFormatTanggal {
  /** Polanya sendiri (mis. `dd-mm-yyyy`) — inilah nilai yang disimpan. */
  kunci: string;
  /** Teks di combobox popover. */
  label: string;
}

/** Pola bawaan kotak tanggal (sepakat dengan `FORMAT_TANGGAL` lama). */
export const FORMAT_TANGGAL_BAWAAN = 'dd/mm/yyyy';

export const POLA_FORMAT_TANGGAL: readonly PolaFormatTanggal[] = [
  { kunci: 'dd/mm/yyyy', label: 'dd/mm/yyyy' },
  { kunci: 'dd-mm-yyyy', label: 'dd-mm-yyyy' },
  { kunci: 'dd.mm.yyyy', label: 'dd.mm.yyyy' },
  { kunci: 'yyyy-mm-dd', label: 'yyyy-mm-dd' },
  { kunci: 'dd Mmm yyyy', label: 'dd Mmm yyyy' },
];

/** Pola yang berlaku untuk sebuah setelan: harus salah satu daftar di atas;
 *  nilai tak dikenal (setelan sisa versi lama atau dari server) → pola bawaan. */
export function polaTanggal(v: unknown): string {
  return typeof v === 'string' && POLA_FORMAT_TANGGAL.some((p) => p.kunci === v)
    ? v
    : FORMAT_TANGGAL_BAWAAN;
}

/** Format kotak tanggal + kebalikannya, dibangun dari SATU pola.
 *
 *  Kontraknya sama dengan `FormatNilai` di `tipeInput.tsx`: nilai yang dipakai
 *  aplikasi — dan dikirim ke server — selalu ISO `YYYY-MM-DD`, sedangkan
 *  `tampil()` hanya untuk mata pengguna. */
export interface FormatPolaTanggal {
  tampil: (nilai: string) => string;
  nilai: (teks: string) => string;
  ketik: (teks: string) => string;
  /** Teks kotak sudah PENUH menurut pola (mis. `31/02/2026`) — belum tentu sah. */
  lengkap: (teks: string) => boolean;
  /** Penuh tapi tak ada di kalender (mis. 31 Februari) — untuk menandai kotak. */
  takSah: (teks: string) => boolean;
}

/** Regex satu bagian tanggal. Token TERAKHIR memakai lebar tetapnya (mis. `dd`
 *  = 2 digit) supaya nilai baru dianggap sah saat ketikannya memang sudah
 *  penuh. Tanpa itu, pada pola berawalan tahun (`yyyy-mm-dd`) hari satu digit
 *  ("2026-10-1") langsung dikunci jadi nilai 1 sehingga digit berikutnya — yang
 *  mestinya membentuk hari 12 — tak lagi bisa masuk. */
function regexBagian(t: { bagian: BagianPola; lebar: number }, terakhir: boolean): string {
  if (t.bagian === 'bulan_nama') return '[A-Za-z]{3}';
  if (terakhir || t.bagian === 'tahun') return `\\d{${t.lebar}}`;
  return '\\d{1,2}';
}

/** Nama bulan yang DIKETIK → nomor bulan 1–12; `0` bila tak dikenal.
 *
 *  Boleh dipotong & huruf besar-kecil tak peduli, asal minimal TIGA huruf: semua
 *  nama bulan Indonesia sudah berbeda sejak huruf ketiga (Mei/Juni/Juli, dst.),
 *  jadi tiga huruf cukup untuk memastikan satu bulan — dipakai baik oleh pola
 *  `Mmm` ("Okt") maupun ketikan cepat kotak bulan ("sept", "september"). */
function bulanDariNama(teks: string): number {
  const kunci = teks.trim().toLowerCase();
  if (kunci.length < 3) return 0;
  const kandidat = NAMA_BULAN
    .map((nama, i) => ({ nama, nomor: i + 1 }))
    .filter(({ nama }) => nama.toLowerCase().startsWith(kunci));
  return kandidat.length === 1 ? kandidat[0].nomor : 0;
}

const escapeRegex = (teks: string): string => teks.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bangun format kotak tanggal dari sebuah pola (mis. `dd/mm/yyyy`). */
export function formatTanggalPola(pola: string): FormatPolaTanggal {
  /* Uraikan pola jadi token + pemisah ANTAR token: `pemisah[i]` = teks yang
     berdiri tepat sebelum token ke-i (pemisah paling depan — kalau ada —
     dibuang bersama bagian pertama). */
  const token: { bagian: BagianPola; lebar: number }[] = [];
  const pemisah: string[] = [];
  let buf = '';
  for (let i = 0; i < pola.length;) {
    const kata = KATA_POLA.find((k) => pola.startsWith(k.kata, i));
    if (kata === undefined) {
      buf += pola[i];
      i += 1;
      continue;
    }
    pemisah.push(buf);
    buf = '';
    token.push({ bagian: kata.bagian, lebar: kata.lebar });
    i += kata.kata.length;
  }

  /** Regex satu tanggal PENUH menurut pola; tiap bagian jadi grup tangkap. */
  const regex = new RegExp(
    `^\\s*${token.map((t, i) => `${i === 0 ? '' : escapeRegex(pemisah[i])}(${regexBagian(t, i === token.length - 1)})`).join('')}\\s*$`,
    'i',
  );
  const cocok = (teks: string) => regex.exec(teks.trim());

  const tampil = (nilai: string): string => {
    const p = pecahIso(nilai);
    if (p === null) return nilai;
    return token.map((t, i) => {
      const isi = t.bagian === 'hari' ? pad2(p.hari)
        : t.bagian === 'bulan' ? pad2(p.bulan)
          : t.bagian === 'tahun' ? String(p.tahun).padStart(t.lebar, '0')
            : NAMA_BULAN_SINGKAT[p.bulan - 1];
      return `${i === 0 ? '' : pemisah[i]}${isi}`;
    }).join('');
  };

  const nilai = (teks: string): string => {
    const m = cocok(teks);
    if (m === null) return '';
    let hari = 1;
    let bulan = 1;
    let tahun = 1970;
    token.forEach((t, i) => {
      const isi = m[i + 1];
      if (t.bagian === 'hari') hari = Number(isi);
      else if (t.bagian === 'bulan') bulan = Number(isi);
      else if (t.bagian === 'tahun') tahun = Number(isi);
      else bulan = bulanDariNama(isi);
    });
    return rakitIso(tahun, bulan, hari) ?? '';
  };

  /** Ketikan yang sudah penuh menurut polanya (belum tentu tanggal yang ada). */
  const lengkap = (teks: string): boolean => {
    const m = cocok(teks);
    if (m === null) return false;
    return token.every((t, i) => t.bagian === 'bulan_nama' || m[i + 1].length === t.lebar);
  };

  /* Mask "murni": hanya karakter yang sesuai bagiannya (digit, atau huruf untuk
     nama bulan) yang dipertahankan, dipotong selebar polanya, lalu pemisahnya
     disisipkan sendiri. */
  const maskLangsung = (teks: string): string => {
    const isi: string[] = [];
    let pos = 0;
    for (const t of token) {
      let bagian = '';
      while (bagian.length < t.lebar && pos < teks.length) {
        const c = teks[pos];
        pos += 1;
        const sesuai = t.bagian === 'bulan_nama' ? /[A-Za-z]/.test(c) : /\d/.test(c);
        if (!sesuai) continue;
        bagian += t.bagian === 'bulan_nama' && bagian === '' ? c.toUpperCase() : c;
      }
      if (bagian === '') break;
      isi.push(bagian);
    }
    return isi.map((s, i) => (i === 0 ? s : `${pemisah[i]}${s}`)).join('');
  };

  const ketik = (teks: string): string => {
    /* Teks yang SUDAH sesuai pola = ketikan pengguna yang sedang berjalan —
       jangan ditafsirkan apa-apa. Selebihnya mungkin tempelan ISO
       ("2026-10-12", mis. dari Excel atau DB) yang harus dibaca sebagai ISO;
       tanpa ini digitnya akan dimask jadi "20/26/1012". */
    const iso = maskLangsung(teks) === teks
      ? null
      : /^\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(teks);
    if (iso !== null) {
      const sah = rakitIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
      if (sah !== null) return tampil(sah);
    }
    return maskLangsung(teks);
  };

  return { tampil, nilai, ketik, lengkap, takSah: (teks) => lengkap(teks) && nilai(teks) === '' };
}

/** Format kotak tanggal bawaan (`dd/mm/yyyy`) — dipakai `FORMAT_TANGGAL` (tipe
 *  `tanggal`) dan pemakai lain yang butuh tampilan tanggal tetap. */
const FORMAT_DDMMYYYY = formatTanggalPola(FORMAT_TANGGAL_BAWAAN);

/** Nilai ISO → teks kotak `dd/mm/yyyy`. Nilai yang bukan ISO dibiarkan apa
 *  adanya supaya isian lama/aneh tak diam-diam dikosongkan. */
export function tanggalKeTampilan(nilai: string): string {
  return FORMAT_DDMMYYYY.tampil(nilai);
}

/** Teks kotak `dd/mm/yyyy` → ISO; `''` bila belum lengkap atau tanggalnya tak
 *  ada di kalender. Inilah satu-satunya nilai yang dipakai aplikasi. */
export function tanggalDariTampilan(teks: string): string {
  return FORMAT_DDMMYYYY.nilai(teks);
}

/** Teks kotak sudah lengkap `dd/mm/yyyy` (terlepas sah atau tidak)? */
export function tanggalLengkap(teks: string): boolean {
  return FORMAT_DDMMYYYY.lengkap(teks);
}

/** Mask ketikan kotak tanggal: hanya digit, "/" disisipkan setelah dd & mm. */
export function maskTanggal(teks: string): string {
  return FORMAT_DDMMYYYY.ketik(teks);
}

/* ---------- Kotak bulan: teks `mm/yyyy` ⇄ nilai `YYYY-MM` ---------- */

/** Bulan ini menurut zona waktu LOKAL — `YYYY-MM`. */
export function bulanIni(): string {
  return hariIniIso().slice(0, 7);
}

/** Pecah `YYYY-MM` (`YYYY-MM-DD`/datetime dipotong) jadi angkanya; `null` bila
 *  tak sah — termasuk bulan di luar 1–12. */
export function pecahBulan(nilai: string | null | undefined): { tahun: number; bulan: number } | null {
  if (nilai == null) return null;
  const m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?/.exec(nilai.trim());
  if (m === null) return null;
  const tahun = Number(m[1]);
  const bulan = Number(m[2]);
  if (tahun < TAHUN_MIN || tahun > TAHUN_MAX) return null;
  if (bulan < 1 || bulan > 12) return null;
  return { tahun, bulan };
}

/** Rakit nilai bulan `YYYY-MM` dari angkanya; `null` bila di luar rentang.
 *  Sama seperti `input type="month"`: TANPA bagian hari. */
export function rakitBulan(tahun: number, bulan: number): string | null {
  if (tahun < TAHUN_MIN || tahun > TAHUN_MAX) return null;
  if (bulan < 1 || bulan > 12) return null;
  return `${String(tahun).padStart(4, '0')}-${pad2(bulan)}`;
}

/** Nilai `YYYY-MM` → teks kotak `mm/yyyy`. Nilai yang bukan bulan dikenali
 *  dibiarkan apa adanya supaya isian lama/aneh tak diam-diam dikosongkan. */
export function bulanKeTampilan(nilai: string): string {
  const b = pecahBulan(nilai);
  return b === null ? nilai : `${pad2(b.bulan)}/${b.tahun}`;
}

/** Ketikan cepat "nama bulan + tahun" (mis. `okt 2026`, `okt26`, `oktober26`).
 *  Tahunnya 2 digit (lihat `tahunDariSingkatan`) atau 4 digit penuh. */
const POLA_NAMA_BULAN = /^([A-Za-z]{3,9})[\s\-./]*(\d{2}|\d{4})$/;

/** Dua digit tahun: `50` jadi pivotnya — periode sekolah ada di sekitar
 *  sekarang, jadi `26` berarti 2026 dan `98` berarti 1998. */
const PIVOT_TAHUN_SINGKAT = 50;

/** Tahun dari ketikan cepat: 4 digit apa adanya, 2 digit lewat pivot. */
function tahunDariSingkatan(digit: string): number {
  const angka = Number(digit);
  if (digit.length === 4) return angka;
  return angka < PIVOT_TAHUN_SINGKAT ? 2000 + angka : 1900 + angka;
}

/** Rapikan nama bulan yang diketik: huruf pertama besar, sisanya kecil. */
const rapikanNama = (huruf: string): string =>
  huruf === '' ? '' : huruf[0].toUpperCase() + huruf.slice(1).toLowerCase();

/** Teks kotak `mm/yyyy` — atau ketikan cepat nama bulan (`okt 2026`, `okt26`) —
 *  → `YYYY-MM`; `''` bila belum lengkap atau bulannya tak ada (mis. `13/2026`,
 *  `Xyz 2026`, `ju 2026`). Inilah satu-satunya nilai yang dipakai aplikasi. */
export function bulanDariTampilan(teks: string): string {
  const nama = POLA_NAMA_BULAN.exec(teks.trim());
  if (nama !== null) {
    const bulan = bulanDariNama(nama[1]);
    return bulan === 0 ? '' : rakitBulan(tahunDariSingkatan(nama[2]), bulan) ?? '';
  }
  const m = /^(\d{1,2})\/(\d{4})$/.exec(teks.trim());
  if (m === null) return '';
  return rakitBulan(Number(m[2]), Number(m[1])) ?? '';
}

/** Teks kotak sudah lengkap `mm/yyyy` ATAU "nama bulan + tahun" (terlepas sah
 *  atau tidak)? Dipakai menandai salah ketik yang sudah penuh. */
export function bulanLengkap(teks: string): boolean {
  const t = teks.trim();
  return /^\d{2}\/\d{4}$/.test(t) || POLA_NAMA_BULAN.test(t);
}

/** Mask ketikan kotak bulan: `mm/yyyy` (hanya digit, "/" disisipkan setelah
 *  bulan) atau ketikan cepat nama bulan ("okt 2026").
 *
 *  Tempelan ISO ("2026-10", mis. dari Excel atau DB) dibaca sebagai bulan itu —
 *  tanpa ini, digitnya akan dimask jadi "20/2610". Tanggal penuh ("2026-10-12",
 *  atau "12 Okt 2026" dari dokumen) pun terbaca sebagai bulannya saja. */
export function maskBulan(teks: string): string {
  const tanggalNama = /^\s*\d{1,2}[\s\-./]+([A-Za-z]{3,9})[\s\-./]+(\d{4})\s*$/.exec(teks);
  if (tanggalNama !== null) return `${rapikanNama(tanggalNama[1])} ${tanggalNama[2]}`;
  /* Ada HURUF = pengguna mengetik nama bulan; hurufnya dibiarkan (huruf pertama
     dibesarkan) supaya ketikan cepat tetap terlihat, tahunnya menempel di
     belakang. Tahun yang masih ditambah digit demi digit pun tetap utuh —
     beda dengan mask digit yang akan memotong "2026" jadi "20". */
  if (/[A-Za-z]/.test(teks)) {
    const huruf = (teks.match(/[A-Za-z]/g) ?? []).join('').slice(0, 9);
    const angka = (teks.match(/\d/g) ?? []).join('').slice(0, 4);
    const nama = rapikanNama(huruf);
    return angka === '' ? nama : `${nama} ${angka}`;
  }
  const iso = /^\s*(\d{4})[-/.](\d{1,2})/.exec(teks);
  if (iso !== null) return `${pad2(Number(iso[2]))}/${iso[1]}`;
  const digit = teks.replace(/\D/g, '').slice(0, 6);
  if (digit.length <= 2) return digit;
  return `${digit.slice(0, 2)}/${digit.slice(2)}`;
}
