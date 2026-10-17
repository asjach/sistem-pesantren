import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from '@/components/ui/resizable';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { ActionIcon, DeleteAction, EditAction } from '@/components/RowActions';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import LabelTombolTambah from '@/components/LabelTombolTambah';
import { labelPintasan, usePintasanBaru } from '@/hooks/usePintasanBaru';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { ArrowRight, GraduationCap, Plus } from '@/icons';
import {
  buatKomposisi, buatKurikulum, daftarKomposisi, daftarKurikulum, hapusKomposisi,
  hapusKurikulum, ubahKomposisi, ubahKurikulum,
  type Kurikulum, type KomposisiBaris, type MataPelajaran,
} from '@/api/kurikulum';

/** Kolom tabel kiri — daftar kurikulum jenjang aktif. Nama boleh diedit sel
 *  (pakai endpoint yang sama dengan dialog Ubah), jumlah mapel/kelas statis. */
const FIELDS_DAFTAR: ExcelField[] = [
  {
    key: 'nama', label: 'Nama Kurikulum', width: 190, kind: 'text', maxLength: 100,
    validate: (v) => (!v || !v.trim() ? 'Nama kurikulum wajib diisi.' : null),
  },
  { key: 'mapel_count', label: 'Mapel', width: 70, kind: 'static', format: 'angka' },
  { key: 'kelas_count', label: 'Kelas', width: 70, kind: 'static', format: 'angka' },
];

/** Kolom tabel tengah — mapel jenjang ini yang belum masuk kurikulum. */
const FIELDS_TERSEDIA: ExcelField[] = [
  { key: 'nama_mapel', label: 'Mapel', width: 180, kind: 'static' },
  { key: 'kelompok', label: 'Kelompok', width: 110, kind: 'static' },
];

/** Angka bulat 0..maks, atau kosong (null = biarkan kosong). */
function validasiAngka(maks: number, pesan: string) {
  return (v: string | null) => {
    const s = (v ?? '').trim();
    if (s === '') return null;
    if (!/^\d+$/.test(s) || Number(s) > maks) return pesan;
    return null;
  };
}

function nilaiDaftar(k: Kurikulum): Record<string, string | null> {
  return {
    nama: k.nama,
    mapel_count: String(k.mapel_count ?? 0),
    kelas_count: String(k.kelas_count ?? 0),
  };
}

/** Bentuk mapel pada daftar "belum masuk" — endpoint komposisi mengirim subset
 *  kolom (tanpa `jenjang`/`singkatan`), jadi tipenya bukan `MataPelajaran`. */
type MapelTersedia = Pick<MataPelajaran, 'id' | 'nama_mapel' | 'kelompok' | 'kode_mapel' | 'is_active'>;

function nilaiTersedia(m: MapelTersedia): Record<string, string | null> {
  return {
    nama_mapel: m.nama_mapel,
    kelompok: m.kelompok === 'formal' ? 'Formal' : 'Pesantren',
  };
}

/** Nilai sel komposisi. Kolom cakupan tingkat dihitung halaman (butuh daftar
 *  tingkat), jadi fungsi ini menerima fungsi ringkas (dibuat dengan `useCallback`). */
function nilaiKomposisi(b: KomposisiBaris, ringkas: (daftar: string[]) => string): Record<string, string | null> {
  return {
    nama_mapel: b.mata_pelajaran.nama_mapel,
    cakupan: ringkas(b.tingkat ?? []),
    kkm: b.kkm === null ? '' : String(b.kkm),
    urutan: String(b.urutan),
  };
}

/** Isi formulir kurikulum (dipakai dialog Tambah & Ubah). */
interface NilaiFormKurikulum {
  nama: string;
  deskripsi: string;
}

const FORM_KOSONG: NilaiFormKurikulum = { nama: '', deskripsi: '' };

/** Dialog formulir kurikulum — SATU sumber untuk aksi "Tambah" (baris baru)
 *  dan aksi baris "Ubah". Bentuknya identik; yang berbeda hanya judul, awalan
 *  `id` elemen (snake_case, NFR-05), dan aksi simpannya. Simpan dikunci selama
 *  nama kosong supaya tak ada kurikulum tanpa nama tersimpan. Isi disimpan lewat
 *  `<form>` sehingga Enter langsung menyimpan. */
