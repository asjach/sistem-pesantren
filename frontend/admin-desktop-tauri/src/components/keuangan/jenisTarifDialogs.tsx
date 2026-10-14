import { useState, type FormEvent } from 'react';
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
import { urutanDariTeks } from './tabKeuangan';

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
            <SelectTrigger id="sel_tarif_jenjang" aria-label="Jenjang" className="h-[26px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lembagas.filter((l) => pilihanLembaga.some((p) => p.jenjang === l.jenjang)).map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="sel_tarif_ta">Tahun Ajaran</FieldLabel>
          <Select value={ta} onValueChange={onTa}>
            <SelectTrigger id="sel_tarif_ta" aria-label="Tahun Ajaran" className="h-[26px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {daftarTA.map((x) => <SelectItem key={x.nama} value={x.nama}>{x.nama}{x.is_aktif ? ' (aktif)' : ''}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="sel_tarif_jenis">Jenis</FieldLabel>
          <Select value={jenisId === '' ? '' : String(jenisId)} onValueChange={(v) => setJenisId(v === '' ? '' : Number(v))}>
            <SelectTrigger id="sel_tarif_jenis" aria-label="Jenis" className="h-[26px] text-sm">
              <SelectValue placeholder="Jenis…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Jenis…</SelectItem>
              {jenis.filter((j) => j.jenjang === null || j.jenjang === jenjang).map((j) => <SelectItem key={j.id} value={String(j.id)}>{j.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="inp_tarif_nominal">Nominal</FieldLabel>
          <Input id="inp_tarif_nominal" type="number" className="h-[26px]" value={nominal} onChange={(e) => setNominal(e.target.value)} required />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" className="h-[26px]" onClick={onClose}>Batal</Button>
            <Button id="btn_tarif_simpan" type="submit" className="h-[26px]">Tambah</Button>
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
  const [keterangan, setKeterangan] = useState('');
  const [urutan, setUrutan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const simpan = async (e: FormEvent) => {
    e.preventDefault();
    if (nama.trim() === '') { setGalat('Nama jenis wajib diisi.'); return; }
    if (keterangan.length > 1000) { setGalat('Keterangan maksimal 1000 karakter.'); return; }
    if (urutan.trim() !== '' && !/^\d+$/.test(urutan.trim())) { setGalat('Urutan harus angka bulat ≥ 0.'); return; }
    setGalat(null); setBusy(true);
    try {
      await buatJenis({
        nama: nama.trim(), tipe,
        jenjang: lembaga === '' ? null : lembaga,
        keterangan: keterangan.trim() === '' ? null : keterangan.trim(),
        urutan: urutanDariTeks(urutan, 0),
      });
      toast.success('Jenis dibuat.');
      onClose();
      await onSukses();
    } catch (e2) { setGalat(errorMessage(e2)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Jenis Tagihan</DialogTitle>
          <DialogDescription className="sr-only">Formulir penambahan jenis tagihan.</DialogDescription>
        </DialogHeader>
        <form id="form_tambah_jenis" onSubmit={(e) => void simpan(e)} className="flex flex-col gap-3">
          {galat !== null && (
            <p role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {galat}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="inp_jenis_nama">Nama</FieldLabel>
            <Input
              id="inp_jenis_nama" placeholder="mis. HIPA" value={nama} required
              aria-invalid={galat !== null} className="h-[26px]"
              onChange={(e) => { setNama(e.target.value); setGalat(null); }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="sel_jenis_tipe">Tipe</FieldLabel>
            <Select value={tipe} onValueChange={(v) => setTipe(v as 'bulanan' | 'non_bulanan')}>
              <SelectTrigger id="sel_jenis_tipe" aria-label="Tipe" className="h-[26px] w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="non_bulanan">Non-bulanan</SelectItem>
                <SelectItem value="bulanan">Bulanan</SelectItem>
              </SelectContent>
            </Select>
            <p className="min-h-4 text-xs text-muted-foreground">
              {tipe === 'bulanan' ? 'Ditagih tiap bulan dalam rentang periode.' : 'Ditagih sekali per tahun ajaran.'}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="sel_jenis_lembaga">Lembaga</FieldLabel>            <Select value={lembaga} onValueChange={setLembaga}>
              <SelectTrigger id="sel_jenis_lembaga" aria-label="Lembaga" className="h-[26px] w-full text-sm">
                <SelectValue placeholder="Lembaga…" />
              </SelectTrigger>
              <SelectContent>
                {efektifSuper ? <SelectItem value="">Semua (global)</SelectItem> : null}
                {pilihanLembaga.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            {efektifSuper && (
              <p className="text-xs text-muted-foreground">Semua (global) berlaku untuk semua lembaga.</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="inp_jenis_urutan">Urutan</FieldLabel>
            <Input
              id="inp_jenis_urutan" inputMode="numeric" placeholder="mis. 10" value={urutan}
              maxLength={5} className="h-[26px]"
              onChange={(e) => { setUrutan(e.target.value); setGalat(null); }}
            />
            <p className="text-xs text-muted-foreground">
              Urutan kolom di tabel Tagihan. Kosong = 0 (mengikuti urutan id).
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="inp_jenis_keterangan">Keterangan</FieldLabel>
            <textarea
              id="inp_jenis_keterangan" placeholder="mis. Iuran halaqoh pekanan" value={keterangan}
              rows={3} maxLength={1000} onChange={(e) => setKeterangan(e.target.value)}
              className="min-h-16 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-[26px]" disabled={busy} onClick={onClose}>Batal</Button>
            <Button id="btn_jenis_simpan" type="submit" className="h-[26px]" disabled={busy}>{busy ? 'Menyimpan…' : 'Tambah'}</Button>
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
  const [keterangan, setKeterangan] = useState(item.keterangan ?? '');
  const [aktif, setAktif] = useState(item.is_active);
  const [urutan, setUrutan] = useState(item.urutan === 0 ? '' : String(item.urutan));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Ubah Jenis Tagihan</DialogTitle></DialogHeader>
        <form id="form_ubah_jenis" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); if (urutan.trim() !== '' && !/^\d+$/.test(urutan.trim())) { toast.error('Urutan harus angka bulat ≥ 0.'); return; } try { await ubahJenis(item.id, { nama, tipe, jenjang: jenjang === '' ? null : jenjang, keterangan: keterangan.trim() === '' ? null : keterangan.trim(), urutan: urutanDariTeks(urutan, item.urutan), is_active: aktif }); toast.success('Tersimpan.'); onClose(); await onSukses(); } catch (e2) { toast.error(errorMessage(e2)); } }}>
          <FieldLabel htmlFor="inp_jenis_edit_nama">Nama</FieldLabel>
          <Input id="inp_jenis_edit_nama" value={nama} className="h-[26px]" onChange={(e) => setNama(e.target.value)} required />
          <FieldLabel htmlFor="sel_jenis_edit_tipe">Tipe</FieldLabel>
          <Select value={tipe} onValueChange={(v) => setTipe(v as 'bulanan' | 'non_bulanan')}>
            <SelectTrigger id="sel_jenis_edit_tipe" aria-label="Tipe" className="h-[26px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="non_bulanan">Non-bulanan</SelectItem>
              <SelectItem value="bulanan">Bulanan</SelectItem>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="sel_jenis_edit_lembaga">Lembaga</FieldLabel>
          <Select value={jenjang} onValueChange={setJenjang}>
            <SelectTrigger id="sel_jenis_edit_lembaga" aria-label="Lembaga" className="h-[26px] text-sm">
              <SelectValue placeholder="Lembaga…" />
            </SelectTrigger>
            <SelectContent>
              {efektifSuper ? <SelectItem value="">Semua (global)</SelectItem> : null}
              {pilihanLembaga.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="inp_jenis_edit_urutan">Urutan</FieldLabel>
          <Input
            id="inp_jenis_edit_urutan" inputMode="numeric" placeholder="mis. 10" value={urutan}
            maxLength={5} className="h-[26px]" onChange={(e) => setUrutan(e.target.value)}
          />
          <FieldLabel htmlFor="chk_jenis_edit_aktif">Aktif</FieldLabel>
          <Checkbox id="chk_jenis_edit_aktif" aria-label="Aktif" checked={aktif} onCheckedChange={(v) => setAktif(v === true)} />
          <FieldLabel htmlFor="inp_jenis_edit_keterangan">Keterangan</FieldLabel>
          <textarea
            id="inp_jenis_edit_keterangan" value={keterangan} rows={3} maxLength={1000}
            onChange={(e) => setKeterangan(e.target.value)}
            className="min-h-16 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" className="h-[26px]" onClick={onClose}>Batal</Button>
            <Button id="btn_jenis_edit_simpan" type="submit" className="h-[26px]">Simpan</Button>
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
            <Button type="button" variant="outline" className="h-[26px]" onClick={onClose}>Batal</Button>
            <Button id="btn_tarif_edit_simpan" type="submit" className="h-[26px]">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
