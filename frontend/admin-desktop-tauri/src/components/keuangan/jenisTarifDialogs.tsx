import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/client';
import {
  buatJenis, buatTarif, ubahJenis, ubahTarif,
  type JenisTagihan, type Tarif,
} from '@/api/keuangan';
import type { Lembaga, TahunAjaran } from '@/api/master';
import type { PilihanLembaga } from '@/lembagaAktif';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/* Dialog form jenis tagihan & tarif halaman Keuangan.
 *
 * Diekstrak dari `KeuanganPage` tanpa mengubah perilaku: seluruh `id` elemen,
 * teks, urutan field, dan alur simpan (toast → tutup → muat ulang) tetap sama.
 * Dialog hanya dirender saat terbuka, jadi state field di dalamnya otomatis
 * ter-reset saat dibuka lagi — setara dengan reset manual di halaman dulu.
 * Nilai yang memang bertahan lintas buka (jenjang & tahun ajaran pada form
 * Tambah Tarif) tetap dikendalikan halaman lewat props. */

/** Dialog Tambah Tarif: jenjang + tahun ajaran (dikendalikan halaman) + jenis & nominal (lokal). */
export function DialogTambahTarif({
  onClose, onSukses, jenis, lembagas, daftarTA, pilihanLembaga, jenjang, ta, onJenjang, onTa,
}: {
  onClose: () => void;
  onSukses: () => void | Promise<void>;
  jenis: JenisTagihan[];
  lembagas: Lembaga[];
  daftarTA: TahunAjaran[];
  pilihanLembaga: PilihanLembaga[];
  jenjang: string;
  ta: string;
  onJenjang: (v: string) => void;
  onTa: (v: string) => void;
}) {
  const [jenisId, setJenisId] = useState<number | ''>('');
  const [nominal, setNominal] = useState('');

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Tarif</DialogTitle>
          <DialogDescription className="sr-only">Formulir penambahan tarif tagihan.</DialogDescription>
        </DialogHeader>
        <form id="form_tambah_tarif" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); if (jenisId === '') return; try { await buatTarif({ jenjang, tahun_ajaran: ta, jenis_id: Number(jenisId), nominal: Number(nominal) }); toast.success('Tarif dibuat.'); onClose(); await onSukses(); } catch (e2) { toast.error(errorMessage(e2)); } }}>
          <FieldLabel htmlFor="sel_tarif_jenjang">Jenjang</FieldLabel>
          <Select value={jenjang} onValueChange={onJenjang}>
            <SelectTrigger id="sel_tarif_jenjang" aria-label="Jenjang" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lembagas.filter((l) => pilihanLembaga.some((p) => p.jenjang === l.jenjang)).map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="sel_tarif_ta">Tahun Ajaran</FieldLabel>
          <Select value={ta} onValueChange={onTa}>
            <SelectTrigger id="sel_tarif_ta" aria-label="Tahun Ajaran" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {daftarTA.map((x) => <SelectItem key={x.nama} value={x.nama}>{x.nama}{x.is_aktif ? ' (aktif)' : ''}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="sel_tarif_jenis">Jenis</FieldLabel>
          <Select value={jenisId === '' ? '' : String(jenisId)} onValueChange={(v) => setJenisId(v === '' ? '' : Number(v))}>
            <SelectTrigger id="sel_tarif_jenis" aria-label="Jenis" className="h-8 text-sm">
              <SelectValue placeholder="Jenis…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Jenis…</SelectItem>
              {jenis.filter((j) => j.jenjang === null || j.jenjang === jenjang).map((j) => <SelectItem key={j.id} value={String(j.id)}>{j.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="inp_tarif_nominal">Nominal</FieldLabel>
          <Input id="inp_tarif_nominal" type="number" value={nominal} onChange={(e) => setNominal(e.target.value)} required />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_tarif_simpan" type="submit">Tambah</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog Tambah Jenis Tagihan; lembaga awal mengikuti peran lembaga aktif. */
export function DialogTambahJenis({
  onClose, onSukses, pilihanLembaga, efektifSuper, peranJenjang,
}: {
  onClose: () => void;
  onSukses: () => void | Promise<void>;
  pilihanLembaga: PilihanLembaga[];
  efektifSuper: boolean;
  peranJenjang: string | null;
}) {
  const [nama, setNama] = useState('');
  const [tipe, setTipe] = useState<'bulanan' | 'non_bulanan'>('non_bulanan');
  const [lembaga, setLembaga] = useState(peranJenjang ?? '');

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Jenis Tagihan</DialogTitle>
          <DialogDescription className="sr-only">Formulir penambahan jenis tagihan.</DialogDescription>
        </DialogHeader>
        <form id="form_tambah_jenis" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); if (!nama) return; try { await buatJenis(nama, tipe, lembaga === '' ? null : lembaga); toast.success('Jenis dibuat.'); onClose(); await onSukses(); } catch (e2) { toast.error(errorMessage(e2)); } }}>
          <FieldLabel htmlFor="inp_jenis_nama">Nama</FieldLabel>
          <Input id="inp_jenis_nama" placeholder="mis. HIPA" value={nama} required onChange={(e) => setNama(e.target.value)} />
          <FieldLabel htmlFor="sel_jenis_tipe">Tipe</FieldLabel>
          <Select value={tipe} onValueChange={(v) => setTipe(v as 'bulanan' | 'non_bulanan')}>
            <SelectTrigger id="sel_jenis_tipe" aria-label="Tipe" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="non_bulanan">Non-bulanan</SelectItem>
              <SelectItem value="bulanan">Bulanan</SelectItem>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="sel_jenis_lembaga">Lembaga</FieldLabel>
          <Select value={lembaga} onValueChange={setLembaga}>
            <SelectTrigger id="sel_jenis_lembaga" aria-label="Lembaga" className="h-8 text-sm">
              <SelectValue placeholder="Lembaga…" />
            </SelectTrigger>
            <SelectContent>
              {efektifSuper ? <SelectItem value="">Semua (global)</SelectItem> : null}
              {pilihanLembaga.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_jenis_simpan" type="submit">Tambah</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog Ubah Jenis Tagihan; nilai awal dari baris terpilih. */
export function DialogUbahJenis({
  item, onClose, onSukses, pilihanLembaga, efektifSuper,
}: {
  item: JenisTagihan;
  onClose: () => void;
  onSukses: () => void | Promise<void>;
  pilihanLembaga: PilihanLembaga[];
  efektifSuper: boolean;
}) {
  const [nama, setNama] = useState(item.nama);
  const [tipe, setTipe] = useState<'bulanan' | 'non_bulanan'>(item.tipe);
  const [jenjang, setJenjang] = useState(item.jenjang ?? '');
  const [aktif, setAktif] = useState(item.is_active);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Ubah Jenis Tagihan</DialogTitle></DialogHeader>
        <form id="form_ubah_jenis" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); try { await ubahJenis(item.id, { nama, tipe, jenjang: jenjang === '' ? null : jenjang, is_active: aktif }); toast.success('Tersimpan.'); onClose(); await onSukses(); } catch (e2) { toast.error(errorMessage(e2)); } }}>
          <FieldLabel htmlFor="inp_jenis_edit_nama">Nama</FieldLabel>
          <Input id="inp_jenis_edit_nama" value={nama} onChange={(e) => setNama(e.target.value)} required />
          <FieldLabel htmlFor="sel_jenis_edit_tipe">Tipe</FieldLabel>
          <Select value={tipe} onValueChange={(v) => setTipe(v as 'bulanan' | 'non_bulanan')}>
            <SelectTrigger id="sel_jenis_edit_tipe" aria-label="Tipe" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="non_bulanan">Non-bulanan</SelectItem>
              <SelectItem value="bulanan">Bulanan</SelectItem>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="sel_jenis_edit_lembaga">Lembaga</FieldLabel>
          <Select value={jenjang} onValueChange={setJenjang}>
            <SelectTrigger id="sel_jenis_edit_lembaga" aria-label="Lembaga" className="h-8 text-sm">
              <SelectValue placeholder="Lembaga…" />
            </SelectTrigger>
            <SelectContent>
              {efektifSuper ? <SelectItem value="">Semua (global)</SelectItem> : null}
              {pilihanLembaga.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="chk_jenis_edit_aktif">Aktif</FieldLabel>
          <Checkbox id="chk_jenis_edit_aktif" aria-label="Aktif" checked={aktif} onCheckedChange={(v) => setAktif(v === true)} />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_jenis_edit_simpan" type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog Ubah Tarif; nilai awal dari baris terpilih. */
export function DialogUbahTarif({
  item, onClose, onSukses,
}: {
  item: Tarif;
  onClose: () => void;
  onSukses: () => void | Promise<void>;
}) {
  const [nominal, setNominal] = useState(String(item.nominal));
  const [aktif, setAktif] = useState(item.is_active);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Ubah Tarif</DialogTitle></DialogHeader>
        <form id="form_ubah_tarif" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); try { await ubahTarif(item.id, Number(nominal), aktif); toast.success('Tersimpan.'); onClose(); await onSukses(); } catch (e2) { toast.error(errorMessage(e2)); } }}>
          <FieldLabel htmlFor="inp_tarif_edit_nominal">Nominal</FieldLabel>
          <Input id="inp_tarif_edit_nominal" type="number" value={nominal} onChange={(e) => setNominal(e.target.value)} required />
          <FieldLabel htmlFor="chk_tarif_edit_aktif">Aktif</FieldLabel>
          <Checkbox id="chk_tarif_edit_aktif" aria-label="Aktif" checked={aktif} onCheckedChange={(v) => setAktif(v === true)} />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_tarif_edit_simpan" type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
