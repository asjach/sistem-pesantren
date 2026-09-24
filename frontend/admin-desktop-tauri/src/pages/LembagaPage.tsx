import { useCallback, useEffect, useState } from 'react';
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
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
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
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

const FIELDS: ExcelField[] = [
  {
    key: 'jenjang', label: 'jenjang', width: 110, kind: 'text', maxLength: 20,
    required: true,
    validate: (v) => {
      const t = (v ?? '').trim().toUpperCase();
      if (!t) return 'Jenjang wajib diisi.';
      return /^[A-Z0-9]{1,20}$/.test(t) ? null : 'Jenjang: huruf/angka kapital, maks 20.';
    },
  },
  {
    key: 'nama', label: 'nama', width: 260, kind: 'text', maxLength: 100,
    required: true,
    validate: (v) => (!v || !v.trim() ? 'Nama lembaga wajib diisi.' : null),
  },
  { key: 'kelompok', label: 'kelompok_psb', width: 140, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'kelompok_psb' } },
  { key: 'seleksi', label: 'is_seleksi', width: 100, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'is_seleksi' } },
];

function gridValues(l: Lembaga): Record<string, string | null> {
  return {
    jenjang: l.jenjang,
    nama: l.nama,
    kelompok: l.kelompok_psb === 'combo_mi_md' ? 'Combo MI-MD' : 'Eksklusif',
    seleksi: l.is_seleksi ? 'Ya' : 'Tidak',
  };
}

function bolehCombo(jenjang: string): boolean {
  return ['MI', 'MD'].includes(jenjang.trim().toUpperCase());
}

async function commitDraft(jenjang: string, f: Record<string, string | null>) {
  // `jenjang` imutabel: hanya nama yang bisa diubah dari grid.
  await updateLembaga(jenjang, {
    ...(f.nama !== undefined ? { nama: f.nama ?? '' } : {}),
  });
}

