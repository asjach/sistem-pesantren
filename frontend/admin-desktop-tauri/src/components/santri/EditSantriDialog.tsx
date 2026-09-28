import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/api/client';
import { updateSantri, type SantriPenuh } from '@/api/santri';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BAGIAN_IDENTITAS, fieldUntuk } from '@/components/santri/bagianIdentitas';
import {
  SANTRI_IDENTITAS_FIELDS,
  TGL_KEYS,
  TURUNAN_KEYS,
  hanyaIdentitas,
  nilaiIdentitas,
} from '@/components/santri/kolomIdentitas';
import type { ExcelField } from '@/components/ExcelTable';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Label manusiawi untuk kunci yang di grid masih berupa nama kolom DB. */
const LABEL: Record<string, string> = {
  nama: 'Nama lengkap',
  nik: 'NIK',
  nisn: 'NISN',
  jk: 'Jenis kelamin',
  tipe_santri: 'Tipe santri',
  no_kk: 'No. KK',
  email_santri: 'Email',
};

/** Ubah detail santri: form identitas buku induk (kolom `santri`) memakai
 *  definisi kolom yang sama dengan Buku Induk agar label/validator seragam. */
export function EditSantriDialog({ santri, open, onOpenChange, onSaved }: {
  santri: SantriPenuh | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}) {
  const [nilai, setNilai] = useState<Record<string, string | null>>({});
  /** Nilai saat dialog dibuka — dipakai menandai baris yang sudah diubah
   *  (belum disimpan), seperti sel "dirty" di tabel utama. */
  const [awal, setAwal] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  const fields = useMemo(
    () => SANTRI_IDENTITAS_FIELDS.filter((f) => f.kind !== 'static' && !TURUNAN_KEYS.has(f.key)),
    [],
  );

  useEffect(() => {
    if (open && santri) {
      const v = nilaiIdentitas(santri);
      setNilai(v);
      setAwal(v);
    }
  }, [open, santri]);

  const ubah = (k: string, v: string) => setNilai((s) => ({ ...s, [k]: v }));

  /** true bila nilai field berubah sejak dialog dibuka. */
  const berubah = (k: string) => (nilai[k] ?? null) !== (awal[k] ?? null);


  async function simpan() {
    if (!santri) return;
    for (const f of fields) {
      const pesan = f.validate?.(nilai[f.key] ?? null);
      if (pesan) { toast.error(pesan); return; }
    }
    setBusy(true);
    try {
      const profil: Record<string, string | null> = hanyaIdentitas(nilai);
      await updateSantri(santri.id, profil);
      toast.success('Detail santri disimpan.');
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Ubah detail: {santri?.nama_lengkap}</DialogTitle>
          <DialogDescription>Identitas buku induk santri.</DialogDescription>
        </DialogHeader>
        {/* Area isi ber tinggi tetap + menggulir, sama seperti dialog profil:
           panjang form tidak membuat dialog memanjang/memendek. */}
        <form
          className="h-[60vh] min-h-72 space-y-6 overflow-y-auto pr-1"
          onSubmit={(e) => { e.preventDefault(); void simpan(); }}
        >
          {BAGIAN_IDENTITAS.map((b) => (
            <section key={b.judul} className="space-y-3">
              <h3 className="border-b pb-1 text-sm font-semibold">{b.judul}</h3>
              {/* Satu kolom: panel susun ke bawah, tiap panel melebar penuh
                  supaya baris label–kontrol punya ruang lega dan mudah dibaca. */}
              <div className="space-y-4">
                {b.panels.map((p) => {
                  // Panel boleh memuat kunci yang tidak punya kolom (mis. `id`
                  // pada profil) — dilewati, tidak bisa diedit.
                  const isi = p.kunci
                    .map((k) => ({ kunci: k, f: fieldUntuk(k) }))
                    .filter((x): x is { kunci: string; f: ExcelField } =>
                      x.f != null && x.f.kind !== 'static' && !TURUNAN_KEYS.has(x.f.key));
                  if (isi.length === 0) return null;
                  return (
                    <fieldset key={p.judul} className="min-w-0">
                      <legend className="mb-1.5 text-sm font-semibold">{p.judul}</legend>
                      {/* Tampilan tabel: label dan kontrol sebaris, baris
                          berdempet tanpa jarak — dipisah garis tipis, sama
                          seperti baris label–nilai pada dialog profil. */}
                      <div className="overflow-hidden rounded-lg border">
                        {isi.map(({ f }) => {
                          const id = `input_edit_santri_${f.key}`;
                          const val = nilai[f.key] ?? '';
                          const dirty = berubah(f.key);
                          // Kontrol TANPA kotak sendiri: garis baris yang jadi
                          // pemisah, sehingga tidak ada garis dobel dan kontrol
                          // tidak menumpuk. Fokus tetap jelas lewat
                          // latar + cincin tipis, dan nilai yang diubah diberi
                          // warna aksen (sel "dirty" di tabel utama).
                          const kelasKontrol = cn(
                            'h-6 w-full border-0 bg-transparent px-1.5 text-xs shadow-none',
                            'focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/50',
                            dirty && 'bg-accent/15',
                          );
                          const kontrol = f.kind === 'select' ? (
                            <Select
                              value={val === '' ? '_kosong' : val}
                              onValueChange={(v) => ubah(f.key, v === '_kosong' ? '' : v)}
                            >
                              <SelectTrigger id={id} className={kelasKontrol}>
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="_kosong">—</SelectItem>
                                  {(f.choices ?? []).map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={id}
                              className={kelasKontrol}
                              type={TGL_KEYS.has(f.key) ? 'date' : 'text'}
                              value={val}
                              maxLength={f.maxLength}
                              onChange={(e) => ubah(f.key, e.target.value)}
                            />
                          );
                          return (
                            <div
                              key={f.key}
                              className={cn(
                                'grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-2 border-t px-2.5 transition-colors hover:bg-muted/40',
                                dirty && 'bg-accent/10',
                              )}
                            >
                              <FieldLabel
                                htmlFor={id}
                                className="truncate text-xs leading-4 text-muted-foreground"
                                title={LABEL[f.key] ?? f.label}
                              >
                                {LABEL[f.key] ?? f.label}
                              </FieldLabel>
                              {kontrol}
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            </section>
          ))}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button id="btn_simpan_edit_santri" type="button" disabled={busy} onClick={() => void simpan()}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
