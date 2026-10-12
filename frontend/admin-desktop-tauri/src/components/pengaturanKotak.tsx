import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import PopoverUkuranKombo from '@/components/PopoverUkuranKombo';
import { setelanUntukTujuan, simpanSalinan, useSalinan } from '@/components/salinSetelan';
import { pakaiLebarFilter } from '@/components/excel/lebarFilter';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import {
  definisiTipe,
  KUNCI_TIPE_INPUT,
  nilaiPengaturanTipe,
  normalkanSetelanTipe,
  OPSI_TIPE_INPUT,
  type KunciTipeInput,
} from '@/components/tipeInput';
import {
  gabungSetelanKomponen,
  hapusSetelanKomponen,
  setelanKomponen,
  simpanSetelanKomponen,
  ubahPengaturanTipe,
  useSetelanKomponen,
} from '@/components/komponenCustom';
import {
  LEBAR_KOMBO_BAWAAN,
  LEBAR_KONTROL_BAWAAN,
  LEBAR_LABEL_BAWAAN,
  TINGGI_KOMBO_BAWAAN,
  jepitLangkah,
  jepitLebar,
  jepitLebarKontrol,
  jepitLebarLabel,
  jepitTinggi,
  type UbahUkuranKombo,
} from '@/components/ukuranKombo';

/** Pengaturan ukuran KOTAK (klik-kanan) bersama komponen label+kontrol
 *  (`LabeledCombobox`, `LabeledTextInput`, `LabeledStepper` — semuanya
 *  memakai shell `KotakLabel` sehingga DOM terukurnya sama: anak pertama =
 *  label, anak kedua = zona kontrol).
 *
 *  Popover pengaturan TIDAK punya tombol tutup; KLIK KIRI DI LUAR menutupnya,
 *  sementara Escape sengaja tidak (lihat `PopoverUkuranKombo`).
 *
 *  Ukuran tersimpan (bila ada) menang atas nilai dari pemanggil. Di dalam
 *  toolbar tabel disimpan ke SERVER (global per tabel); di luar itu disimpan
 *  per perangkat. Tanpa `htmlFor`, kotak tak punya identitas → fitur mati
 *  (hanya ukuran dari pemanggil yang dipakai). */
