import { useSyncExternalStore } from 'react';

import type { SetelanKomponen } from '@/api/komponenCustom';
import {
  jepitLangkah,
  jepitLebar,
  jepitLebarKontrol,
  jepitLebarLabel,
  jepitTinggi,
} from '@/components/ukuranKombo';
import { definisiTipe, normalkanSetelanTipe } from '@/components/tipeInput';

/** PAPAN SALIN setelan komponen: "Salin setelan" di satu kotak (ikon di kepala
 *  popover pengaturan), lalu "Tempel setelan" di kotak lain — termasuk kotak di
 *  halaman lain, karena isinya hidup di memori aplikasi, bukan di store server.
 *
 *  Kenapa di memori, bukan clipboard OS: menempel dari clipboard OS butuh izin
 *  baca yang bisa ditolak di webview Tauri, dan isinya JSON setelan internal
 *  yang tak ada gunanya di aplikasi lain.
 *
 *  Salinan MENYIMPAN nama kotak asalnya supaya tombol Tempel bisa menyebut
 *  dari mana asalnya. */
export interface SalinanSetelan {
  setelan: SetelanKomponen;
  /** Label kotak sumber (mis. "Jenis Kelamin"); kosong bila tak berlabel. */
  label: string;
  /** Kata ganti jenis kotak sumber (mis. "combobox", "input"). */
  nama: string;
}

let salinan: SalinanSetelan | null = null;
const pendengar = new Set<() => void>();

function beritahu(): void {
  for (const f of pendengar) f();
}

/** Simpan setelan sebuah kotak ke papan salin (menimpa salinan sebelumnya). */
export function simpanSalinan(s: SalinanSetelan): void {
  salinan = s;
  beritahu();
}

/** Isi papan salin saat ini (`null` = belum ada yang disalin). */
export function isiSalinan(): SalinanSetelan | null {
  return salinan;
}

/** Kosongkan papan salin (dipakai tes; juga saat pengguna membatalkan). */
export function kosongkanSalinan(): void {
  salinan = null;
  beritahu();
}

/** Papan salin reaktif: ikon "Tempel setelan" muncul begitu ada isinya. */
export function useSalinan(): SalinanSetelan | null {
  return useSyncExternalStore(
    (f) => {
      pendengar.add(f);
      return () => {
        pendengar.delete(f);
      };
    },
    isiSalinan,
    () => null,
  );
}

/** Kemampuan kotak TUJUAN — menentukan kunci mana yang boleh ikut tersalin. */
export interface KemampuanTujuan {
  /** Label opsi combobox tujuan (kosong = tanpa opsi, mis. input/stepper). */
  opsi?: string[];
  /** Tipe yang bisa dipilih kotak tujuan (whitelist baris "Tipe"); kosong =
   *  kotak tujuan tak punya baris Tipe atau tipenya dipatok kode. */
  tipeDiizinkan?: readonly string[];
  /** Tipe kontrol efektif kotak tujuan SEKARANG (sebelum ditempeli). */
  tipeSekarang?: string;
  /** True = kotak tujuan punya baris "Langkah" (stepper angka) — langkah
   *  sumber boleh ikut disalin; kotak lain tak punya tombol ± yang
   *  intervalnya bisa diatur. */
  aturLangkah?: boolean;
  /** Setelan kotak tujuan saat ini; jadi titik awal kunci yang "salin hanya
   *  bila sah" (`tipeKontrol`, `tipe`, `nilaiDefault`) supaya tak terhapus. */
  setelanSekarang?: SetelanKomponen;
}

export interface HasilTempel {
  /** Setelan yang akan DITULIS ke kotak tujuan (pengganti penuh). */
  setelan: SetelanKomponen;
  /** Kunci yang sengaja tak ikut karena kotak tujuan tak mendukungnya. */
  dilewati: string[];
}

