import { type ReactNode, useState } from 'react';
import { Input } from '@/components/ui/input';
import KotakLabel, { hitungLebarKontrol, keCss } from '@/components/kotakLabel';
import { usePengaturanKotak } from '@/components/pengaturanKotak';
import { kunciDariTypeNative, type DefinisiTipeInput, type KunciTipeInput } from '@/components/tipeInput';
import { cn } from '@/lib/utils';

/** Gabungan label + input teks dalam satu kotak tanpa padding.
 *
 *  Styling, penskalaan lebar, dan pendaftaran ke Kelola Tabel identik dengan
 *  `LabeledCombobox` (keduanya memakai shell `KotakLabel`) — bedanya hanya
 *  jenis kontrolnya: input teks yang bisa diketik bebas.
 *
 *  JENIS inputnya tidak dipecah jadi komponen terpisah: registry
 *  `tipeInput.tsx` memuat bawaan tiap tipe (atribut, tombol di ujung kanan,
 *  pengaturan yang bisa diubah pengguna), dan tipe aktif dipilih dari baris
 *  "Tipe input:" pada popover klik-kanan. Jadi "nominal" cukup tipe, bukan
 *  komponen `LabeledNominalInput` tersendiri.
 *
 *  - Label segaris (inline) di dalam kotak; tanpa ukuran, kotak selebar induk
 *    dan input mengisi sisa ruang. Di dalam toolbar tabel lebarnya mengikuti
 *    Kelola Tabel (bawaan `LEBAR_BAWAHAN_FILTER`).
 *  - `lebarLabel`/`lebarInput` mengunci lebar; `lebarInput` menyusut bila ruang
 *    induk tak cukup (dibatasi `MIN_LEBAR_KONTROL`).
 *  - Tinggi label & input mengikuti tinggi kotak (`tinggi`, bawaan 26px).
 *  - `type`, `placeholder`, `value`, `onChange`, dan seterusnya diteruskan ke
 *    `Input`; `className` tambahan digabung di atas kelas bawaan.
 *  - `aksiKanan` menempelkan konten (mis. tombol) di ujung kanan zona kontrol
 *    secara absolut; input diberi ruang kanan agar teks tak tertimpa.
 *  - KLIK KANAN pada kotak membuka popover pengaturan ukuran KOTAK (sama
 *    seperti `LabeledCombobox`); butuh `htmlFor` sebagai identitas. */
