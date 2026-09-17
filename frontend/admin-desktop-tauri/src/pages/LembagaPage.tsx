import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import {
  createLembaga,
  deleteLembaga,
  listLembaga,
  updateLembaga,
  type Lembaga,
} from '../api/master';
import { errorMessage } from '../api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
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
import { ViewDialog } from '@/components/ViewDialog';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

const FIELDS: ExcelField[] = [
  {
    key: 'kode', label: 'Kode', width: 130, kind: 'text', maxLength: 20,
    validate: (v) => (v && v.length > 20 ? 'Kode maksimal 20 karakter.' : null),
  },
  {
    key: 'nama', label: 'Nama', width: 260, kind: 'text', maxLength: 100,
    required: true,
    validate: (v) => (!v || !v.trim() ? 'Nama lembaga wajib diisi.' : null),
  },
  { key: 'induk', label: 'Induk', width: 220, kind: 'static' },
  { key: 'kelompok', label: 'Kelompok PSB', width: 140, kind: 'static' },
  { key: 'seleksi', label: 'Seleksi', width: 100, kind: 'static' },
];

function gridValues(l: Lembaga): Record<string, string | null> {
  return {
    kode: l.kode,
    nama: l.nama,
    induk: l.parent?.nama ?? '',
    kelompok: l.kelompok_psb === 'combo_mi_md' ? 'Combo MI-MD' : 'Eksklusif',
    seleksi: l.is_seleksi ? 'Ya' : 'Tidak',
  };
}

function bolehCombo(kode: string): boolean {
  return ['MI', 'MD'].includes(kode.trim().toUpperCase());
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  await updateLembaga(id, {
    ...(f.nama !== undefined ? { nama: f.nama ?? '' } : {}),
    ...(f.kode !== undefined ? { kode: f.kode || undefined } : {}),
  });
}

