import { useState } from 'react';
import { PAGE_SHELL } from '@/components/PageHeader';
import LabeledCombobox from '@/components/LabeledCombobox';
import LabeledNominalInput from '@/components/LabeledNominalInput';
import LabeledStepper from '@/components/LabeledStepper';
import LabeledTextInput from '@/components/LabeledTextInput';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info } from '@/icons';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';

const STATUS = ['Aktif', 'Tidak aktif', 'Pindah keluar', 'Lulus', 'Keluar sementara'];

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

/** Halaman workshop komponen custom (khusus super_admin): tempat merakit
 *  dan menguji komponen gabungan sebelum dipakai di halaman produksi. */
export default function KomponenPage() {
  const [nominalBawaan, setNominalBawaan] = useState('');
  const [jumlahSantri, setJumlahSantri] = useState(32);
  return (
    <div className={PAGE_SHELL}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <div>
          <h1 className="text-base font-semibold">Komponen</h1>
          <p className="text-xs text-muted-foreground">
            Ruang rakit komponen custom. Contoh langsung bisa dipakai di bawah.
          </p>
        </div>

        <section className="overflow-hidden rounded-md border border-border">
          <div className="grid gap-3 border-b border-border bg-muted/40 p-2 text-xs font-semibold sm:grid-cols-[240px_1fr]">
            <div>Nama Custom Component</div>
            <div>Contoh Component</div>
          </div>

          <div className="grid gap-3 border-b border-border p-2 sm:grid-cols-[240px_1fr]">
            <div>
              <h2 className="flex items-center gap-1 text-sm font-semibold">
                LabeledCombobox
                <InfoKeterangan
                  id="info_labeled_combobox"
                  keterangan="gabungan komponen label + combobox dalam 1 kotak"
                  rincian={[
                    'Tanpa ukuran yang dikunci.',
                    'Kotak selebar kolom, tinggi 26px.',
                    'Combobox mengisi sisa ruang.',
                  ]}
                />
              </h2>
            </div>
            <div className="rounded-md border border-border p-2">
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
            </div>
          </div>

          <div className="grid gap-3 border-b border-border p-2 sm:grid-cols-[240px_1fr]">
            <div>
              <h2 className="flex items-center gap-1 text-sm font-semibold">
                LabeledTextInput
                <InfoKeterangan
                  id="info_labeled_text_input"
                  keterangan="gabungan komponen label + input dalam 1 kotak"
                  rincian={[
                    'Tanpa ukuran yang dikunci.',
                    'Kotak selebar kolom, tinggi 26px.',
                    'Properti input biasa diteruskan (type, step, dll).',
                  ]}
                />
              </h2>
            </div>
            <div className="rounded-md border border-border p-2">
              <LabeledTextInput
                label="NIS"
                htmlFor="demo_input_nis"
                type="number"
                placeholder="mis. 1234"
                defaultValue="24001"
              />
            </div>
          </div>

          <div className="grid gap-3 border-b border-border p-2 sm:grid-cols-[240px_1fr]">
            <div>
              <h2 className="flex items-center gap-1 text-sm font-semibold">
                LabeledNominalInput
                <InfoKeterangan
                  id="info_labeled_nominal_input"
                  keterangan="input angka nominal + dua panel tombol (nominal di atas input, angka di bawahnya)"
                  rincian={[
                    'Tanpa ukuran dikunci: kotak selebar kolom.',
                    '`type=number` + `inputMode` numeric dipaksa.',
                    'Spinner bawaan browser disembunyikan.',
                  ]}
                />
              </h2>
            </div>
            <div className="rounded-md border border-border p-2">
              <LabeledNominalInput
                label="Nominal Default"
                htmlFor="demo_nominal_bawaan"
                min={0}
                placeholder="mis. 50000"
                value={nominalBawaan}
                onValueChange={setNominalBawaan}
              />
            </div>
          </div>

          <div className="grid gap-3 p-2 sm:grid-cols-[240px_1fr]">
            <div>
              <h2 className="flex items-center gap-1 text-sm font-semibold">
                LabeledStepper
                <InfoKeterangan
                  id="info_labeled_stepper"
                  keterangan="stepper angka berlabel: tombol kurang/tambah + ketikan langsung dalam 1 kotak"
                  rincian={[
                    'Tanpa ukuran dikunci: kotak selebar kolom.',
                    'Ketikan di-commit saat blur/Enter, dijepit ke min..maks.',
                    'Tombol ber-id `<id>_kurang`/`<id>_tambah`.',
                  ]}
                />
              </h2>
            </div>
            <div className="rounded-md border border-border p-2">
              <LabeledStepper
                label="Jumlah Santri"
                htmlFor="demo_stepper_jumlah"
                min={0}
                max={999}
                value={jumlahSantri}
                onChange={setJumlahSantri}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}