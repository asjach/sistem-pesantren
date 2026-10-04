import { useCallback, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  KOLOM_IMPORT_PEGAWAI,
  batalPotongPegawai,
  buatkanAkunPegawai,
  createPegawai,
  dataPegawaiExisting,
  deletePegawai,
  generateAkunPegawai,
  importPegawaiPotong,
  listPegawai,
  tautkanAkunPegawai,
  unduhGalatPegawai,
  unduhTemplatePegawai,
  updatePegawai,
  uploadFotoPegawai,
  type AkunGuruBaru,
  type HasilGenerateAkun,
  type Pegawai,
} from '../api/pegawai';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ImportBertahapUmumDialog from '@/components/ImportBertahapUmumDialog';
import { DeleteAction, EditAction, ActionIcon } from '@/components/RowActions';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { FileUp, ImageUp, UserCheck } from '@/icons';
import { toast } from 'sonner';

/** Seluruh kolom identitas Buku Induk Guru (cermin tabel `pegawai`). */
const FIELDS: ExcelField[] = [
  { key: 'nama_lengkap', label: 'pegawai.nama_lengkap', width: 220, kind: 'text', maxLength: 255, required: true },
  { key: 'nip', label: 'pegawai.nip', width: 190, kind: 'text', maxLength: 50 },
  { key: 'nipp', label: 'pegawai.nipp', width: 150, kind: 'text', maxLength: 30 },
  { key: 'nik', label: 'pegawai.nik', width: 190, kind: 'text', maxLength: 20 },
  { key: 'jenis_kelamin', label: 'pegawai.jenis_kelamin', width: 90, kind: 'text', maxLength: 1 },
  { key: 'gelar_depan', label: 'pegawai.gelar_depan', width: 110, kind: 'text', maxLength: 50 },
  { key: 'gelar_belakang', label: 'pegawai.gelar_belakang', width: 110, kind: 'text', maxLength: 50 },
  { key: 'tempat_lahir', label: 'pegawai.tempat_lahir', width: 150, kind: 'text', maxLength: 100 },
  { key: 'tanggal_lahir', label: 'pegawai.tanggal_lahir', width: 130, kind: 'text', maxLength: 10 },
  { key: 'no_hp', label: 'No. HP', width: 150, kind: 'text', maxLength: 20 },
  { key: 'email_pribadi', label: 'pegawai.email_pribadi', width: 200, kind: 'text', maxLength: 255 },
  { key: 'email_gws', label: 'pegawai.email_gws', width: 200, kind: 'text', maxLength: 255 },
  { key: 'status_aktif', label: 'pegawai.status_aktif', width: 110, kind: 'text', maxLength: 10 },
  { key: 'tgl_mulai_kerja', label: 'pegawai.tgl_mulai_kerja', width: 140, kind: 'text', maxLength: 10 },
  { key: 'no_sk_awal', label: 'pegawai.no_sk_awal', width: 180, kind: 'text', maxLength: 100 },
  { key: 'tgl_sk_awal', label: 'pegawai.tgl_sk_awal', width: 140, kind: 'text', maxLength: 10 },
  { key: 'pendidikan_terakhir', label: 'pegawai.pendidikan_terakhir', width: 150, kind: 'text', maxLength: 100 },
  { key: 'jenis_ptk', label: 'pegawai.jenis_ptk', width: 150, kind: 'text', maxLength: 100 },
  { key: 'status_pernikahan', label: 'pegawai.status_pernikahan', width: 150, kind: 'text', maxLength: 100 },
  { key: 'agama', label: 'pegawai.agama', width: 120, kind: 'text', maxLength: 100 },
  { key: 'gol_darah', label: 'Golongan Darah', width: 90, kind: 'text', maxLength: 10 },
  { key: 'npwp', label: 'pegawai.npwp', width: 180, kind: 'text', maxLength: 50 },
  { key: 'no_kk', label: 'pegawai.no_kk', width: 180, kind: 'text', maxLength: 20 },
  { key: 'no_bpjs', label: 'pegawai.no_bpjs', width: 180, kind: 'text', maxLength: 50 },
  { key: 'status_tempat_tinggal', label: 'pegawai.status_tempat_tinggal', width: 170, kind: 'text', maxLength: 100 },
  { key: 'niat_npa', label: 'pegawai.niat_npa', width: 150, kind: 'text', maxLength: 100 },
  { key: 'jarak_ke_pesantren', label: 'pegawai.jarak_ke_pesantren', width: 160, kind: 'text', maxLength: 100 },
  { key: 'waktu_tempuh', label: 'pegawai.waktu_tempuh', width: 150, kind: 'text', maxLength: 100 },
  { key: 'transportasi', label: 'pegawai.transportasi', width: 150, kind: 'text', maxLength: 100 },
  { key: 'sertifikasi', label: 'pegawai.sertifikasi', width: 110, kind: 'text', maxLength: 10 },
  { key: 'provinsi', label: 'pegawai.provinsi', width: 150, kind: 'text', maxLength: 100 },
  { key: 'kab_kota', label: 'pegawai.kab_kota', width: 150, kind: 'text', maxLength: 100 },
  { key: 'kecamatan', label: 'pegawai.kecamatan', width: 150, kind: 'text', maxLength: 100 },
  { key: 'desa_kelurahan', label: 'pegawai.desa_kelurahan', width: 160, kind: 'text', maxLength: 100 },
  { key: 'rt', label: 'pegawai.rt', width: 70, kind: 'text', maxLength: 3 },
  { key: 'rw', label: 'pegawai.rw', width: 70, kind: 'text', maxLength: 3 },
  { key: 'kode_pos', label: 'pegawai.kode_pos', width: 110, kind: 'text', maxLength: 10 },
  { key: 'alamat', label: 'pegawai.alamat', width: 240, kind: 'text', maxLength: 500 },
  { key: 'foto', label: 'Foto', width: 110, kind: 'static' },
  { key: 'akun', label: 'Akun', width: 160, kind: 'static',  },
];

