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
import type { BulkAksi } from '@/components/psb/bersama';
import type { BulkHasil } from '@/api/psb';

/** Judul dialog per jenis aksi massal. */
function judulBulk(aksi: BulkAksi): string {
  return aksi === 'verifikasi' ? 'Verifikasi massal'
    : aksi === 'daftar_ulang' ? 'Masuk daftar ulang massal'
      : aksi === 'acc' ? 'ACC daftar ulang massal'
        : aksi === 'undur' ? 'Pengunduran diri massal'
          : aksi === 'batal' ? 'Batalkan fase massal'
            : aksi === 'hapus' ? 'Hapus massal'
              : 'Pulihkan massal';
}

/** Dialog konfirmasi aksi massal (verifikasi/daftar ulang/undur/batal/hapus/pulihkan). */
export function DialogBulkKonfirmasi({ aksi, ids, lolos, catatan, butuhSeleksi, proses, onLolos, onCatatan, onClose, onProses }: {
  aksi: BulkAksi | null;
  ids: number[];
  lolos: string;
  catatan: string;
  butuhSeleksi: boolean;
  proses: boolean;
  onLolos: (v: string) => void;
  onCatatan: (v: string) => void;
  onClose: () => void;
  onProses: () => void;
}) {
  return (
    <Dialog open={aksi !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{aksi ? judulBulk(aksi) : ''}</DialogTitle>
          <DialogDescription>
            {ids.length} calon terpilih akan diproses.
            {aksi === 'hapus' ? ' Calon dihapus (soft delete).' : ''}
            {aksi === 'undur' ? ' Calon dipindahkan ke fase Mengundurkan Diri / Ditolak.' : ''}
            {aksi === 'batal' ? ' Calon dikembalikan ke fase sebelumnya (fase diterima tidak bisa dibatalkan).' : ''}
            {aksi === 'daftar_ulang' && butuhSeleksi ? ' Sebagian lembaga memiliki seleksi — tentukan hasilnya.' : ''}
          </DialogDescription>
        </DialogHeader>
        {(aksi === 'daftar_ulang' && butuhSeleksi) || aksi === 'undur' || aksi === 'batal' ? (
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            {aksi === 'daftar_ulang' && butuhSeleksi ? (
              <>
                <FieldLabel htmlFor="select_bulk_hasil_seleksi">Hasil seleksi</FieldLabel>
                <Select value={lolos} onValueChange={onLolos}>
                  <SelectTrigger id="select_bulk_hasil_seleksi" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="lolos">Lolos</SelectItem>
                      <SelectItem value="tidak_lolos">Tidak lolos</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </>
            ) : null}
            <FieldLabel htmlFor="input_bulk_catatan_psb">Catatan (opsional)</FieldLabel>
            <Input id="input_bulk_catatan_psb" value={catatan} onChange={(e) => onCatatan(e.target.value)} />
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button
            id="btn_proses_bulk_psb"
            variant={aksi === 'hapus' || aksi === 'undur' ? 'destructive' : 'default'}
            disabled={proses}
            onClick={onProses}
          >
            {proses ? 'Memproses…' : `Proses ${ids.length} calon`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog hasil proses massal (ringkasan berhasil/gagal per calon). */
export function DialogBulkHasil({ hasil, onClose }: {
  hasil: BulkHasil | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={hasil !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Hasil proses massal</DialogTitle>
          <DialogDescription>
            {hasil?.berhasil.length ?? 0} berhasil · {hasil?.gagal.length ?? 0} gagal
          </DialogDescription>
        </DialogHeader>
        {hasil && hasil.gagal.length > 0 ? (
          <ul className="max-h-64 divide-y overflow-auto rounded-md border text-xs">
            {hasil.gagal.map((g) => (
              <li key={g.id} className="flex flex-col gap-0.5 p-2">
                <span className="font-medium">
                  {g.nama_lengkap ?? `#${g.id}`}{g.no_pendaftaran ? ` · ${g.no_pendaftaran}` : ''}
                </span>
                <span className="text-xs text-destructive">{g.pesan}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Semua calon berhasil diproses.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
