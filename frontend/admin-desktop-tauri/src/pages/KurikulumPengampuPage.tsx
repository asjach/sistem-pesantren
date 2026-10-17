import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { listKelas, type Kelas } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { Copy, FileUp, NotebookTabs } from '@/icons';
import { DeleteAction } from '@/components/RowActions';
import ConfirmDelete from '@/components/ConfirmDelete';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import ImportBertahapUmumDialog from '@/components/ImportBertahapUmumDialog';
import {
  daftarGuruAktif, daftarKurikulum, daftarKelasKurikulum, daftarPengampus,
  generatePengampu, hapusKomposisi, simpanKelasKurikulum, simpanPengampu,
  batalPotongPengampu, importPengampuPotong, unduhGalatPengampu, unduhTemplatePengampu,
  KOLOM_IMPORT_PENGAMPU,
  type GuruAktif, type Kurikulum, type PengampusBaris,
} from '@/api/kurikulum';

/**
 * Keterangan aksi baris — tiga jenis, karena akibatnya berbeda total:
 *
 *  1. **Baris dari kurikulum** (`dari_kurikulum`): daftar pengampu kelas adalah
 *     GABUNGAN komposisi kurikulum kelas + baris yang tersimpan, jadi baris ini
 *     tak bisa hilang dari tabel selama mapelnya masih di kurikulum. Menghapus
 *     barisnya berarti melepas GURU-nya saja — baris muncul kembali tanpa guru.
 *     Karena itu aksi di sini dinamai "Kosongkan guru", bukan "hapus".
 *  2. **Baris manual**: baris benar-benar dihapus dari daftar pengampu.
 *  3. **Mapel dari kurikulum**: aksi kedua di baris yang sama (ikon notebook)
 *     menghapus MAPELNYA dari komposisi kurikulum — bukan cuma guru. Lihat
 *     `aksiKurikulum`.
 */
function aksiBaris(b: BarisPengampu): { judul: string; keterangan: string; sukses: string } {
  if (b.dari_kurikulum) {
    return {
      judul: 'Kosongkan guru pengampu?',
      keterangan: `"${b.nama_mapel}" di kelas ${b.nama_kelas} bagian dari kurikulum kelas, jadi mapelnya tetap tampil di daftar — yang dilepas hanya guru pengampunya. Untuk menghilangkan mapelnya sendiri, pakai tombol "Keluarkan dari kurikulum".`,
      sukses: `Guru ${b.nama_mapel} (kelas ${b.nama_kelas}) dilepas.`,
    };
  }
  return {
    judul: 'Keluarkan mapel dari pengampu?',
    keterangan: `"${b.nama_mapel}" dikeluarkan dari daftar pengampu kelas ${b.nama_kelas}. Guru & penugasan pada baris ini ikut dilepas. Mapel yang sudah punya nilai atau jadwal tidak bisa dikeluarkan.`,
    sukses: `${b.nama_mapel} dikeluarkan dari pengampu kelas ${b.nama_kelas}.`,
  };
}

/**
 * Keterangan dialog "Keluarkan dari kurikulum" — yang dihapus MAPELNYA, bukan
 * cuma guru: berkasnya di komposisi kurikulum, jadi efeknya ke SEMUA kelas yang
 * memakai kurikulum itu, bukan cuma kelas yang sedang dibuka.
 */
function aksiKurikulum(b: BarisPengampu): { judul: string; keterangan: string; sukses: string } {
  const kur = b.kurikulum_nama.length > 0 ? b.kurikulum_nama.join(', ') : 'kurikulum kelas';
  return {
    judul: 'Keluarkan mapel dari kurikulum?',
    keterangan: `"${b.nama_mapel}" dikeluarkan dari komposisi ${kur}. Berlaku untuk SEMUA kelas yang memakai kurikulum itu, bukan hanya kelas ${b.nama_kelas} — kelas lain yang memakai kurikulum yang sama ikut kehilangan mapel ini. `
      + (b.keaktifan_pegawai_id === null
        ? 'Mapel ini tidak punya guru pengampu di kelas ini, jadi tak ada penugasan yang ikut dilepas.'
        : `Guru ${b.nama_mapel} di kelas ${b.nama_kelas} juga dilepas. `
          + 'Kalau mapel ini sudah punya nilai atau jadwal di kelas ini, melepas guru akan DITOLAK dan mapel TIDAK dikeluarkan dari kurikulum.'),
    sukses: `${b.nama_mapel} dikeluarkan dari ${kur}.`,
  };
}