function gridValues(p: Pegawai): Record<string, string | null> {
  return {
    nama_lengkap: p.nama_lengkap,
    nip: p.nip,
    nipp: p.nipp,
    nik: p.nik,
    jenis_kelamin: p.jenis_kelamin,
    gelar_depan: p.gelar_depan,
    gelar_belakang: p.gelar_belakang,
    tempat_lahir: p.tempat_lahir,
    tanggal_lahir: p.tanggal_lahir,
    no_hp: p.no_hp,
    email_pribadi: p.email_pribadi,
    email_gws: p.email_gws,
    status_aktif: p.status_aktif,
    tgl_mulai_kerja: p.tgl_mulai_kerja,
    no_sk_awal: p.no_sk_awal,
    tgl_sk_awal: p.tgl_sk_awal,
    pendidikan_terakhir: p.pendidikan_terakhir,
    jenis_ptk: p.jenis_ptk,
    status_pernikahan: p.status_pernikahan,
    agama: p.agama,
    gol_darah: p.gol_darah,
    npwp: p.npwp,
    no_kk: p.no_kk,
    no_bpjs: p.no_bpjs,
    status_tempat_tinggal: p.status_tempat_tinggal,
    niat_npa: p.niat_npa,
    jarak_ke_pesantren: p.jarak_ke_pesantren,
    waktu_tempuh: p.waktu_tempuh,
    transportasi: p.transportasi,
    sertifikasi: p.sertifikasi,
    provinsi: p.provinsi,
    kab_kota: p.kab_kota,
    kecamatan: p.kecamatan,
    desa_kelurahan: p.desa_kelurahan,
    rt: p.rt,
    rw: p.rw,
    kode_pos: p.kode_pos,
    alamat: p.alamat,
    foto: p.foto_url ? 'Ada' : '—',
    akun: p.akun ? p.akun.name : '—',
  };
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  const bersih: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === 'akun') continue;
    bersih[k] = v === '' ? null : v;
  }
  if (Object.keys(bersih).length > 0) await updatePegawai(id, bersih);
}

