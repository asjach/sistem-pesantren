import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import PopoverUkuranKombo from '@/components/PopoverUkuranKombo';
import { kunciFilterBawaan, pakaiLebarFilter } from '@/components/excel/lebarFilter';
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
 *  Ukuran tersimpan (bila ada) menang atas nilai dari pemanggil. Di dalam
 *  toolbar tabel disimpan ke SERVER (global per tabel); di luar itu disimpan
 *  per perangkat. Tanpa `htmlFor`, kotak tak punya identitas → fitur mati
 *  (hanya ukuran dari pemanggil yang dipakai). */
export function usePengaturanKotak({ htmlFor, kelolaLebar = true, label, nama = 'combobox', labelTransparan = true, lebarLabel, lebarKontrol, lebarKotak, tinggi = 26 }: {
  htmlFor?: string;
  kelolaLebar?: boolean;
  label: string;
  /** Kata ganti jenis kotak di judul & aria popover. */
  nama?: string;
  /** Bawaan label transparan; simpanan menang atas prop. */
  labelTransparan?: boolean;
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
     kunci = `htmlFor`. Kontrol bawaan toolbar (Urutkan/Kolom) memakai
     `kelolaLebar={false}` tetapi tetap milik server; kontrol FORM di dalam
     area toolbar tidak — itu preferensi perangkat. */
  const milikToolbar = kunciUkuran !== '' && (kelolaLebar || kunciFilterBawaan(kunciUkuran));
  const kunciServer = konteks !== null && milikToolbar ? kunciUkuran : '';
  /** Store perangkat hanya dipakai di luar toolbar (kunci '' = tak berefek). */
  const ukuranLokal = useUkuranKombo(kunciServer === '' ? kunciUkuran : '');
  const ukuran = kunciServer === ''
    ? ukuranLokal
    : {
      lebar: konteks?.lebar[kunciServer],
      tinggi: konteks?.tinggi?.[kunciServer],
      lebarLabel: konteks?.lebarLabel?.[kunciServer],
      lebarKontrol: konteks?.lebarKontrol?.[kunciServer],
      expandLabel: konteks?.expandLabel?.[kunciServer],
      labelTransparan: konteks?.labelTransparan?.[kunciServer],
    };

  const refKotak = useRef<HTMLSpanElement | null>(null);
  const [bukaUkuran, setBukaUkuran] = useState(false);
  /** Ukuran kotak terukur saat popover dibuka: titik awal stepper (prop bisa
   *  berupa string, jadi mengukur DOM lebih andal daripada membaca prop). */
  const [ukuranTerukur, setUkuranTerukur] = useState({ tinggi: 0, lebar: 0, label: 0, kontrol: 0 });
  /** Jangkar BEKU (posisi kotak saat popover dibuka, koordinat viewport). */
  const refJangkar = useRef<HTMLSpanElement | null>(null);
  const [jangkar, setJangkar] = useState({ left: 0, top: 0, width: 0, height: 0 });

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
  }, []);

  /** Simpan sebagian ukuran: ke server (toolbar) atau ke store perangkat. */
  const ubahUkuran = useCallback((ubah: UbahUkuranKombo) => {
    if (kunciServer !== '' && konteks?.simpanUkuran) konteks.simpanUkuran(kunciServer, ubah);
    else simpanUkuranKombo(kunciUkuran, ubah);
  }, [kunciServer, konteks, kunciUkuran]);

  /** Kembalikan ke bawaan: hapus kunci di server, atau kosongkan store lokal. */
  const resetUkuran = useCallback(() => {
    if (kunciServer !== '' && konteks?.simpanUkuran) konteks.simpanUkuran(kunciServer, { tinggi: null, lebar: null, lebarLabel: null, lebarKontrol: null, expandLabel: null, labelTransparan: null });
    else kosongkanUkuranKombo(kunciUkuran);
  }, [kunciServer, konteks, kunciUkuran]);

  /** Kembalikan SATU baris ke bawaan (lebar label/kontrol/tinggi/total). */
  const resetBaris = useCallback((bidang: 'tinggi' | 'lebar' | 'lebarLabel' | 'lebarKontrol') => {
    if (kunciServer !== '' && konteks?.simpanUkuran) konteks.simpanUkuran(kunciServer, { [bidang]: null });
    else simpanUkuranKombo(kunciUkuran, { [bidang]: null });
  }, [kunciServer, konteks, kunciUkuran]);

  /* Ukuran tersimpan (bila ada) menang atas nilai dari pemanggil. */
  const tinggiEfektif = ukuran.tinggi ?? tinggi;
  const lebarKotakEfektif = ukuran.lebar ?? lebarKotak;
  const lebarLabelEfektif = ukuran.lebarLabel ?? lebarLabel;
  const lebarKontrolEfektif = ukuran.lebarKontrol ?? lebarKontrol;
  const labelTransparanEfektif = ukuran.labelTransparan ?? labelTransparan;

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
          expandLabel={ukuran.expandLabel === true}
          labelTransparan={labelTransparanEfektif}
          onUbah={ubahUkuran}
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
    bungkus,
  };
}
