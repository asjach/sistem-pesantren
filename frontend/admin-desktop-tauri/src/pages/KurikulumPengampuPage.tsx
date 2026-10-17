import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { listKelas, type Kelas } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { Copy, FileUp, Plus } from '@/icons';
import { DeleteAction } from '@/components/RowActions';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import ImportBertahapUmumDialog from '@/components/ImportBertahapUmumDialog';
import {
  daftarGuruAktif, daftarMapel, daftarPengampus, salinPengampu, simpanPengampu,
  batalPotongPengampu, importPengampuPotong, unduhGalatPengampu, unduhTemplatePengampu,
  KOLOM_IMPORT_PENGAMPU,
  type GuruAktif, type MataPelajaran, type PengampusBaris,
} from '@/api/kurikulum';

/**
 * Halaman Pengampu: daftar mapel sebuah kelas YAITUH daftar pengampu kelas itu
 * sendiri (`pengampu_mapel`; modul kurikulum + komposisi sudah dihapus). Mapel
 * masuk kelas lewat tiga jalan: tombol "Tambah mapel", "Salin dari kelas lain",
 * atau import Excel. Baris yang sudah punya nilai/jadwal tidak boleh
 * dikeluarkan (dijaga endpoint sync).
 *
 *  Kelas dipilih lewat RAIL Tingkat/Kelas di kiri tabel (bukan pemilih di
 *  toolbar) dan boleh beberapa kelas sekaligus — tabel lalu menampilkan baris
 *  pengampu gabungan dengan kolom "Kelas".
 */

/** Keterangan aksi baris — satu jenis saja sekarang: semua baris adalah baris
 *  pengampu sungguhan, jadi menghapus baris berarti mapel benar-benar keluar
 *  dari daftar kelas (bukan sekadar melepas guru dari baris "kurikulum"). */
function aksiBaris(b: BarisPengampu): { judul: string; keterangan: string; sukses: string } {
  return {
    judul: 'Keluarkan mapel dari pengampu?',
    keterangan: `"${b.nama_mapel}" dikeluarkan dari daftar pengampu kelas ${b.nama_kelas}. Guru & penugasan pada baris ini ikut dilepas. Mapel yang sudah punya nilai atau jadwal tidak bisa dikeluarkan.`,
    sukses: `${b.nama_mapel} dikeluarkan dari pengampu kelas ${b.nama_kelas}.`,
  };
}

/** Baris tabel pengampu. `PengampuBaris` tak punya `id` sendiri, sedangkan
 *  komponen tabel selalu menandai satu baris lewat `id` — dan karena tabel bisa
 *  menampilkan BEBERAPA kelas sekaligus, kuncinya harus memuat kelas:
 *  `${kelas_id}-${mata_pelajaran_id}`. */
type BarisPengampu = PengampusBaris & { id: string };

/** Nama guru untuk pilihan di sel "Guru pengampu". */
function namaGuru(g: GuruAktif): string {
  return `${g.gelar_depan ? `${g.gelar_depan} ` : ''}${g.nama_lengkap}${g.gelar_belakang ? `, ${g.gelar_belakang}` : ''}`;
}

function nilaiPengampu(b: BarisPengampu): Record<string, string | null> {
  return {
    kelas: b.nama_kelas,
    nama_mapel: b.is_active ? b.nama_mapel : `${b.nama_mapel} (nonaktif)`,
    kelompok: b.kelompok === 'formal' ? 'Formal' : 'Pesantren',
    kkm: b.kkm === null ? '—' : String(b.kkm),
    guru: b.keaktifan_pegawai_id === null ? '' : String(b.keaktifan_pegawai_id),
  };
}