/** Baris tabel pengampu. `PengampuBaris` tak punya `id` sendiri, sedangkan
 *  komponen tabel selalu menandai satu baris lewat `id` — dan karena tabel bisa
 *  menampilkan BEBERAPA kelas sekaligus, kuncinya harus memuat kelas too:
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
    sumber: b.dari_kurikulum ? 'dari kurikulum' : 'manual',
    guru: b.keaktifan_pegawai_id === null ? '' : String(b.keaktifan_pegawai_id),
  };
}

/** Halaman Pengampu: peta kelas→kurikulum + pengampu (kelas × mapel → guru).
 *
 *  Kelas dipilih lewat RAIL Tingkat/Kelas di kiri tabel (bukan pemilih di
 *  toolbar) dan boleh beberapa kelas sekaligus — tabel lalu menampilkan baris
 *  pengampu Gabungan dengan kolom "Kelas". Endpoint pengampu & kurikulum kelas
 *  bekerja per kelas, jadi satu kelas = satu request. */
export default function KurikulumPengampuPage() {
  const {
    jenjangs, tahunAjaranNames, tingkat: tingkatFilter, kelas: kelasFilter, loading: filterLoading,
  } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canUbah = bisa(user, 'kurikulum.ubah');
  /** Mengeluarkan mapel dari komposisi kurikulum = menghapus baris komposisi. */
  const canHapus = bisa(user, 'kurikulum.hapus');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [kurikulum, setKurikulum] = useState<Kurikulum[]>([]);
  /** Kurikulum terpasang per kelas (`kelas_id` → daftar id kurikulum). */
  const [petaKurikulum, setPetaKurikulum] = useState<Record<number, number[]>>({});
  const [guru, setGuru] = useState<GuruAktif[]>([]);
  const [baris, setBaris] = useState<BarisPengampu[]>([]);
  const [pengampuLoading, setPengampuLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [err, setErr] = useState('');
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
   *  pilihan tingkat disembunyikan (bersamaan blok kurikulum per kelas). Tanpa
   *  menampilkan kelas dari tingkat lain. Kelas yang tersaring TIDAK ikut dihapus dari
   *  menampilkan kelas dari tingkat lain. Kelas yang tersaring TIDAK ikut
   *  dihapus dari filter kelas global — itu milik pengguna & halaman lain. */
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

  // Daftar kelas (pemetaan nama di rail → id) + kurikulum jenjang.
  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKelasOpsi([]); return; }
    let hidup = true;
    Promise.all([
      listKelas({ jenjang, tahun_ajaran: ta, per_page: 1000 }),
      daftarKurikulum(jenjang),
    ])
      .then(([k, kur]) => {
        if (!hidup) return;
        setKelasOpsi(k.data);
        setKurikulum(kur);
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

  /** Peta kelas→kurikulum untuk seluruh kelas lingkup (blok "kurikulum kelas"
   *  menampilkan satu blok per kelas terpilih). */
  const muatPetaKelas = useCallback(async () => {
    if (jenjang === null || ta === null) return;
    try {
      const { kelas } = await daftarKelasKurikulum({ jenjang, tahun_ajaran: ta });
      setPetaKurikulum(Object.fromEntries(kelas.map((k) => [k.id, k.kurikulum_ids])));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [jenjang, ta]);

  useEffect(() => { void muatPetaKelas(); }, [muatPetaKelas]);

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

  /** Simpan kurikulum untuk SATU kelas (blok per kelas). */
  const simpanKurikulum = useCallback(async (kelasId: number) => {
    await jalankan(
      () => simpanKelasKurikulum(kelasId, petaKurikulum[kelasId] ?? []),
      'Kurikulum kelas disimpan.',
      async () => {
        await muatPetaKelas();
        // Baris pengampu mengikuti kurikulum kelas itu juga.
        await muatPengampu(kelasIds);
      },
    );
  }, [petaKurikulum, jalankan, muatPetaKelas, muatPengampu, kelasIds]);

  /** Generate baris pengampu dari kurikulum untuk SETIAP kelas terpilih. */
  const generate = useCallback(async () => {
    if (kelasIds.length === 0) return;
    let dibuat = 0;
    const gagal: number[] = [];
    for (const id of kelasIds) {
      try {
        const r = await generatePengampu(id);
        dibuat += r.dibuat;
      } catch {
        gagal.push(id);
      }
    }
    const namaGagal = gagal
      .map((id) => kelasTampil.find((k) => k.id === id)?.nama_kelas ?? `#${id}`)
      .join(', ');
    if (gagal.length > 0) toast.error(`Gagal di kelas: ${namaGagal}.`);
    if (dibuat > 0) toast.success(`${dibuat} baris pengampu dibuat.`);
    else if (gagal.length === 0) toast.success('Tidak ada baris baru — mapel kurikulum sudah punya pengampu.');
    await muatPengampu(kelasIds);
  }, [kelasIds, kelasTampil, muatPengampu]);

  /** Edit sel "Guru pengampu": tersimpan seketika lewat satu PUT berisi seluruh
   *  baris KELAS ITU SAJA (endpoint sync per kelas). Nilai baris ditulis ke peta
   *  nilai lebih dulu, supaya edit berikutnya dalam antrean yang sama ikut
   *  membawanya. Galat diteruskan ke antrean simpan komponen tabel — ia yang
   *  mengembalikan nilai sel & menampilkan toast "Gagal menyimpan". */
  const commitGuru = useCallback(async (id: string | number, f: Record<string, string | null>) => {
    if (f.guru === undefined) return;
    const barisIni = baris.find((b) => b.id === String(id));
    if (!barisIni) return;
    const guru = f.guru === null || f.guru === '' ? null : Number(f.guru);
    nilaiGuruRef.current.set(barisIni.id, guru);
    const kirim = baris
      .filter((b) => b.kelas_id === barisIni.kelas_id)
      .map((b) => ({
        mata_pelajaran_id: b.mata_pelajaran_id,
        keaktifan_pegawai_id: b.id === barisIni.id ? guru : (nilaiGuruRef.current.get(b.id) ?? null),
      }));
    await simpanPengampu(barisIni.kelas_id, kirim);
  }, [baris]);

  /** Keluarkan satu mapel dari daftar pengampu kelasnya: kirim daftar kelas itu
   *  tanpa baris tersebut (endpoint sync menghapus baris yang absen). */
  const hapusBaris = useCallback(async (b: BarisPengampu) => {
    const kirim = baris
      .filter((x) => x.kelas_id === b.kelas_id && x.id !== b.id)
      .map((x) => ({ mata_pelajaran_id: x.mata_pelajaran_id, keaktifan_pegawai_id: nilaiGuruRef.current.get(x.id) ?? null }));
    const aksi = aksiBaris(b);
    await jalankan(
      () => simpanPengampu(b.kelas_id, kirim),
      aksi.sukses,
      async () => { await muatPengampu(kelasIds); },
    );
  }, [baris, jalankan, muatPengampu, kelasIds]);

  /**
   * Keluarkan MAPEL dari kurikulum kelas ini — bukan cuma melepas guru.
   *
   * Dua langkah: (1) baris pengampu kelas ini dibuang bila ada (sync `simpanPengampu`
   * menolak baris yang sudah punya nilai/jadwal, jadi langkah ini bisa gagal —
   * kalau gagal, komposisi kurikulum TIDAK disentuh); (2) baris komposisi
   * kurikulum dihapus. Baris pengampu di kelas lain ikut hilang dari daftar saat
   * tabelnya dimuat ulang, karena mapelnya tak lagi ada di kurikulum.
   */
  const hapusMapel = useCallback(async (b: BarisPengampu) => {
    const aksi = aksiKurikulum(b);
    await jalankan(async () => {
      if (b.keaktifan_pegawai_id !== null) {
        const kirim = baris
          .filter((x) => x.kelas_id === b.kelas_id && x.id !== b.id)
          .map((x) => ({ mata_pelajaran_id: x.mata_pelajaran_id, keaktifan_pegawai_id: nilaiGuruRef.current.get(x.id) ?? null }));
        await simpanPengampu(b.kelas_id, kirim);
      }
      for (const id of b.komposisi_ids) {
        await hapusKomposisi(id);
      }
    }, aksi.sukses, async () => { await muatPengampu(kelasIds); });
  }, [baris, jalankan, muatPengampu, kelasIds]);

  /** Kolom tabel pengampu. "Guru pengampu" = select yang langsung tersimpan
   *  saat dipilih (tanpa mode Edit); pilihannya mengikuti daftar guru aktif
   *  jenjang + tahun ajaran, jadi `fields` dihitung ulang saat daftar berubah.
   *  Kolom "Kelas" muncul karena tabel bisa menampilkan beberapa kelas. */
  const fieldsPengampu = useMemo<ExcelField[]>(() => [
    { key: 'kelas', label: 'Kelas', width: 110, kind: 'static' },
    { key: 'nama_mapel', label: 'Mapel', width: 220, kind: 'static' },
    { key: 'kelompok', label: 'Kelompok', width: 110, kind: 'static' },
    { key: 'sumber', label: 'Sumber', width: 120, kind: 'static' },
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

  /** Aksi baris: keluarkan mapel manual, atau kosongkan guru untuk baris dari
   *  kurikulum (mapelnya sendiri tak bisa hilang sebelum keluar dari kurikulum).
   *  Baris dari kurikulum yang belum punya guru tak perlu aksi — tak ada yang
   *  bisa dilepas. */
  const renderActions = useCallback((b: BarisPengampu) => {
    const aksi = aksiBaris(b);
    const keluarKurikulum = aksiKurikulum(b);
    // Baris dari kurikulum SELALU bisa dikeluarkan lewat ikon kurikulum, walau
    // tak ada guru (baris tanpa guru tak punya aksi "Kosongkan guru").
    const aksiKurikulumBoleh = canHapus && b.dari_kurikulum && b.komposisi_ids.length > 0;
    if (!canUbah && !aksiKurikulumBoleh) return null;
    return (
      <>
        {canUbah && !(b.dari_kurikulum && b.keaktifan_pegawai_id === null) && (
          <DeleteAction
            id={b.dari_kurikulum
              ? `btn_kosongkan_guru_${b.kelas_id}_${b.mata_pelajaran_id}`
              : `btn_hapus_pengampu_${b.kelas_id}_${b.mata_pelajaran_id}`}
            title={aksi.judul}
            description={aksi.keterangan}
            onConfirm={() => void hapusBaris(b)}
          />
        )}
        {aksiKurikulumBoleh && (
          <ConfirmDelete
            title={keluarKurikulum.judul}
            description={keluarKurikulum.keterangan}
            confirmLabel="Keluarkan"
            onConfirm={() => void hapusMapel(b)}
            tip="Keluarkan dari kurikulum"
          >
            <Button
              id={`btn_keluar_kurikulum_${b.kelas_id}_${b.mata_pelajaran_id}`}
              variant="ghost"
              size="icon-sm"
              aria-label="Keluarkan mapel dari kurikulum"
              className="text-muted-foreground hover:text-foreground"
            >
              <NotebookTabs size={16} />
            </Button>
          </ConfirmDelete>
        )}
      </>
    );
  }, [canUbah, canHapus, hapusBaris, hapusMapel]);

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

      {/* Kurikulum terpasang per kelas: satu baris ringkas tiap kelas (dapat
          banyak kelas saat rail di "All"), jadi kelas mana memakai kurikulum
          mana tetap jelas. */}
      {jumlahKelas > 0 && (
        <div className="max-h-40 shrink-0 overflow-auto border-b border-border p-3">
          {kurikulum.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Belum ada kurikulum untuk jenjang ini — buat di halaman Kurikulum.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {kelasTampil.map((k) => {
                const terpasang = petaKurikulum[k.id] ?? [];
                return (
                  <div key={k.id} className="flex items-start gap-2 text-xs">
                    <span className="w-32 shrink-0 font-medium">
                      {k.nama_kelas}
                      <span className="ml-1 font-normal text-muted-foreground">
                        (tingkat {k.tingkat ?? '-'})
                      </span>
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-3">
                      {kurikulum.map((kur) => (
                        <label key={kur.id} className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            aria-label={`Kurikulum ${kur.nama} untuk ${k.nama_kelas}`}
                            disabled={!canUbah}
                            checked={terpasang.includes(kur.id)}
                            onChange={(e) => setPetaKurikulum((prev) => {
                              const sekarang = prev[k.id] ?? [];
                              return {
                                ...prev,
                                [k.id]: e.target.checked
                                  ? [...sekarang, kur.id]
                                  : sekarang.filter((x) => x !== kur.id),
                              };
                            })}
                          />
                          {kur.nama}
                        </label>
                      ))}
                    </div>
                    {canUbah && (
                      <Button type="button" variant="outline" size="sm"
                        id={`btn_simpan_kurikulum_kelas_${k.id}`}
                        onClick={() => void simpanKurikulum(k.id)}>
                        Simpan
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                : semuaKelas
                  ? 'Belum ada mapel di kelas lingkup ini — pasang kurikulum di atas, lalu klik “Generate dari kurikulum”.'
                  : 'Belum ada mapel untuk kelas terpilih — pasang kurikulum di atas, lalu klik “Generate dari kurikulum”.'
          }
          canEdit={canUbah}
          onCommit={commitGuru}
          // Setiap edit sel = satu PUT penuh untuk kelasnya; muat ulang agar isi
          // tabel mengikuti data terbaru (mis. guru dinonaktifkan di halaman lain).
          onSaved={() => void muatPengampu(kelasIds)}
          addButtonLangsung
          addButton={
            <>
              {canUbah && (
                <Button type="button" variant="outline" size="sm" id="btn_buka_import_pengampu"
                  onClick={() => setImportOpen(true)}>
                  <FileUp data-icon="inline-start" size={16} /> Import
                </Button>
              )}
              {canUbah && jumlahKelas > 0 && (
                <Button type="button" variant="outline" size="sm" id="btn_generate_pengampu"
                  onClick={() => void generate()}>
                  <Copy data-icon="inline-start" size={14} /> Generate dari kurikulum
                </Button>
              )}
            </>
          }
          renderActions={renderActions}
        />
      </div>

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