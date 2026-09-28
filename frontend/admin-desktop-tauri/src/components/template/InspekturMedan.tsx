import { FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { bacaAngka, teksMm } from '@/lib/template/satuan';
import { kunciAset, type AsetDokumen } from '@/lib/template/tipe';
import {
  FONT_PDF,
  RATA,
  SIZEMODE,
  TIPE_DEKORATIF,
  TIPE_TANDA,
  type GayaMedan,
  type KatalogNilai,
  type Medan,
  type Rata,
  type Sizemode,
} from '@/lib/template/tipe';
import { LABEL_TIPE_MEDAN } from './PaletMedan';
import ComboCari from '@/components/ComboCari';

interface InspekturMedanProps {
  medan: Medan | null;
  katalog: KatalogNilai | null;
  /** Jumlah halaman berkas, untuk membatasi pilihan halaman. */
  jumlahHalaman: number;
  /** Pustaka aset, dipakai ketika medan menunjuk sumber Aset Dokumen. */
  aset?: AsetDokumen[];
  onUbah: (id: string, ubah: Partial<Medan>) => void;
  onUbahGaya: (id: string, gaya: Partial<GayaMedan>) => void;
  onHapus: (id: string) => void;
  onDuplikat: (id: string) => void;
  modeBaca?: boolean;
}

const LABEL_RATA: Record<Rata, string> = { kiri: 'Kiri', tengah: 'Tengah', kanan: 'Kanan' };

const LABEL_FONT: Record<(typeof FONT_PDF)[number], string> = {
  helvetica: 'Helvetica (sans)',
  times: 'Times (serif)',
  courier: 'Courier (monospace)',
  dejavusans: 'DejaVu Sans (karakter lengkap)',
};

const LABEL_SIZEMODE: Record<Sizemode, string> = {
  sesuaikan: 'Sesuaikan dengan kotak',
  potong: 'Potong agar penuh',
  asli: 'Ukuran asli berkas',
};

/** Panel sifat satu medan: posisi, ukuran, gaya, dan sumber nilainya. */
export default function InspekturMedan({
  medan,
  katalog,
  jumlahHalaman,
  aset = [],
  onUbah,
  onUbahGaya,
  onHapus,
  onDuplikat,
  modeBaca = false,
}: InspekturMedanProps) {
  if (!medan) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        Pilih satu medan di kanvas untuk mengubah letak, ukuran, dan nilainya.
      </p>
    );
  }

  const gaya = medan.gaya;
  // Tipe dekoratif memakai panel tebal dan warna isian, bukan gaya huruf.
  const perluGaya = !TIPE_TANDA.includes(medan.tipe) && !TIPE_DEKORATIF.includes(medan.tipe);
  const sumber = katalog?.sumber.find((s) => s.kunci === medan.sumber) ?? null;
  const koleksi = katalog?.koleksi.find((k) => k.kunci === medan.baris_berulang?.sumber) ?? null;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{LABEL_TIPE_MEDAN[medan.tipe]}</p>
        {!modeBaca && (
          <div className="flex gap-1">
            <Button id="btn_duplikat_medan" size="sm" variant="outline" onClick={() => onDuplikat(medan.id)}>
              Duplikat
            </Button>
            <Button id="btn_hapus_medan" size="sm" variant="destructive" onClick={() => onHapus(medan.id)}>
              Hapus
            </Button>
          </div>
        )}
      </div>

      <div>
        <FieldLabel htmlFor="input_label_medan">Nama medan</FieldLabel>
        <Input
          id="input_label_medan"
          value={medan.label}
          disabled={modeBaca}
          onChange={(e) => onUbah(medan.id, { label: e.target.value })}
          maxLength={120}
        />
        <FieldDescription>Nama ini hanya untuk membantu Anda mengenali medan.</FieldDescription>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <AngkaMedan
          id="input_x_medan"
          label="Kiri (mm)"
          nilai={medan.x}
          ubah={(x) => onUbah(medan.id, { x })}
        />
        <AngkaMedan id="input_y_medan" label="Atas (mm)" nilai={medan.y} ubah={(y) => onUbah(medan.id, { y })} />
        <AngkaMedan
          id="input_w_medan"
          label="Lebar (mm)"
          nilai={medan.w}
          ubah={(w) => onUbah(medan.id, { w })}
        />
        <AngkaMedan
          id="input_h_medan"
          label="Tinggi (mm)"
          nilai={medan.h}
          ubah={(h) => onUbah(medan.id, { h })}
        />
      </div>

      <div>
        <FieldLabel htmlFor="select_halaman_medan">Halaman</FieldLabel>
        <Select
          value={String(medan.halaman)}
          disabled={modeBaca}
          onValueChange={(v) => onUbah(medan.id, { halaman: Number(v) })}
        >
          <SelectTrigger id="select_halaman_medan" aria-label="Halaman medan" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: Math.max(1, jumlahHalaman) }, (_, i) => i + 1).map((n) => (
              <SelectItem key={n} value={String(n)}>
                Halaman {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {perluGaya && (
        <>
          <div>
            <FieldLabel htmlFor="select_font_medan">Font</FieldLabel>
            <Select value={gaya.font} disabled={modeBaca} onValueChange={(v) => onUbahGaya(medan.id, { font: v as GayaMedan['font'] })}>
              <SelectTrigger id="select_font_medan" aria-label="Font medan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_PDF.map((f) => (
                  <SelectItem key={f} value={f}>
                    {LABEL_FONT[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Font harus tersedia di PDF; huruf yang tidak didukung berisiko tidak tercetak.</FieldDescription>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <AngkaMedan
              id="input_ukuran_medan"
              label="Ukuran (pt)"
              nilai={gaya.ukuran}
              langkah={0.5}
              ubah={(ukuran) => onUbahGaya(medan.id, { ukuran })}
            />
            <AngkaMedan
              id="input_baris_medan"
              label="Tinggi baris"
              nilai={gaya.baris}
              langkah={0.1}
              ubah={(baris) => onUbahGaya(medan.id, { baris })}
            />
          </div>

          <div>
            <FieldLabel htmlFor="select_rata_medan">Perataan</FieldLabel>
            <Select value={gaya.rata} disabled={modeBaca} onValueChange={(v) => onUbahGaya(medan.id, { rata: v as Rata })}>
              <SelectTrigger id="select_rata_medan" aria-label="Perataan teks" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATA.map((r) => (
                  <SelectItem key={r} value={r}>
                    {LABEL_RATA[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id="checkbox_tebal_medan"
                checked={gaya.tebal}
                disabled={modeBaca}
                onCheckedChange={(tebal) => onUbahGaya(medan.id, { tebal: Boolean(tebal) })}
              />
              Tebal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id="checkbox_miring_medan"
                checked={gaya.miring}
                disabled={modeBaca}
                onCheckedChange={(miring) => onUbahGaya(medan.id, { miring: Boolean(miring) })}
              />
              Miring
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id="checkbox_besar_medan"
                checked={gaya.huruf_besar}
                disabled={modeBaca}
                onCheckedChange={(huruf_besar) => onUbahGaya(medan.id, { huruf_besar: Boolean(huruf_besar) })}
              />
              Huruf besar
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id="checkbox_skala_medan"
                checked={gaya.skala_otomatis}
                disabled={modeBaca}
                onCheckedChange={(skala_otomatis) => onUbahGaya(medan.id, { skala_otomatis: Boolean(skala_otomatis) })}
              />
              Perkecil otomatis
            </label>
          </div>

          {gaya.skala_otomatis && (
            <AngkaMedan
              id="input_huruf_min_medan"
              label="Ukuran huruf minimum (pt)"
              nilai={gaya.huruf_min}
              langkah={0.5}
              ubah={(huruf_min) => onUbahGaya(medan.id, { huruf_min })}
            />
          )}
        </>
      )}

      <Separator />

      {medan.tipe === 'gambar' && (
        <div>
          <FieldLabel htmlFor="select_sizemode_medan">Cara menampilkan gambar</FieldLabel>
          <Select
            value={medan.sizemode ?? 'sesuaikan'}
            disabled={modeBaca}
            onValueChange={(v) => onUbah(medan.id, { sizemode: v as Sizemode })}
          >
            <SelectTrigger id="select_sizemode_medan" aria-label="Cara menampilkan gambar" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZEMODE.map((m) => (
                <SelectItem key={m} value={m}>
                  {LABEL_SIZEMODE[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {medan.tipe === 'centang' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel htmlFor="input_bawa_centang">Dicetak bila nilai</FieldLabel>
            <Input
              id="input_bawa_centang"
              value={medan.bawa ?? ''}
              disabled={modeBaca}
              onChange={(e) => onUbah(medan.id, { bawa: e.target.value })}
              placeholder="mis. L"
            />
          </div>
          <div>
            <FieldLabel htmlFor="input_huruf_centang">Tanda</FieldLabel>
            <Input
              id="input_huruf_centang"
              value={medan.huruf ?? ''}
              disabled={modeBaca}
              onChange={(e) => onUbah(medan.id, { huruf: e.target.value })}
              maxLength={8}
            />
          </div>
        </div>
      )}

      {medan.tipe === 'halaman_otomatis' && (
        <div>
          <FieldLabel htmlFor="input_format_halaman">Format</FieldLabel>
          <Input
            id="input_format_halaman"
            value={medan.format ?? ''}
            disabled={modeBaca}
            onChange={(e) => onUbah(medan.id, { format: e.target.value })}
          />
          <FieldDescription>
            Gunakan {'{halaman}'} untuk nomor halaman dan {'{jumlah}'} untuk jumlah halaman.
          </FieldDescription>
        </div>
      )}

      {TIPE_DEKORATIF.includes(medan.tipe) && (
        <>
          <p className="text-xs text-muted-foreground">
            {medan.tipe === 'garis'
              ? 'Panjang garis memakai lebar kotak dan tebal memakai tingginya.'
              : 'Isi medianya diisi medan lain. Warna isian boleh dikosongkan agar tetap transparan.'}
          </p>

          <AngkaMedan
            id="input_tebal_garis_medan"
            label={medan.tipe === 'garis' ? 'Tebal garis (mm)' : 'Tebal border (mm)'}
            nilai={gaya.tebal_mm}
            ubah={(nilai) => onUbahGaya(medan.id, { tebal_mm: nilai })}
            langkah={0.1}
            modeBaca={modeBaca}
          />

          {medan.tipe === 'kotak' && (
            <div>
              <FieldLabel htmlFor="input_warna_isi_medan">Warna isian</FieldLabel>
              <Input
                id="input_warna_isi_medan"
                type="color"
                value={gaya.isi ?? '#ffffff'}
                disabled={modeBaca}
                onChange={(e) => onUbahGaya(medan.id, { isi: e.target.value })}
                className="h-8 w-20 p-1"
              />
              <label className="flex items-center gap-2 pt-1 text-sm">
                <Checkbox
                  id="checkbox_isi_kosong_medan"
                  checked={gaya.isi === null}
                  disabled={modeBaca}
                  onCheckedChange={(benar) => onUbahGaya(medan.id, { isi: benar ? null : '#f1f1f1' })}
                />
                Tanpa isian
              </label>
            </div>
          )}

          <div>
            <FieldLabel htmlFor="input_warna_garis_medan">Warna garis</FieldLabel>
            <Input
              id="input_warna_garis_medan"
              type="color"
              value={gaya.warna}
              disabled={modeBaca}
              onChange={(e) => onUbahGaya(medan.id, { warna: e.target.value })}
              className="h-8 w-20 p-1"
            />
          </div>
        </>
      )}

      {TIPE_TANDA.includes(medan.tipe) ? (
        <FieldDescription>
          Medan ini hanya menandai tempat di kanvas dan tidak mencetak apa pun pada dokumen.
        </FieldDescription>
      ) : medan.tipe === 'baris_berulang' ? (
        <>
          <div>
            <FieldLabel htmlFor="select_koleksi_baris">Koleksi isi</FieldLabel>
            <Select
              value={medan.baris_berulang?.sumber ?? ''}
              disabled={modeBaca}
              onValueChange={(v) =>
                onUbah(medan.id, { baris_berulang: { ...medan.baris_berulang!, sumber: v } })
              }
            >
              <SelectTrigger id="select_koleksi_baris" aria-label="Koleksi baris" className="w-full">
                <SelectValue placeholder="Pilih daftar" />
              </SelectTrigger>
              <SelectContent>
                {(katalog?.koleksi ?? []).map((k) => (
                  <SelectItem key={k.kunci} value={k.kunci}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {koleksi?.catatan && <FieldDescription>{koleksi.catatan}</FieldDescription>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <AngkaMedan
              id="input_jumlah_baris"
              label="Jumlah baris"
              nilai={medan.baris_berulang?.jumlah ?? 10}
              ubah={(jumlah) => onUbah(medan.id, { baris_berulang: { ...medan.baris_berulang!, jumlah } })}
            />
            <AngkaMedan
              id="input_tinggi_baris"
              label="Tinggi baris (mm)"
              nilai={medan.baris_berulang?.tinggi_baris ?? 8}
              ubah={(tinggi_baris) => onUbah(medan.id, { baris_berulang: { ...medan.baris_berulang!, tinggi_baris } })}
            />
          </div>

          <ul className="grid gap-1 text-sm">
            {(medan.baris_berulang?.kolom ?? []).map((kolom, i) => (
              <li key={`${kolom.label}-${i}`} className="rounded border border-border px-2 py-1">
                <span className="font-medium">{kolom.label}</span>
                <span className="text-muted-foreground"> — {teksMm(kolom.w)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div>
            <FieldLabel htmlFor="select_sumber_medan">Sumber nilai</FieldLabel>
            <Select
              value={medan.sumber ?? ''}
              disabled={modeBaca}
              onValueChange={(v) => onUbah(medan.id, { sumber: v, kunci: null })}
            >
              <SelectTrigger id="select_sumber_medan" aria-label="Sumber nilai" className="w-full">
                <SelectValue placeholder="Pilih sumber" />
              </SelectTrigger>
              <SelectContent>
                {(katalog?.sumber ?? []).map((s) => (
                  <SelectItem key={s.kunci} value={s.kunci}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sumber?.catatan && <FieldDescription>{sumber.catatan}</FieldDescription>}
          </div>

          {medan.sumber === 'aset' && (
            <div>
              <FieldLabel htmlFor="pilih_aset_medan">Aset</FieldLabel>
              <ComboCari
                id="pilih_aset_medan"
                value={medan.kunci ?? ''}
                onChange={(kunci) => onUbah(medan.id, { kunci: kunci || null })}
                options={[
                  { value: '', label: 'Pilih aset' },
                  ...aset.map((satu) => ({ value: kunciAset(satu.id), label: satu.nama })),
                ]}
                className="w-full"
                kosongText={aset.length === 0 ? 'Pustaka aset masih kosong.' : undefined}
              />
              <FieldDescription>
                Logo, kop, stempel, atau tanda tangan dari pustaka aset.
              </FieldDescription>
            </div>
          )}

          {sumber && medan.sumber !== 'aset' && (
            <div>
              <FieldLabel htmlFor="pilih_kunci_medan">Medan</FieldLabel>
              <ComboCari
                id="pilih_kunci_medan"
                value={medan.kunci ?? ''}
                onChange={(kunci) => onUbah(medan.id, { kunci: kunci || null })}
                options={[
                  { value: '', label: 'Pilih medan' },
                  ...sumber.medan.map((m) => ({ value: m.kunci, label: m.label })),
                ]}
                className="w-full"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface AngkaMedanProps {
  id: string;
  label: string;
  nilai: number;
  ubah: (nilai: number) => void;
  langkah?: number;
  modeBaca?: boolean;
}

function AngkaMedan({ id, label, nilai, ubah, langkah = 0.5, modeBaca = false }: AngkaMedanProps) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={langkah}
        defaultValue={nilai}
        disabled={modeBaca}
        onBlur={(e) => ubah(bacaAngka(e.target.value, nilai))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            ubah(bacaAngka((e.target as HTMLInputElement).value, nilai));
          }
        }}
      />
    </div>
  );
}
