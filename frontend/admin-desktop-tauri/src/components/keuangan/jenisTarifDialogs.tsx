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
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

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
          <select id="sel_tarif_jenjang" className="border rounded px-2" value={jenjang} onChange={(e) => onJenjang(e.target.value)} required>
            {lembagas.filter((l) => pilihanLembaga.some((p) => p.jenjang === l.jenjang)).map((l) => <option key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</option>)}
          </select>
          <FieldLabel htmlFor="sel_tarif_ta">Tahun Ajaran</FieldLabel>
          <select id="sel_tarif_ta" className="border rounded px-2" value={ta} onChange={(e) => onTa(e.target.value)} required>
            {daftarTA.map((x) => <option key={x.nama} value={x.nama}>{x.nama}{x.is_aktif ? ' (aktif)' : ''}</option>)}
          </select>
          <FieldLabel htmlFor="sel_tarif_jenis">Jenis</FieldLabel>
          <select id="sel_tarif_jenis" className="border rounded px-2" value={jenisId} onChange={(e) => setJenisId(e.target.value === '' ? '' : Number(e.target.value))} required>
            <option value="">Jenis…</option>{jenis.filter((j) => j.jenjang === null || j.jenjang === jenjang).map((j) => <option key={j.id} value={j.id}>{j.nama}</option>)}
          </select>
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
          <select id="sel_jenis_tipe" className="border rounded px-2" value={tipe} onChange={(e) => setTipe(e.target.value as 'bulanan' | 'non_bulanan')}>
            <option value="non_bulanan">Non-bulanan</option>
            <option value="bulanan">Bulanan</option>
          </select>
          <FieldLabel htmlFor="sel_jenis_lembaga">Lembaga</FieldLabel>
          <select id="sel_jenis_lembaga" className="border rounded px-2" value={lembaga} onChange={(e) => setLembaga(e.target.value)}>
            {efektifSuper ? <option value="">Semua (global)</option> : null}
            {pilihanLembaga.map((l) => <option key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</option>)}
          </select>
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
          <select id="sel_jenis_edit_tipe" className="border rounded px-2" value={tipe} onChange={(e) => setTipe(e.target.value as 'bulanan' | 'non_bulanan')}>
            <option value="non_bulanan">Non-bulanan</option><option value="bulanan">Bulanan</option>
          </select>
          <FieldLabel htmlFor="sel_jenis_edit_lembaga">Lembaga</FieldLabel>
          <select id="sel_jenis_edit_lembaga" className="border rounded px-2" value={jenjang} onChange={(e) => setJenjang(e.target.value)}>
            {efektifSuper ? <option value="">Semua (global)</option> : null}
            {pilihanLembaga.map((l) => <option key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</option>)}
          </select>
          <FieldLabel htmlFor="chk_jenis_edit_aktif">Aktif</FieldLabel>
          <input id="chk_jenis_edit_aktif" type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
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
          <input id="chk_tarif_edit_aktif" type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id="btn_tarif_edit_simpan" type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
