import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useLembagaAwalNumber } from '@/hooks/useLembagaAwal';
import { useLembagaAktif } from '@/lembagaAktif';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DeleteAction, EditAction } from '@/components/RowActions';
import { toast } from 'sonner';

const STATUS_TIPE = ['status_awal', 'status_akhir'];

const NOOP = () => {};
async function noopCommit() {}

/** Nilai tampil baris: semua tabel ref memakai `nama` (status juga menyimpan `kode`). */
function rowText(r: ReferensiRow): string {
  return r.nama ?? r.kode ?? '';
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
  const myLembagaIds = useMemo(() => me?.lembagas?.map((l) => l.id) ?? [], [me]);
  const adminFull = canManage && !isSuper && myLembagaIds.length === 0;

  const [types, setTypes] = useState<string[]>([]);
  const [tipe, setTipe] = useState('');
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [lembagaId, setLembagaId] = useState<number | ''>('');
  useLembagaAwalNumber(setLembagaId);
  const { bertindak } = useLembagaAktif();
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
  const [fUrutan, setFUrutan] = useState('0');

  const [editRow, setEditRow] = useState<ReferensiRow | null>(null);
  const [eNama, setENama] = useState('');
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

  const reload = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  const lembagaName = useCallback((id: number | null): string => {
    if (id === null) return 'Global';
    const l = lembagas.find((x) => x.id === id);
    return l?.kode ?? l?.nama ?? `Lembaga #${id}`;
  }, [lembagas]);

  const canAccessRow = useCallback(
    (lid: number | null) =>
      isSuper || adminFull || (lid !== null && myLembagaIds.includes(lid)),
    [isSuper, adminFull, myLembagaIds],
  );
  const canUbahRow = useCallback(
    (r: ReferensiRow) => (r.lembaga_id === null ? isSuper : canAccessRow(r.lembaga_id)),
    [isSuper, canAccessRow],
  );
  const canNonaktifRow = useCallback(
    (r: ReferensiRow) =>
      r.lembaga_id === null ? canManage && lembagaId !== '' : canAccessRow(r.lembaga_id),
    [canManage, lembagaId, canAccessRow],
  );

  const fields = useMemo<ExcelField[]>(
    () => isStatus
      ? [
          { key: 'kode', label: 'Kode', width: 150, kind: 'static' },
          { key: 'nama', label: 'Nama', width: 200, kind: 'static' },
          { key: 'urutan', label: 'Urutan', width: 80, kind: 'static' },
          ...(isStatusAkhir ? [{ key: 'sifat', label: 'Sifat', width: 170, kind: 'static' as const }] : []),
          { key: 'sumber', label: 'Sumber', width: 170, kind: 'static' },
        ]
      : [
          { key: 'nama', label: 'Nama', width: 220, kind: 'static' },
          { key: 'urutan', label: 'Urutan', width: 80, kind: 'static' },
          { key: 'sumber', label: 'Sumber', width: 170, kind: 'static' },
        ],
    [isStatus, isStatusAkhir],
  );

  const gridValues = useCallback((r: ReferensiRow): Record<string, string | null> => ({
    nama: r.nama ?? null,
    kode: r.kode ?? null,
    urutan: String(r.urutan ?? 0),
    sifat: sifatOf(r),
    sumber: lembagaName(r.lembaga_id),
  }), [lembagaName]);

  const q = search.trim().toLowerCase();
  const visibleRows = q
    ? rows.filter((r) =>
        [r.nama, r.kode].some((v) => (v ?? '').toLowerCase().includes(q)),
      )
    : rows;

  const openTambah = useCallback(() => {
    setFNama(''); setFKode(''); setFUrutan('0');
    const fallback = lembagaId !== ''
      ? String(lembagaId)
      : (isSuper ? '_global' : (lembagas[0] ? String(lembagas[0].id) : ''));
    setScope(fallback);
    setTambahOpen(true);
  }, [lembagaId, isSuper, lembagas]);

  const onCreate = useCallback(async (e: React.FormEvent) => {
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
        payload.nama = fNama.trim() || fKode.trim();
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
  }, [isSuper, scope, fUrutan, isStatus, fKode, fNama, tipe, reload]);

  const openEdit = useCallback((r: ReferensiRow) => {
    setEditRow(r);
    setENama(r.nama ?? '');
    setEUrutan(String(r.urutan ?? 0));
  }, []);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    setErr('');
    setSubmitting(true);
    try {
      const urutan = eUrutan === '' ? 0 : Number(eUrutan);
      await updateReferensi(tipe, editRow.id, { nama: eNama.trim(), urutan });
      toast.success('Entri referensi diubah.');
      setEditRow(null);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [editRow, tipe, eNama, eUrutan, reload]);

  const onDelete = useCallback(async (r: ReferensiRow) => {
    // Baris global: nonaktif per lembaga (shadow) — butuh konteks lembaga terpilih.
    const lid = r.lembaga_id === null && lembagaId !== '' ? Number(lembagaId) : undefined;
    try {
      await deleteReferensi(tipe, r.id, lid);
      toast.success('Entri referensi dinonaktifkan.');
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [tipe, lembagaId, reload]);

  const renderActions = useCallback((r: ReferensiRow) => {
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
  }, [canUbahRow, canNonaktifRow, openEdit, onDelete, lembagaName, lembagaId]);

  return (
    <div className={PAGE_SHELL}>
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
        onCommit={noopCommit}
        onSaved={reload}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={NOOP}
        searchPlaceholder={isStatus ? 'Kode / nama' : 'Nama'}
        searchIds={{ form: 'form_cari_referensi', input: 'input_cari_referensi', button: 'btn_cari_referensi' }}
        filter={(
          <>
            <FilterField label="Tipe kamus" htmlFor="select_tipe">
            <Select value={tipe} onValueChange={(v) => { setTipe(v); setSearch(''); }}>
              <SelectTrigger id="select_tipe" title="Tipe kamus" aria-label="Tipe kamus" size="sm" className="w-44">
                <SelectValue placeholder="Pilih tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            </FilterField>
            <FilterField label="Lembaga" htmlFor="select_lembaga_referensi">
            <Select
              value={lembagaId === '' ? '_global' : String(lembagaId)}
              onValueChange={(v) => setLembagaId(v === '_global' ? '' : Number(v))}
            >
              <SelectTrigger id="select_lembaga_referensi" title="Filter lembaga" aria-label="Filter lembaga" size="sm" className="w-40">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {isSuper && !bertindak && <SelectLabel>Global</SelectLabel>}
                  {isSuper && !bertindak && <SelectItem value="_global">Global (bawaan)</SelectItem>}
                  <SelectLabel>Per lembaga</SelectLabel>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            </FilterField>
          </>
        )}
        addButton={(
          <Button id="btn_tambah_referensi" onClick={openTambah} disabled={!tipe}>
            + Entri
          </Button>
        )}
        renderActions={renderActions}
      />
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah entri referensi</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan entri referensi.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_referensi" onSubmit={onCreate} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_scope_referensi">Lembaga</FieldLabel>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger id="select_scope_referensi" className="w-full">
                <SelectValue placeholder="Pilih lembaga" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {isSuper && <SelectLabel>Global</SelectLabel>}
                  {isSuper && <SelectItem value="_global">Global (bawaan sistem)</SelectItem>}
                  <SelectLabel>Per lembaga</SelectLabel>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            {isStatus ? (
              <>
                <FieldLabel htmlFor="input_kode_referensi">Kode</FieldLabel>
                <Input
                  id="input_kode_referensi"
                  value={fKode}
                  onChange={(e) => setFKode(e.target.value)}
                  required
                  maxLength={50}
                  placeholder="cuti_panjang"
                />
                <FieldLabel htmlFor="input_nama_status_referensi">Nama</FieldLabel>
                <Input
                  id="input_nama_status_referensi"
                  value={fNama}
                  onChange={(e) => setFNama(e.target.value)}
                  maxLength={100}
                  placeholder="Cuti Panjang"
                />
              </>
            ) : (
              <>
                <FieldLabel htmlFor="input_nama_referensi">Nama</FieldLabel>
                <Input
                  id="input_nama_referensi"
                  value={fNama}
                  onChange={(e) => setFNama(e.target.value)}
                  required
                />
              </>
            )}
            <FieldLabel htmlFor="input_urutan_referensi">Urutan</FieldLabel>
            <Input
              id="input_urutan_referensi"
              type="number"
              value={fUrutan}
              onChange={(e) => setFUrutan(e.target.value)}
            />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_simpan_tambah_referensi" type="submit" disabled={submitting}>Tambah</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ubah entri referensi</DialogTitle>
            <DialogDescription className="sr-only">Formulir perubahan entri referensi.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            {isStatus ? (
              <>
                <FieldLabel htmlFor="input_kode_referensi_ubah">Kode (tidak dapat diubah)</FieldLabel>
                <Input id="input_kode_referensi_ubah" value={editRow?.kode ?? ''} readOnly disabled />
                <FieldLabel htmlFor="input_nama_status_referensi_ubah">Nama</FieldLabel>
                <Input
                  id="input_nama_status_referensi_ubah"
                  value={eNama}
                  onChange={(e) => setENama(e.target.value)}
                  required
                  maxLength={100}
                />
              </>
            ) : (
              <>
                <FieldLabel htmlFor="input_nama_referensi_ubah" className="self-start pt-1.5">Nama</FieldLabel>
                <div className="flex flex-col gap-1.5">
                  <Input
                    id="input_nama_referensi_ubah"
                    value={eNama}
                    onChange={(e) => setENama(e.target.value)}
                    required
                  />
                  <FieldDescription>
                    Mengubah nama tidak mengubah data lama yang sudah memakainya (kamus saran).
                  </FieldDescription>
                </div>
              </>
            )}
            <FieldLabel htmlFor="input_urutan_referensi_ubah">Urutan</FieldLabel>
            <Input
              id="input_urutan_referensi_ubah"
              type="number"
              value={eUrutan}
              onChange={(e) => setEUrutan(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button
              id="btn_simpan_ubah_referensi"
              onClick={onUpdate}
              disabled={submitting || !eNama.trim()}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
