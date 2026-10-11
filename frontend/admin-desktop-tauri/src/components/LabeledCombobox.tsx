import { Children, cloneElement, isValidElement, useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ComboboxContent, ComboboxInput, ComboboxRoot, ComboboxTrigger } from '@/components/ui/combobox';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import PopoverUkuranKombo from '@/components/PopoverUkuranKombo';
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
import { kunciFilterBawaan, pakaiLebarFilter } from '@/components/excel/lebarFilter';
import KotakLabel, { hitungLebarKontrol, keCss } from '@/components/kotakLabel';

/** Rekursif: suntikkan `gaya` (className & properti lain) ke elemen bertipe
 *  `jenis` (ComboboxInput/Trigger/Content). Combobox Root tak me-render DOM
 *  (Fragment), jadi harus menelusuri pohon anak dan menyalin elemen yang cocok. */
function suntikGaya(node: ReactNode, jenis: unknown, kelas: string, gaya?: Record<string, unknown>): ReactNode {
  // Render-prop anak (mis. `ComboboxList` menerima fungsi) tak boleh dilewati:
  // `Children.map` atas fungsi mengembalikan array kosong dan daftar opsi
  // ikut hilang.
  if (typeof node === 'function') return node;
  return Children.map(node, (c) => {
    if (!isValidElement(c)) return c;
    const props = c.props as { children?: ReactNode; className?: string };
    if ((c.type as unknown) === jenis) {
      return cloneElement(c, {
        className: cn(props.className, kelas),
        ...(gaya ?? {}),
      } as { className?: string });
    }
    if (props.children === undefined || typeof props.children === 'function') return c;
    return cloneElement(c, { ...props, children: suntikGaya(props.children, jenis, kelas, gaya) });
  });
}

/** Gabungan label + combobox dalam satu kotak tanpa padding (Base UI Combobox).
 *
 *  - Label segaris (inline) di dalam kotak, dipisah dari zona kontrol lewat
 *    warna latar (tanpa garis pemisah).
 *  - Tanpa ukuran: kotak selebar induk, kontrol mengisi sisa ruang; di dalam
 *    toolbar tabel lebarnya ikut preset toolbar (bawaan LEBAR_BAWAHAN_FILTER).
 *  - `lebarLabel`/`lebarKombo` mengunci lebar; `lebarKombo` menyusut bila
 *    ruang induk tak cukup (dibatasi MIN_LEBAR_KONTROL).
 *  - Tinggi label & kontrol mengikuti tinggi kotak (`tinggi`, bawaan 26px).
 *  - Tombol panah diletakkan menumpuk di kanan zona (absolut) sehingga input
 *    memakai seluruh lebar zona dan popup (yang ditambatkan ke input) otomatis
 *    membentang sampai tepi kanan kotak.
 *  - `bisaCari` mengaktifkan pengetikan untuk mencari; bawaan mati (input
 *    read-only, tanpa caret berkedip).
 *  - KLIK KANAN pada kotak membuka popover pengaturan ukuran KOTAK (tinggi &
 *    lebar). Di dalam toolbar tabel nilainya disimpan ke SERVER (global per
 *    tabel, lihat `useToolbarPreset`); di luar itu disimpan per perangkat
 *    (`ukuranKombo.ts`).
 *  - Anak idealnya satu `ComboboxRoot`; kontrol lain dirender apa adanya. */
