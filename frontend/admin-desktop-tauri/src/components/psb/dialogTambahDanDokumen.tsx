import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PsbCalon, PsbGelombang } from '@/api/psb';
import type { DokumenSantri } from '@/api/santri';
import type { Lembaga } from '@/api/master';

/** Dialog tambah pendaftar manual (jalur admin tanpa pendaftaran publik). */
export function DialogTambahPendaftar({ open, gelombangs, lembagas, busy, f, set, onClose, onSubmit }: {
  open: boolean;
  gelombangs: PsbGelombang[];
  lembagas: Lembaga[];
  busy: boolean;
  f: {
    gelombang: string; lembaga: string; tipe: 'asrama' | 'non_asrama'; nik: string; nama: string;
    jk: string; tglLahir: string; email: string; telp: string; ayah: string; ibu: string;
    pindahan: boolean; tingkat: string;
  };
  set: {
    gelombang: (v: string) => void; lembaga: (v: string) => void; tipe: (v: 'asrama' | 'non_asrama') => void;
    nik: (v: string) => void; nama: (v: string) => void; jk: (v: string) => void;
    tglLahir: (v: string) => void; email: (v: string) => void; telp: (v: string) => void;
    ayah: (v: string) => void; ibu: (v: string) => void; pindahan: (v: boolean) => void;
    tingkat: (v: string) => void;
  };
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah pendaftar (input admin)</DialogTitle>
          <DialogDescription>
            Jalur manual tanpa pendaftaran publik. Kuota & dedup NIK tetap berlaku.
          </DialogDescription>
        </DialogHeader>
        <form id="form_tambah_pendaftar" onSubmit={onSubmit} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
          <FieldLabel htmlFor="select_gelombang_pendaftar">Gelombang</FieldLabel>
          <Select value={f.gelombang} onValueChange={set.gelombang}>
            <SelectTrigger id="select_gelombang_pendaftar" className="w-full">
              <SelectValue placeholder="Pilih gelombang" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {gelombangs.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.nama}{g.tahun_ajaran ? ` — ${g.tahun_ajaran.nama}` : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="select_lembaga_pendaftar">Lembaga tujuan</FieldLabel>
          <Select value={f.lembaga} onValueChange={set.lembaga}>
            <SelectTrigger id="select_lembaga_pendaftar" className="w-full">
              <SelectValue placeholder="Pilih lembaga" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {lembagas.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="select_tipe_pendaftar">Tipe santri</FieldLabel>
          <Select value={f.tipe} onValueChange={(v) => set.tipe(v as 'asrama' | 'non_asrama')}>
            <SelectTrigger id="select_tipe_pendaftar" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="non_asrama">Non asrama</SelectItem>
                <SelectItem value="asrama">Asrama</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="input_nik_pendaftar">NIK (16 digit)</FieldLabel>
          <Input
            id="input_nik_pendaftar"
            value={f.nik}
            onChange={(e) => set.nik(e.target.value)}
            inputMode="numeric"
            minLength={16}
            maxLength={16}
            required
          />
          <FieldLabel htmlFor="input_nama_pendaftar">Nama lengkap</FieldLabel>
          <Input id="input_nama_pendaftar" value={f.nama} onChange={(e) => set.nama(e.target.value)} required maxLength={100} />
          <FieldLabel htmlFor="select_jk_pendaftar">Jenis kelamin</FieldLabel>
          <Select value={f.jk === '' ? '_kosong' : f.jk} onValueChange={(v) => set.jk(v === '_kosong' ? '' : v)}>
            <SelectTrigger id="select_jk_pendaftar" className="w-full">
              <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_kosong">-</SelectItem>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="input_tgl_lahir_pendaftar">Tanggal lahir</FieldLabel>
          <Input id="input_tgl_lahir_pendaftar" type="date" value={f.tglLahir} onChange={(e) => set.tglLahir(e.target.value)} />
          <FieldLabel htmlFor="input_email_ortu_pendaftar">Email orang tua</FieldLabel>
          <Input id="input_email_ortu_pendaftar" type="email" value={f.email} onChange={(e) => set.email(e.target.value)} maxLength={100} />
          <FieldLabel htmlFor="input_telp_ortu_pendaftar">No. HP orang tua</FieldLabel>
          <Input id="input_telp_ortu_pendaftar" value={f.telp} onChange={(e) => set.telp(e.target.value)} maxLength={20} />
          <FieldLabel htmlFor="input_ayah_pendaftar">Nama ayah</FieldLabel>
          <Input id="input_ayah_pendaftar" value={f.ayah} onChange={(e) => set.ayah(e.target.value)} maxLength={100} />
          <FieldLabel htmlFor="input_ibu_pendaftar">Nama ibu</FieldLabel>
          <Input id="input_ibu_pendaftar" value={f.ibu} onChange={(e) => set.ibu(e.target.value)} maxLength={100} />
          <FieldLabel htmlFor="check_pindahan_pendaftar">Pindahan</FieldLabel>
          <label htmlFor="check_pindahan_pendaftar" className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              id="check_pindahan_pendaftar"
              type="checkbox"
              checked={f.pindahan}
              onChange={(e) => set.pindahan(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            <span className="text-muted-foreground">Bukan santri baru</span>
          </label>
          {f.pindahan && (
            <>
              <FieldLabel htmlFor="input_tingkat_pendaftar">Masuk tingkat</FieldLabel>
              <Input
                id="input_tingkat_pendaftar"
                value={f.tingkat}
                onChange={(e) => set.tingkat(e.target.value)}
                maxLength={2}
                placeholder="mis. 3"
              />
            </>
          )}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button
              id="btn_simpan_pendaftar"
              type="submit"
              disabled={busy || !f.gelombang || !f.lembaga || f.nik.trim().length !== 16 || !f.nama.trim()}
            >
              Simpan pendaftar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog dokumen calon: daftar dokumen + aksi validasi/tolak. */
export function DialogDokumenCalon({ calon, dokumen, busy, onClose, onVerifikasi }: {
  calon: PsbCalon | null;
  dokumen: DokumenSantri[];
  busy: boolean;
  onClose: () => void;
  onVerifikasi: (id: number, status: 'valid' | 'ditolak') => void;
}) {
  return (
    <Dialog open={calon !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dokumen: {calon?.nama_lengkap}</DialogTitle>
          <DialogDescription className="sr-only">
            Daftar dokumen calon beserta status verifikasi dan aksinya.
          </DialogDescription>
        </DialogHeader>
        {dokumen.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada dokumen diupload.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {dokumen.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                <span className="font-medium">{d.jenis_dokumen_santri}</span>
                <span className="text-muted-foreground">{d.status_verifikasi}</span>
                <div className="ml-auto flex gap-1.5">
                  <Button
                    id={`btn_dok_valid_${d.id}`}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onVerifikasi(d.id, 'valid')}
                  >
                    Valid
                  </Button>
                  <Button
                    id={`btn_dok_tolak_${d.id}`}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onVerifikasi(d.id, 'ditolak')}
                  >
                    Tolak
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
