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
import {
  SANTRI_IDENTITAS_FIELDS,
  TGL_KEYS,
  TURUNAN_KEYS,
  hanyaIdentitas,
  nilaiIdentitas,
} from '@/components/santri/kolomIdentitas';
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
  const [busy, setBusy] = useState(false);

  const fields = useMemo(
    () => SANTRI_IDENTITAS_FIELDS.filter((f) => f.kind !== 'static' && !TURUNAN_KEYS.has(f.key)),
    [],
  );

  useEffect(() => {
    if (open && santri) setNilai(nilaiIdentitas(santri));
  }, [open, santri]);

  const ubah = (k: string, v: string) => setNilai((s) => ({ ...s, [k]: v }));

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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ubah detail: {santri?.nama_lengkap}</DialogTitle>
          <DialogDescription>Identitas buku induk santri.</DialogDescription>
        </DialogHeader>
        <form
          className="grid max-h-[60vh] grid-cols-1 gap-x-6 gap-y-3 overflow-y-auto pr-1 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); void simpan(); }}
        >
          {fields.map((f) => {
            const id = `input_edit_santri_${f.key}`;
            const val = nilai[f.key] ?? '';
            return (
              <div key={f.key} className="grid gap-1.5">
                <FieldLabel htmlFor={id}>{LABEL[f.key] ?? f.label}</FieldLabel>
                {f.kind === 'select' ? (
                  <Select value={val === '' ? '_kosong' : val} onValueChange={(v) => ubah(f.key, v === '_kosong' ? '' : v)}>
                    <SelectTrigger id={id}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="_kosong">—</SelectItem>
                        {(f.choices ?? []).map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={id}
                    type={TGL_KEYS.has(f.key) ? 'date' : 'text'}
                    value={val}
                    maxLength={f.maxLength}
                    onChange={(e) => ubah(f.key, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button id="btn_simpan_edit_santri" type="button" disabled={busy} onClick={() => void simpan()}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
