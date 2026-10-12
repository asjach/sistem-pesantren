import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ComboboxContent, ComboboxInput, ComboboxRoot, ComboboxTrigger } from '@/components/ui/combobox';
import { usePengaturanKotak } from '@/components/pengaturanKotak';
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
 *    lebar) + "Nilai awal": opsi yang dipakai sebagai default combobox ini.
 *    Nilai awal menentukan default (diterapkan ke pemanggil sekali), lalu
 *    pengguna tetap bisa mengubahnya. Di dalam toolbar tabel nilainya disimpan
 *    ke SERVER (global per tabel, lihat `useToolbarPreset`); di luar itu
 *    disimpan per perangkat (`ukuranKombo.ts`).
 *  - Anak idealnya satu `ComboboxRoot`; kontrol lain dirender apa adanya. */
export default function LabeledCombobox({ label, htmlFor, labelTransparan = true, lebarLabel, lebarKombo, lebarKotak, tinggi = 26, children, className, kelolaLebar = true, bisaCari = false, tambahan }: {
  label: string;
  htmlFor?: string;
  /** Label transparan (tanpa bg, teks bertitik dua); bisa juga diatur per
   *  komponen dari popover klik-kanan (simpanan menang atas prop). */
  labelTransparan?: boolean;
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
  /** Node tambahan di dalam kotak setelah zona combobox (mis. tombol arah
   *  urut) — diteruskan ke `KotakLabel`. */
  tambahan?: ReactNode;
}) {
  const anakTunggal = Children.count(children) === 1 && isValidElement(children)
    ? (children as ReactElement)
    : null;

  /* Props anak (bila tepat satu `ComboboxRoot`): `items` dipakai popover untuk
     memilih nilai awal; `value`/`onValueChange` untuk menerapkan nilai awal. */
  const propsAnak = (anakTunggal?.type === ComboboxRoot ? anakTunggal.props : {}) as {
    children?: ReactNode;
    items?: unknown;
    itemToStringLabel?: (o: unknown) => string;
    value?: unknown;
    onValueChange?: (v: unknown) => void;
  };
  const items = Array.isArray(propsAnak.items) ? propsAnak.items : [];
  const labelItem = (o: unknown): string => (
    typeof propsAnak.itemToStringLabel === 'function'
      ? propsAnak.itemToStringLabel(o)
      : typeof o === 'string' ? o : String(o)
  );
  const opsi = items.map(labelItem);

  const {
    refKotak, onContextMenu, tinggiEfektif, lebarKotakEfektif,
    lebarLabelEfektif, lebarKontrolEfektif, labelTransparanEfektif,
    nilaiDefaultEfektif, bungkus,
  } = usePengaturanKotak({
    htmlFor, kelolaLebar, label, labelTransparan, opsi,
    lebarLabel, lebarKontrol: lebarKombo, lebarKotak, tinggi,
  });

  /* Nilai AWAL dari popover → jadi nilai yang DITAMPILKAN sampai pengguna
     atau pemanggil mengubahnya (`ikutAwal` mati begitu salah satunya berubah). */
  const itemAwal = nilaiDefaultEfektif === undefined
    ? undefined
    : items.find((o) => labelItem(o) === nilaiDefaultEfektif);
  const nilaiProp = propsAnak.value;
  /* Kunci nilai = LABEL-nya (lewat `itemToStringLabel`/String). Identitas objek
     item sering berganti tiap render (array `items` dibangun ulang pemanggil,
     mis. `opsiItem` di PresetUrut), jadi membandingkan identitas salah menganggap
     nilai pemanggil "berubah" — itu mematikan mode ikut-awal SEBELUM nilai awal
     (yang dimuat async) sempat diterapkan. */
  const kunciProp = nilaiProp === undefined || nilaiProp === null ? '' : labelItem(nilaiProp);
  const kunciMount = useRef(kunciProp);
  const [nilaiLokal, setNilaiLokal] = useState<unknown>(undefined);
  const [ikutAwal, setIkutAwal] = useState(true);
  /** Nilai awal yang SUDAH diterapkan ke pemanggil (`null` = belum).
   *  Di-key ke NILAI-nya, bukan sekali per pemasangan: mengubah nilai awal dari
   *  popover saat halaman sedang terbuka harus LANGSUNG berlaku, bukan menunggu
   *  halaman dimuat ulang. */
  const sudahTerapkanRef = useRef<string | null>(null);
  /* Perubahan `value` dari PEMANGGIL = nilai pemanggil yang menang.
     KECUALI selama nilai awal belum sempat diterapkan: pemanggil (mis.
     `PresetKolom`) sering mengisi `value`-nya sendiri secara ASYNC — mula-mula
     opsi fallback (mis. "Lengkap"), baru preset aktif tersimpan. Perubahan itu
     BUKAN pilihan pengguna; kalau dianggap pembatalan, `ikutAwal` mati sebelum
     nilai awal sempat dipakai sehingga setelan "Nilai awal" tak pernah berefek
     (keluhan: "nilai default tidak otomatis"). */
  useEffect(() => {
    if (kunciProp === kunciMount.current) return;
    kunciMount.current = kunciProp;
    if (sudahTerapkanRef.current === null && nilaiDefaultEfektif !== undefined) return;
    setNilaiLokal(nilaiProp);
    setIkutAwal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciProp, nilaiDefaultEfektif]);
  const nilaiTampil = nilaiLokal !== undefined
    ? nilaiLokal
    : (itemAwal !== undefined && ikutAwal ? itemAwal : nilaiProp);

  /* Terapkan nilai awal ke PEMANGGIL: nilai awal = penentu default, jadi
     halaman harus benar-benar memakainya (bukan sekadar tampilannya).
     Callback disimpan di ref agar efek bergantung hanya pada nilai. */
  const cbUbahRef = useRef(propsAnak.onValueChange);
  cbUbahRef.current = propsAnak.onValueChange;
  useEffect(() => {
    /* Nilai awal dihapus → siap diterapkan lagi bila nanti diisi ulang. */
    if (nilaiDefaultEfektif === undefined) {
      sudahTerapkanRef.current = null;
      return;
    }
    if (itemAwal === undefined || sudahTerapkanRef.current === nilaiDefaultEfektif) return;
    /* Pemanggil sudah memakai nilai itu (mis. PresetUrut yang urutannya memang
       = nilai awal) → tak perlu memanggil balik. TAPI jangan tandai "sudah
       diterapkan": `kunciProp` bisa masih berupa FALLBACK pemanggil yang
       kebetulan berlabel sama (PresetKolom menampilkan "Lengkap" sebelum daftar
       preset termuat), sehingga penerapan yang sebenarnya justru tak akan
       pernah terjadi. */
    if (kunciProp === nilaiDefaultEfektif) return;
    sudahTerapkanRef.current = nilaiDefaultEfektif;
    cbUbahRef.current?.(itemAwal);
    /* `ikutAwal` sengaja BUKAN gerbang di sini: mengubah nilai awal dari popover
       adalah perintah eksplisit, jadi harus berlaku walau pengguna sudah memilih
       nilai lain pada sesi ini. Pengulangan dicegah oleh penanda di atas. */
  }, [itemAwal, nilaiDefaultEfektif, kunciProp]);

  if (anakTunggal === null || anakTunggal.type !== ComboboxRoot) {
    // Tanpa akar Combobox: tetap dirender di dalam kotak (tanpa suntikan gaya).
    return (
      <KotakLabel label={label} htmlFor={htmlFor} labelTransparan={labelTransparanEfektif} lebarLabel={lebarLabelEfektif} lebarKontrol={lebarKontrolEfektif} lebarKotak={lebarKotakEfektif} tinggi={tinggiEfektif} className={className} kelolaLebar={kelolaLebar} tambahan={tambahan}>
        {() => children}
      </KotakLabel>
    );
  }

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

  const propsGabung: Record<string, unknown> = { ...(anakTunggal.props as object), children: isi };
  if (itemAwal !== undefined) {
    /* Nilai dikendalikan agar nilai awal benar-benar tampil; perubahan tetap
       diteruskan ke pemanggil dan menghentikan mode ikut-awal. */
    propsGabung.value = nilaiTampil;
    propsGabung.defaultValue = undefined;
    propsGabung.onValueChange = (v: unknown) => {
      setNilaiLokal(v);
      setIkutAwal(false);
      propsAnak.onValueChange?.(v);
    };
  }

  const kotak = (
    <KotakLabel
      ref={refKotak}
      label={label}
      htmlFor={htmlFor}
      labelTransparan={labelTransparanEfektif}
      lebarLabel={lebarLabelEfektif}
      lebarKontrol={lebarKontrolEfektif}
      lebarKotak={lebarKotakEfektif}
      tinggi={tinggiEfektif}
      className={className}
      kelolaLebar={kelolaLebar}
      onContextMenu={onContextMenu}
      tambahan={tambahan}
    >
      {() => cloneElement(anakTunggal, propsGabung)}
    </KotakLabel>
  );

  return bungkus(kotak);
}

export { hitungLebarKontrol as hitungLebarKombo, keCss };