export default function LabeledCombobox({ label, htmlFor, lebarLabel, lebarKombo, lebarKotak, tinggi = 26, children, className, kelolaLebar = true, bisaCari = false }: {
  label: string;
  htmlFor?: string;
  lebarLabel?: number | string;
  lebarKombo?: number | string;
  /** Lebar TOTAL kotak (label + combobox); combobox mengisi sisa ruang. */
  lebarKotak?: number | string;
  tinggi?: number | string;
  children: ReactNode;
  className?: string;
  /** Matikan pendaftaran ke Kelola Tabel (kontrol bawaan toolbar). */
  kelolaLebar?: boolean;
  /** Izinkan mengetik untuk mencari di daftar. Bawaan: mati — input hanya
   *  menampilkan nilai terpilih (tanpa caret berkedip), klik/panah tetap
   *  membuka daftar. */
  bisaCari?: boolean;
}) {
  /** Kunci pengaturan ukuran = id kontrol combobox. Tanpa id, kotak tak punya
   *  identitas untuk menyimpan ukurannya → fitur dimatikan. */
  const kunciUkuran = htmlFor ?? '';
  const konteks = pakaiLebarFilter();
  /* Di dalam toolbar tabel (ada konteks preset): ukuran disimpan di SERVER,
     kunci = `htmlFor`. Kontrol bawaan toolbar (Urutkan/Kolom) memakai
     `kelolaLebar={false}` tetapi tetap milik server; kontrol FORM di dalam
     area toolbar (mis. di `addButton`) tidak — itu preferensi perangkat. */
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
       ikut bergeser saat mengubah lebar kotak — di toolbar tabel yang rata
       kanan, melebarkan kotak mendorong kotaknya ke kiri sehingga popover
       mengejarnya. */
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
    if (kunciServer !== '' && konteks?.simpanUkuran) konteks.simpanUkuran(kunciServer, { tinggi: null, lebar: null, lebarLabel: null, lebarKontrol: null });
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
  const lebarKontrolEfektif = ukuran.lebarKontrol ?? lebarKombo;

  const anakTunggal = Children.count(children) === 1 && isValidElement(children)
    ? (children as ReactElement)
    : null;
  if (anakTunggal === null || anakTunggal.type !== ComboboxRoot) {
    // Tanpa akar Combobox: tetap dirender di dalam kotak (tanpa suntikan gaya).
    return (
      <KotakLabel label={label} htmlFor={htmlFor} lebarLabel={lebarLabelEfektif} lebarKontrol={lebarKontrolEfektif} lebarKotak={lebarKotakEfektif} tinggi={tinggiEfektif} className={className} kelolaLebar={kelolaLebar}>
        {() => children}
      </KotakLabel>
    );
  }

  const propsAnak = anakTunggal.props as { children?: ReactNode };
  /* `pr-6`: ruang kanan untuk tombol panah yang menumpuk. `readOnly` (bawaan)
     membuat input hanya menampilkan nilai terpilih — tanpa caret berkedip
     dan tanpa pengetikan, klik/panah tetap membuka daftar. */
  let isi = suntikGaya(
    propsAnak.children,
    ComboboxInput,
    'h-full w-full min-w-0 rounded-none border-0 pr-6 shadow-none focus-visible:ring-0 focus-visible:shadow-none',
    bisaCari ? undefined : { readOnly: true },
  );
  isi = suntikGaya(isi, ComboboxTrigger, 'absolute top-1/2 right-0 -translate-y-1/2');
  // Popup: border sama dengan kotak pembungkus.
  isi = suntikGaya(isi, ComboboxContent, 'border-foreground/30');

  const kotak = (
    <KotakLabel
      ref={refKotak}
      label={label}
      htmlFor={htmlFor}
      lebarLabel={lebarLabelEfektif}
      lebarKontrol={lebarKontrolEfektif}
      lebarKotak={lebarKotakEfektif}
      tinggi={tinggiEfektif}
      className={className}
      kelolaLebar={kelolaLebar}
      onContextMenu={kunciUkuran === '' ? undefined : bukaPengaturan}
    >
      {() => cloneElement(anakTunggal, { ...(anakTunggal.props as object), children: isi })}
    </KotakLabel>
  );

  if (kunciUkuran === '') return kotak;

  return (
    <Popover open={bukaUkuran} onOpenChange={setBukaUkuran}>
      {kotak}
      {/* Jangkar BEKU: elemen `position: fixed` (di luar alur, tak terlihat)
          pada posisi kotak saat popover dibuka. `virtualRef` membuat Radix
          memakai elemen ini — bukan kotaknya — sehingga popover DIAM walau
          tata letak bergeser (mis. kotak dilebarkan). */}
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
        /* Titik awal stepper = ukuran tersimpan, atau ukuran kotak yang
           TERUKUR saat popover dibuka (0 = tak terukur, mis. di jsdom),
           atau prop pemanggil, atau bawaan. */
        tinggi={jepitTinggi(ukuran.tinggi ?? (ukuranTerukur.tinggi > 0 ? ukuranTerukur.tinggi : TINGGI_KOMBO_BAWAAN))}
        lebar={jepitLebar(ukuran.lebar ?? (ukuranTerukur.lebar > 0 ? ukuranTerukur.lebar : LEBAR_KOMBO_BAWAAN))}
        lebarLabel={jepitLebarLabel(ukuran.lebarLabel ?? (ukuranTerukur.label > 0 ? ukuranTerukur.label : (typeof lebarLabel === 'number' ? lebarLabel : LEBAR_LABEL_BAWAAN)))}
        lebarKontrol={jepitLebarKontrol(ukuran.lebarKontrol ?? (ukuranTerukur.kontrol > 0 ? ukuranTerukur.kontrol : (typeof lebarKombo === 'number' ? lebarKombo : LEBAR_KONTROL_BAWAAN)))}
        adaTinggi={ukuran.tinggi !== undefined}
        adaLebar={ukuran.lebar !== undefined}
        adaLebarLabel={ukuran.lebarLabel !== undefined}
        adaLebarKontrol={ukuran.lebarKontrol !== undefined}
        onUbah={ubahUkuran}
        onReset={resetUkuran}
        onResetBaris={resetBaris}
      />
    </Popover>
  );
}

export { hitungLebarKontrol as hitungLebarKombo, keCss };
