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
import type { PsbCalon } from '@/api/psb';

/** Dialog konfirmasi hasil seleksi saat calon masuk daftar ulang. */
export function DialogDaftarUlangSeleksi({ calon, lolos, catatan, busy, onLolos, onCatatan, onClose, onSubmit }: {
  calon: PsbCalon | null;
  lolos: string;
  catatan: string;
  busy: boolean;
  onLolos: (v: string) => void;
  onCatatan: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={calon !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Masuk daftar ulang: {calon?.nama_lengkap}</DialogTitle>
          <DialogDescription>
            Lembaga ini memiliki tes/seleksi — tentukan hasilnya. Lolos = masuk fase daftar ulang; tidak lolos = ditolak.
          </DialogDescription>
        </DialogHeader>
        <form id="form_daftar_ulang_psb" onSubmit={onSubmit} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
          <FieldLabel htmlFor="select_hasil_seleksi">Hasil seleksi</FieldLabel>
          <Select value={lolos} onValueChange={onLolos}>
            <SelectTrigger id="select_hasil_seleksi" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="lolos">Lolos</SelectItem>
                <SelectItem value="tidak_lolos">Tidak lolos</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="input_catatan_seleksi">Catatan (opsional)</FieldLabel>
          <Input id="input_catatan_seleksi" value={catatan} onChange={(e) => onCatatan(e.target.value)} />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_simpan_daftar_ulang_psb" type="submit" disabled={busy}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog pembatalan fase calon (kembali ke fase sebelumnya). */
export function DialogBatalkanFase({ calon, catatan, busy, onCatatan, onClose, onSubmit }: {
  calon: PsbCalon | null;
  catatan: string;
  busy: boolean;
  onCatatan: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={calon !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batalkan fase: {calon?.nama_lengkap}</DialogTitle>
          <DialogDescription className="sr-only">
            Calon dikembalikan ke fase sebelumnya berdasarkan riwayat status.
          </DialogDescription>
        </DialogHeader>
        <form id="form_batal_fase_psb" onSubmit={onSubmit} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
          <FieldLabel htmlFor="input_catatan_batal_fase">Catatan (opsional)</FieldLabel>
          <Input id="input_catatan_batal_fase" value={catatan} onChange={(e) => onCatatan(e.target.value)} maxLength={255} />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Tutup</Button>
            <Button id="btn_simpan_batal_fase_psb" type="submit" disabled={busy}>Batalkan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog pengunduran diri calon (dengan tampilan galat). */
export function DialogUndurDiri({ calon, catatan, busy, err, onCatatan, onClose, onSubmit }: {
  calon: PsbCalon | null;
  catatan: string;
  busy: boolean;
  err: string;
  onCatatan: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={calon !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pengunduran diri: {calon?.nama_lengkap}</DialogTitle>
          <DialogDescription>
            Calon dipindahkan ke fase Mengundurkan Diri / Ditolak. Catatan/alasan bersifat opsional.
          </DialogDescription>
        </DialogHeader>
        <form id="form_undur_diri_psb" onSubmit={onSubmit} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
          <FieldLabel htmlFor="input_catatan_undur">Catatan / alasan (opsional)</FieldLabel>
          <Input id="input_catatan_undur" value={catatan} onChange={(e) => onCatatan(e.target.value)} maxLength={255} />
          {err ? (
            <p id="error_undur_psb" className="col-span-2 text-sm text-destructive" role="alert">{err}</p>
          ) : null}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_simpan_undur_psb" type="submit" variant="destructive" disabled={busy}>Mengundurkan Diri</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog ACC jadi santri: daftar calon + isian NIS opsional (tunggal maupun massal). */
export function DialogAccSantri({ rows, nis, proses, onNis, onClose, onSubmit }: {
  rows: PsbCalon[] | null;
  nis: Record<string, string>;
  proses: boolean;
  onNis: (id: number, v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={rows !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {rows?.length === 1 ? `ACC jadi santri: ${rows[0]?.nama_lengkap}` : 'ACC jadi santri (massal)'}
          </DialogTitle>
          <DialogDescription>
            Isi NIS bila sudah tersedia — boleh dikosongkan lalu diisi menyusul lewat import Excel.
            {rows && rows.length > 1 ? ` ${rows.length} calon akan diproses.` : ''}
          </DialogDescription>
        </DialogHeader>
        <form id="form_acc_psb" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex flex-col gap-3">
          <ul className="max-h-72 divide-y overflow-auto rounded-md border">
            {(rows ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-2 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.nama_lengkap}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.no_pendaftaran ?? `#${c.id}`}</p>
                </div>
                <Input
                  id={`input_nis_acc_${c.id}`}
                  className="w-36"
                  maxLength={20}
                  placeholder="NIS (opsional)"
                  value={nis[String(c.id)] ?? ''}
                  onChange={(e) => onNis(c.id, e.target.value)}
                />
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_proses_acc_psb" type="submit" disabled={proses}>
              {proses ? 'Memproses…' : rows && rows.length > 1 ? `ACC ${rows.length} calon` : 'ACC jadi santri'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