export default function KurikulumPengampuPage() {
  const {
    jenjangs, tahunAjaranNames, tingkat: tingkatFilter, kelas: kelasFilter, loading: filterLoading,
  } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canUbah = bisa(user, 'kurikulum.ubah');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  /** Mapel AKTIF jenjang ini — pilihan di dialog "Tambah mapel". */
  const [mapelAktif, setMapelAktif] = useState<MataPelajaran[]>([]);
  const [guru, setGuru] = useState<GuruAktif[]>([]);
  const [baris, setBaris] = useState<BarisPengampu[]>([]);
  const [pengampuLoading, setPengampuLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [err, setErr] = useState('');
  /** Dialog "Tambah mapel": kelas tujuan + mapel + guru (opsional). */
  const [tambahOpen, setTambahOpen] = useState(false);
  const [tambahKelas, setTambahKelas] = useState<number | ''>('');
  const [tambahMapel, setTambahMapel] = useState<number | ''>('');
  const [tambahGuru, setTambahGuru] = useState<number | ''>('');
  /** Dialog "Salin dari kelas lain": kelas tujuan + kelas sumber. */
  const [salinOpen, setSalinOpen] = useState(false);
  const [salinTujuan, setSalinTujuan] = useState<number | ''>('');
  const [salinSumber, setSalinSumber] = useState<number | ''>('');
  /** Nilai guru terbaru per baris (kunci baris = `kelas-mapel`) — sumber payload
   *  sync. Berisi ref (bukan state) karena dua edit sel beruntun dalam satu
   *  antrean simpan harus saling membaca nilai terbaru: endpoint
   *  `simpanPengampu` menerima SELURUH baris satu kelas, jadi payload dari data
   *  server yang basi akan menimpa edit sebelumnya. */
  const nilaiGuruRef = useRef<Map<string, number | null>>(new Map());
  /** Nomor urut pemuatan pengampu — hanya hasil pemuatan TERAKHIR yang boleh
   *  menulis state (lihat `muatPengampu`). */
  const muatSeq = useRef(0);

  /** Kelas yang ditampilkan tabel. Rail menyebut NAMA kelas (endpoint & tabel
   *  pakai id). "All" di rail berarti TIDAK ada filter — jadi semua kelas
   *  lingkup, bukan "belum ada kelas dipilih" (perlakuan itu yang membuat
   *  pilihan All tampak kosong).
   *
   *  Rail TINGKAT ikut mempersempit tabel: kelas yang tingkatnya tak termasuk
   *  pilihan tingkat disembunyikan. Kelas yang tersaring TIDAK ikut dihapus
   *  dari filter kelas global — itu milik pengguna & halaman lain. */
  const semuaKelas = kelasFilter.length === 0;
  const semuaTingkat = tingkatFilter.length === 0;
  const kelasTampil = useMemo(() => {
    const dasar = semuaKelas ? kelasOpsi : kelasOpsi.filter((k) => kelasFilter.includes(k.nama_kelas));
    if (semuaTingkat) return dasar;
    return dasar.filter((k) => k.tingkat !== null && tingkatFilter.includes(k.tingkat));
  }, [kelasOpsi, kelasFilter, tingkatFilter, semuaKelas, semuaTingkat]);
  /** Id kelas yang ditampilkan, urut sesuai daftar — kunci efek muat. */
  const kelasIds = useMemo(() => kelasTampil.map((k) => k.id), [kelasTampil]);
  const kunciKelas = kelasIds.join(',');

  /** Data server → state + peta nilai guru (sumber payload sync). */
  const terapkanBaris = useCallback((baru: BarisPengampu[]) => {
    setBaris(baru);
    nilaiGuruRef.current = new Map(baru.map((b) => [b.id, b.keaktifan_pegawai_id]));
  }, []);

  // Daftar kelas (pemetaan nama di rail → id) + mapel aktif jenjang (pilihan
  // dialog "Tambah mapel") dimuat bersama.
  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKelasOpsi([]); return; }
    let hidup = true;
    Promise.all([
      listKelas({ jenjang, tahun_ajaran: ta, per_page: 1000 }),
      daftarMapel({ jenjang, keaktifan: 'aktif' }),
    ])
      .then(([k, m]) => {
        if (!hidup) return;
        setKelasOpsi(k.data);
        setMapelAktif(m);
      })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta]);

  // Guru aktif jenjang+TA.
  useEffect(() => {
    if (jenjang === null || ta === null) { setGuru([]); return; }
    let hidup = true;
    daftarGuruAktif({ jenjang, tahun_ajaran: ta })
      .then((g) => { if (hidup) setGuru(g); })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [jenjang, ta]);

  /** Pengampu seluruh kelas terpilih dalam SATU request (`daftarPengampus`) —
   *  endpoint per-kelas membuat N request yang saling antre dan tabel tampil
   *  jauh lebih lambat.
   *
   *  Pilihan kelas di rail berubah beberapa kali beruntun saat halaman dibuka
   *  (pilihan tersimpan dimuat belakangan), jadi beberapa pemuatan bisa bertumpuk.
   *  Tanpa penjaga urutan, permintaan yang selesai belakangan menimpa data yang
   *  lebih baru — hasilnya tabel menampilkan kelas yang tak lagi dipilih. */
  const muatPengampu = useCallback(async (ids: number[]) => {
    const seq = ++muatSeq.current;
    if (ids.length === 0) { terapkanBaris([]); setPengampuLoading(false); return; }
    setPengampuLoading(true);
    try {
      const r = await daftarPengampus(ids);
      if (seq !== muatSeq.current) return;
      terapkanBaris(r.baris.map((b) => ({ ...b, id: `${b.kelas_id}-${b.mata_pelajaran_id}` })));
    } catch (e) {
      if (seq !== muatSeq.current) return;
      setErr(errorMessage(e)); terapkanBaris([]);
    } finally {
      if (seq === muatSeq.current) setPengampuLoading(false);
    }
  }, [terapkanBaris]);

  useEffect(() => {
    void muatPengampu(kelasIds);
    // Kunci = id kelas terpilih (array baru tiap render, jadi tak dipakai langsung).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muatPengampu, kunciKelas]);

  const jalankan = useCallback(async (kerja: () => Promise<unknown>, sukses: string, lalu?: () => void) => {
    try { await kerja(); toast.success(sukses); lalu?.(); }
    catch (e) { toast.error(errorMessage(e)); }
  }, []);

  /** Isi payload sync untuk satu kelas: baris kelas itu + satu baris TAMBAHAN
   *  (dipakai dialog "Tambah mapel"). Nilai guru diambil dari peta nilai agar
   *  edit sel yang belum kembali dari server tak hilang. */
  const payloadKelas = useCallback((kelasId: number, tambah?: {
    mata_pelajaran_id: number; keaktifan_pegawai_id: number | null;
  }) => {
    const kirim = baris
      .filter((b) => b.kelas_id === kelasId)
      .map((b) => ({
        mata_pelajaran_id: b.mata_pelajaran_id,
        keaktifan_pegawai_id: nilaiGuruRef.current.get(b.id) ?? null,
      }));
    if (tambah) kirim.push(tambah);
    return kirim;
  }, [baris]);

  /** Edit sel "Guru pengampu": tersimpan seketika lewat satu PUT berisi seluruh
   *  baris KELAS ITU SAJA (endpoint sync per kelas). Nilai baris ditulis ke peta
   *  nilai lebih dulu, supaya edit berikutnya dalam antrean yang sama ikut
   *  membawanya. Galat diteruskan ke antrean simpan komponen tabel — ia yang
   *  mengembalikan nilai sel & menampilkan toast "Gagal menyimpan". */
  const commitSel = useCallback(async (id: string | number, f: Record<string, string | null>) => {
    if (f.guru === undefined) return;
    const barisIni = baris.find((b) => b.id === String(id));
    if (!barisIni) return;
    const guru = f.guru === null || f.guru === '' ? null : Number(f.guru);
    nilaiGuruRef.current.set(barisIni.id, guru);
    await simpanPengampu(barisIni.kelas_id, payloadKelas(barisIni.kelas_id));
  }, [baris, payloadKelas]);

  /** Keluarkan satu mapel dari daftar pengampu kelasnya: kirim daftar kelas itu
   *  tanpa baris tersebut (endpoint sync menghapus baris yang absen). */
  const hapusBaris = useCallback(async (b: BarisPengampu) => {
    const kirim = baris
      .filter((x) => x.kelas_id === b.kelas_id && x.id !== b.id)
      .map((x) => ({
        mata_pelajaran_id: x.mata_pelajaran_id,
        keaktifan_pegawai_id: nilaiGuruRef.current.get(x.id) ?? null,
      }));
    const aksi = aksiBaris(b);
    await jalankan(
      () => simpanPengampu(b.kelas_id, kirim),
      aksi.sukses,
      async () => { await muatPengampu(kelasIds); },
    );
  }, [baris, jalankan, muatPengampu, kelasIds]);

  /** Mapel jenjang aktif yang BELUM terpasang di kelas terpilih — pilihan
   *  dialog "Tambah mapel" (mapel nonaktif sengaja tak ditawarkan). */
  const mapelBelumTerpasang = useCallback((kelasId: number | ''): MataPelajaran[] => {
    if (kelasId === '') return mapelAktif;
    const terpasang = new Set(baris.filter((b) => b.kelas_id === kelasId).map((b) => b.mata_pelajaran_id));
    return mapelAktif.filter((m) => !terpasang.has(m.id));
  }, [mapelAktif, baris]);

  const bukaTambah = useCallback(() => {
    setTambahKelas(kelasIds[0] ?? '');
    setTambahMapel('');
    setTambahGuru('');
    setTambahOpen(true);
  }, [kelasIds]);

  const simpanTambah = useCallback(async () => {
    if (tambahKelas === '' || tambahMapel === '') { toast.error('Pilih kelas dan mapel dulu.'); return; }
    try {
      await simpanPengampu(tambahKelas, payloadKelas(tambahKelas, {
        mata_pelajaran_id: tambahMapel,
        keaktifan_pegawai_id: tambahGuru === '' ? null : tambahGuru,
      }));
      toast.success('Mapel ditambahkan ke pengampu kelas.');
      setTambahOpen(false);
      await muatPengampu(kelasIds);
    } catch (e) { toast.error(errorMessage(e)); }
  }, [tambahKelas, tambahMapel, tambahGuru, payloadKelas, muatPengampu, kelasIds]);

  const bukaSalin = useCallback(() => {
    setSalinTujuan(kelasIds[0] ?? '');
    setSalinSumber('');
    setSalinOpen(true);
  }, [kelasIds]);

  const simpanSalin = useCallback(async () => {
    if (salinTujuan === '' || salinSumber === '') { toast.error('Pilih kelas tujuan dan kelas sumber dulu.'); return; }
    try {
      const r = await salinPengampu(salinTujuan, salinSumber);
      toast.success(r.pesan);
      setSalinOpen(false);
      await muatPengampu(kelasIds);
    } catch (e) { toast.error(errorMessage(e)); }
  }, [salinTujuan, salinSumber, muatPengampu, kelasIds]);

  /** Kolom tabel pengampu. "Guru pengampu" = select yang langsung tersimpan
   *  saat dipilih (tanpa mode Edit); pilihannya mengikuti daftar guru aktif
   *  jenjang + tahun ajaran, jadi `fields` dihitung ulang saat daftar berubah.
   *  Kolom "Kelas" muncul karena tabel bisa menampilkan beberapa kelas;
   *  "KKM" tampil saja (diubah di halaman Mata Pelajaran). */
  const fieldsPengampu = useMemo<ExcelField[]>(() => [
    { key: 'kelas', label: 'Kelas', width: 110, kind: 'static' },
    { key: 'nama_mapel', label: 'Mapel', width: 220, kind: 'static' },
    { key: 'kelompok', label: 'Kelompok', width: 110, kind: 'static' },
    { key: 'kkm', label: 'KKM', width: 70, kind: 'static' },
    {
      // Semua kolom select memakai Select Radix; selnya hanya memasang instance
      // Radix saat daftar benar-benar dibuka (lihat SelectRadixCell) supaya tabel
      // ratusan baris tak berat.
      key: 'guru', label: 'Guru pengampu', width: 260, kind: 'select', selectTanpaEdit: true,
      choices: [
        { value: '', label: '— belum ada guru —' },
        ...guru.map((g) => ({ value: String(g.keaktifan_pegawai_id), label: namaGuru(g) })),
      ],
    },
  ], [guru]);

  /** Aksi baris: keluarkan mapel dari pengampu kelas. Baris yang sudah punya
   *  nilai/jadwal ditolak endpoint sync — pesannya muncul lewat toast galat. */
  const renderActions = useCallback((b: BarisPengampu) => {
    if (!canUbah) return null;
    const aksi = aksiBaris(b);
    return (
      <DeleteAction
        id={`btn_hapus_pengampu_${b.kelas_id}_${b.mata_pelajaran_id}`}
        title={aksi.judul}
        description={aksi.keterangan}
        onConfirm={() => void hapusBaris(b)}
      />
    );
  }, [canUbah, hapusBaris]);

  if (!siap) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) dan satu tahun ajaran pada filter di atas.</p>
      </div>
    );
  }

  const jumlahKelas = kelasTampil.length;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tabel={[
        // Key memakai imbuhan `-kelas`: tabel ini dulu punya key `kurikulum_pengampu`
        // saat kolomnya masih 4 (tanpa "Kelas"), dan preset kolom lama itu
        // membuat kolom baru muncul di paling akhir.
        { key: 'kurikulum_pengampu_kelas', judul: 'Pengampu', fields: fieldsPengampu },
      ]} />

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <ExcelTable<BarisPengampu>
          tableKey="kurikulum_pengampu_kelas"
          // Rel Tingkat/Kelas di kiri grid: inilah pemilih kelas halaman ini
          // (boleh beberapa kelas — tabelnya punya kolom "Kelas").
          rail
          fields={fieldsPengampu}
          rows={baris}
          getValues={nilaiPengampu}
          loading={pengampuLoading}
          emptyText={
            kelasOpsi.length === 0
              ? 'Belum ada kelas untuk jenjang + tahun ajaran ini.'
              : !semuaTingkat && kelasTampil.length === 0 && !semuaKelas
                ? 'Kelas yang dipilih tidak ada di tingkat tersebut — longgarkan filter Tingkat atau pilih kelas lain di rel Kelas.'
                : 'Belum ada mapel untuk kelas terpilih — tambahkan lewat tombol “Tambah mapel” atau “Salin dari kelas lain”.'
          }
          canEdit={canUbah}
          onCommit={commitSel}
          // Setiap edit sel = satu PUT penuh untuk kelasnya; muat ulang agar isi
          // tabel mengikuti data terbaru (mis. guru dinonaktifkan di halaman lain).
          onSaved={() => void muatPengampu(kelasIds)}
          addButtonLangsung
          addButton={
            <>
              {canUbah && jumlahKelas > 0 && (
                <Button type="button" variant="outline" size="sm" id="btn_tambah_pengampu"
                  onClick={bukaTambah}>
                  <Plus data-icon="inline-start" size={16} /> Tambah mapel
                </Button>
              )}
              {canUbah && jumlahKelas > 1 && (
                <Button type="button" variant="outline" size="sm" id="btn_salin_pengampu"
                  onClick={bukaSalin}>
                  <Copy data-icon="inline-start" size={14} /> Salin dari kelas lain
                </Button>
              )}
              {canUbah && (
                <Button type="button" variant="outline" size="sm" id="btn_buka_import_pengampu"
                  onClick={() => setImportOpen(true)}>
                  <FileUp data-icon="inline-start" size={16} /> Import
                </Button>
              )}
            </>
          }
          renderActions={renderActions}
        />
      </div>

      {/* Dialog "Tambah mapel": kelas tujuan (dari kelas yang tampil), mapel
          jenjang yang belum terpasang di kelas itu, dan guru opsional. */}
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah mapel ke pengampu kelas</DialogTitle>
            <DialogDescription>
              Mapel yang sudah terpasang di kelas terpilih tidak muncul lagi di daftar. Guru boleh dipilih nanti.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs" htmlFor="sel_tambah_kelas">
              Kelas
              <select
                id="sel_tambah_kelas"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={tambahKelas === '' ? '' : String(tambahKelas)}
                onChange={(e) => { setTambahKelas(e.target.value === '' ? '' : Number(e.target.value)); setTambahMapel(''); }}
              >
                <option value="">— pilih kelas —</option>
                {kelasTampil.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" htmlFor="sel_tambah_mapel">
              Mapel
              <select
                id="sel_tambah_mapel"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={tambahMapel === '' ? '' : String(tambahMapel)}
                onChange={(e) => setTambahMapel(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— pilih mapel —</option>
                {mapelBelumTerpasang(tambahKelas).map((m) => (
                  <option key={m.id} value={m.id}>{m.nama_mapel}</option>
                ))}
              </select>
              {tambahKelas !== '' && mapelBelumTerpasang(tambahKelas).length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Semua mapel aktif jenjang ini sudah terpasang di kelas tersebut.
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-xs" htmlFor="sel_tambah_guru">
              Guru pengampu (opsional)
              <select
                id="sel_tambah_guru"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={tambahGuru === '' ? '' : String(tambahGuru)}
                onChange={(e) => setTambahGuru(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— belum ada guru —</option>
                {guru.map((g) => (
                  <option key={g.keaktifan_pegawai_id} value={g.keaktifan_pegawai_id}>{namaGuru(g)}</option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setTambahOpen(false)}>Batal</Button>
            <Button type="button" size="sm" id="btn_simpan_tambah_pengampu" onClick={() => void simpanTambah()}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog "Salin dari kelas lain": seluruh mapel kelas sumber yang belum
          ada di kelas tujuan ditambahkan TANPA guru. */}
      <Dialog open={salinOpen} onOpenChange={setSalinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salin daftar mapel dari kelas lain</DialogTitle>
            <DialogDescription>
              Mapel kelas sumber yang belum ada di kelas tujuan ditambahkan tanpa guru — isi guru kemudian lewat kolom “Guru pengampu”.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs" htmlFor="sel_salin_tujuan">
              Kelas tujuan
              <select
                id="sel_salin_tujuan"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={salinTujuan === '' ? '' : String(salinTujuan)}
                onChange={(e) => setSalinTujuan(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— pilih kelas —</option>
                {kelasTampil.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" htmlFor="sel_salin_sumber">
              Kelas sumber
              <select
                id="sel_salin_sumber"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={salinSumber === '' ? '' : String(salinSumber)}
                onChange={(e) => setSalinSumber(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— pilih kelas —</option>
                {kelasOpsi.filter((k) => k.id !== salinTujuan).map((k) => (
                  <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setSalinOpen(false)}>Batal</Button>
            <Button type="button" size="sm" id="btn_salin_pengampu_jalankan" onClick={() => void simpanSalin()}>
              Salin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportBertahapUmumDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={{
          idPrefix: 'pengampu',
          judul: 'Import pengampu bertahap',
          deskripsi: 'Import pengampu bertahap. Satu file boleh berisi banyak lembaga + tahun ajaran.',
          kolom: KOLOM_IMPORT_PENGAMPU,
          wajib: ['jenjang', 'tahun_ajaran', 'nama_kelas', 'nama_mapel'],
          idTombol: {
            template: 'btn_unduh_template_pengampu',
            periksa: 'btn_periksa_import_pengampu',
            mulai: 'btn_import_pengampu',
          },
          labelTemplate: 'Unduh template Excel pengampu',
          unduhTemplate: unduhTemplatePengampu,
          kirim: ({ sesi_id, mode, total, baris, terakhir }) =>
            importPengampuPotong({
              ...(sesi_id === undefined ? {} : { sesi_id }),
              mode, ...(sesi_id === undefined ? { total } : {}), baris,
              ...(terakhir ? { terakhir } : {}),
            }),
          batal: batalPotongPengampu,
          unduhGalat: unduhGalatPengampu,
          onSelesai: () => {
            setImportOpen(false);
            void muatPengampu(kelasIds);
          },
        }}
      />
    </div>
  );
}
