import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { PAGE_SHELL } from '@/components/PageHeader';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import LabeledCombobox from '@/components/LabeledCombobox';
import LabeledStepper from '@/components/LabeledStepper';
import LabeledInput from '@/components/LabeledInput';
import PresetKolom from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import { definisiTipe, KUNCI_TIPE_INPUT, type KunciTipeInput } from '@/components/tipeInput';
import type { ExcelField } from '@/components/excel/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info } from '@/icons';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';

const STATUS = ['Aktif', 'Tidak aktif', 'Pindah keluar', 'Lulus', 'Keluar sementara'];

/* ---------- Lebar kolom daftar (dapat digeser) ---------- */

/** Lebar kolom nama saat halaman dibuka (px) — sama dengan lebar lama yang
 *  dipatok di kelas grid. */
const LEBAR_NAMA_BAWAAN = 240;
const LEBAR_NAMA_MIN = 120;
const LEBAR_NAMA_MAX = 480;
/** Langkah panah saat gagang difokus (px); Shift = langkah lebar. */
const LANGKAH_PANAH = 16;
const LANGKAH_PANAH_LEBAR = 48;

/** Nama variabel CSS lebar kolom nama; dipasang di wadah daftar supaya header
 *  DAN seluruh baris memakai lebar yang sama (satu sumber, bukan per baris). */
const VAR_LEBAR_NAMA = '--lebar-kolom-nama';

/** Kelas grid tiap baris & header daftar: kolom nama selebar variabel di atas,
 *  kolom contoh mengisi sisanya. Di bawah `sm` keduanya bertumpuk. */
const KELAS_GRID_BARIS = 'grid gap-3 sm:grid-cols-[var(--lebar-kolom-nama)_1fr]';

/** Jepit lebar kolom ke rentang yang masuk akal (mis. saat diseret jauh). */
function jepitLebarNama(px: number): number {
  if (!Number.isFinite(px)) return LEBAR_NAMA_BAWAAN;
  return Math.min(LEBAR_NAMA_MAX, Math.max(LEBAR_NAMA_MIN, Math.round(px)));
}

/** Gagang penggeser lebar kolom: garis pemisah tipis di header daftar.
 *
 *  Anak header yang ber-`relative`, jadi `inset-y-0` = setinggi header (termasuk
 *  paddingnya) dan `left` diukur dari tepi dalam border. Karena isi grid mulai
 *  setelah padding kiri header (`p-2` = 0.5rem), batas kolom ada di
 *  `lebar + 0.5rem`; gagang selebar celah (`w-3` = gap-3) ditaruh tepat di
 *  tengahnya. Jadi ia hanya menutupi celah antar kolom, bukan isi kolom.
 *
 *  Bisa diseret dengan mouse maupun digeser dengan panah (pola separator ARIA,
 *  sama seperti gagang lebar navigasi di Sidebar). */