export function usePengaturanKotak({ htmlFor, kelolaLebar = true, label, nama = 'combobox', labelTransparan = true, opsi = [], tipeKontrol, pilihanTipe, tipeTerkunci = false, lebarLabel, lebarKontrol, lebarKotak, tinggi = 26, langkah }: {
  htmlFor?: string;
  kelolaLebar?: boolean;
  label: string;
  /** Kata ganti jenis kotak di judul & aria popover. */
  nama?: string;
  /** Bawaan label transparan; simpanan menang atas prop. */
  labelTransparan?: boolean;
  /** Daftar label opsi combobox — untuk pemilih "nilai awal" di popover.
   *  Kosong = baris itu tidak tampil (mis. input/stepper tanpa opsi). */
  opsi?: string[];
  /** Tipe kontrol bawaan dari pemanggil (registry `tipeInput.tsx`); absen =
   *  `Input` polos / ikut `type` yang diteruskan. */
  tipeKontrol?: KunciTipeInput;
  /** Tipe yang boleh dipilih di popover (baris "Tipe"). Default: semua
   *  tipe bila `tipeKontrol` diberikan, kosong (baris disembunyikan) bila
   *  `tipeKontrol` absen — mis. combobox & stepper tak punya tipe input. */
  pilihanTipe?: KunciTipeInput[];
  /** Kunci tipe dari kode: baris "Tipe" disembunyikan DAN setelan tipe
   *  tersimpan diabaikan. Untuk kotak yang tipenya bagian dari kontrak
   *  (mis. jatuh tempo harus `tanggal`, nominal bayar harus `nominal`). */
  tipeTerkunci?: boolean;
  lebarLabel?: number | string;
  /** Lebar KONTROL terkunci (`lebarKombo`/`lebarInput`/`lebarStepper`). */
  lebarKontrol?: number | string;
  /** Lebar TOTAL kotak. */
  lebarKotak?: number | string;
  tinggi?: number | string;
  /** Langkah tombol −/+ bawaan dari pemanggil (prop `step` `LabeledStepper`).
   * Hanya dikirim kotak stepper: cukup untuk menampilkan baris "Langkah" di
   * popover — kotak lain tak punya tombol ± yang intervalnya bisa diatur. */
  langkah?: number;
}) {
  /** Kunci setelan = id kontrol. Tanpa id, kotak tak punya identitas untuk
   *  menyimpan setelannya → fitur dimatikan. */
  const kunciUkuran = htmlFor ?? '';
  /* Menyetel komponen = MENULIS ke server (`komponen_custom`). Tanpa izin
     tulis, popovernya disembunyikan supaya pengguna tak menabrak 403
     "User does not have the right permissions." — lebih baik fitur tak
     ditawarkan daripada gagal saat dipakai. `user === null` = sesi belum
     termuat (atau tanpa konteks auth, mis. di tes): jangan memblokir. */
  const { user } = useAuth();
  const bolehSetel = user === null
    || bisa(user, 'komponen_custom.tambah')
    || bisa(user, 'komponen_custom.ubah');
  const bolehBukaPengaturan = kunciUkuran !== '' && bolehSetel;
  const konteks = pakaiLebarFilter();
  /* Tabel tempat komponen hidup; komponen di luar tabel memakai string kosong
     supaya tetap punya identitas di server. */
  const tableKey = konteks?.tableKey ?? '';
  /* SETELAN komponen: ukuran (tinggi/lebar/label/kontrol), sisi yang
     mengembang, warna label, nilai awal, dan tipe kontrol — semuanya dari
     server, tabel `komponen_custom` (satu entri per komponen). Tak ada lagi
     percabangan "di dalam toolbar → server, selain itu → perangkat". */
  const ukuran = useSetelanKomponen(tableKey, kunciUkuran);

  const refKotak = useRef<HTMLSpanElement | null>(null);
  const [bukaUkuran, setBukaUkuran] = useState(false);
  /** Ukuran kotak terukur saat popover dibuka: titik awal stepper (prop bisa
   *  berupa string, jadi mengukur DOM lebih andal daripada membaca prop). */
  const [ukuranTerukur, setUkuranTerukur] = useState({ tinggi: 0, lebar: 0, label: 0, kontrol: 0 });
  /** Jangkar BEKU (posisi kotak saat popover dibuka, koordinat viewport). */
  const refJangkar = useRef<HTMLSpanElement | null>(null);
  const [jangkar, setJangkar] = useState({ left: 0, top: 0, width: 0, height: 0 });

  /** Klik-kanan pada kotak: buka popover pengaturan. Penutupanhandled Radix
   *  (klik kiri di luar panel). */
  const bukaPengaturan = useCallback((e: ReactMouseEvent<HTMLSpanElement>) => {
    // Tahan menu konteks bawaan (di dalam input: potong/salin/tempel) supaya
    // popover pengaturan yang muncul, bukan menu peramban.
    e.preventDefault();
    const r = refKotak.current?.getBoundingClientRect();
    /* Anak pertama = label, anak kedua = zona kontrol (lihat `KotakLabel`):
       lebar terukurnya jadi titik awal stepper label & kontrol. */
    const anak = refKotak.current?.children;
    setUkuranTerukur({
      tinggi: Math.round(r?.height ?? 0),
      lebar: Math.round(r?.width ?? 0),
      label: Math.round(anak?.[0]?.getBoundingClientRect().width ?? 0),
      kontrol: Math.round(anak?.[1]?.getBoundingClientRect().width ?? 0),
    });
    /* Bekukan posisi: popover ditambatkan ke elemen `position: fixed` pada
       posisi kotak SEKARANG, bukan ke kotaknya langsung. Tanpa ini popover
       ikut bergeser saat mengubah lebar kotak. */
    if (r) {
      setJangkar({
        left: Math.round(r.left),
        top: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
    }
    setBukaUkuran(true);
    /* Buka daftar opsi kontrol yang diklik-kanan, supaya pengguna langsung
       melihat dampak perubahan dari panel pengaturan tanpa klik lagi.
       Yang diklik PANAH pemicu daftar (bukan input): Base UI membuka daftar
       dari sana, sedangkan input tak merespons `click()` sintetis. `click()`
       sintetis juga tak memunculkan `pointerdown`, jadi tak dihitung
       "interaksi di luar" yang menutup panel. */
    const pemicu = refKotak.current?.querySelector('[data-slot="combobox-trigger"]');
    if (pemicu instanceof HTMLElement) pemicu.click();
  }, []);

  /** Simpan sebagian setelan komponen (ukuran, sisi yang mengembang, warna
   *  label, nilai awal, tipe kontrol). `null` untuk sebuah kunci berarti hapus
   *  kunci itu (kembali ke bawaan pemanggil). */
  const ubahUkuran = useCallback((ubah: UbahUkuranKombo) => {
    gabungSetelanKomponen(tableKey, kunciUkuran, ubah);
  }, [tableKey, kunciUkuran]);

  /** Kembalikan ke bawaan: hapus seluruh setelan komponen ini. */
  const resetUkuran = useCallback(() => {
    hapusSetelanKomponen(tableKey, kunciUkuran);
  }, [tableKey, kunciUkuran]);

  /** Kembalikan SATU baris ke bawaan (tinggi/total/label/kontrol/nilai/tipe/
   *  langkah). */
  const resetBaris = useCallback((bidang: 'tinggi' | 'lebar' | 'lebarLabel' | 'lebarKontrol' | 'nilaiDefault' | 'tipeKontrol' | 'langkah') => {
    gabungSetelanKomponen(tableKey, kunciUkuran, { [bidang]: null });
  }, [tableKey, kunciUkuran]);

  /** Papan salin setelan (isi tombol "Salin setelan" kotak lain). */
  const salinan = useSalinan();
  /** Ada setelan tersimpan apa pun? → tombol "Salin setelan" hidup. */
  const bisaSalin = bolehBukaPengaturan && Object.keys(ukuran).length > 0;
  /** Sebutan kotak di pesan toast: labelnya bila ada, kalau tidak jenisnya. */
  const sebutan = label === '' ? nama : label;
  /** Nama kotak sumber di tooltip tombol "Tempel setelan". */
  const asalSalinan = salinan === null ? undefined : (salinan.label === '' ? salinan.nama : salinan.label);

  /* Ukuran tersimpan (bila ada) menang atas nilai dari pemanggil. */
  const tinggiEfektif = ukuran.tinggi ?? tinggi;
  const lebarKotakEfektif = ukuran.lebar ?? lebarKotak;
  const lebarLabelEfektif = ukuran.lebarLabel ?? lebarLabel;
  const lebarKontrolEfektif = ukuran.lebarKontrol ?? lebarKontrol;
  const labelTransparanEfektif = ukuran.labelTransparan ?? labelTransparan;
  /** Nilai awal combobox (label opsi terpilih); absen = ikut nilai pemanggil. */
  const nilaiDefaultEfektif = ukuran.nilaiDefault;
  /** Langkah tombol −/+ stepper: setelan tersimpan menang atas prop pemanggil
   *  (`step`, bawaan 1) dan dijepit ke rentang sah. `undefined` = kotak bukan
   *  stepper → baris "Langkah" di popover disembunyikan. */
  const langkahEfektif = langkah === undefined ? undefined : jepitLangkah(ukuran.langkah ?? langkah);
  const simpanTipeKontrol = useCallback((tipeBaru: string | null) => {
    gabungSetelanKomponen(tableKey, kunciUkuran, {
      tipeKontrol: tipeBaru !== null && definisiTipe(tipeBaru) !== undefined ? tipeBaru : null,
    });
  }, [tableKey, kunciUkuran]);
  /** Baris "Tipe" di popover — hanya untuk kontrol yang memang punya
   *  tipe input (dikirim `LabeledTextInput`). `tipeTerkunci` mematikannya. */
  const barisTipe = tipeTerkunci ? [] : (pilihanTipe ?? (tipeKontrol === undefined ? [] : KUNCI_TIPE_INPUT));
  const opsiTipe = barisTipe.map((n) => OPSI_TIPE_INPUT.find((o) => o.nilai === n)).filter((o) => o !== undefined);
  /** Whitelist berisi SATU tipe = terkunci: pilihan lain memang tak tersedia,
   *  jadi setelan tipe tersimpan tak boleh menang. */
  const tipeDipatok = tipeTerkunci || barisTipe.length === 1;
  const tipeTersimpan = ukuran.tipeKontrol;
  /** Tipe kontrol: setelan tersimpan MANG atas tipe dari pemanggil — kecuali
   *  saat tipe dipatok dari kode; nilai tak dikenal (mis. versi lama registry)
   *  → bawaan pemanggil. */
  const tipeKontrolEfektif = tipeDipatok
    ? (tipeKontrol ?? barisTipe[0])
    : (definisiTipe(tipeTersimpan) !== undefined ? tipeTersimpan as KunciTipeInput : tipeKontrol);

  /** Pengaturan khusus tipe AKTIF (mis. preset nominal cepat pada tipe
   *  `nominal`): baris di popover, nilainya disimpan per kotak. */
  const setelanTipe = normalkanSetelanTipe(ukuran.tipe);
  const defTipeAktif = definisiTipe(tipeKontrolEfektif);
  /** Nilai pengaturan tipe yang berlaku (setelan tersimpan, atau bawaan tipe). */
  const nilaiTipe = nilaiPengaturanTipe(defTipeAktif, setelanTipe);
  /** Definisi tipe aktif SESUDAH pengaturan diterapkan — inilah yang dipakai
   *  kotak (mis. `aksiKanan` ber-preset milik pengguna). */
  const defTipeEfektif = definisiTipe(tipeKontrolEfektif, nilaiTipe);
  const pengaturanAktif = defTipeAktif?.pengaturan;
  const idPengaturan = pengaturanAktif === undefined ? '' : `${kunciUkuran}_tipe_${pengaturanAktif.kunci}`;
  const pengaturanTipe = pengaturanAktif === undefined ? undefined : {
    id: idPengaturan,
    label: pengaturanAktif.label,
    judul: pengaturanAktif.judul,
    isi: pengaturanAktif.render({
      htmlFor: idPengaturan,
      nilai: nilaiTipe,
      setNilai: (v) => ubahPengaturanTipe(tableKey, kunciUkuran, pengaturanAktif.kunci, v),
    }),
  };
  const adaPengaturanTipe = Object.keys(setelanTipe).length > 0;

  /** Salin setelan kotak ini ke papan salin (ikon di kepala popover). Isinya
   *  hidup di memori aplikasi, jadi bisa ditempel ke kotak di halaman lain. */
  const aksiSalin = useCallback(() => {
    if (!bisaSalin) return;
    simpanSalinan({ setelan: { ...ukuran }, label, nama });
    toast.success(`Setelan ${sebutan} disalin. Buka kotak lain, lalu tekan "Tempel setelan".`);
  }, [bisaSalin, ukuran, label, nama, sebutan]);

  /** Terapkan isi papan salin ke kotak ini; kunci yang tak didukung kotak ini
   *  dilewati (lihat `setelanUntukTujuan`) dan disebut di pesan. Server ditulis
   *  lewat store setelan komponen, lengkap dengan tombol "Batalkan". */
  const aksiTempel = useCallback(() => {
    if (salinan === null || !bolehBukaPengaturan) return;
    const sebelumnya = setelanKomponen(tableKey, kunciUkuran);
    const { setelan: baru, dilewati } = setelanUntukTujuan(salinan.setelan, {
      opsi,
      tipeDiizinkan: opsiTipe.map((o) => o.nilai),
      tipeSekarang: tipeKontrolEfektif,
      setelanSekarang: sebelumnya,
      aturLangkah: langkahEfektif !== undefined,
    });
    if (Object.keys(baru).length === 0) hapusSetelanKomponen(tableKey, kunciUkuran);
    else simpanSetelanKomponen(tableKey, kunciUkuran, baru);
    const dari = salinan.label === '' ? salinan.nama : salinan.label;
    toast.success(
      `Setelan dari "${dari}" diterapkan ke ${sebutan}.`
        + (dilewati.length === 0 ? '' : ` Dilewati (tak didukung kotak ini): ${dilewati.join(', ')}.`),
      {
        action: {
          label: 'Batalkan',
          onClick: () => {
            if (Object.keys(sebelumnya).length === 0) hapusSetelanKomponen(tableKey, kunciUkuran);
            else simpanSetelanKomponen(tableKey, kunciUkuran, sebelumnya);
          },
        },
      },
    );
  }, [salinan, bolehBukaPengaturan, opsi, opsiTipe, tipeKontrolEfektif, tableKey, kunciUkuran, sebutan, langkahEfektif]);

  /** Bungkus kotak dalam popover pengaturan (klik-kanan). Tanpa `htmlFor`,
   *  kotak dikembalikan apa adanya. */
  const bungkus = (kotak: ReactNode) => {
    if (!bolehBukaPengaturan) return kotak;
    return (
      <Popover open={bukaUkuran} onOpenChange={setBukaUkuran}>
        {kotak}
        {/* Jangkar BEKU: elemen `position: fixed` (di luar alur, tak terlihat)
            pada posisi kotak saat popover dibuka. `virtualRef` membuat Radix
            memakai elemen ini — bukan kotaknya — sehingga popover DIAM walau
            tata letak bergeser. */}
        <span
          ref={refJangkar}
          aria-hidden
          style={{
            position: 'fixed',
            left: jangkar.left,
            top: jangkar.top,
            width: jangkar.width,
            height: jangkar.height,
            visibility: 'hidden',
            pointerEvents: 'none',
          }}
        />
        <PopoverAnchor virtualRef={refJangkar} />
        <PopoverUkuranKombo
          kunci={kunciUkuran}
          refKotak={refKotak}
          label={label}
          nama={nama}
          /* Titik awal stepper = ukuran tersimpan, atau ukuran kotak yang
             TERUKUR saat popover dibuka (0 = tak terukur, mis. di jsdom),
             atau prop pemanggil, atau bawaan. */
          tinggi={jepitTinggi(ukuran.tinggi ?? (ukuranTerukur.tinggi > 0 ? ukuranTerukur.tinggi : TINGGI_KOMBO_BAWAAN))}
          lebar={jepitLebar(ukuran.lebar ?? (ukuranTerukur.lebar > 0 ? ukuranTerukur.lebar : LEBAR_KOMBO_BAWAAN))}
          lebarLabel={jepitLebarLabel(ukuran.lebarLabel ?? (ukuranTerukur.label > 0 ? ukuranTerukur.label : (typeof lebarLabel === 'number' ? lebarLabel : LEBAR_LABEL_BAWAAN)))}
          lebarKontrol={jepitLebarKontrol(ukuran.lebarKontrol ?? (ukuranTerukur.kontrol > 0 ? ukuranTerukur.kontrol : (typeof lebarKontrol === 'number' ? lebarKontrol : LEBAR_KONTROL_BAWAAN)))}
          adaTinggi={ukuran.tinggi !== undefined}
          adaLebar={ukuran.lebar !== undefined}
          adaLebarLabel={ukuran.lebarLabel !== undefined}
          adaLebarKontrol={ukuran.lebarKontrol !== undefined}
          adaExpand={ukuran.expandLabel === true}
          adaLabelTransparan={ukuran.labelTransparan !== undefined}
          adaNilaiDefault={ukuran.nilaiDefault !== undefined}
          adaTipeKontrol={definisiTipe(tipeTersimpan) !== undefined}
          adaPengaturanTipe={adaPengaturanTipe}
          langkah={langkahEfektif}
          adaLangkah={ukuran.langkah !== undefined}
          tipeKontrol={tipeKontrolEfektif}
          opsiTipe={opsiTipe}
          pengaturanTipe={pengaturanTipe}
          expandLabel={ukuran.expandLabel === true}
          labelTransparan={labelTransparanEfektif}
          opsi={opsi}
          nilaiDefault={nilaiDefaultEfektif}
          onUbah={ubahUkuran}
          onUbahTipeKontrol={simpanTipeKontrol}
          onReset={resetUkuran}
          onResetBaris={resetBaris}
          onSalin={aksiSalin}
          onTempel={aksiTempel}
          bisaSalin={bisaSalin}
          asalSalinan={asalSalinan}
        />
      </Popover>
    );
  };

  return {
    refKotak,
    onContextMenu: bolehBukaPengaturan ? bukaPengaturan : undefined,
    tinggiEfektif,
    lebarKotakEfektif,
    lebarLabelEfektif,
    lebarKontrolEfektif,
    labelTransparanEfektif,
    nilaiDefaultEfektif,
    langkahEfektif,
    tipeKontrolEfektif,
    defTipeEfektif,
    bungkus,
  };
}