/**
 * Setelan yang berlaku bila salinan ditempel ke kotak BERKEMAMPUAN tertentu.
 *
 *  Dua perlakuan, sengaja dibedakan:
 *
 *  1. UKURAN & gaya label (`tinggi`, `lebar`, `lebarLabel`, `lebarKontrol`,
 *     `expandLabel`, `labelTransparan`) — MIRROR: hasil akhir kotak tujuan
 *     dibuat sama dengan sumber, termasuk kunci yang TIDAK dimiliki sumber
 *     (artinya kembali ke bawaan pemanggil). Menyalin kotak yang tampil dengan
 *     ukuran bawaan ke kotak yang besar memang seharusnya mengecilkannya.
 *     Nilai angka dijepit ke rentang yang sah.
 *
 *  2. Pengaturan yang bergantung ISI kotak itu sendiri (`tipeKontrol`, `tipe`
 *     seperti format/preset, dan `nilaiDefault`) — SALIN HANYA BILA SAH, dan
 *     nilai LAMA kotak tujuan dipertahankan bila sumbernya tak sah:
 *     - tipe hanya bila kotak tujuan memang boleh memilih tipe itu;
 *     - pengaturan tipe hanya bila tipe kotak tujuan (setelah tempel) SAMA
 *       dengan tipe sumber — preset rupiah tak berarti di kotak tanggal. Bila
 *       tipenya BERGANTI tapi sumber tak punya setelan tipe, setelan tipe lama
 *       ikut dibuang: preset/format lama milik tipe yang sudah tak dipakai;
 *     - nilai awal hanya bila opsi kotak tujuan memuat label itu.
 *     Kunci yang tak sah DIBIARKAN apa adanya (tak dihapus): membuang tipe atau
 *     nilai awal kotak tujuan diam-diam akan mengubah perilakunya, padahal
 *     keduanya bukan sekadar gaya tampilan.
 *
 *  `langkah` (interval tombol −/+ stepper) juga bergantung ISI kotak: hanya
 *  kotak stepper yang punya baris "Langkah" (`aturLangkah`), jadi di kotak lain
 *  kunci itu tak pernah ada untuk disalin.
 */
export function setelanUntukTujuan(
  sumber: SetelanKomponen,
  tujuan: KemampuanTujuan = {},
): HasilTempel {
  const sekarang = tujuan.setelanSekarang ?? {};
  const hasil: SetelanKomponen = {};
  const dilewati: string[] = [];

  /* (1) Ukuran & gaya label — MIRROR: kunci yang tak dipunyai sumber hilang,
     artinya kembali ke bawaan pemanggil. */
  if (typeof sumber.tinggi === 'number') hasil.tinggi = jepitTinggi(sumber.tinggi);
  if (typeof sumber.lebar === 'number') hasil.lebar = jepitLebar(sumber.lebar);
  if (typeof sumber.lebarLabel === 'number') hasil.lebarLabel = jepitLebarLabel(sumber.lebarLabel);
  if (typeof sumber.lebarKontrol === 'number') hasil.lebarKontrol = jepitLebarKontrol(sumber.lebarKontrol);
  if (sumber.expandLabel === true) hasil.expandLabel = true;
  if (typeof sumber.labelTransparan === 'boolean') hasil.labelTransparan = sumber.labelTransparan;

  /* (2) Mulai dari nilai kotak tujuan untuk kunci yang "salin hanya bila sah". */
  if (sekarang.tipeKontrol !== undefined) hasil.tipeKontrol = sekarang.tipeKontrol;
  if (sekarang.nilaiDefault !== undefined) hasil.nilaiDefault = sekarang.nilaiDefault;

  /* Langkah stepper: MIRROR seperti ukuran, tapi hanya bila kotak tujuan
     memang punya baris "Langkah" (stepper) — di combobox/input kunci itu tak
     relevan. Sumber tanpa langkah → langkah tujuan hilang (kembali bawaan). */
  if (typeof sumber.langkah === 'number') {
    if (tujuan.aturLangkah === true) hasil.langkah = jepitLangkah(sumber.langkah);
    else dilewati.push('langkah');
  }

  /* Tipe input: diganti hanya bila kotak tujuan boleh memilihnya. */
  const tipeDiizinkan = tujuan.tipeDiizinkan ?? [];
  if (sumber.tipeKontrol !== undefined) {
    if (tipeDiizinkan.includes(sumber.tipeKontrol) && definisiTipe(sumber.tipeKontrol) !== undefined) {
      hasil.tipeKontrol = sumber.tipeKontrol;
    } else {
      dilewati.push('tipeKontrol');
    }
  }

  /* Tipe yang berlaku SESUDAH tempel: tipe hasil salinan, atau tipe kotak
     tujuan sendiri bila tipenya tak ikut disalin. */
  const tipeBerlaku = hasil.tipeKontrol ?? tujuan.tipeSekarang;
  const tipeSumber = normalkanSetelanTipe(sumber.tipe);
  if (tipeBerlaku !== undefined && tipeBerlaku === sumber.tipeKontrol && Object.keys(tipeSumber).length > 0) {
    hasil.tipe = tipeSumber;
  } else if (tipeBerlaku === tujuan.tipeSekarang && sekarang.tipe !== undefined) {
    hasil.tipe = sekarang.tipe;
    if (Object.keys(tipeSumber).length > 0 && sumber.tipeKontrol !== tipeBerlaku) dilewati.push('tipe');
  } else if (Object.keys(tipeSumber).length > 0) {
    dilewati.push('tipe');
  }

  /* Nilai awal combobox: harus salah satu opsi kotak tujuan. */
  if (sumber.nilaiDefault !== undefined && sumber.nilaiDefault !== '') {
    if ((tujuan.opsi ?? []).includes(sumber.nilaiDefault)) hasil.nilaiDefault = sumber.nilaiDefault;
    else dilewati.push('nilaiDefault');
  }

  return { setelan: hasil, dilewati };
}
