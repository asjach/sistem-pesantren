import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import PopoverUkuranKombo from '@/components/PopoverUkuranKombo';
import { pakaiLebarFilter } from '@/components/excel/lebarFilter';
import { definisiTipe, KUNCI_TIPE_INPUT, OPSI_TIPE_INPUT, type KunciTipeInput } from '@/components/tipeInput';
import {
  hapusSetelanKomponen,
  simpanSetelanKomponen,
  useSetelanKomponen,
} from '@/components/komponenCustom';
import {
  LEBAR_KOMBO_BAWAAN,
  LEBAR_KONTROL_BAWAAN,
  LEBAR_LABEL_BAWAAN,
  TINGGI_KOMBO_BAWAAN,
  jepitLebar,
  jepitLebarKontrol,
  jepitLebarLabel,
  jepitTinggi,
  kosongkanUkuranKombo,
  simpanUkuranKombo,
  useUkuranKombo,
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
export function usePengaturanKotak({ htmlFor, kelolaLebar = true, label, nama = 'combobox', labelTransparan = true, opsi = [], tipeKontrol, pilihanTipe, lebarLabel, lebarKontrol, lebarKotak, tinggi = 26 }: {
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
  /** Tipe yang boleh dipilih di popover (baris "Tipe input:"). Default: semua
   *  tipe bila `tipeKontrol` diberikan, kosong (baris disembunyikan) bila
   *  `tipeKontrol` absen — mis. combobox & stepper tak punya tipe input. */
  pilihanTipe?: KunciTipeInput[];
  lebarLabel?: number | string;
  /** Lebar KONTROL terkunci (`lebarKombo`/`lebarInput`/`lebarStepper`). */
  lebarKontrol?: number | string;
  /** Lebar TOTAL kotak. */
  lebarKotak?: number | string;
  tinggi?: number | string;
}) {
  /** Kunci pengaturan ukuran = id kontrol. Tanpa id, kotak tak punya
   *  identitas untuk menyimpan ukurannya → fitur dimatikan. */
  const kunciUkuran = htmlFor ?? '';
  const konteks = pakaiLebarFilter();
  /* Di dalam toolbar tabel (ada konteks preset): ukuran disimpan di SERVER,
     kunci = `htmlFor`. Hanya kontrol FORM di dalam area toolbar yang
     memakainya; kontrol bawaan toolbar (Urutkan/Kolom, `kelolaLebar={false}`)
     TIDAK — setelannya per perangkat. */
  const milikToolbar = kunciUkuran !== '' && kelolaLebar;
  const kunciServer = konteks !== null && milikToolbar ? kunciUkuran : '';
  /** Store perangkat hanya dipakai di luar toolbar (kunci '' = tak berefek). */
  const ukuranLokal = useUkuranKombo(kunciServer === '' ? kunciUkuran : '');
  /* Setelan komponen custom (tipe input) disimpan di SERVER, terpisah dari
     Kelola Tabel: kuncinya `table_key` + `htmlFor`, dan komponen di luar
     tabel memakai `tableKey` kosong. */
  const setelan = useSetelanKomponen(konteks?.tableKey ?? '', kunciUkuran);
  const ukuran = kunciServer === ''
    ? ukuranLokal
    : {
      lebar: konteks?.lebar[kunciServer],
      tinggi: konteks?.tinggi?.[kunciServer],
      lebarLabel: konteks?.lebarLabel?.[kunciServer],
      lebarKontrol: konteks?.lebarKontrol?.[kunciServer],
      expandLabel: konteks?.expandLabel?.[kunciServer],
      labelTransparan: konteks?.labelTransparan?.[kunciServer],
      nilaiDefault: konteks?.nilaiDefault?.[kunciServer],
    };

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

  /** Simpan sebagian ukuran: ke server (toolbar) atau ke store perangkat. */
  const ubahUkuran = useCallback((ubah: UbahUkuranKombo) => {
    if (kunciServer !== '' && konteks?.simpanUkuran) konteks.simpanUkuran(kunciServer, ubah);
    else simpanUkuranKombo(kunciUkuran, ubah);
  }, [kunciServer, konteks, kunciUkuran]);

  /** Kembalikan ke bawaan: hapus kunci di server, atau kosongkan store lokal. */
  const resetUkuran = useCallback(() => {
    if (kunciServer !== '' && konteks?.simpanUkuran) konteks.simpanUkuran(kunciServer, { tinggi: null, lebar: null, lebarLabel: null, lebarKontrol: null, expandLabel: null, labelTransparan: null, nilaiDefault: null });
    else kosongkanUkuranKombo(kunciUkuran);
    /* Setelan komponen custom ikut ke bawaan (terpisah dari ukuran toolbar). */
    hapusSetelanKomponen(konteks?.tableKey ?? '', kunciUkuran);
  }, [kunciServer, konteks, kunciUkuran]);

  /** Kembalikan SATU baris ke bawaan (tinggi/total/label/kontrol/nilai/tipe). */
  const resetBaris = useCallback((bidang: 'tinggi' | 'lebar' | 'lebarLabel' | 'lebarKontrol' | 'nilaiDefault' | 'tipeKontrol') => {
    if (bidang === 'tipeKontrol') {
      hapusSetelanKomponen(konteks?.tableKey ?? '', kunciUkuran);
      return;
    }
    if (kunciServer !== '' && konteks?.simpanUkuran) konteks.simpanUkuran(kunciServer, { [bidang]: null });
    else simpanUkuranKombo(kunciUkuran, { [bidang]: null });
  }, [kunciServer, konteks, kunciUkuran]);

  /* Ukuran tersimpan (bila ada) menang atas nilai dari pemanggil. */
  const tinggiEfektif = ukuran.tinggi ?? tinggi;
  const lebarKotakEfektif = ukuran.lebar ?? lebarKotak;
  const lebarLabelEfektif = ukuran.lebarLabel ?? lebarLabel;
  const lebarKontrolEfektif = ukuran.lebarKontrol ?? lebarKontrol;
  const labelTransparanEfektif = ukuran.labelTransparan ?? labelTransparan;
  /** Nilai awal combobox (label opsi terpilih); absen = ikut nilai pemanggil. */
  const nilaiDefaultEfektif = ukuran.nilaiDefault;
  /** Tipe kontrol: setelan komponen custom (server) MANG atas tipe dari
   *  pemanggil; nilai tak dikenal (mis. versi lama registry) → bawaan. */
  const tipeTersimpan = setelan.tipeKontrol;
  const tipeKontrolEfektif = definisiTipe(tipeTersimpan) !== undefined
    ? tipeTersimpan as KunciTipeInput
    : tipeKontrol;
  /** Simpan tipe kontrol ke server sebagai setelan komponen custom. */
  const simpanTipeKontrol = useCallback((tipeBaru: string | null) => {
    if (tipeBaru === null || definisiTipe(tipeBaru) === undefined) {
      hapusSetelanKomponen(konteks?.tableKey ?? '', kunciUkuran);
      return;
    }
    simpanSetelanKomponen(konteks?.tableKey ?? '', kunciUkuran, { ...setelan, tipeKontrol: tipeBaru });
  }, [konteks, kunciUkuran, setelan]);
  /** Baris "Tipe input:" di popover — hanya untuk kontrol yang memang punya
   *  tipe input (dikirim `LabeledTextInput`). */
  const barisTipe = pilihanTipe ?? (tipeKontrol === undefined ? [] : KUNCI_TIPE_INPUT);
  const opsiTipe = barisTipe.map((n) => OPSI_TIPE_INPUT.find((o) => o.nilai === n)).filter((o) => o !== undefined);

  /** Bungkus kotak dalam popover pengaturan (klik-kanan). Tanpa `htmlFor`,
   *  kotak dikembalikan apa adanya. */
  const bungkus = (kotak: ReactNode) => {
    if (kunciUkuran === '') return kotak;
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
          tipeKontrol={tipeKontrolEfektif}
          opsiTipe={opsiTipe}
          expandLabel={ukuran.expandLabel === true}
          labelTransparan={labelTransparanEfektif}
          opsi={opsi}
          nilaiDefault={nilaiDefaultEfektif}
          onUbah={ubahUkuran}
          onUbahTipeKontrol={simpanTipeKontrol}
          onReset={resetUkuran}
          onResetBaris={resetBaris}
        />
      </Popover>
    );
  };

  return {
    refKotak,
    onContextMenu: kunciUkuran === '' ? undefined : bukaPengaturan,
    tinggiEfektif,
    lebarKotakEfektif,
    lebarLabelEfektif,
    lebarKontrolEfektif,
    labelTransparanEfektif,
    nilaiDefaultEfektif,
    tipeKontrolEfektif,
    bungkus,
  };
}
