import { useEffect, useState } from 'react';
import {
  createReferensi,
  deleteReferensi,
  listLembaga,
  referensiList,
  referensiTypes,
  updateReferensi,
  type Lembaga,
  type ReferensiInput,
  type ReferensiRow,
} from '../api/master';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import PageHeader, { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DeleteAction, EditAction } from '@/components/RowActions';
import { toast } from 'sonner';

const STATUS_TIPE = ['status_awal', 'status_akhir'];

/** Nilai tampil baris: kamus bebas pakai `nama`, status pakai `label`/`kode`. */
function rowText(r: ReferensiRow): string {
  return r.nama ?? r.label ?? r.kode ?? '';
}

/** Sifat logika status akhir (bawaan sistem / terminal / custom netral). */
function sifatOf(r: ReferensiRow): string {
  if (r.is_aktif_bawaan) return 'Aktif bawaan';
  if (r.terminal_ke) return `Terminal → ${r.terminal_ke}`;
  return 'Netral';
}

export default function ReferensiPage() {
  const { user: me } = useAuth();
  const isSuper = !!me?.roles.some((r) => r.name === 'super_admin');
  const canManage = !!me?.roles.some((r) => r.name === 'super_admin' || r.name === 'admin');
  const myLembagaIds = me?.lembagas?.map((l) => l.id) ?? [];
  const adminFull = canManage && !isSuper && myLembagaIds.length === 0;

  const [types, setTypes] = useState<string[]>([]);
  const [tipe, setTipe] = useState('');
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [lembagaId, setLembagaId] = useState<number | ''>('');
  const [rows, setRows] = useState<ReferensiRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);

  const [tambahOpen, setTambahOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scope, setScope] = useState('_global');
  const [fNama, setFNama] = useState('');
  const [fKode, setFKode] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [fUrutan, setFUrutan] = useState('0');

  const [editRow, setEditRow] = useState<ReferensiRow | null>(null);
  const [eNama, setENama] = useState('');
  const [eLabel, setELabel] = useState('');
  const [eUrutan, setEUrutan] = useState('0');

  const isStatus = STATUS_TIPE.includes(tipe);
  const isStatusAkhir = tipe === 'status_akhir';

  useEffect(() => {
    referensiTypes()
      .then((t) => { setTypes(t); if (t[0]) setTipe((cur) => cur || t[0]); })
      .catch((e) => { setErr(errorMessage(e)); setLoading(false); });
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch(() => {});
  }, []);

  // Admin non-global wajib punya konteks lembaga; super_admin boleh '' (baris global).
  useEffect(() => {
    if (isSuper || lembagaId !== '' || lembagas.length === 0) return;
    setLembagaId(lembagas[0].id);
  }, [isSuper, lembagaId, lembagas]);

  useEffect(() => {
    if (!tipe) return;
    let alive = true;
    setErr('');
    setLoading(true);
    referensiList(tipe, lembagaId === '' ? undefined : lembagaId)
      .then((r) => { if (alive) setRows(r); })
      .catch((e) => { if (alive) setErr(errorMessage(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tipe, lembagaId, tick]);

  function reload() {
    setTick((t) => t + 1);
  }

  function lembagaName(id: number | null): string {
    if (id === null) return 'Global';
    return lembagas.find((l) => l.id === id)?.nama ?? `Lembaga #${id}`;
  }

  const canAccessRow = (lid: number | null) =>
    isSuper || adminFull || (lid !== null && myLembagaIds.includes(lid));
  const canUbahRow = (r: ReferensiRow) =>
    r.lembaga_id === null ? isSuper : canAccessRow(r.lembaga_id);
  const canNonaktifRow = (r: ReferensiRow) =>
    r.lembaga_id === null ? canManage && lembagaId !== '' : canAccessRow(r.lembaga_id);

  const fields: ExcelField[] = isStatus
    ? [
        { key: 'kode', label: 'Kode', width: 150, kind: 'static' },
        { key: 'label', label: 'Label', width: 200, kind: 'static' },
        { key: 'urutan', label: 'Urutan', width: 80, kind: 'static' },
        ...(isStatusAkhir ? [{ key: 'sifat', label: 'Sifat', width: 170, kind: 'static' as const }] : []),
        { key: 'sumber', label: 'Sumber', width: 170, kind: 'static' },
      ]
    : [
        { key: 'nama', label: 'Nama', width: 220, kind: 'static' },
        { key: 'urutan', label: 'Urutan', width: 80, kind: 'static' },
        { key: 'sumber', label: 'Sumber', width: 170, kind: 'static' },
      ];

  function gridValues(r: ReferensiRow): Record<string, string | null> {
    return {
      nama: r.nama ?? null,
      kode: r.kode ?? null,
      label: r.label ?? null,
      urutan: String(r.urutan ?? 0),
      sifat: sifatOf(r),
      sumber: lembagaName(r.lembaga_id),
    };
  }

  const q = search.trim().toLowerCase();
  const visibleRows = q
    ? rows.filter((r) =>
        [r.nama, r.kode, r.label].some((v) => (v ?? '').toLowerCase().includes(q)),
      )
    : rows;

  function openTambah() {
    setFNama(''); setFKode(''); setFLabel(''); setFUrutan('0');
    const fallback = lembagaId !== ''
      ? String(lembagaId)
      : (isSuper ? '_global' : (lembagas[0] ? String(lembagas[0].id) : ''));
    setScope(fallback);
    setTambahOpen(true);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isSuper && scope === '_global') {
      setErr('Pilih lembaga dulu.');
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const payload: ReferensiInput = { urutan: fUrutan === '' ? 0 : Number(fUrutan) };
      if (scope !== '_global') payload.lembaga_id = Number(scope);
      if (isStatus) {
        payload.kode = fKode.trim();
        payload.label = fLabel.trim() || fKode.trim();
      } else {
        payload.nama = fNama.trim();
      }
      await createReferensi(tipe, payload);
      toast.success('Entri referensi ditambahkan.');
      setTambahOpen(false);
      reload();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(r: ReferensiRow) {
    setEditRow(r);
    setENama(r.nama ?? '');
    setELabel(r.label ?? '');
    setEUrutan(String(r.urutan ?? 0));
  }

  async function onUpdate() {
    if (!editRow) return;
    setErr('');
    setSubmitting(true);
    try {
      const urutan = eUrutan === '' ? 0 : Number(eUrutan);
      if (isStatus) {
        await updateReferensi(tipe, editRow.id, { label: eLabel.trim(), urutan });
      } else {
        await updateReferensi(tipe, editRow.id, { nama: eNama.trim(), urutan });
      }
      toast.success('Entri referensi diubah.');
      setEditRow(null);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(r: ReferensiRow) {
    // Baris global: nonaktif per lembaga (shadow) — butuh konteks lembaga terpilih.
    const lid = r.lembaga_id === null && lembagaId !== '' ? Number(lembagaId) : undefined;
    try {
      await deleteReferensi(tipe, r.id, lid);
      toast.success('Entri referensi dinonaktifkan.');
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_referensi" title="Referensi" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        key={tipe}
        tableKey="referensi"
        fields={fields}
        rows={visibleRows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada entri."
        canEdit={false}
        onCommit={async () => {}}
        onSaved={reload}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => {}}
        searchPlaceholder={isStatus ? 'Kode / label' : 'Nama'}
        searchIds={{ form: 'form_cari_referensi', input: 'input_cari_referensi', button: 'btn_cari_referensi' }}
        filter={(
          <>
            <Select value={tipe} onValueChange={(v) => { setTipe(v); setSearch(''); }}>
              <SelectTrigger id="select_tipe" title="Tipe kamus" aria-label="Tipe kamus" className="h-8 w-44">
                <SelectValue placeholder="Pilih tipe" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={lembagaId === '' ? '_global' : String(lembagaId)}
              onValueChange={(v) => setLembagaId(v === '_global' ? '' : Number(v))}
            >
              <SelectTrigger id="select_lembaga_referensi" title="Filter lembaga" aria-label="Filter lembaga" className="h-8 w-40">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                {isSuper && <SelectItem value="_global">Global (bawaan)</SelectItem>}
                {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
        addButton={(
          <Button id="btn_tambah_referensi" onClick={openTambah} disabled={!tipe}>
            + Entri
          </Button>
        )}
        renderActions={(r) => {
          const bolehUbah = canUbahRow(r);
          const bolehNonaktif = canNonaktifRow(r);
          if (!bolehUbah && !bolehNonaktif) return null;
          return (
            <>
              {bolehUbah && <EditAction id={`btn_ubah_referensi_${r.id}`} onClick={() => openEdit(r)} />}
              {bolehNonaktif && (
                <DeleteAction
                  id={`btn_hapus_referensi_${r.id}`}
                  title="Nonaktifkan entri?"
                  description={r.lembaga_id === null
                    ? `"${rowText(r)}" tidak akan tampil untuk ${lembagaName(Number(lembagaId))}. Baris global tetap berlaku di lembaga lain.`
                    : `"${rowText(r)}" tidak akan tampil lagi di daftar efektif.`}
                  onConfirm={() => onDelete(r)}
                />
              )}
            </>
          );
        }}
      />
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah entri referensi</DialogTitle>
          </DialogHeader>
          <form id="form_tambah_referensi" onSubmit={onCreate} className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="select_scope_referensi">Lembaga</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger id="select_scope_referensi" className="w-full">
                  <SelectValue placeholder="Pilih lembaga" />
                </SelectTrigger>
                <SelectContent>
                  {isSuper && <SelectItem value="_global">Global (bawaan sistem)</SelectItem>}
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isStatus ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="input_kode_referensi">Kode</Label>
                  <Input
                    id="input_kode_referensi"
                    value={fKode}
                    onChange={(e) => setFKode(e.target.value)}
                    required
                    maxLength={50}
                    placeholder="cuti_panjang"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="input_label_referensi">Label</Label>
                  <Input
                    id="input_label_referensi"
                    value={fLabel}
                    onChange={(e) => setFLabel(e.target.value)}
                    maxLength={100}
                    placeholder="Cuti Panjang"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="input_nama_referensi">Nama</Label>
                <Input
                  id="input_nama_referensi"
                  value={fNama}
                  onChange={(e) => setFNama(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="input_urutan_referensi">Urutan</Label>
              <Input
                id="input_urutan_referensi"
                type="number"
                value={fUrutan}
                onChange={(e) => setFUrutan(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_simpan_tambah_referensi" type="submit" disabled={submitting}>Tambah</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah entri referensi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {isStatus ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="input_kode_referensi_ubah">Kode (tidak dapat diubah)</Label>
                  <Input id="input_kode_referensi_ubah" value={editRow?.kode ?? ''} readOnly disabled />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="input_label_referensi_ubah">Label</Label>
                  <Input
                    id="input_label_referensi_ubah"
                    value={eLabel}
                    onChange={(e) => setELabel(e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="input_nama_referensi_ubah">Nama</Label>
                <Input
                  id="input_nama_referensi_ubah"
                  value={eNama}
                  onChange={(e) => setENama(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Mengubah nama tidak mengubah data lama yang sudah memakainya (kamus saran).
                </p>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="input_urutan_referensi_ubah">Urutan</Label>
              <Input
                id="input_urutan_referensi_ubah"
                type="number"
                value={eUrutan}
                onChange={(e) => setEUrutan(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button
              id="btn_simpan_ubah_referensi"
              onClick={onUpdate}
              disabled={submitting || (isStatus ? !eLabel.trim() : !eNama.trim())}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
