import { useState } from 'react';
import { PAGE_SHELL } from '@/components/PageHeader';
import LabeledCombobox from '@/components/LabeledCombobox';
import LabeledNominalInput from '@/components/LabeledNominalInput';
import LabeledTextInput from '@/components/LabeledTextInput';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';

const KELOMPOK = [
  'Semua (kecuali pindah keluar)', 'MI (MI + MI-MD)', 'MD (MD + MI-MD)', 'MI-MD',
  'MI Saja (tanpa MD)', 'MD Saja (tanpa MI)', 'Kelas Akhir', 'Selain Kelas Akhir', 'Custom',
];
const TAHUN_AJARAN = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];
const STATUS = ['Aktif', 'Tidak aktif', 'Pindah keluar', 'Lulus', 'Keluar sementara'];

/** Halaman workshop komponen custom (khusus super_admin): tempat merakit
 *  dan menguji komponen gabungan sebelum dipakai di halaman produksi. */
export default function KomponenPage() {
  const [nominalTarif, setNominalTarif] = useState('');
  const [nominalKustom, setNominalKustom] = useState('1500000');
  const [nominalBawaan, setNominalBawaan] = useState('');
  return (
    <div className={PAGE_SHELL}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <div>
          <h1 className="text-base font-semibold">Komponen</h1>
          <p className="text-xs text-muted-foreground">
            Ruang rakit komponen custom. Contoh langsung bisa dipakai di bawah.
          </p>
        </div>

        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 overflow-hidden rounded-md border border-border">
            <div className="border-b border-border px-2 py-1.5">
              <h2 className="text-sm font-semibold">
                <span className="text-muted-foreground">Nama Custom Component: </span>LabeledCombobox
              </h2>
              <p className="text-xs text-muted-foreground">Keterangan: gabungan komponen label + combobox dalam 1 kotak</p>
            </div>
            <div className="grid gap-3 p-2 sm:grid-cols-3">
            <figure className="flex flex-col overflow-hidden rounded-md border border-border">
              <div className="border-b border-border p-2">
                <LabeledCombobox label="Kelompok" htmlFor="demo_kombo_kelompok" lebarLabel={80} lebarKombo={180}>
                  <ComboboxRoot items={KELOMPOK} defaultValue="Semua (kecuali pindah keluar)">
                    <ComboboxInput id="demo_kombo_kelompok" aria-label="Kelompok" placeholder="Cari kelompok…" />
                    <ComboboxTrigger aria-label="Buka daftar kelompok" />
                    <ComboboxContent>
                      <ComboboxEmpty>Tidak ada kelompok.</ComboboxEmpty>
                      <ComboboxList>
                        {(k) => <ComboboxItem key={k} value={k}>{k}</ComboboxItem>}
                      </ComboboxList>
                    </ComboboxContent>
                  </ComboboxRoot>
                </LabeledCombobox>
              </div>
              <figcaption className="p-2">
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  <li>Lebar dikunci: label 80px + kombo 180px.</li>
                  <li>Kotak rangkul isi, tak mengikuti lebar kolom.</li>
                  <li>Isi kepanjangan terpotong elipsis.</li>
                </ul>
              </figcaption>
            </figure>

            <figure className="flex flex-col overflow-hidden rounded-md border border-border">
              <div className="border-b border-border p-2">
                <LabeledCombobox label="Tahun Ajaran" htmlFor="demo_kombo_ta" lebarLabel={100} tinggi={34}>
                  <ComboboxRoot items={TAHUN_AJARAN} defaultValue="2025/2026">
                    <ComboboxInput id="demo_kombo_ta" aria-label="Tahun Ajaran" placeholder="Cari tahun ajaran…" />
                    <ComboboxTrigger aria-label="Buka daftar tahun ajaran" />
                    <ComboboxContent>
                      <ComboboxEmpty>Tidak ada tahun ajaran.</ComboboxEmpty>
                      <ComboboxList>
                        {(t) => <ComboboxItem key={t} value={t}>{t}</ComboboxItem>}
                      </ComboboxList>
                    </ComboboxContent>
                  </ComboboxRoot>
                </LabeledCombobox>
              </div>
              <figcaption className="p-2">
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  <li>Tinggi khusus 34px (bawaan 26px).</li>
                  <li>Label &amp; combobox merentang sama tinggi.</li>
                  <li>Lebar kombo mengikuti sisa ruang kolom.</li>
                </ul>
              </figcaption>
            </figure>

            <figure className="flex flex-col overflow-hidden rounded-md border border-border">
              <div className="border-b border-border p-2">
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
              <figcaption className="p-2">
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  <li>Tanpa ukuran yang dikunci.</li>
                  <li>Kotak selebar kolom, tinggi 26px.</li>
                  <li>Combobox mengisi sisa ruang.</li>
                </ul>
              </figcaption>
            </figure>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 overflow-hidden rounded-md border border-border">
            <div className="border-b border-border px-2 py-1.5">
              <h2 className="text-sm font-semibold">
                <span className="text-muted-foreground">Nama Custom Component: </span>LabeledTextInput
              </h2>
              <p className="text-xs text-muted-foreground">Keterangan: gabungan komponen label + input dalam 1 kotak</p>
            </div>
            <div className="grid gap-3 p-2 sm:grid-cols-3">
              <figure className="flex flex-col overflow-hidden rounded-md border border-border">
                <div className="border-b border-border p-2">
                  <LabeledTextInput
                    label="Nama Santri"
                    htmlFor="demo_input_nama"
                    lebarLabel={80}
                    lebarInput={180}
                    placeholder="mis. Ahmad Fauzi"
                    defaultValue="Ahmad Fauzi"
                  />
                </div>
                <figcaption className="p-2">
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    <li>Lebar dikunci: label 80px + input 180px.</li>
                    <li>Kotak rangkul isi, tak mengikuti lebar kolom.</li>
                    <li>Teks panjang terpotong elipsis.</li>
                  </ul>
                </figcaption>
              </figure>

              <figure className="flex flex-col overflow-hidden rounded-md border border-border">
                <div className="border-b border-border p-2">
                  <LabeledTextInput
                    label="Catatan"
                    htmlFor="demo_input_catatan"
                    lebarLabel={100}
                    tinggi={34}
                    placeholder="Keterangan tambahan…"
                    defaultValue="Dispensasi anak pegawai"
                  />
                </div>
                <figcaption className="p-2">
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    <li>Tinggi khusus 34px (bawaan 26px).</li>
                    <li>Label & input merentang sama tinggi.</li>
                    <li>Input mengisi sisa ruang kolom.</li>
                  </ul>
                </figcaption>
              </figure>

              <figure className="flex flex-col overflow-hidden rounded-md border border-border">
                <div className="border-b border-border p-2">
                  <LabeledTextInput
                    label="NIS"
                    htmlFor="demo_input_nis"
                    type="number"
                    placeholder="mis. 1234"
                    defaultValue="24001"
                  />
                </div>
                <figcaption className="p-2">
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    <li>Tanpa ukuran yang dikunci.</li>
                    <li>Kotak selebar kolom, tinggi 26px.</li>
                    <li>Properti input biasa diteruskan (type, step, dll).</li>
                  </ul>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 overflow-hidden rounded-md border border-border">
            <div className="border-b border-border px-2 py-1.5">
              <h2 className="text-sm font-semibold">
                <span className="text-muted-foreground">Nama Custom Component: </span>LabeledNominalInput
              </h2>
              <p className="text-xs text-muted-foreground">Keterangan: input angka nominal + dua panel tombol (nominal di atas input, angka di bawahnya)</p>
            </div>
            <div className="grid gap-3 p-2 sm:grid-cols-3">
              <figure className="flex flex-col overflow-hidden rounded-md border border-border">
                <div className="border-b border-border p-2">
                  <LabeledNominalInput
                    label="Nominal Tarif"
                    htmlFor="demo_nominal_tarif"
                    lebarLabel={90}
                    lebarInput={180}
                    min={0}
                    placeholder="mis. 150000"
                    value={nominalTarif}
                    onValueChange={setNominalTarif}
                  />
                </div>
                <figcaption className="p-2">
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    <li>Dua panel: nominal + Reset di atas input, angka di bawah.</li>
                    <li>Nominal selalu ditambah ke nilai; ⟲ Reset mengembalikan ke 0.</li>
                    <li>Tombol angka menempel seperti mengetik, mis. 1→0→0→0 = 1000.</li>
                  </ul>
                </figcaption>
              </figure>

              <figure className="flex flex-col overflow-hidden rounded-md border border-border">
                <div className="border-b border-border p-2">
                  <LabeledNominalInput
                    label="Nominal Kustom"
                    htmlFor="demo_nominal_kustom"
                    lebarLabel={100}
                    tinggi={34}
                    min={0}
                    preset={[250_000, 750_000, 1_500_000, 3_000_000]}
                    value={nominalKustom}
                    onValueChange={setNominalKustom}
                  />
                </div>
                <figcaption className="p-2">
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    <li>Daftar preset bagian pertama bisa diganti lewat prop `preset`.</li>
                    <li>Mode yang dipilih juga berlaku di tinggi khusus ini.</li>
                    <li>Nilai tetap teks, sama seperti input number biasa.</li>
                  </ul>
                </figcaption>
              </figure>

              <figure className="flex flex-col overflow-hidden rounded-md border border-border">
                <div className="border-b border-border p-2">
                  <LabeledNominalInput
                    label="Nominal Default"
                    htmlFor="demo_nominal_bawaan"
                    min={0}
                    placeholder="mis. 50000"
                    value={nominalBawaan}
                    onValueChange={setNominalBawaan}
                  />
                </div>
                <figcaption className="p-2">
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    <li>Tanpa ukuran dikunci: kotak selebar kolom.</li>
                    <li>`type=number` + `inputMode` numeric dipaksa.</li>
                    <li>Spinner bawaan browser disembunyikan.</li>
                  </ul>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}