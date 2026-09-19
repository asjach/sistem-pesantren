import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createReferensi,
  deleteReferensi,
  listLembaga,
  pulihkanReferensi,
  referensiList,
  referensiTypes,
  updateReferensi,
  type Lembaga,
  type ReferensiInput,
  type ReferensiRow,
} from '../api/master';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
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
  /** Gerbang super = EFEKTIF (mati saat bertindak; baris global terkunci). */
  const { efektifSuper: isSuper } = useLembagaAktif();
  // Nilai referensi murni per lembaga (tanpa baris global): super_admin
  // menambah ke semua lembaga sekaligus; tiap lembaga kelola miliknya.
  const canManage = bisa(me, 'referensi.ubah');
  const myLembagaIds = useMemo(() => me?.lembagas?.map((l) => l.id) ?? [], [me]);
  const adminFull = canManage && !isSuper && myLembagaIds.length === 0;

  const [types, setTypes] = useState<string[]>([]);
  const [tipe, setTipe] = useState('');
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [lembagaId, setLembagaId] = useState<number | ''>('');
  useLembagaAwalNumber(setLembagaId);
  const { terkunci, lembagaId: lembagaTop } = useLembagaAktif();
  const [rows, setRows] = useState<ReferensiRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);

  const [tambahOpen, setTambahOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scope, setScope] = useState('');
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

  // '' = Semua lembaga (gabungan semua yang boleh diakses); pilihan spesifik
  // memfilter satu lembaga. Terkunci saat bertindak (mengikuti peran).
  // Auto-ikuti topbar hanya sekali saat halaman dibuka — pilihan Semua
  // eksplisit pengguna tidak ditimpa balik.
  const autoLembaga = useRef(false);
  useEffect(() => {
    if (autoLembaga.current || lembagaId !== '' || terkunci) return;
    autoLembaga.current = true;
    if (lembagaTop != null) setLembagaId(lembagaTop);
  }, [lembagaId, terkunci, lembagaTop]);

  /** Muat daftar; mengembalikan promise agar antrean simpan grid bisa menunggu
   *  baris segar TIBA sebelum membuang draft optimistis (tanpa ini toggle
   *  kelap-kelip on→off→on→off: draft dibuang saat basis masih basi). */
  const tipeRef = useRef(tipe);
  tipeRef.current = tipe;
  const lembagaRef = useRef(lembagaId);
  lembagaRef.current = lembagaId;
  const muat = useCallback(async () => {
    if (!tipeRef.current) return;
    setErr('');
    setLoading(true);
    try {
      // Mode kelola: selalu sertakan nonaktif agar toggle bisa memulihkan.
      // MySQL tinyint tiba sebagai 0/1 → normalkan ke boolean.
      const r = await referensiList(tipeRef.current, lembagaRef.current === '' ? undefined : lembagaRef.current, true);
      setRows(r.map((row) => ({ ...row, is_active: !!row.is_active })));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat, tipe, lembagaId, tick]);

  const reload = useCallback(() => muat(), [muat]);

  const lembagaName = useCallback((id: number | null): string => {
    if (id === null) return 'Global';
    const l = lembagas.find((x) => x.id === id);
    return l?.kode ?? l?.nama ?? `Lembaga #${id}`;
  }, [lembagas]);

  const canAccessRow = useCallback(
    (lid: number | null) =>
      lid !== null && (isSuper || adminFull || myLembagaIds.includes(lid)),
    [isSuper, adminFull, myLembagaIds],
  );
  const canUbahRow = useCallback(
    (r: ReferensiRow) => canAccessRow(r.lembaga_id),
    [canAccessRow],
  );
  const canNonaktifRow = useCallback(
    (r: ReferensiRow) => canAccessRow(r.lembaga_id),
    [canAccessRow],
  );

  /** Boleh toggle per baris: hak akses baris lembaganya (backend menegakkan). */
  const toggleBoleh = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const r of rows) {
      const nyala = r.is_active !== false;
      m.set(r.id, nyala ? canNonaktifRow(r) : (r.lembaga_id !== null && canAccessRow(r.lembaga_id)));
    }
    return m;
  }, [rows, canNonaktifRow, canAccessRow]);

  const toggleBolehId = useCallback((id: string | number) => toggleBoleh.get(Number(id)) ?? false, [toggleBoleh]);

  const fields = useMemo<ExcelField[]>(
    () => isStatus
      ? [
          { key: 'kode', label: 'kode', width: 150, kind: 'static' },
          { key: 'nama', label: 'nama', width: 200, kind: 'static' },
          { key: 'urutan', label: 'urutan', width: 80, kind: 'static' },
          ...(isStatusAkhir ? [{ key: 'sifat', label: 'Sifat', width: 170, kind: 'static' as const }] : []),
          { key: 'sumber', label: 'Sumber', width: 170, kind: 'static' },
          { key: 'tampil', label: 'is_active', width: 130, kind: 'toggle', toggleTanpaEdit: true, bolehToggle: toggleBolehId },
        ]
      : [
          { key: 'nama', label: 'nama', width: 220, kind: 'static' },
          { key: 'urutan', label: 'urutan', width: 80, kind: 'static' },
          { key: 'sumber', label: 'Sumber', width: 170, kind: 'static' },
          { key: 'tampil', label: 'is_active', width: 130, kind: 'toggle', toggleTanpaEdit: true, bolehToggle: toggleBolehId },
        ],
    [isStatus, isStatusAkhir, toggleBolehId],
  );

  const gridValues = useCallback((r: ReferensiRow): Record<string, string | null> => ({
    nama: r.nama ?? null,
    kode: r.kode ?? null,
    urutan: String(r.urutan ?? 0),
    sifat: sifatOf(r),
    sumber: lembagaName(r.lembaga_id),
    tampil: r.is_active === false ? 'tidak' : 'ya',
  }), [lembagaName]);

  const q = search.trim().toLowerCase();
  const visibleRows = q
    ? rows.filter((r) =>
        [r.nama, r.kode].some((v) => (v ?? '').toLowerCase().includes(q)),
      )
    : rows;

  const openTambah = useCallback(() => {
    setFNama(''); setFKode(''); setFUrutan('0');
    // Tanpa Global: super_admin tanpa lembaga = sebar ke semua; jika scope
    // lembaga aktif, tambah ke lembaga itu.
    const fallback = lembagaId !== '' ? String(lembagaId) : '';
    setScope(fallback);
    setTambahOpen(true);
  }, [lembagaId]);

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      const payload: ReferensiInput = { urutan: fUrutan === '' ? 0 : Number(fUrutan) };
      // Scope kosong = super_admin sebar ke semua lembaga (backend fan-out).
      if (scope !== '') payload.lembaga_id = Number(scope);
      else if (!isSuper) {
        setErr('Pilih lembaga dulu.');
        setSubmitting(false);
        return;
      }
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
    // Tiap baris milik satu lembaga: padam langsung baris itu.
    // Tanpa toast/reload di sini: antrean grid memanggil onSaved (= muat) dan
    // menunggunya sebelum membuang draft; toast cukup satu dari antrean.
    const lid = r.lembaga_id ?? undefined;
    try {
      await deleteReferensi(tipe, r.id, lid);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [tipe]);

  const onPulihkan = useCallback(async (r: ReferensiRow) => {
    try {
      await pulihkanReferensi(tipe, r.id);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [tipe]);

  /** Hapus permanen: baris benar-benar dibuang (bukan sekadar dipadamkan). */
  const onHapusPermanen = useCallback(async (r: ReferensiRow) => {
    setErr('');
    try {
      const res = await deleteReferensi(tipe, r.id, r.lembaga_id ?? undefined, true);
      toast.success(res.pesan);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [tipe, reload]);

  const renderActions = useCallback((r: ReferensiRow) => {
    // Tampil/padam lewat toggle di kolom is_active; aksi baris: Ubah + Hapus permanen.
    if (!canUbahRow(r)) return null;
    return (
      <>
        <EditAction id={`btn_ubah_referensi_${r.id}`} onClick={() => openEdit(r)} />
        <DeleteAction
          id={`btn_hapus_referensi_${r.id}`}
          title="Hapus permanen entri?"
          description={`"${rowText(r)}" dibuang dari kamus ${lembagaName(r.lembaga_id)}. Data yang sudah memakai teks ini tidak ikut berubah.`}
          onConfirm={() => onHapusPermanen(r)}
        />
      </>
    );
  }, [canUbahRow, openEdit, onHapusPermanen, rowText, lembagaName]);

  /** Simpan toggle kolom is_active: padam → nonaktifkan, nyala → pulihkan. */
  const onCommit = useCallback(async (id: number, fields: Record<string, string | null>) => {
    if (!('tampil' in fields)) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (fields.tampil === 'tidak') await onDelete(row);
    else await onPulihkan(row);
  }, [rows, onDelete, onPulihkan]);

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
        onCommit={onCommit}
        onSaved={reload}
        searchValue={search}
        onSearchChange={setSearch}
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
              value={lembagaId === '' ? '__semua' : String(lembagaId)}
              onValueChange={(v) => setLembagaId(v === '__semua' ? '' : Number(v))}
              disabled={terkunci}
            >
              <SelectTrigger id="select_lembaga_referensi" title="Filter lembaga" aria-label="Filter lembaga" size="sm" className="w-40">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="__semua">Semua</SelectItem>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            </FilterField>
          </>
        )}
        addButton={bisa(me, 'referensi.tambah') ? (
          <Button id="btn_tambah_referensi" onClick={openTambah} disabled={!tipe}>
            + Entri
          </Button>
        ) : undefined}
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
            <Select value={scope === '' ? '__semua' : scope} onValueChange={(v) => setScope(v === '__semua' ? '' : v)}>
              <SelectTrigger id="select_scope_referensi" className="w-full">
                <SelectValue placeholder={isSuper ? 'Semua lembaga (sebar)' : 'Pilih lembaga'} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {isSuper && <SelectItem value="__semua">Semua lembaga (sebar sekaligus)</SelectItem>}
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