function DialogFormKurikulum({ open, onClose, judul, idPrefix, idSimpan, nilai, set, onSimpan }: {
  open: boolean;
  onClose: () => void;
  judul: string;
  /** Awalan id: `input_<prefix>_nama`, `input_<prefix>_deskripsi`, … */
  idPrefix: string;
  idSimpan: string;
  nilai: NilaiFormKurikulum;
  /** Ubah sebagian field (patch) — state formulir dipegang halaman. */
  set: (p: Partial<NilaiFormKurikulum>) => void;
  onSimpan: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription className="sr-only">Formulir data kurikulum.</DialogDescription>
        </DialogHeader>
        <form
          id={`form_${idPrefix}`}
          onSubmit={(e) => { e.preventDefault(); onSimpan(); }}
          className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4"
        >
          <FieldLabel htmlFor={`input_${idPrefix}_nama`}>Nama kurikulum</FieldLabel>
          <Input
            id={`input_${idPrefix}_nama`} value={nilai.nama} maxLength={100} required autoFocus
            onChange={(e) => set({ nama: e.target.value })}
          />
          <FieldLabel htmlFor={`input_${idPrefix}_deskripsi`}>Deskripsi (opsional)</FieldLabel>
          {/* Batas 500 = validasi backend (`max:500`) — tak ada field yang bisa
              ditolak server karena isian panjang. */}
          <Input
            id={`input_${idPrefix}_deskripsi`} value={nilai.deskripsi} maxLength={500}
            onChange={(e) => set({ deskripsi: e.target.value })}
          />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button id={idSimpan} type="submit" disabled={nilai.nama.trim() === ''}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Halaman Kurikulum: daftar kurikulum per jenjang + komposisi mapel
 *  (mapel → kurikulum, dengan cakupan tingkat opsional + KKM & urutan rapor).
 *
 *  Ketiga tabel memakai komponen `ExcelTable` yang sama seperti halaman lain:
 *  daftar kurikulum (kiri, pemilih — klik baris mengisi dua tabel kanan),
 *  mapel yang belum masuk (tengah, tombol → per baris), dan komposisi
 *  (kanan, sel bisa diedit langsung). "Tambah" membuka dialog formulir —
 *  kurikulum tak lagi lahir dengan nama "Kurikulum Baru" yang langsung jadi. */
export default function KurikulumKurikulumPage() {
  const { jenjangs, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'kurikulum.tambah');
  const canUbah = bisa(user, 'kurikulum.ubah');
  const canHapus = bisa(user, 'kurikulum.hapus');

  const jenjang = targetTunggal(jenjangs);
  const [daftar, setDaftar] = useState<Kurikulum[]>([]);
  const [daftarLoading, setDaftarLoading] = useState(false);
  const [pilihId, setPilihId] = useState<number | ''>('');
  const [komposisi, setKomposisi] = useState<Awaited<ReturnType<typeof daftarKomposisi>> | null>(null);
  const [komposisiLoading, setKomposisiLoading] = useState(false);
  const [err, setErr] = useState('');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [formTambah, setFormTambah] = useState<NilaiFormKurikulum>(FORM_KOSONG);
  const [editRow, setEditRow] = useState<Kurikulum | null>(null);
  const [formUbah, setFormUbah] = useState<NilaiFormKurikulum>(FORM_KOSONG);
  /** Tingkat pilihan cakupan (dari server, mengikuti jenjang kurikulum aktif). */
  const tingkatOpsi = komposisi?.tingkatOpsi ?? [];
  const namaTingkat = useMemo(() => tingkatOpsi.map((t) => t.nama), [tingkatOpsi]);

  /** Dialog "Berlaku di tingkat": baris yang disunting + daftar tingkat terpilih. */
  const [cakupanTarget, setCakupanTarget] = useState<KomposisiBaris | null>(null);
  const [cakupanDipilih, setCakupanDipilih] = useState<string[]>([]);

  const kurikulumAktif = daftar.find((k) => k.id === pilihId) ?? null;

  const muatDaftarKurikulum = useCallback(async () => {
    if (jenjang === null) { setDaftar([]); setPilihId(''); return; }
    setDaftarLoading(true);
    try {
      const r = await daftarKurikulum(jenjang);
      setDaftar(r);
      setPilihId((v) => (r.some((k) => k.id === v) ? v : (r[0]?.id ?? '')));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setDaftarLoading(false);
    }
  }, [jenjang]);

  const muatDataKomposisi = useCallback(async () => {
    if (pilihId === '') { setKomposisi(null); return; }
    setKomposisiLoading(true);
    try {
      setKomposisi(await daftarKomposisi(pilihId));
    } catch (e) {
      setErr(errorMessage(e)); setKomposisi(null);
    } finally {
      setKomposisiLoading(false);
    }
  }, [pilihId]);

  useEffect(() => {
    if (filterLoading) return;
    setErr('');
    void muatDaftarKurikulum();
  }, [filterLoading, muatDaftarKurikulum]);

  useEffect(() => { void muatDataKomposisi(); }, [muatDataKomposisi]);

  const segarkan = useCallback(async () => {
    await muatDaftarKurikulum(); await muatDataKomposisi();
  }, [muatDaftarKurikulum, muatDataKomposisi]);

  const jalankan = useCallback(async (kerja: () => Promise<unknown>, sukses: string) => {
    try { await kerja(); toast.success(sukses); await segarkan(); }
    catch (e) { toast.error(errorMessage(e)); }
  }, [segarkan]);

  /** Ringkasan cakupan tingkat satu mapel: "Semua tingkat" / "1, 2" /
   *  daftar nama (dipotong 3 + "+n"). */
  const ringkasTingkat = useCallback((daftar: string[]) => {
    if (daftar.length === 0) return 'Semua tingkat';
    if (daftar.length <= 3) return daftar.join(', ');
    return `${daftar.slice(0, 3).join(', ')} +${daftar.length - 3}`;
  }, []);

  const nilaiBarisKomposisi = useCallback(
    (b: KomposisiBaris) => nilaiKomposisi(b, ringkasTingkat),
    [ringkasTingkat],
  );

  const fieldsKomposisi = useMemo<ExcelField[]>(() => [
    { key: 'nama_mapel', label: 'Mapel', width: 200, kind: 'static' },
    {
      // Cakupan tingkat: daftar tingkat yang boleh; KOSONG = berlaku di semua
      // tingkat. Disunting lewat dialog checkbox dari kolom Aksi (ikon "Tingkat").
      key: 'cakupan', label: 'Berlaku di tingkat', width: 170, kind: 'static',
    },
    {
      key: 'kkm', label: 'KKM', width: 90, kind: 'text',
      validate: validasiAngka(100, 'KKM 0–100.'),
    },
    {
      key: 'urutan', label: 'Urut', width: 80, kind: 'text',
      validate: validasiAngka(9999, 'Urutan 0–9999.'),
    },
  ], []);

  /** "Tambah" membuka formulir kosong — kurikulum baru lahir setelah pengguna
   *  mengisi nama lalu menekan Simpan (tak ada lagi nama sementaraotomatis). */
  const bukaTambah = useCallback(() => {
    setFormTambah(FORM_KOSONG);
    setTambahOpen(true);
  }, []);

  // Pintasan Ctrl/Cmd+N = tombol "Tambah" (dialog kurikulum baru). Terhalang
  // bila dialog sudah terbuka agar tak bertumpuk.
  usePintasanBaru({
    kunci: 'n',
    aktif: canTambah,
    terhalang: tambahOpen || editRow !== null,
    onPicu: bukaTambah,
  });

  /** Simpan dialog Tambah: kurikulum dibuat setelah pengguna mengisi nama —
   *  dialog hanya ditutup bila BERHASIL, galat tampil sebagai toast sementara
   *  isian tetap ada untuk diperbaiki. */
  const simpanTambah = useCallback(async () => {
    if (jenjang === null) return;
    const nama = formTambah.nama.trim();
    if (nama === '') { toast.error('Nama kurikulum wajib diisi.'); return; }
    try {
      const baru = await buatKurikulum({
        jenjang,
        nama,
        deskripsi: formTambah.deskripsi.trim() === '' ? null : formTambah.deskripsi.trim(),
      });
      toast.success('Kurikulum ditambah.');
      setTambahOpen(false);
      // Kurikulum baru langsung jadi pilihan aktif supaya panel kanan langsung
      // terisi (tak perlu klik baris dulu). `muatDaftarKurikulum` mempertahankan
      // pilihan itu karena baris baru sudah ada di daftar.
      setPilihId(baru.id);
      await segarkan();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [jenjang, formTambah, segarkan]);

  /** Isi dialog dari baris yang diklik (semua field diisi ulang, bukan
   *  ditumpuk — dialog boleh dibuka beruntun untuk baris berbeda). */
  const openEdit = useCallback((k: Kurikulum) => {
    setEditRow(k);
    setFormUbah({ nama: k.nama, deskripsi: k.deskripsi ?? '' });
  }, []);

  const simpanUbah = useCallback(async () => {
    if (editRow === null) return;
    const nama = formUbah.nama.trim();
    if (nama === '') { toast.error('Nama kurikulum wajib diisi.'); return; }
    try {
      await ubahKurikulum(editRow.id, {
        nama,
        deskripsi: formUbah.deskripsi.trim() === '' ? null : formUbah.deskripsi.trim(),
      });
      toast.success('Kurikulum diubah.');
      setEditRow(null);
      await segarkan();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [editRow, formUbah, segarkan]);

  const onHapusKurikulum = useCallback((k: Kurikulum) => jalankan(
    () => hapusKurikulum(k.id), 'Kurikulum dihapus.',
  ), [jalankan]);

  /** Aksi baris tabel kiri: Ubah (dialog) + Hapus (konfirmasi). */
  const renderActionsDaftar = useCallback((k: Kurikulum) => (
    <>
      {canUbah && <EditAction id={`btn_ubah_kurikulum_${k.id}`} onClick={() => openEdit(k)} />}
      {canHapus && (
        <DeleteAction
          id={`btn_hapus_kurikulum_${k.id}`}
          title="Hapus kurikulum?"
          description={`Kurikulum "${k.nama}" akan dihapus beserta komposisi mapelnya.`}
          onConfirm={() => void onHapusKurikulum(k)}
        />
      )}
    </>
  ), [canUbah, canHapus, openEdit, onHapusKurikulum]);

  /** Edit sel tabel kiri: ubah nama (endpoint sama dengan dialog Ubah). Galat
   *  sengaja diteruskan ke antrean simpan komponen tabel — ia yang mengembalikan
   *  draft & menampilkan toast "Gagal menyimpan". Muat ulang lewat `onSaved`. */
  const commitDaftar = useCallback(async (id: number, f: Record<string, string | null>) => {
    if (f.nama === undefined || f.nama === null) return;
    await ubahKurikulum(id, { nama: f.nama.trim() });
  }, []);

  /** Aksi baris tabel tengah: masukkan mapel ini ke kurikulum aktif. */
  const renderActionsTersedia = useCallback((m: MapelTersedia) => {
    if (!canTambah || kurikulumAktif === null) return null;
    return (
      <Button type="button" variant="ghost" size="icon-sm"
        id={`btn_tambah_mapel_kurikulum_${m.id}`}
        aria-label={`Tambah ${m.nama_mapel}`}
        title="Masukkan ke kurikulum"
        onClick={() => void jalankan(
          () => buatKomposisi({ kurikulum_id: kurikulumAktif.id, mata_pelajaran_id: m.id }),
          `${m.nama_mapel} masuk kurikulum.`,
        )}>
        <ArrowRight size={16} />
      </Button>
    );
  }, [canTambah, kurikulumAktif, jalankan]);

  /** Edit sel komposisi: KKM / urutan rapor. Nilai kosong untuk KKM berarti
   *  "biarkan kosong" (null), bukan nol; `urutan` kosong = 0. Muat ulang tabel
   *  diserahkan ke `onSaved` (server mengurutkan ulang baris menurut `urutan`,
   *  jadi isi grid harus mengikuti urutan terbaru). Cakupan kelas disunting lewat
   *  dialog (lihat `simpanCakupan`), bukan lewat sel. */
  const commitKomposisi = useCallback(async (id: number, f: Record<string, string | null>) => {
    const kkm = f.kkm;
    const urutan = f.urutan;
    if (kkm === undefined && urutan === undefined) return;
    await ubahKomposisi(id, {
      ...(kkm !== undefined ? { kkm: kkm === null || kkm === '' ? null : Number(kkm) } : {}),
      ...(urutan !== undefined ? { urutan: Number(urutan) || 0 } : {}),
    });
  }, []);

  /** Simpan cakupan tingkat dari dialog checkbox: daftar kosong = semua tingkat. */
  const simpanCakupan = useCallback(async () => {
    if (cakupanTarget === null) return;
    const id = cakupanTarget.id;
    setCakupanTarget(null);
    try {
      await ubahKomposisi(id, { tingkat: cakupanDipilih });
      toast.success('Cakupan tingkat diperbarui.');
      await muatDataKomposisi();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [cakupanTarget, cakupanDipilih, muatDataKomposisi]);

  /** Buka dialog cakupan tingkat untuk satu baris komposisi. */
  const bukaCakupan = useCallback((b: KomposisiBaris) => {
    setCakupanDipilih(b.tingkat ?? []);
    setCakupanTarget(b);
  }, []);

  /** Aksi baris komposisi: atur tingkat cakupan mapelnya + keluarkan mapel. */
  const renderActionsKomposisi = useCallback((b: KomposisiBaris) => (
    <>
      {canUbah && tingkatOpsi.length > 0 && (
        <ActionIcon
          id={`btn_cakupan_tingkat_${b.id}`}
          title="Berlaku di tingkat"
          onClick={() => bukaCakupan(b)}
        >
          <GraduationCap size={16} />
        </ActionIcon>
      )}
      {canHapus && (
        <DeleteAction
          id={`btn_keluar_komposisi_${b.id}`}
          title="Keluarkan mapel dari kurikulum?"
          description={`Mapel "${b.mata_pelajaran.nama_mapel}" akan dikeluarkan dari komposisi kurikulum ini (berlaku untuk semua kelas yang memakai kurikulum ini).`}
          onConfirm={() => void jalankan(
            () => hapusKomposisi(b.id), 'Mapel dikeluarkan dari kurikulum.',
          )}
        />
      )}
    </>
  ), [canUbah, canHapus, tingkatOpsi.length, bukaCakupan, jalankan]);

  if (jenjang === null) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) pada filter di atas.</p>
      </div>
    );
  }

  const barisKomposisi = komposisi?.baris ?? [];
  const mapelTersedia = komposisi?.tersedia ?? [];

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tabel={[
        { key: 'kurikulum_daftar', judul: 'Kurikulum', fields: FIELDS_DAFTAR },
        { key: 'kurikulum_tersedia', judul: 'Mapel belum masuk', fields: FIELDS_TERSEDIA },
        { key: 'kurikulum_komposisi', judul: 'Komposisi kurikulum', fields: fieldsKomposisi },
      ]} />
      {/* Susunan dua kolom yang bisa digeser: kolom kiri terbagi lagi secara
          vertikal (daftar kurikulum di atas, tinggi tetap 150px; mapel belum
          masuk memakai sisa tinggi), kolom kanan dipakai penuh oleh komposisi
          kurikulum. Tiap pemisah punya gagang sendiri. */}
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_kurikulum_kurikulum">
        {/* Kolom kiri: daftar kurikulum (baris 1) + mapel belum masuk (baris 2). */}
        <ResizablePanel
          id="panel_kurikulum_kiri"
          defaultSize="42%"
          minSize="300px"
          maxSize="70%"
          groupResizeBehavior="preserve-relative-size"
          className="flex min-h-0 flex-col"
        >
          <ResizablePanelGroup orientation="vertical" className="h-full min-h-0" id="grup_kurikulum_kiri">
            {/* Baris 1: daftar kurikulum jenjang aktif — 150px sampai pengguna
                menggeser gagangnya; klik baris mengisi kolom kanan. */}
            <ResizablePanel
              id="panel_kurikulum_daftar"
              defaultSize="150px"
              minSize="120px"
              groupResizeBehavior="preserve-pixel-size"
              className="flex min-h-0 flex-col"
            >
              <ExcelTable<Kurikulum>
                tableKey="kurikulum_daftar"
                sumberTabel="kurikulum"
                fields={FIELDS_DAFTAR}
                rows={daftar}
                getValues={nilaiDaftar}
                loading={daftarLoading}
                emptyText="Belum ada kurikulum."
                canEdit={canUbah}
                onCommit={commitDaftar}
                onSaved={muatDaftarKurikulum}
                // Pemilih baris, bukan tempat kerja massal: tanpa kotak centang &
                // tanpa pemilih kolom.
                hideCheckbox
                hidePreset
                aksiLangsung
                header={<>Kurikulum · {jenjang}</>}
                onBarisKlik={(k) => setPilihId(k.id)}
                barisAktifId={kurikulumAktif?.id ?? null}
                addButton={
                  <Button type="button" size="sm" id="btn_tambah_kurikulum" disabled={!canTambah}
                    onClick={bukaTambah}
                    title={`Tambah kurikulum (${labelPintasan('n')})`}
                    aria-keyshortcuts="Control+N Meta+N">
                    <LabelTombolTambah pintasan={labelPintasan('n')}>
                      <Plus data-icon="inline-start" size={16} /> Tambah
                    </LabelTombolTambah>
                  </Button>
                }
                renderActions={renderActionsDaftar}
              />
            </ResizablePanel>

            <ResizableHandle
              orientation="vertical"
              withHandle
              id="gagang_kurikulum_daftar_tersedia"
              aria-label="Atur tinggi Daftar Kurikulum dan Mapel Belum Masuk"
            />

            {/* Baris 2: mapel jenjang ini yang belum masuk kurikulum aktif —
                memakai sisa tinggi kolom. */}
            <ResizablePanel
              id="panel_kurikulum_tersedia"
              minSize="160px"
              groupResizeBehavior="preserve-relative-size"
              className="flex min-h-0 flex-col"
            >
              <ExcelTable<MapelTersedia>
                tableKey="kurikulum_tersedia"
                sumberTabel="mata_pelajaran"
                fields={FIELDS_TERSEDIA}
                rows={mapelTersedia}
                getValues={nilaiTersedia}
                loading={komposisiLoading}
                emptyText={
                  kurikulumAktif === null
                    ? 'Pilih kurikulum di atas.'
                    : 'Semua mapel jenjang ini sudah masuk kurikulum.'
                }
                canEdit={false}
                onCommit={async () => {}}
                onSaved={() => {}}
                hideCheckbox
                hidePreset
                aksiLangsung
                // Tanpa `header`, bilah judul butuh minimal satu komponen
                // (filter/aksi) — di sini keduanya sengaja tidak ada.
                header="Mapel belum masuk"
                renderActions={renderActionsTersedia}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle
          orientation="horizontal"
          withHandle
          id="gagang_kurikulum_kiri_komposisi"
          aria-label="Atur lebar kolom kiri dan Komposisi Kurikulum"
        />

        {/* Kolom kanan: komposisi mapel kurikulum aktif (tingkat, KKM, urutan). */}
        <ResizablePanel
          id="panel_kurikulum_komposisi"
          minSize="360px"
          groupResizeBehavior="preserve-relative-size"
          className="flex min-h-0 flex-col"
        >
          <ExcelTable<KomposisiBaris>
            tableKey="kurikulum_komposisi"
            sumberTabel="kurikulum_mapel"
            fields={fieldsKomposisi}
            rows={barisKomposisi}
            getValues={nilaiBarisKomposisi}
            loading={komposisiLoading}
            emptyText={
              kurikulumAktif === null
                ? 'Pilih kurikulum di kolom kiri, atau buat baru.'
                : 'Belum ada mapel — masukkan dari kolom kiri.'
            }
            canEdit={canUbah}
            onCommit={commitKomposisi}
            // Urutan rapor bisa berubah → server mengurutkan ulang baris;
            // muat ulang agar isi tabel mengikuti urutan terbaru.
            onSaved={muatDataKomposisi}
            // Judul menampilkan nama kurikulum yang sedang disusun, jadi
            // baris tabel jelas milik kurikulum mana.
            header={kurikulumAktif === null ? (
              'Komposisi kurikulum'
            ) : (
              <>Komposisi · <strong>{kurikulumAktif.nama}</strong></>
            )}
            tengah={kurikulumAktif?.deskripsi ? kurikulumAktif.deskripsi : undefined}
            renderActions={renderActionsKomposisi}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Dialog "Berlaku di tingkat": daftar CHECKBOX tingkat yang dicakup mapel
          ini. Kosong = berlaku di semua tingkat. Dipakai nama tingkat (bukan id
          kelas), jadi tetap berlaku di tahun ajaran berikutnya. */}
      <Dialog open={cakupanTarget !== null} onOpenChange={(o) => { if (!o) setCakupanTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Berlaku di tingkat — {cakupanTarget?.mata_pelajaran.nama_mapel}</DialogTitle>
            <DialogDescription className="sr-only">
              Pilih tingkat tempat mapel ini diajarkan. Kosong berarti semua tingkat.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="check_cakupan_semua_tingkat"
                checked={namaTingkat.length > 0 && cakupanDipilih.length === namaTingkat.length}
                onCheckedChange={(v) => setCakupanDipilih(v === true ? [...namaTingkat] : [])}
              />
              <label htmlFor="check_cakupan_semua_tingkat" className="text-xs font-medium">
                Semua tingkat ({namaTingkat.join(', ')})
              </label>
            </div>
            <div className="max-h-64 overflow-auto rounded border border-border p-1">
              {tingkatOpsi.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">
                  Belum ada data tingkat untuk jenjang ini — mapel berlaku di semua tingkat.
                </p>
              ) : (
                tingkatOpsi.map((t) => (
                  <label
                    key={t.id}
                    htmlFor={`check_cakupan_tingkat_${t.id}`}
                    className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`check_cakupan_tingkat_${t.id}`}
                      checked={cakupanDipilih.includes(t.nama)}
                      onCheckedChange={(v) => setCakupanDipilih((prev) => (
                        v === true ? [...prev, t.nama] : prev.filter((x) => x !== t.nama)
                      ))}
                    />
                    Tingkat {t.nama}
                  </label>
                ))
              )}
            </div>
            <FieldDescription>
              {cakupanDipilih.length === 0
                ? 'Kosong = mapel ini berlaku di semua tingkat kelas yang memakai kurikulum ini.'
                : `Mapel ini hanya berlaku di kelas tingkat ${cakupanDipilih.join(', ')}. `
                  + 'Baris pengampu yang sudah terlanjur dibuat di kelas lain tidak ikut terhapus — hapus dari halaman Pengampu bila tak mau lagi.'}
            </FieldDescription>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCakupanTarget(null)}>Batal</Button>
            <Button id="btn_simpan_cakupan_tingkat" onClick={() => void simpanCakupan()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aksi "Tambah" & aksi baris "Ubah" memakai formulir dialog yang SAMA
          (`DialogFormKurikulum`). "Tambah" tidak lagi menyisipkan
          "Kurikulum Baru" ke tabel — kurikulum lahir setelah pengguna mengisi
          nama lalu menekan Simpan. */}
      <DialogFormKurikulum
        open={tambahOpen}
        onClose={() => setTambahOpen(false)}
        judul="Tambah kurikulum"
        idPrefix="tambah_kurikulum"
        idSimpan="btn_simpan_tambah_kurikulum"
        nilai={formTambah}
        set={(p) => setFormTambah((f) => ({ ...f, ...p }))}
        onSimpan={() => void simpanTambah()}
      />
      <DialogFormKurikulum
        open={editRow !== null}
        onClose={() => setEditRow(null)}
        judul="Ubah kurikulum"
        idPrefix="ubah_kurikulum"
        idSimpan="btn_simpan_ubah_kurikulum"
        nilai={formUbah}
        set={(p) => setFormUbah((f) => ({ ...f, ...p }))}
        onSimpan={() => void simpanUbah()}
      />
    </div>
  );
}