/** Halaman Buku Induk Guru: seluruh field `pegawai` + Urutkan/Kolom + Import + Unduh existing. */
export default function PegawaiPage() {
  const { user } = useAuth();
  const canTambah = bisa(user, 'pegawai.tambah');
  const canUbah = bisa(user, 'pegawai.ubah');
  const canHapus = bisa(user, 'pegawai.hapus');
  const canBuatAkun = canUbah && bisa(user, 'pengguna.tambah');
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('');

  // Buku Induk bersifat global: abaikan filter global jenjang/TA agar pegawai
  // tanpa penempatan tetap tampil. Filter penempatan hanya di halaman terkait.
  const { rows, loading, err, urut, arahUrut, terapkanUrut, load, lastPage, total, pager, onSaved } =
    useDaftarTabel<Pegawai>({
      tableKey: 'pegawai',
      search: cari,
      ambil: (a) => listPegawai({
        q: a.search || undefined,
        status_aktif: status || undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      }),
      deps: [status],
    });

  const [tambahOpen, setTambahOpen] = useState(false);
  const [fNama, setFNama] = useState('');
  const [fJk, setFJk] = useState('L');
  const [fNip, setFNip] = useState('');
  const [fNipp, setFNipp] = useState('');
  const [fNik, setFNik] = useState('');
  const [busy, setBusy] = useState(false);

  const [akunRow, setAkunRow] = useState<Pegawai | null>(null);
  const [akunId, setAkunId] = useState('');
  const [fileOpen, setFileOpen] = useState(false);
  const [fotoRow, setFotoRow] = useState<Pegawai | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [akunBaru, setAkunBaru] = useState<AkunGuruBaru | null>(null);
  const [hasilGenerate, setHasilGenerate] = useState<HasilGenerateAkun | null>(null);

  const onTambah = useCallback(async () => {
    if (!fNama.trim()) return;
    setBusy(true);
    try {
      await createPegawai({
        nama_lengkap: fNama.trim(),
        jenis_kelamin: fJk,
        nip: fNip.trim() || null,
        nipp: fNipp.trim() || null,
        nik: fNik.trim() || null,
      });
      toast.success('Pegawai ditambahkan.');
      setTambahOpen(false);
      setFNama('');
      setFNip('');
      setFNipp('');
      setFNik('');
      pager.goFirst();
      await load(1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [fNama, fJk, fNip, fNipp, fNik, pager, load]);

  const onGenerateAkun = useCallback(async () => {
    setBusy(true);
    try {
      const res = await generateAkunPegawai({
        ...(cari.trim() === '' ? {} : { q: cari.trim() }),
        ...(status === '' ? {} : { status_aktif: status }),
      });
      toast.success(res.pesan);
      setHasilGenerate(res.data);
      await load(1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [cari, status, load]);

  const onHapus = useCallback(async (id: number) => {
    try {
      await deletePegawai(id);
      toast.success('Pegawai dihapus.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [load]);

  const onTautkan = useCallback(async () => {
    if (!akunRow) return;
    setBusy(true);
    try {
      await tautkanAkunPegawai(akunRow.id, akunId.trim() === '' ? null : Number(akunId));
      toast.success('Akun ditautkan.');
      setAkunRow(null);
      setAkunId('');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [akunRow, akunId, load]);

  const renderActions = useCallback((p: Pegawai) => (
    <>
      {canUbah && <EditAction id={`btn_akun_pegawai_${p.id}`} onClick={() => { setAkunRow(p); setAkunId(p.user_id ? String(p.user_id) : ''); }} />}
      {canBuatAkun && !p.user_id && (p.email_pribadi || p.no_hp) && (
        <ActionIcon
          id={`btn_buatkan_akun_pegawai_${p.id}`}
          title="Buatkan akun guru dari email/no. HP"
          aria-label={`Buatkan akun guru untuk ${p.nama_lengkap}`}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await buatkanAkunPegawai(p.id);
              toast.success(res.pesan);
              setAkunBaru(res.data);
              await load();
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <UserCheck size={16} />
        </ActionIcon>
      )}
      {canUbah && (
        <ActionIcon
          id={`btn_foto_pegawai_${p.id}`}
          title="Upload foto"
          aria-label={`Upload foto ${p.nama_lengkap}`}
          onClick={() => { setFotoRow(p); setFotoFile(null); }}
        >
          <ImageUp size={16} />
        </ActionIcon>
      )}
      {canHapus && (
        <DeleteAction
          id={`btn_hapus_pegawai_${p.id}`}
          title="Hapus pegawai?"
          description={`${p.nama_lengkap} akan dihapus permanen beserta penempatannya.`}
          onConfirm={() => onHapus(p.id)}
        />
      )}
    </>
  ), [canUbah, canBuatAkun, canHapus, onHapus, load]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tampil={{ semester: false, tingkat: false }} tabel={[{ key: 'pegawai', judul: 'Pegawai', fields: FIELDS }]} />
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIP / NIK…" />
      <ExcelTable
        tableKey="pegawai"
        sumberTabel="pegawai"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada pegawai."
        canEdit={canUbah}
        onCommit={commitDraft}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        filter={(
          <FilterField label="Status" htmlFor="select_status_pegawai">
            <Select value={status === '' ? 'semua' : status} onValueChange={(v) => { setStatus(v === 'semua' ? '' : v); pager.goFirst(); }}>
              <SelectTrigger id="select_status_pegawai" title="Filter status" aria-label="Filter status" size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="semua">Semua</SelectItem>
                <SelectItem value="Ya">Ya</SelectItem>
                <SelectItem value="Tidak">Tidak</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
          </FilterField>
        )}
        addButton={(canTambah || canBuatAkun) ? (
          <>
            {canTambah && (
              <Button id="btn_buka_import_pegawai" variant="outline" onClick={() => setFileOpen(true)}>
                <FileUp data-icon="inline-start" size={16} /> Import
              </Button>
            )}
            {canBuatAkun && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button id="btn_generate_akun_pegawai" variant="outline" disabled={busy}
                    onClick={() => void onGenerateAkun()}>
                    <UserCheck data-icon="inline-start" size={16} /> Generate akun
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Buatkan/selaraskan akun guru untuk hasil filter saat ini (sandi bawaan dev)</p></TooltipContent>
              </Tooltip>
            )}
            {canTambah && (
              <Button id="btn_buka_tambah_pegawai" onClick={() => setTambahOpen(true)}>
                + Pegawai
              </Button>
            )}
          </>
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
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah pegawai</DialogTitle>
            <DialogDescription className="sr-only">Formulir pegawai baru.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_nama_pegawai">Nama lengkap</FieldLabel>
            <Input id="input_nama_pegawai" value={fNama} onChange={(e) => setFNama(e.target.value)} maxLength={255} />
            <FieldLabel htmlFor="select_jk_pegawai">Jenis kelamin</FieldLabel>
            <Select value={fJk} onValueChange={setFJk}>
              <SelectTrigger id="select_jk_pegawai"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
            <FieldLabel htmlFor="input_nip_pegawai">NIP</FieldLabel>
            <Input id="input_nip_pegawai" value={fNip} onChange={(e) => setFNip(e.target.value)} maxLength={50} />
            <FieldLabel htmlFor="input_nipp_pegawai">NIPP</FieldLabel>
            <Input id="input_nipp_pegawai" value={fNipp} onChange={(e) => setFNipp(e.target.value)} maxLength={30} placeholder="ID dari sistem lama" />
            <FieldLabel htmlFor="input_nik_pegawai">NIK</FieldLabel>
            <Input id="input_nik_pegawai" value={fNik} onChange={(e) => setFNik(e.target.value)} maxLength={20} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
            <Button id="btn_tambah_pegawai" disabled={!fNama.trim() || busy} onClick={() => void onTambah()}>Tambah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={akunRow !== null} onOpenChange={(o) => { if (!o) setAkunRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tautkan akun: {akunRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>Isi ID pengguna (lihat halaman Pengguna). Kosongkan untuk melepas.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_akun_pegawai">ID pengguna</FieldLabel>
            <Input id="input_akun_pegawai" inputMode="numeric" value={akunId} onChange={(e) => setAkunId(e.target.value)} placeholder="mis. 12" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAkunRow(null)}>Batal</Button>
            <Button id="btn_tautkan_akun_pegawai" disabled={busy} onClick={() => void onTautkan()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={fotoRow !== null} onOpenChange={(o) => { if (!o) setFotoRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload foto: {fotoRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>JPG/PNG maks 2 MB.</DialogDescription>
          </DialogHeader>
          <Input id="input_foto_pegawai" type="file" accept="image/png,image/jpeg" onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFotoRow(null)}>Batal</Button>
            <Button id="btn_upload_foto_pegawai" disabled={!fotoFile || busy} onClick={async () => {
              if (!fotoRow || !fotoFile) return;
              setBusy(true);
              try {
                await uploadFotoPegawai(fotoRow.id, fotoFile);
                toast.success('Foto diupload.');
                setFotoRow(null);
                await load();
              } catch (e2) {
                toast.error(errorMessage(e2));
              } finally {
                setBusy(false);
              }
            }}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={akunBaru !== null} onOpenChange={(o) => { if (!o) setAkunBaru(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Akun guru dibuat: {akunBaru?.pegawai.nama_lengkap}</DialogTitle>
            <DialogDescription>Bagikan kredensial ini ke guru bersangkutan.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2">
            <FieldLabel htmlFor="info_akun_email">Email</FieldLabel>
            <Input id="info_akun_email" readOnly value={akunBaru?.email ?? '—'} />
            <FieldLabel htmlFor="info_akun_telepon">No. HP</FieldLabel>
            <Input id="info_akun_telepon" readOnly value={akunBaru?.telepon ?? '—'} />
            <FieldLabel htmlFor="info_akun_sandi">Sandi bawaan</FieldLabel>
            <Input id="info_akun_sandi" readOnly value={akunBaru?.sandi_bawaan ?? ''} />
          </div>
          {akunBaru && akunBaru.catatan.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-amber-700">
              {akunBaru.catatan.map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">Role guru belum punya izin apa pun — beri izin lewat halaman Kelola Izin.</p>
          <DialogFooter>
            <Button id="btn_tutup_akun_baru" onClick={() => setAkunBaru(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={hasilGenerate !== null} onOpenChange={(o) => { if (!o) setHasilGenerate(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hasil generate akun</DialogTitle>
            <DialogDescription>
              {hasilGenerate ? `${hasilGenerate.dibuat} dibuat · ${hasilGenerate.diperbarui} diperbarui · ${hasilGenerate.dilewati} dilewati. Sandi akun baru = sandi bawaan dev.` : ''}
            </DialogDescription>
          </DialogHeader>
          {hasilGenerate && hasilGenerate.gagal.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-auto text-sm">
              {hasilGenerate.gagal.map((g) => (
                <li key={g.pegawai_id}>{g.nama} — {g.alasan}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button id="btn_tutup_hasil_generate" onClick={() => setHasilGenerate(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportBertahapUmumDialog
        open={fileOpen}
        onOpenChange={setFileOpen}
        config={{
          idPrefix: 'pegawai',
          judul: 'Import pegawai bertahap',
          deskripsi: 'Import Buku Induk Guru. Baris ber-email valid otomatis dibuatkan akun guru (sandi bawaan dev). Penempatan ke lembaga dilakukan di halaman Lembaga Pegawai.',
          kolom: KOLOM_IMPORT_PEGAWAI,
          wajib: ['nama_lengkap', 'jenis_kelamin'],
          idTombol: {
            template: 'btn_unduh_template_pegawai',
            periksa: 'btn_periksa_import_pegawai',
            mulai: 'btn_import_pegawai',
          },
          labelTemplate: 'Unduh template Excel pegawai',
          unduhTemplate: unduhTemplatePegawai,
          unduhData: {
            label: 'Unduh data pegawai existing',
            ambil: dataPegawaiExisting,
            namaBerkas: 'data-pegawai-existing.xlsx',
            judulSheet: 'Data Pegawai',
          },
          kirim: ({ sesi_id, mode, total, baris, terakhir }) =>
            importPegawaiPotong({
              ...(sesi_id === undefined ? {} : { sesi_id }),
              mode, ...(sesi_id === undefined ? { total } : {}), baris,
              ...(terakhir ? { terakhir } : {}),
            }),
          batal: batalPotongPegawai,
          unduhGalat: unduhGalatPegawai,
          onSelesai: () => {
            setFileOpen(false);
            pager.goFirst();
            void load(1);
          },
        }}
      />
    </div>
  );
}
