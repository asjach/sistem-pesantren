import { useState, type ReactNode } from 'react';
import { PAGE_SHELL } from '@/components/PageHeader';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import LabeledCombobox from '@/components/LabeledCombobox';
import LabeledNominalInput from '@/components/LabeledNominalInput';
import LabeledStepper from '@/components/LabeledStepper';
import LabeledTextInput from '@/components/LabeledTextInput';
import PresetKolom from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import type { ExcelField } from '@/components/excel/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info } from '@/icons';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';

const STATUS = ['Aktif', 'Tidak aktif', 'Pindah keluar', 'Lulus', 'Keluar sementara'];

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
    <div className="grid gap-3 border-b border-border p-2 sm:grid-cols-[240px_1fr]">
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
 *  dari komponen utama (LabeledNominalInput membungkus LabeledTextInput;
 *  PresetUrut/PresetKolom membungkus LabeledCombobox), karena itu diletakkan
 *  dalam tab yang sama supaya mudah dibandingkan.
 *
 *  Tanpa bingkai sendiri: bingkai panel tab (`KELAS_PANEL_TAB`) sudah jadi
 *  tepi daftar — pola sama dengan tabel di halaman lain. */
function IsiTab({ utama, varian }: {
  utama: { id: string; nama: string; keterangan: string; rincian: string[]; contoh: ReactNode };
  varian: { id: string; nama: string; keterangan: string; rincian: string[]; contoh: ReactNode }[];
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="grid gap-3 border-b border-border bg-muted/40 p-2 text-xs font-semibold sm:grid-cols-[240px_1fr]">
        <div>Nama Custom Component</div>
        <div>Contoh Component</div>
      </div>
      <BarisKomponen {...utama} />
      {varian.map((v) => (
        <BarisKomponen key={v.id} {...v} catatan={`varian dari ${utama.nama}`} />
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
  const [nominalBawaan, setNominalBawaan] = useState('');
  const [jumlahSantri, setJumlahSantri] = useState(32);
  const [urutAktif, setUrutAktif] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [kolomTerpakai, setKolomTerpakai] = useState<string[] | null>(null);
  return (
    <div className={PAGE_SHELL}>
      <Tabs defaultValue="combobox" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="combobox" id="tab_komponen_combobox" className={KELAS_TRIGGER}>Combobox</TabsTrigger>
          <TabsTrigger value="teks" id="tab_komponen_teks" className={KELAS_TRIGGER}>LabeledTextInput</TabsTrigger>
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
          />
        </TabsContent>

        <TabsContent value="teks" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <IsiTab
            utama={{
              id: 'info_labeled_text_input',
              nama: 'LabeledTextInput',
              keterangan: 'gabungan komponen label + input dalam 1 kotak',
              rincian: [
                'Tanpa ukuran yang dikunci.',
                'Kotak selebar kolom, tinggi 26px.',
                'Properti input biasa diteruskan (type, step, dll).',
              ],
              contoh: (
                <LabeledTextInput
                  label="NIS"
                  htmlFor="demo_input_nis"
                  type="number"
                  placeholder="mis. 1234"
                  defaultValue="24001"
                />
              ),
            }}
            varian={[
              {
                id: 'info_labeled_nominal_input',
                nama: 'LabeledNominalInput',
                keterangan: 'input angka nominal + dua panel tombol (nominal di atas input, angka di bawahnya)',
                rincian: [
                  'Tanpa ukuran dikunci: kotak selebar kolom.',
                  '`type=number` + `inputMode` numeric dipaksa.',
                  'Spinner bawaan browser disembunyikan.',
                ],
                contoh: (
                  <LabeledNominalInput
                    label="Nominal Default"
                    htmlFor="demo_nominal_bawaan"
                    min={0}
                    placeholder="mis. 50000"
                    value={nominalBawaan}
                    onValueChange={setNominalBawaan}
                  />
                ),
              },
            ]}
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
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}