function GagangLebarKolom({ lebar, setLebar }: { lebar: number; setLebar: (px: number) => void }) {
  const lepasRef = useRef<null | (() => void)>(null);
  /* Seretan yang belum dilepas saat halaman ditinggalkan (mis. pindah tab
     dengan tombol mouse masih tertahan) jangan meninggalkan listener. */
  useEffect(() => () => { lepasRef.current?.(); }, []);

  const mulaiSeret = (e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const mulaiX = e.clientX;
    const lebarAwal = lebar;
    /* Kursor dipasang di <body>: pointer gampang keluar dari gagang yang tipis
       saat diseret cepat, dan tanpa ini kursornya berkedip balik ke panah. */
    document.body.style.cursor = 'col-resize';
    const geser = (ev: globalThis.MouseEvent) => setLebar(jepitLebarNama(lebarAwal + (ev.clientX - mulaiX)));
    const selesai = () => {
      window.removeEventListener('mousemove', geser);
      window.removeEventListener('mouseup', selesai);
      document.body.style.cursor = '';
      lepasRef.current = null;
    };
    lepasRef.current?.();
    lepasRef.current = selesai;
    window.addEventListener('mousemove', geser);
    window.addEventListener('mouseup', selesai);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const langkah = e.shiftKey ? LANGKAH_PANAH_LEBAR : LANGKAH_PANAH;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setLebar(jepitLebarNama(lebar - langkah));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setLebar(jepitLebarNama(lebar + langkah));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setLebar(LEBAR_NAMA_BAWAAN);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Lebar kolom nama komponen"
      aria-valuenow={lebar}
      aria-valuemin={LEBAR_NAMA_MIN}
      aria-valuemax={LEBAR_NAMA_MAX}
      tabIndex={0}
      title="Seret untuk mengubah lebar kolom (klik dua kali = lebar bawaan)"
      onMouseDown={mulaiSeret}
      onDoubleClick={() => setLebar(LEBAR_NAMA_BAWAAN)}
      onKeyDown={onKeyDown}
      className="absolute inset-y-0 z-10 w-3 max-sm:hidden cursor-col-resize touch-none select-none"
      /* `0.5rem` = padding kiri header (`p-2`): batas kolom = lebar + padding. */
      style={{ left: `calc(var(${VAR_LEBAR_NAMA}, ${LEBAR_NAMA_BAWAAN}px) + 0.5rem)` }}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors hover:bg-muted-foreground/60" />
    </div>
  );
}

/** Field contoh untuk demo PresetKolom: key-nya sengaja sama dengan kolom
 *  tabel `keanggotaan` supaya preset tabel itu ("ringkas"/"Lengkap") benar-benar
 *  terpetakan saat dipilih. */
const FIELD_KEANGGOTAAN: ExcelField[] = [
  { key: 'nama', label: 'Nama', kind: 'static' },
  { key: 'nik', label: 'NIK', kind: 'static' },
  { key: 'nisn', label: 'NISN', kind: 'static' },
  { key: 'jk', label: 'JK', kind: 'static' },
  { key: 'tmp_lahir', label: 'Tempat Lahir', kind: 'static' },
  { key: 'tgl_lahir', label: 'Tanggal Lahir', kind: 'static' },
  { key: 'alamat', label: 'Alamat', kind: 'static' },
  { key: 'lembaga', label: 'Lembaga', kind: 'static' },
  { key: 'nis_lokal', label: 'NIS Lokal', kind: 'static' },
  { key: 'nis_kemenag', label: 'NIS Kemenag', kind: 'static' },
  { key: 'aktif', label: 'Aktif', kind: 'static' },
  { key: 'masuk', label: 'Masuk', kind: 'static' },
  { key: 'selesai', label: 'Selesai', kind: 'static' },
];

/** Nilai contoh tiap tipe supaya kotaknya tak kosong saat halaman dibuka —
 *  `tanggal` langsung tampil sebagai tanggal, `teks_rahasia` bertitik, dst. */
const CONTOH_NILAI_TIPE: Record<KunciTipeInput, string> = {
  teks: 'Ahmad Fauzi',
  teks_rahasia: 'rahasia123',
  angka: '32',
  nominal: '50000',
  tanggal: '2026-07-14',
  bulan: '2026-07',
  waktu: '08:30',
  tanggal_waktu: '2026-07-14T08:30',
  email: 'ustadz@pesantren.id',
  pencarian: 'cari santri…',
  telepon: '081234567890',
  url: 'https://pesantren.id',
};

/** Rincian keterangan satu tipe, DITURUNKAN dari registry (`tipeInput.tsx`)
 *  supaya halaman ini tak pernah basi saat registry berubah. */
function rincianTipe(kunci: KunciTipeInput): string[] {
  const def = definisiTipe(kunci);
  const inputMode = def?.attrs?.inputMode;
  const baris = [
    `Atribut native: type="${def?.type ?? 'text'}"${inputMode === undefined ? '' : `, inputMode="${inputMode}"`}.`,
  ];
  if (def?.format !== undefined) {
    baris.push('Nilai di kotak DIFORMAT (`format`) — yang dipakai aplikasi & dikirim ke server tetap nilai sebenarnya.');
  }
  if (def?.aksiKanan !== undefined) {
    baris.push('Punya aksi di ujung kanan kotak (`aksiKanan`) — mis. tombol kalkulator rupiah (nominal) atau kalender (tanggal).');
  }
  if (def?.pengaturan !== undefined) {
    baris.push(`Punya pengaturan sendiri di popover: baris "${def.pengaturan.label}".`);
  }
  baris.push('Klik kanan kotak → baris "Tipe" (muncul bila ada lebih dari satu pilihan).');
  return baris;
}

