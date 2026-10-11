import { useCallback, useEffect, useState } from 'react';
import {
  arahKolomDariOpsi,
  muatUrutPreset,
  type ArahUrut,
  type PresetUrutData,
} from '@/api/urutPreset';
import { LEBAR_BAWAHAN_FILTER } from '@/components/kelolaTabel/jenis';
import LabeledCombobox from '@/components/LabeledCombobox';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import TombolIkon from '@/components/TombolIkon';

/** Segitiga penuh untuk tombol arah urutan (naik/turun). SVG-inline supaya
 *  benar-benar terisi penuh — ikon garis tak cukup untuk arah sortasi. */
function SegitigaArah({ naik }: { naik: boolean }) {
  return (
    <svg viewBox="0 0 10 10" className="size-2 shrink-0 opacity-70" aria-hidden="true" focusable="false"
      style={naik ? undefined : { transform: 'rotate(180deg)' }}>
      <path d="M5 0.8 9.6 9H0.4z" fill="currentColor" />
    </svg>
  );
}

const TANPA = '_tanpa';

/** Dropdown Urutkan yang sumbernya Preset Urut (global per tabel).
 *  Pengelolaan opsi hanya lewat dialog Kelola Tabel (section Urutan).
 *  Opsi dengan `arah_kolom` mengirim arah per kode ke `onUrut` (token
 *  `kode:arah`) sehingga tiap kolom bisa beda orientasi (mis. aktif DESC,
 *  nama ASC).
 *  Nilai AWAL (urutan yang dipakai saat halaman dibuka) ditentukan lewat
 *  "Nilai awal" di popover pengaturan kotak (klik-kanan), BUKAN lewat preset
 *  `bawaan`. */ 
export default function PresetUrut({
  tableKey,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
  wrapperClassName,
}: {
  tableKey: string;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  /** `arahKolom` = arah per kode (bila opsi preset punya pengaturan sendiri). */
  onUrut?: (nilai: string[], arah: 'naik' | 'turun', arahKolom?: Record<string, ArahUrut>) => void;
  wrapperClassName?: string;
}) {
  const [data, setData] = useState<PresetUrutData | null>(null);
  /** Sudah selesai muat pertama? Dipakai gerbang tampil/sembunyi dropdown. */
  const [muatSelesai, setMuatSelesai] = useState(false);
  const [gagalMuat, setGagalMuat] = useState(false);

  const muat = useCallback(async () => {
    // Termemo per tabel: berbagi satu request dengan hook data.
    try {
      const res = await muatUrutPreset(tableKey);
      setData(res.data);
      setGagalMuat(false);
    } catch {
      // Gagal memuat preset: dropdown tampil tanpa opsi (urutan tetap jalan).
      setData({ table_key: tableKey, opsi: [], tersedia: [] });
      setGagalMuat(true);
    } finally {
      setMuatSelesai(true);
    }
  }, [tableKey]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const opsi = data?.opsi ?? [];
  const kunciAktif = (urutAktif ?? []).join(',');
  const idxAktif = opsi.findIndex((o) => o.kode.join(',') === kunciAktif);
  const nilaiSelect = idxAktif >= 0 ? String(idxAktif) : kunciAktif === '' ? TANPA : '';

  function pilihNilai(v: string) {
    if (v === TANPA) {
      onUrut?.([], arahUrut);
      return;
    }
    const it = opsi[Number(v)];
    if (it) onUrut?.(it.kode, it.arah ?? arahUrut ?? 'naik', arahKolomDariOpsi(it));
  }

  function balikArah() {
    if ((urutAktif ?? []).length === 0) return;
    onUrut?.(urutAktif ?? [], arahUrut === 'naik' ? 'turun' : 'naik');
  }

  // Tanpa opsi nyata (hanya "—") dropdown tak berguna: sembunyikan. Tetap
  // tampil saat masih memuat, saat muat gagal, atau saat ada urutan aktif
  // (agar arah masih bisa dibalik).
  const tampil = !muatSelesai || gagalMuat || opsi.length > 0 || (urutAktif ?? []).length > 0;
  if (!tampil) return null;

  /* Opsi dropdown: label yang tampil + nilai pemicu (index opsi preset, atau
     TANPA). */
  const opsiItem = [
    { label: '—', nilai: TANPA },
    ...opsi.map((o, i) => ({ label: o.label, nilai: String(i) })),
  ];

  return (
    <LabeledCombobox
      label="Urutkan"
      htmlFor={`select_urut_${tableKey}`}
      kelolaLebar={false}
      /* Lebar tersimpan untuk SELURUH kontrol Urutkan; label mengikuti
         panjang teksnya, sisa lebar diisi combobox. Lebar tak lagi dari
         preset toolbar (lepas dari Kelola Tabel) — bawaan tetap, bisa
         diubah per perangkat lewat popover klik-kanan. */
      lebarKotak={LEBAR_BAWAHAN_FILTER}
      /* `gap-0 items-stretch`: kelas wrapper bawaan (`gap-1.5 items-center`)
         untuk mode klasik (label di samping kontrol). Label & zona harus
         menempel dan sama tinggi — kalau `items-center`, label hanya setinggi
         teksnya dan sisanya memperlihatkan latar kotak, sehingga pita label
         terlihat dua warna. */
      className={`${wrapperClassName ?? ''} gap-0 items-stretch`}
      /* Tombol arah kini DI DALAM kotak sebagai segmen kanan (dipisah garis
         oleh `KotakLabel.tambahan`) supaya label + combobox + arah terbaca
         satu kontrol berbagi kotak. */
      tambahan={(
        <TombolIkon
          id={`btn_arah_urut_${tableKey}`}
          variant="ghost"
          size="icon-sm"
          className="h-full w-6 rounded-none text-muted-foreground hover:text-foreground"
          tip={`Balik arah urutan (kini: ${arahUrut === 'naik' ? 'naik' : 'turun'})`}
          disabled={(urutAktif ?? []).length === 0}
          onClick={balikArah}
        >
          {arahUrut === 'naik' ? <SegitigaArah naik /> : <SegitigaArah naik={false} />}
        </TombolIkon>
      )}
    >
      <ComboboxRoot
        items={opsiItem}
        autoHighlight
        itemToStringLabel={(o) => o.label}
        isItemEqualToValue={(a, b) => a.nilai === b.nilai}
        value={opsiItem.find((o) => o.nilai === (nilaiSelect ?? TANPA)) ?? opsiItem[0]}
        onValueChange={(o) => { if (o !== null) pilihNilai(o.nilai); }}
        onOpenChange={(buka) => { if (buka) void muat(); }}
      >
        <ComboboxInput id={`select_urut_${tableKey}`} aria-label="Urutkan" placeholder="Urutkan…" />
        <ComboboxTrigger aria-label="Buka daftar urutan" />
        <ComboboxContent>
          <ComboboxEmpty>Tidak ada opsi urutan.</ComboboxEmpty>
          <ComboboxList>
            {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
    </LabeledCombobox>
  );
}