export default function LembagaPage() {
  const { user: me } = useAuth();
  const canUbah = bisa(me, 'lembaga.ubah');
  const canTambah = bisa(me, 'lembaga.tambah');
  const canHapus = bisa(me, 'lembaga.hapus');
  const [rows, setRows] = useState<Lembaga[]>([]);
  const [all, setAll] = useState<Lembaga[]>([]);
  const [search, setSearch] = useState('');
  /** Urut header: daftar nilai allowlist + arah global (maks 3 kunci). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const pager = usePager('lembaga');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reqRef = useRef(0);

  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [parentId, setParentId] = useState('');
  const [kelompokPsb, setKelompokPsb] = useState<'combo_mi_md' | 'eksklusif'>('eksklusif');
  const [isSeleksi, setIsSeleksi] = useState(false);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<Lembaga | null>(null);
  const [editRow, setEditRow] = useState<Lembaga | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKode, setEditKode] = useState('');
  const [editKelompok, setEditKelompok] = useState<'combo_mi_md' | 'eksklusif'>('eksklusif');
  const [editSeleksi, setEditSeleksi] = useState(false);
  const [editAktif, setEditAktif] = useState(true);
  const [editParent, setEditParent] = useState('');
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const setF = useCallback(
    (kunci: string) => (e: { target: { value: string } }) =>
      setEditForm((f) => ({ ...f, [kunci]: e.target.value })),
    [],
  );
  const setFS = useCallback(
    (kunci: string) => (v: string) => setEditForm((f) => ({ ...f, [kunci]: v })),
    [],
  );

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage, o?: { urut?: string[]; arah?: 'naik' | 'turun' }) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const u = o?.urut ?? urut;
        const a = o?.arah ?? arahUrut;
        const res = await listLembaga({
          search: search || undefined,
          sort: u.length ? u : undefined,
          arah: u.length ? a : undefined,
          page: p,
          per_page: pp,
        });
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        setRows(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [search, urut, arahUrut, pager.page, pager.perPage, pager.sync],
  );

  /** Klik header: simpan urut baru lalu muat ulang dari halaman 1. */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun') {
    setUrut(nilai);
    setArahUrut(arah);
    pager.goFirst();
    void load(1, pager.perPage, { urut: nilai, arah });
  }

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, search]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setAll(p.data)).catch(() => {});
  }, []);

  const openEdit = useCallback((l: Lembaga) => {
    setEditRow(l);
    setEditNama(l.nama);
    setEditKode(l.kode ?? '');
    setEditKelompok(l.kelompok_psb === 'combo_mi_md' ? 'combo_mi_md' : 'eksklusif');
    setEditSeleksi(!!l.is_seleksi);
    setEditAktif(l.is_active ?? true);
    setEditParent(l.parent_id != null ? String(l.parent_id) : '');
    const teks = (v: unknown) => (v == null ? '' : String(v));
    setEditForm({
      nama_singkat: l.nama_singkat ?? '',
      mudir_am: l.mudir_am ?? '',
      jenjang: l.jenjang ?? '',
      status: l.status ?? '',
      npsn: l.npsn ?? '',
      nsm: l.nsm ?? '',
      npwp: l.npwp ?? '',
      no_izin_operasional: l.no_izin_operasional ?? '',
      tgl_izin: (l.tgl_izin ?? '').slice(0, 10),
      no_sk_pendirian: l.no_sk_pendirian ?? '',
      tgl_sk_pendirian: (l.tgl_sk_pendirian ?? '').slice(0, 10),
      tahun_berdiri: teks(l.tahun_berdiri),
      no_sk_kemenkumham: l.no_sk_kemenkumham ?? '',
      akreditasi: l.akreditasi ?? '',
      tgl_akreditasi: (l.tgl_akreditasi ?? '').slice(0, 10),
      penyelenggara: l.penyelenggara ?? '',
      provinsi: l.provinsi ?? '',
      kab_kota: l.kab_kota ?? '',
      kecamatan: l.kecamatan ?? '',
      desa: l.desa ?? '',
      rt: l.rt ?? '',
      rw: l.rw ?? '',
      kode_pos: l.kode_pos ?? '',
      alamat: l.alamat ?? '',
      lintang: teks(l.lintang),
      bujur: teks(l.bujur),
      telepon: l.telepon ?? '',
      email: l.email ?? '',
      website: l.website ?? '',
      logo_url: l.logo_url ?? '',
      waktu_belajar: l.waktu_belajar ?? '',
      mode_rapor: l.mode_rapor ?? '',
      template_rapor: l.template_rapor ?? '',
    });
  }, []);

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await createLembaga({
        nama,
        kode: kode || undefined,
        parent_id: parentId ? Number(parentId) : undefined,
        kelompok_psb: kelompokPsb,
        is_seleksi: isSeleksi,
      });
      toast.success('Lembaga dibuat.');
      setNama(''); setKode(''); setParentId('');
      setKelompokPsb('eksklusif'); setIsSeleksi(false);
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
      const p = await listLembaga({ per_page: 100 });
      setAll(p.data);
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }, [nama, kode, parentId, kelompokPsb, isSeleksi, load, pager.goFirst]);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    try {
      const f = editForm;
      const teks = (v: string | undefined) => {
        const t = (v ?? '').trim();
        return t === '' ? null : t;
      };
      const angka = (v: string | undefined): number | string | null => {
        const t = (v ?? '').trim();
        if (t === '') return null;
        const n = Number(t.replace(',', '.'));
        // Tak valid: kirim mentah agar validasi backend menolak dengan pesan jelas.
        return Number.isNaN(n) ? t : n;
      };
      await updateLembaga(editRow.id, {
        nama: editNama,
        kode: editKode || undefined,
        parent_id: editParent ? Number(editParent) : null,
        kelompok_psb: editKelompok,
        is_seleksi: editSeleksi,
        is_active: editAktif,
        nama_singkat: teks(f.nama_singkat),
        mudir_am: teks(f.mudir_am),
        jenjang: teks(f.jenjang),
        status: (f.status || null) as 'negeri' | 'swasta' | null,
        npsn: teks(f.npsn),
        nsm: teks(f.nsm),
        npwp: teks(f.npwp),
        no_izin_operasional: teks(f.no_izin_operasional),
        tgl_izin: teks(f.tgl_izin),
        no_sk_pendirian: teks(f.no_sk_pendirian),
        tgl_sk_pendirian: teks(f.tgl_sk_pendirian),
        tahun_berdiri: angka(f.tahun_berdiri) == null ? null : Number(angka(f.tahun_berdiri)),
        no_sk_kemenkumham: teks(f.no_sk_kemenkumham),
        akreditasi: (f.akreditasi || null) as 'A' | 'B' | 'C' | 'belum' | null,
        tgl_akreditasi: teks(f.tgl_akreditasi),
        penyelenggara: teks(f.penyelenggara),
        provinsi: teks(f.provinsi),
        kab_kota: teks(f.kab_kota),
        kecamatan: teks(f.kecamatan),
        desa: teks(f.desa),
        rt: teks(f.rt),
        rw: teks(f.rw),
        kode_pos: teks(f.kode_pos),
        alamat: teks(f.alamat),
        lintang: angka(f.lintang) == null ? null : Number(angka(f.lintang)),
        bujur: angka(f.bujur) == null ? null : Number(angka(f.bujur)),
        telepon: teks(f.telepon),
        email: teks(f.email),
        website: teks(f.website),
        logo_url: teks(f.logo_url),
        waktu_belajar: (f.waktu_belajar || null) as 'pagi' | 'siang' | 'pagi_siang' | null,
        mode_rapor: (f.mode_rapor || null) as 'terpisah' | 'digabung' | null,
        template_rapor: teks(f.template_rapor),
      });
      toast.success('Lembaga diubah.');
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [editRow, editNama, editKode, editParent, editKelompok, editSeleksi, editAktif, editForm, load]);

  const onDelete = useCallback(async (id: number) => {
    try {
      await deleteLembaga(id);
      toast.success('Lembaga dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const onSearchChange = useCallback((v: string) => {
    setSearch(v);
    pager.goFirst();
  }, [pager.goFirst]);

  const onSearchSubmit = useCallback(() => {
    pager.goFirst();
  }, [pager.goFirst]);

  const onSaved = useCallback(() => load(), [load]);

  /** Mode Input: buat lembaga baru dari baris input (super_admin). */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    await createLembaga({
      nama: (f.nama ?? '').trim(),
      kode: (f.kode ?? '').trim() || undefined,
    });
    toast.success('Lembaga dibuat.');
    await load(1);
  }, [load]);

  const renderActions = useCallback((l: Lembaga) => (
    <>
      <ViewAction id={`btn_lihat_lembaga_${l.id}`} onClick={() => setViewRow(l)} />
      {canUbah && (
        <EditAction id={`btn_ubah_lembaga_${l.id}`} onClick={() => openEdit(l)} />
      )}
      {canHapus && (
        <>
          <DeleteAction
            id={`btn_hapus_lembaga_${l.id}`}
            title="Hapus lembaga?"
            description={`${l.nama} akan dihapus permanen.`}
            onConfirm={() => onDelete(l.id)}
          />
        </>
      )}
    </>
  ), [canUbah, canHapus, openEdit, onDelete]);

  const medan = (
    id: string, label: string, kunci: string,
    opts?: { type?: string; maxLength?: number; placeholder?: string },
  ) => (
    <>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id} type={opts?.type ?? 'text'} value={editForm[kunci] ?? ''} onChange={setF(kunci)}
        maxLength={opts?.maxLength} placeholder={opts?.placeholder} autoComplete="off"
      />
    </>
  );

  const pilihan = (
    id: string, label: string, kunci: string, items: Array<{ nilai: string; label: string; mati?: boolean }>,
  ) => (
    <>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={editForm[kunci] ?? ''} onValueChange={setFS(kunci)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="">—</SelectItem>
            {items.map((o) => (
              <SelectItem key={o.nilai} value={o.nilai} disabled={o.mati}>{o.label}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );

  const seksi = (judul: string) => (
    <div className="col-span-2 border-b pb-1 pt-2 text-sm font-semibold">{judul}</div>
  );

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="lembaga"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada lembaga."
        canEdit={canUbah}
        onCommit={commitDraft}
        onSaved={onSaved}
        opsiUrut={[
          { kunci: 'kode', nilai: 'kode' },
          { kunci: 'nama', nilai: 'nama' },
          { kunci: 'induk', nilai: 'induk' },
          { kunci: 'kelompok', nilai: 'kelompok' },
          { kunci: 'seleksi', nilai: 'seleksi' },
        ]}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        onCreateRow={canTambah ? createRow : undefined}
        searchValue={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchPlaceholder="Nama / kode"
        addButton={canTambah ? (
          <Button id="btn_buka_tambah_lembaga" onClick={() => setTambahOpen(true)}>
            + Lembaga
          </Button>
        ) : undefined}
        searchIds={{ form: 'form_cari_lembaga', input: 'input_cari_lembaga', button: 'btn_cari_lembaga' }}
        renderActions={renderActions}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />
      {canTambah && (
        <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Tambah lembaga</DialogTitle>
              <DialogDescription className="sr-only">Formulir penambahan lembaga baru.</DialogDescription>
            </DialogHeader>
            <form id="form_tambah_lembaga" onSubmit={onCreate} autoComplete="off" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
              <FieldLabel htmlFor="input_nama_lembaga">Nama</FieldLabel>
              <Input id="input_nama_lembaga" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={100} autoComplete="off" />
              <FieldLabel htmlFor="input_kode_lembaga">Kode (unik global, opsional)</FieldLabel>
              <Input id="input_kode_lembaga" value={kode} onChange={(e) => { const v = e.target.value; setKode(v); if (!bolehCombo(v)) setKelompokPsb('eksklusif'); }} maxLength={20} placeholder="MI" autoComplete="off" />
              <FieldLabel htmlFor="select_kelompok_psb_lembaga">Kelompok PSB</FieldLabel>
              <Select value={kelompokPsb} onValueChange={(v) => setKelompokPsb(v as 'combo_mi_md' | 'eksklusif')}>
                <SelectTrigger id="select_kelompok_psb_lembaga" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="eksklusif">Eksklusif</SelectItem>
                    <SelectItem value="combo_mi_md" disabled={!bolehCombo(kode)}>Combo MI-MD (khusus MI/MD)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldLabel htmlFor="chk_seleksi_lembaga">Butuh seleksi</FieldLabel>
              <label htmlFor="chk_seleksi_lembaga" className="flex w-fit items-center gap-2 text-sm">
                <input id="chk_seleksi_lembaga" type="checkbox" checked={isSeleksi} onChange={(e) => setIsSeleksi(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              </label>
              <FieldLabel htmlFor="select_induk_lembaga">Induk (opsional)</FieldLabel>
              <Select value={parentId || '_root'} onValueChange={(v) => setParentId(v === '_root' ? '' : v)}>
                <SelectTrigger id="select_induk_lembaga" className="w-full">
                  <SelectValue placeholder="Tanpa induk (root)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Induk lembaga</SelectLabel>
                    <SelectItem value="_root">Tanpa induk (root)</SelectItem>
                    {all.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <DialogFooter className="col-span-2">
                <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
                <Button id="btn_tambah_lembaga" type="submit">Tambah</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <ViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        title={viewRow ? `Lembaga: ${viewRow.nama}` : 'Lembaga'}
        row={viewRow as unknown as Record<string, unknown> | null}
      />
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ubah lembaga</DialogTitle>
            <DialogDescription className="sr-only">Formulir perubahan data lembaga.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            {seksi('Identitas')}
            <FieldLabel htmlFor="input_ubah_nama_lembaga">Nama</FieldLabel>
            <Input id="input_ubah_nama_lembaga" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={100} />
            {medan('input_ubah_nama_singkat_lembaga', 'Nama singkat', 'nama_singkat', { maxLength: 50 })}
            <FieldLabel htmlFor="input_ubah_kode_lembaga">Kode (unik global, opsional)</FieldLabel>
            <Input id="input_ubah_kode_lembaga" value={editKode} onChange={(e) => { const v = e.target.value; setEditKode(v); if (!bolehCombo(v)) setEditKelompok('eksklusif'); }} maxLength={20} />
            {medan('input_ubah_mudir_lembaga', 'Mudir / Kepala', 'mudir_am', { maxLength: 100 })}
            {medan('input_ubah_jenjang_lembaga', 'Jenjang', 'jenjang', { maxLength: 50 })}
            {pilihan('select_ubah_status_lembaga', 'Status', 'status', [
              { nilai: 'negeri', label: 'Negeri' },
              { nilai: 'swasta', label: 'Swasta' },
            ])}
            <FieldLabel htmlFor="select_ubah_induk_lembaga">Induk</FieldLabel>
            <Select value={editParent || '_root'} onValueChange={(v) => setEditParent(v === '_root' ? '' : v)}>
              <SelectTrigger id="select_ubah_induk_lembaga" className="w-full">
                <SelectValue placeholder="Tanpa induk (root)" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_root">Tanpa induk (root)</SelectItem>
                  {all.filter((l) => editRow == null || l.id !== editRow.id).map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="chk_ubah_aktif_lembaga">Aktif</FieldLabel>
            <label htmlFor="chk_ubah_aktif_lembaga" className="flex w-fit items-center gap-2 text-sm">
              <input id="chk_ubah_aktif_lembaga" type="checkbox" checked={editAktif} onChange={(e) => setEditAktif(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            </label>
            {seksi('Legalitas & Akreditasi')}
            {medan('input_ubah_npsn_lembaga', 'NPSN', 'npsn', { maxLength: 20 })}
            {medan('input_ubah_nsm_lembaga', 'NSM', 'nsm', { maxLength: 30 })}
            {medan('input_ubah_npwp_lembaga', 'NPWP', 'npwp', { maxLength: 30 })}
            {medan('input_ubah_izin_lembaga', 'No. izin operasional', 'no_izin_operasional', { maxLength: 100 })}
            {medan('input_ubah_tgl_izin_lembaga', 'Tgl. izin', 'tgl_izin', { type: 'date' })}
            {medan('input_ubah_sk_pendirian_lembaga', 'No. SK pendirian', 'no_sk_pendirian', { maxLength: 100 })}
            {medan('input_ubah_tgl_sk_lembaga', 'Tgl. SK pendirian', 'tgl_sk_pendirian', { type: 'date' })}
            {medan('input_ubah_tahun_berdiri_lembaga', 'Tahun berdiri', 'tahun_berdiri', { type: 'number', placeholder: '1998' })}
            {medan('input_ubah_sk_kemenkumham_lembaga', 'No. SK Kemenkumham', 'no_sk_kemenkumham', { maxLength: 100 })}
            {pilihan('select_ubah_akreditasi_lembaga', 'Akreditasi', 'akreditasi', [
              { nilai: 'A', label: 'A' },
              { nilai: 'B', label: 'B' },
              { nilai: 'C', label: 'C' },
              { nilai: 'belum', label: 'Belum' },
            ])}
            {medan('input_ubah_tgl_akreditasi_lembaga', 'Tgl. akreditasi', 'tgl_akreditasi', { type: 'date' })}
            {medan('input_ubah_penyelenggara_lembaga', 'Penyelenggara', 'penyelenggara', { maxLength: 100 })}
            {seksi('Alamat & Kontak')}
            {medan('input_ubah_alamat_lembaga', 'Alamat', 'alamat')}
            {medan('input_ubah_desa_lembaga', 'Desa', 'desa', { maxLength: 100 })}
            {medan('input_ubah_kecamatan_lembaga', 'Kecamatan', 'kecamatan', { maxLength: 100 })}
            {medan('input_ubah_kab_kota_lembaga', 'Kab/Kota', 'kab_kota', { maxLength: 100 })}
            {medan('input_ubah_provinsi_lembaga', 'Provinsi', 'provinsi', { maxLength: 100 })}
            {medan('input_ubah_rt_lembaga', 'RT', 'rt', { maxLength: 3 })}
            {medan('input_ubah_rw_lembaga', 'RW', 'rw', { maxLength: 3 })}
            {medan('input_ubah_kode_pos_lembaga', 'Kode pos', 'kode_pos', { maxLength: 10 })}
            {medan('input_ubah_lintang_lembaga', 'Lintang', 'lintang', { placeholder: '-6.89' })}
            {medan('input_ubah_bujur_lembaga', 'Bujur', 'bujur', { placeholder: '107.61' })}
            {medan('input_ubah_telepon_lembaga', 'Telepon', 'telepon', { maxLength: 30 })}
            {medan('input_ubah_email_lembaga', 'Email', 'email', { maxLength: 100 })}
            {medan('input_ubah_website_lembaga', 'Website', 'website', { maxLength: 100 })}
            {medan('input_ubah_logo_lembaga', 'Logo URL', 'logo_url', { maxLength: 255 })}
            {seksi('Operasional & PSB')}
            {pilihan('select_ubah_waktu_lembaga', 'Waktu belajar', 'waktu_belajar', [
              { nilai: 'pagi', label: 'Pagi' },
              { nilai: 'siang', label: 'Siang' },
              { nilai: 'pagi_siang', label: 'Pagi dan siang' },
            ])}
            {pilihan('select_ubah_rapor_lembaga', 'Mode rapor', 'mode_rapor', [
              { nilai: 'terpisah', label: 'Terpisah' },
              { nilai: 'digabung', label: 'Digabung' },
            ])}
            {medan('input_ubah_template_rapor_lembaga', 'Template rapor', 'template_rapor', { maxLength: 50 })}
            <FieldLabel htmlFor="select_ubah_kelompok_psb">Kelompok PSB</FieldLabel>
            <Select value={editKelompok} onValueChange={(v) => setEditKelompok(v as 'combo_mi_md' | 'eksklusif')}>
              <SelectTrigger id="select_ubah_kelompok_psb" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="eksklusif">Eksklusif</SelectItem>
                  <SelectItem value="combo_mi_md" disabled={!bolehCombo(editKode)}>Combo MI-MD (khusus MI/MD)</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="chk_ubah_seleksi_lembaga">Butuh seleksi</FieldLabel>
            <label htmlFor="chk_ubah_seleksi_lembaga" className="flex w-fit items-center gap-2 text-sm">
              <input id="chk_ubah_seleksi_lembaga" type="checkbox" checked={editSeleksi} onChange={(e) => setEditSeleksi(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_lembaga" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