/** Satu baris varian per TIPE input: kotak yang sama, tipe dipatok dari kode.
 *  SELURUH tipe di registry ikut tampil, jadi menambah tipe baru cukup di
 *  `tipeInput.tsx` — daftar di sini mengikuti sendiri (tanpa daftar ganda). */
const VARIAN_TIPE_TEKS = KUNCI_TIPE_INPUT.map((kunci) => {
  const nama = definisiTipe(kunci)?.label ?? kunci;
  return {
    id: `info_tipe_${kunci}`,
    nama: `LabeledInput — ${nama}`,
    keterangan: `tipe \`${kunci}\` dari registry tipeInput.tsx: satu komponen, tipe dipatok lewat prop tipeKontrol`,
    rincian: rincianTipe(kunci),
    catatan: `tipe \`${kunci}\` — varian dari LabeledInput`,
    contoh: (
      <LabeledInput
        label={nama}
        htmlFor={`demo_tipe_${kunci}`}
        tipeKontrol={kunci}
        defaultValue={CONTOH_NILAI_TIPE[kunci]}
      />
    ),
  };
});

/** Ikon info di akhir nama komponen: keterangan tampil dalam popover. */
function InfoKeterangan({ id, keterangan, rincian }: { id: string; keterangan: string; rincian: string[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Keterangan ${keterangan}`}
          title="Keterangan"
          className="text-muted-foreground"
        >
          <Info size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 border border-foreground/30 p-2">
        <p className="text-xs text-muted-foreground">Keterangan: {keterangan}</p>
        <ul className="list-disc space-y-0.5 pl-4 pt-1 text-xs text-muted-foreground">
          {rincian.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Satu komponen di dalam tab: nama (+ ikon info) dan contoh yang bisa dipakai. */
function BarisKomponen({ id, nama, keterangan, rincian, contoh, catatan }: {
  id: string;
  nama: string;
  keterangan: string;
  rincian: string[];
  /** Contoh hidup komponen ini. */
  contoh: ReactNode;
  /** Penanda tambahan di bawah nama (mis. "varian dari LabeledCombobox"). */
  catatan?: string;
}) {
  return (
    <div className={`${KELAS_GRID_BARIS} border-b border-border p-2`}>
      <div>
        <h3 className="flex items-center gap-1 text-sm font-semibold">
          <span className="truncate">{nama}</span>
          <InfoKeterangan id={id} keterangan={keterangan} rincian={rincian} />
        </h3>
        {catatan !== undefined && (
          <p className="text-[11px] text-muted-foreground">{catatan}</p>
        )}
      </div>
      <div className="rounded-md border border-border p-2">{contoh}</div>
    </div>
  );
}

/** Satu tab: satu komponen utama + varian-variannya. Varian adalah turunan
 *  dari komponen utama (mis. PresetUrut/PresetKolom membungkus
 *  LabeledCombobox), karena itu diletakkan dalam tab yang sama supaya mudah
 *  dibandingkan.
 *
 *  Bukan semua perbedaan jadi komponen baru: jenis input `LabeledInput`
 *  ditentukan TIPE di registry (`components/tipeInput.tsx`) lewat popover
 *  klik-kanan, jadi "nominal" cukup baris contoh, bukan komponen tersendiri.
 *
 *  Tanpa bingkai sendiri: bingkai panel tab (`KELAS_PANEL_TAB`) sudah jadi
 *  tepi daftar — pola sama dengan tabel di halaman lain.
 *
 *  Lebar kolom nama diatur lewat variabel CSS di wadah daftar (`VAR_LEBAR_NAMA`)
 *  supaya header & SELURUH baris ikut bergerak bersama; nilainya dari state
 *  halaman, jadi lebar yang disetel di satu tab berlaku untuk semua tab. */
function IsiTab({ utama, varian, lebarNama, setLebarNama }: {
  utama: { id: string; nama: string; keterangan: string; rincian: string[]; contoh: ReactNode };
  varian: { id: string; nama: string; keterangan: string; rincian: string[]; contoh: ReactNode; catatan?: string }[];
  lebarNama: number;
  setLebarNama: (px: number) => void;
}) {
  return (
    <div
      className="relative min-h-0 flex-1 overflow-auto"
      style={{ [VAR_LEBAR_NAMA]: `${lebarNama}px` } as CSSProperties}
    >
      <div className={`${KELAS_GRID_BARIS} relative border-b border-border bg-muted/40 p-2 text-xs font-semibold`}>
        <div className="truncate">Nama Custom Component</div>
        <div>Contoh Component</div>
        <GagangLebarKolom lebar={lebarNama} setLebar={setLebarNama} />
      </div>
      <BarisKomponen {...utama} />
      {varian.map((v) => (
        <BarisKomponen key={v.id} {...v} catatan={v.catatan ?? `varian dari ${utama.nama}`} />
      ))}
      {varian.length === 0 && (
        <p className="p-2 text-xs text-muted-foreground">Belum ada varian dari {utama.nama}.</p>
      )}
    </div>
  );
}

/** Halaman workshop komponen custom (khusus super_admin): tempat merakit
 *  dan menguji komponen gabungan sebelum dipakai di halaman produksi.
 *
 *  Satu tab per komponen utama; di dalamnya ada komponen utama itu dan
 *  varian-variannya. Kerangka tab memakai pola bersama halaman bertab lain
 *  (`KELAS_LIST_TAB`/`KELAS_TRIGGER`/`KELAS_PANEL_TAB`) supaya tampak sama
 *  dengan mis. Santri Aktif → Daftar Kelas. */
export default function KomponenPage() {
  const [jumlahSantri, setJumlahSantri] = useState(32);
  const [urutAktif, setUrutAktif] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [kolomTerpakai, setKolomTerpakai] = useState<string[] | null>(null);
  /** Lebar kolom nama (px) — dipakai bersama ketiga tab, diatur lewat gagang
   *  geser di header daftar. */
  const [lebarNama, setLebarNama] = useState(LEBAR_NAMA_BAWAAN);
  return (
    <div className={PAGE_SHELL}>
      <Tabs defaultValue="combobox" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="combobox" id="tab_komponen_combobox" className={KELAS_TRIGGER}>Combobox</TabsTrigger>
          <TabsTrigger value="teks" id="tab_komponen_teks" className={KELAS_TRIGGER}>LabeledInput</TabsTrigger>
          <TabsTrigger value="stepper" id="tab_komponen_stepper" className={KELAS_TRIGGER}>Stepper</TabsTrigger>
        </TabsList>

        <TabsContent value="combobox" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <IsiTab
            utama={{
              id: 'info_labeled_combobox',
              nama: 'LabeledCombobox',
              keterangan: 'gabungan komponen label + combobox dalam 1 kotak',
              rincian: [
                'Tanpa ukuran yang dikunci.',
                'Kotak selebar kolom, tinggi 26px.',
                'Combobox mengisi sisa ruang.',
              ],
              contoh: (
                <LabeledCombobox label="Status" htmlFor="demo_kombo_status">
                  <ComboboxRoot items={STATUS} defaultValue="Aktif">
                    <ComboboxInput id="demo_kombo_status" aria-label="Status" placeholder="Cari status…" />
                    <ComboboxTrigger aria-label="Buka daftar status" />
                    <ComboboxContent>
                      <ComboboxEmpty>Tidak ada status.</ComboboxEmpty>
                      <ComboboxList>
                        {(k) => <ComboboxItem key={k} value={k}>{k}</ComboboxItem>}
                      </ComboboxList>
                    </ComboboxContent>
                  </ComboboxRoot>
                </LabeledCombobox>
              ),
            }}
            varian={[
              {
                id: 'info_preset_urut',
                nama: 'PresetUrut',
                keterangan: 'dropdown Urutkan yang opsinya berasal dari Preset Urut global per tabel',
                rincian: [
                  'Sumber opsi: endpoint urut-preset; kelola lewat Kelola Tabel → Urutan.',
                  'Menyembunyikan diri bila tabel belum punya opsi preset.',
                  'Demo memakai tabel keanggotaan (sudah ada opsi seed).',
                ],
                contoh: (
                  <div className="flex flex-col gap-2">
                    <PresetUrut
                      tableKey="keanggotaan"
                      urutAktif={urutAktif}
                      arahUrut={arahUrut}
                      onUrut={(nilai, arah) => { setUrutAktif(nilai); setArahUrut(arah); }}
                      wrapperClassName="flex-row items-center gap-1.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Terpilih: {urutAktif.length > 0 ? `${urutAktif.join(' → ')} (${arahUrut})` : '—'}
                    </p>
                  </div>
                ),
              },
              {
                id: 'info_preset_kolom',
                nama: 'PresetKolom',
                keterangan: 'dropdown preset kolom tampilan tabel (Lengkap / preset tersimpan)',
                rincian: [
                  'Sumber opsi: endpoint preset; kelola lewat Kelola Tabel → Kolom.',
                  'Memilih preset menyimpan pilihan aktif pengguna untuk tabel itu.',
                  'Demo memakai tabel keanggotaan dan field contoh yang cocok.',
                ],
                contoh: (
                  <div className="flex flex-col gap-2">
                    <PresetKolom
                      tableKey="keanggotaan"
                      fields={FIELD_KEANGGOTAAN}
                      onApply={(keys) => setKolomTerpakai(keys)}
                      wrapperClassName="flex-row items-center gap-1.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Kolom aktif: {kolomTerpakai === null ? 'semua' : `${kolomTerpakai.length} kolom`}
                    </p>
                  </div>
                ),
              },
            ]}
            lebarNama={lebarNama}
            setLebarNama={setLebarNama}
          />
        </TabsContent>

          <TabsContent value="teks" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
            <IsiTab
              utama={{
                id: 'info_labeled_text_input',
                nama: 'LabeledInput',
                keterangan: 'gabungan komponen label + input dalam 1 kotak; JENIS inputnya dipilih dari baris "Tipe" di popover klik-kanan (registry tipeInput.tsx)',
                rincian: [
                  'Tanpa ukuran yang dikunci.',
                  'Kotak selebar kolom, tinggi 26px.',
                  'Properti input biasa diteruskan (type, step, dll).',
                  'Klik kanan kotak → baris "Tipe" + pengaturan khusus tipe aktif.',
                  'Tiap tipe punya baris varian sendiri di bawah ini.',
                ],
                contoh: (
                  <LabeledInput
                    label="Contoh"
                    htmlFor="demo_input_bebas"
                    placeholder="Klik kanan untuk memilih tipe…"
                  />
                ),
              }}
              varian={VARIAN_TIPE_TEKS}
              lebarNama={lebarNama}
              setLebarNama={setLebarNama}
            />
          </TabsContent>

        <TabsContent value="stepper" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <IsiTab
            utama={{
              id: 'info_labeled_stepper',
              nama: 'LabeledStepper',
              keterangan: 'stepper angka berlabel: tombol kurang/tambah + ketikan langsung dalam 1 kotak',
              rincian: [
                'Tanpa ukuran dikunci: kotak selebar kolom.',
                'Ketikan di-commit saat blur/Enter, dijepit ke min..maks.',
                'Tombol ber-id `<id>_kurang`/`<id>_tambah`.',
              ],
              contoh: (
                <LabeledStepper
                  label="Jumlah Santri"
                  htmlFor="demo_stepper_jumlah"
                  min={0}
                  max={999}
                  value={jumlahSantri}
                  onChange={setJumlahSantri}
                />
              ),
            }}
            varian={[]}
            lebarNama={lebarNama}
            setLebarNama={setLebarNama}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}