export default function LabeledTextInput({ label, htmlFor, labelTransparan = true, nama = 'input', tipeKontrol, pilihanTipe, tipeTerkunci, bawaanTipe, lebarLabel, lebarInput, lebarKotak, tinggi = 26, className, kelolaLebar = true, aksiKanan, ...props }: {
  label: string;
  htmlFor?: string;
  /** Label transparan (tanpa bg, teks bertitik dua); simpanan popover menang. */
  labelTransparan?: boolean;
  /** Kata ganti jenis kotak di judul & aria popover (bawaan 'input'). */
  nama?: string;
  /** Tipe bawaan dari pemanggil; bila absen diturunkan dari `type` native
   *  (`date` → `tanggal`, dst). Pilihan di popover MANG atas nilai ini, dan
   *  tipe tak terdaftar tetap memakai `Input` bawaan. */
  tipeKontrol?: KunciTipeInput;
  /** Tipe yang boleh dipilih di popover; absen = baris "Tipe input:"
   *  disembunyikan (kontrol yang bukan input teks, mis. combobox). Berisi
   *  SATU tipe = terkunci ke tipe itu. */
  pilihanTipe?: KunciTipeInput[];
  /** Kunci tipe ini dari kode: baris "Tipe input:" disembunyikan DAN setelan
   *  tipe tersimpan diabaikan. Untuk kotak yang tipenya bagian dari kontrak
   *  (mis. jatuh tempo harus `tanggal`). */
  tipeTerkunci?: boolean;
  /** Pengimpaan bawaan tipe AKTIF untuk kotak ini saja (mis. daftar preset
   *  nominal berbeda). Berlapis di ATAS bawaan registry + pengaturan tipe. */
  bawaanTipe?: Partial<DefinisiTipeInput>;
  lebarLabel?: number | string;
  /** Lebar input terkunci (`lebarKotak`/`lebarInput`); menyusut bila ruang
   *  induk tak cukup (dibatasi `MIN_LEBAR_KONTROL`). */
  lebarInput?: number | string;
  /** Lebar TOTAL kotak (label + input); input mengisi sisa ruang. */
  lebarKotak?: number | string;
  tinggi?: number | string;
  /** Matikan pendaftaran ke Kelola Tabel (kontrol bawaan toolbar). */
  kelolaLebar?: boolean;
  className?: string;
  /** Konten di ujung kanan zona kontrol (tombol dsb), ditumpuk absolut. */
  aksiKanan?: ReactNode;
} & Omit<React.ComponentProps<typeof Input>, 'className' | 'style'>) {
  const {
    refKotak, onContextMenu, tinggiEfektif, lebarKotakEfektif,
    lebarLabelEfektif, lebarKontrolEfektif, labelTransparanEfektif,
    defTipeEfektif, bungkus,
  } = usePengaturanKotak({
    htmlFor, kelolaLebar, label, nama, labelTransparan,
    lebarLabel, lebarKontrol: lebarInput, lebarKotak, tinggi,
    tipeKontrol: tipeKontrol ?? kunciDariTypeNative(props.type), pilihanTipe, tipeTerkunci,
  });
  /* Bawaan tipe (atribut + aksiKanan) digabung BAWAH props: yang menentukan
     pemanggil tetap menang. Bawaan sudah termasuk pengaturan tipe tersimpan
     (mis. preset nominal milik pengguna). Tipe tak dikenal → `Input` bawaan. */
  const bawaan = { ...defTipeEfektif, ...bawaanTipe };
  /* Input yang TIDAK dikendalikan pemanggil (tanpa `value`/`onChange`) tetap
     tak-terkontrol agar `defaultValue` pemanggil tetap berlaku — kecuali tipe
     aktif punya `aksiKanan` bawaan (mis. kalkulator rupiah) yang butuh menulis
     nilai; baru nilai disimpan internal (lihat penanganan `key`/`defaultValue`
     pada `Input` di bawah). */
  const terkendaliPemanggil = props.value !== undefined || props.onChange !== undefined;
  const pakaiNilaiInternal = !terkendaliPemanggil && bawaan?.aksiKanan !== undefined;
  const [nilaiInternal, setNilaiInternal] = useState(props.defaultValue === undefined ? '' : String(props.defaultValue));
  const nilai = terkendaliPemanggil ? String(props.value ?? '') : nilaiInternal;
  const setNilai = (nilaiBaru: string) => {
    if (terkendaliPemanggil) props.onChange?.({ target: { value: nilaiBaru } } as React.ChangeEvent<HTMLInputElement>);
    else setNilaiInternal(nilaiBaru);
  };
  const aksiKananEfektif = aksiKanan
    ?? (bawaan?.aksiKanan === undefined ? undefined : bawaan.aksiKanan({ htmlFor, nilai, setNilai }));
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
    >
      {(kelasKontrol) => (
        <>
          <Input
            {...bawaan?.attrs}
            {...props}
            id={props.id ?? htmlFor}
            type={props.type ?? bawaan?.type}
            /* Saat nilai dikelola internal: kotak TERKENDALI oleh state itu —
               `defaultValue` jangan diteruskan (React menolak value +
               defaultValue sekaligus) dan `onChange` WAJIB ada supaya isinya
               masih bisa diketik. `key` memisah kedua mode agar React tak
               mengeluh saat tipe aktif berubah dari polos ke ber-aksiKanan. */
            key={pakaiNilaiInternal ? 'nilai_internal' : 'nilai_bebas'}
            value={terkendaliPemanggil ? props.value : pakaiNilaiInternal ? nilaiInternal : undefined}
            defaultValue={pakaiNilaiInternal ? undefined : props.defaultValue}
            onChange={pakaiNilaiInternal ? (e) => setNilai(e.target.value) : props.onChange}
            className={cn(kelasKontrol, aksiKananEfektif !== undefined && 'pr-7')}
          />
          {aksiKananEfektif !== undefined && (
            <span className="absolute inset-y-0 right-0 flex items-center">{aksiKananEfektif}</span>
          )}
        </>
      )}
    </KotakLabel>
  );
  return bungkus(kotak);
}

export { hitungLebarKontrol as hitungLebarInput, keCss };