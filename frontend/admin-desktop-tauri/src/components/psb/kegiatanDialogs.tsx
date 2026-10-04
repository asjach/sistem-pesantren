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
import MultiSelect from '@/components/MultiSelect';
import type { PsbGelombangMaster, PsbKegiatan, PsbKuotaBiayaRow } from '@/api/psb';
import type { TahunAjaran } from '@/api/master';

/** Dialog tambah/ubah kegiatan PSB (satu per tahun ajaran). */
export function DialogKegiatan({ open, edit, taTersedia, nama, ta, aktif, busy, onNama, onTa, onAktif, onClose, onSubmit }: {
  open: boolean;
  edit: PsbKegiatan | null;
  taTersedia: TahunAjaran[];
  nama: string;
  ta: string;
  aktif: boolean;
  busy: boolean;
  onNama: (v: string) => void;
  onTa: (v: string) => void;
  onAktif: (v: boolean) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{edit ? 'Ubah kegiatan PSB' : 'Tambah kegiatan PSB'}</DialogTitle>
          <DialogDescription className="sr-only">Formulir kegiatan PSB.</DialogDescription>
        </DialogHeader>
        <form id="form_kegiatan_psb" onSubmit={onSubmit} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
          <FieldLabel htmlFor="select_ta_kegiatan_psb" className="self-start pt-1.5">Tahun ajaran (pesantren)</FieldLabel>
          <div className="flex flex-col gap-1.5">
            <Select value={ta} onValueChange={onTa} disabled={!!edit}>
              <SelectTrigger id="select_ta_kegiatan_psb" className="w-full">
                <SelectValue placeholder="Pilih tahun ajaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {taTersedia.map((t) => (
                    <SelectItem key={t.nama} value={t.nama}>{t.nama}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Satu tahun ajaran hanya untuk satu kegiatan PSB (se-pesantren).</p>
          </div>
          <FieldLabel htmlFor="input_nama_kegiatan_psb">Nama kegiatan (otomatis dari tahun ajaran)</FieldLabel>
          <Input id="input_nama_kegiatan_psb" value={nama} onChange={(e) => onNama(e.target.value)} required maxLength={100} placeholder="PSB 2026/2027" disabled={!ta} />
          <FieldLabel htmlFor="chk_aktif_kegiatan_psb">Aktif</FieldLabel>
          <label htmlFor="chk_aktif_kegiatan_psb" className="flex cursor-pointer items-center gap-2 text-sm">
            <input id="chk_aktif_kegiatan_psb" type="checkbox" checked={aktif} onChange={(e) => onAktif(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            <span className="text-muted-foreground">Jadikan kegiatan aktif (hanya satu kegiatan aktif)</span>
          </label>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_simpan_kegiatan_psb" type="submit" disabled={busy || !ta}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog tambah/ubah gelombang PSB (nama + periode buka/tutup). */
export function DialogGelombang({ open, edit, nama, buka, tutup, busy, onNama, onBuka, onTutup, onClose, onSubmit }: {
  open: boolean;
  edit: PsbGelombangMaster | null;
  nama: string;
  buka: string;
  tutup: string;
  busy: boolean;
  onNama: (v: string) => void;
  onBuka: (v: string) => void;
  onTutup: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{edit ? 'Ubah gelombang' : 'Tambah gelombang'}</DialogTitle>
          <DialogDescription className="sr-only">Formulir gelombang PSB.</DialogDescription>
        </DialogHeader>
        <form id="form_gelombang_psb" onSubmit={onSubmit} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
          <FieldLabel htmlFor="input_nama_gelombang_psb">Nama gelombang</FieldLabel>
          <Input id="input_nama_gelombang_psb" value={nama} onChange={(e) => onNama(e.target.value)} required maxLength={100} placeholder="Gelombang 1" />
          <FieldLabel htmlFor="input_buka_gelombang_psb">Tanggal buka</FieldLabel>
          <Input id="input_buka_gelombang_psb" type="date" value={buka} onChange={(e) => onBuka(e.target.value)} required />
          <FieldLabel htmlFor="input_tutup_gelombang_psb">Tanggal tutup</FieldLabel>
          <Input id="input_tutup_gelombang_psb" type="date" value={tutup} onChange={(e) => onTutup(e.target.value)} required />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_simpan_gelombang_psb" type="submit" disabled={busy}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog tambah/ubah kuota per lembaga + tipe santri (termasuk paket MI-MD). */
export function DialogKuota({ open, edit, terkunci, lembagaOpsi, lembagas, tipe, kuota, paket, seleksi, pemberkasan, busy, onLembagas, onTipe, onKuota, onPaket, onSeleksi, onPemberkasan, onClose, onSubmit }: {
  open: boolean;
  edit: PsbKuotaBiayaRow | null;
  terkunci: boolean;
  lembagaOpsi: { jenjang: string; nama: string }[];
  lembagas: string[];
  tipe: 'semua' | 'asrama' | 'non_asrama';
  kuota: string;
  paket: boolean;
  seleksi: string;
  pemberkasan: string;
  busy: boolean;
  onLembagas: (v: string[]) => void;
  onTipe: (v: 'semua' | 'asrama' | 'non_asrama') => void;
  onKuota: (v: string) => void;
  onPaket: (v: boolean) => void;
  onSeleksi: (v: string) => void;
  onPemberkasan: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edit ? 'Ubah kuota' : 'Tambah kuota'}</DialogTitle>
          <DialogDescription className="sr-only">Formulir kuota per lembaga.</DialogDescription>
        </DialogHeader>
        <form id="form_kuota_psb" onSubmit={onSubmit} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
          <FieldLabel htmlFor="select_lembaga_kuota">Lembaga (bisa pilih beberapa)</FieldLabel>
          <MultiSelect
            id="select_lembaga_kuota"
            title="Lembaga"
            values={lembagas}
            onChange={onLembagas}
            disabled={!!edit || terkunci}
            placeholder="Pilih lembaga"
            options={lembagaOpsi.map((l) => ({ value: l.jenjang, label: `${l.jenjang} — ${l.nama}` }))}
          />
          <FieldLabel htmlFor="select_tipe_kuota">Tipe santri</FieldLabel>
          <Select value={tipe} onValueChange={(v) => onTipe(v as 'semua' | 'asrama' | 'non_asrama')} disabled={!!edit}>
            <SelectTrigger id="select_tipe_kuota" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="non_asrama">Non asrama</SelectItem>
                <SelectItem value="asrama">Asrama</SelectItem>
                <SelectItem value="semua">Semua</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="input_kuota_psb">Kuota pool (kosong = tanpa batas)</FieldLabel>
          <Input id="input_kuota_psb" type="number" min={0} value={kuota} onChange={(e) => onKuota(e.target.value)} placeholder="100" />
          <FieldLabel htmlFor="chk_paket_psb">Paket MI-MD</FieldLabel>
          <label htmlFor="chk_paket_psb" className="flex cursor-pointer items-center gap-2 text-sm">
            <input id="chk_paket_psb" type="checkbox" checked={paket} onChange={(e) => onPaket(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            <span className="text-muted-foreground">Tawarkan paket MI-MD (baris primer MI)</span>
          </label>
          <FieldLabel htmlFor="select_seleksi_psb">Membutuhkan seleksi</FieldLabel>
          <Select value={seleksi} onValueChange={onSeleksi}>
            <SelectTrigger id="select_seleksi_psb" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="default">Ikut lembaga</SelectItem>
                <SelectItem value="ya">Ya</SelectItem>
                <SelectItem value="tidak">Tidak</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="select_pemberkasan_psb">Membutuhkan pemberkasan</FieldLabel>
          <Select value={pemberkasan} onValueChange={onPemberkasan}>
            <SelectTrigger id="select_pemberkasan_psb" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ya">Ya</SelectItem>
                <SelectItem value="tidak">Tidak</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_simpan_kuota_psb" type="submit" disabled={busy}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