export default function LembagaPage() {
  const { user: me } = useAuth();
  const canUbah = bisa(me, 'lembaga.ubah');
  const canTambah = bisa(me, 'lembaga.tambah');
  const canHapus = bisa(me, 'lembaga.hapus');
  /** Pencarian tunggal halaman (topBar). */
  const [cari, setCari] = useState('');
  const {
    rows,
    loading,
    err,
    setErr,
    urut,
    arahUrut,
    terapkanUrut,
    load,
    lastPage,
    total,
    pager,
    onSaved,
  } = useDaftarTabel<Lembaga>({
    tableKey: 'lembaga',
    search: cari,
    ambil: (a) => listLembaga({
      search: a.search || undefined,
      sort: a.urut.length ? a.urut : undefined,
      arah: a.urut.length ? a.arah : undefined,
      page: a.page,
      per_page: a.perPage,
      signal: a.signal,
    }),
  });

  const [nama, setNama] = useState('');
  const [jenjang, setJenjang] = useState('');
  const [kelompokPsb, setKelompokPsb] = useState<'combo_mi_md' | 'eksklusif'>('eksklusif');
  const [isSeleksi, setIsSeleksi] = useState(false);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<Lembaga | null>(null);
  const [editRow, setEditRow] = useState<Lembaga | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKelompok, setEditKelompok] = useState<'combo_mi_md' | 'eksklusif'>('eksklusif');
  const [editSeleksi, setEditSeleksi] = useState(false);
  const [editAktif, setEditAktif] = useState(true);
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

  const openEdit = useCallback((l: Lembaga) => {
    setEditRow(l);
    setEditNama(l.nama);
    setEditKelompok(l.kelompok_psb === 'combo_mi_md' ? 'combo_mi_md' : 'eksklusif');
    setEditSeleksi(!!l.is_seleksi);
    setEditAktif(l.is_active ?? true);
    const teks = (v: unknown) => (v == null ? '' : String(v));
    setEditForm({
      nama_singkat: l.nama_singkat ?? '',
      mudir_am: l.mudir_am ?? '',
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
        jenjang: jenjang.trim().toUpperCase(),
        nama,
        kelompok_psb: kelompokPsb,
        is_seleksi: isSeleksi,
      });
      toast.success('Lembaga dibuat.');
      setNama(''); setJenjang('');
      setKelompokPsb('eksklusif'); setIsSeleksi(false);
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }, [nama, jenjang, kelompokPsb, isSeleksi, load, pager.goFirst]);

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
      await updateLembaga(editRow.jenjang, {
        nama: editNama,
        kelompok_psb: editKelompok,
        is_seleksi: editSeleksi,
        is_active: editAktif,
        nama_singkat: teks(f.nama_singkat),
        mudir_am: teks(f.mudir_am),
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
  }, [editRow, editNama, editKelompok, editSeleksi, editAktif, editForm, load]);

  const onDelete = useCallback(async (jenjang: string) => {
    try {
      await deleteLembaga(jenjang);
      toast.success('Lembaga dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  /** Mode Input: buat lembaga baru dari baris input (super_admin). */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    await createLembaga({
      jenjang: (f.jenjang ?? '').trim().toUpperCase(),
      nama: (f.nama ?? '').trim(),
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
            onConfirm={() => onDelete(l.jenjang)}
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
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari lembaga…" />
      <PengaturanHalaman tampil={{}} tabel={[{ key: 'lembaga', judul: 'Lembaga', fields: FIELDS }]} />
      <ExcelTable
        tableKey="lembaga"
        sumberTabel="lembaga"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada lembaga."
        canEdit={canUbah}
        onCommit={commitDraft}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        onCreateRow={canTambah ? createRow : undefined}
        addButton={canTambah ? (
          <Button id="btn_buka_tambah_lembaga" onClick={() => setTambahOpen(true)}>
            + Lembaga
          </Button>
        ) : undefined}
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
              <FieldLabel htmlFor="input_jenjang_lembaga">Jenjang (kunci unik, mis. MI)</FieldLabel>
              <Input id="input_jenjang_lembaga" value={jenjang} onChange={(e) => { const v = e.target.value; setJenjang(v); if (!bolehCombo(v)) setKelompokPsb('eksklusif'); }} required maxLength={20} placeholder="MI" autoComplete="off" />
              <FieldLabel htmlFor="input_nama_lembaga">Nama</FieldLabel>
              <Input id="input_nama_lembaga" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={100} autoComplete="off" />
              <FieldLabel htmlFor="select_kelompok_psb_lembaga">Kelompok PSB</FieldLabel>
              <Select value={kelompokPsb} onValueChange={(v) => setKelompokPsb(v as 'combo_mi_md' | 'eksklusif')}>
                <SelectTrigger id="select_kelompok_psb_lembaga" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="eksklusif">Eksklusif</SelectItem>
                    <SelectItem value="combo_mi_md" disabled={!bolehCombo(jenjang)}>Combo MI-MD (khusus MI/MD)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldLabel htmlFor="chk_seleksi_lembaga">Butuh seleksi</FieldLabel>
              <label htmlFor="chk_seleksi_lembaga" className="flex w-fit items-center gap-2 text-sm">
                <input id="chk_seleksi_lembaga" type="checkbox" checked={isSeleksi} onChange={(e) => setIsSeleksi(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              </label>
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
            <FieldLabel htmlFor="input_ubah_jenjang_lembaga">Jenjang (kunci, tak dapat diubah)</FieldLabel>
            <Input id="input_ubah_jenjang_lembaga" value={editRow?.jenjang ?? ''} readOnly disabled />
            <FieldLabel htmlFor="input_ubah_nama_lembaga">Nama</FieldLabel>
            <Input id="input_ubah_nama_lembaga" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={100} />
            {medan('input_ubah_nama_singkat_lembaga', 'Nama singkat', 'nama_singkat', { maxLength: 50 })}
            {medan('input_ubah_mudir_lembaga', 'Mudir / Kepala', 'mudir_am', { maxLength: 100 })}
            {pilihan('select_ubah_status_lembaga', 'Status', 'status', [
              { nilai: 'negeri', label: 'Negeri' },
              { nilai: 'swasta', label: 'Swasta' },
            ])}
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
                  <SelectItem value="combo_mi_md" disabled={!bolehCombo(editRow?.jenjang ?? '')}>Combo MI-MD (khusus MI/MD)</SelectItem>
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
