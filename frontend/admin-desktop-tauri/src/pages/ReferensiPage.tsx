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
import { errorMessage, prefGet, prefSet } from '../api/client';
import type { PetaArahKolom } from '../lib/urut';
import { urutanBerikutnya, urutkanReferensi } from '../lib/referensiUrut';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useLembagaAktif } from '@/lembagaAktif';
import { targetTunggal, useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { labelPintasan, usePintasanBaru } from '@/hooks/usePintasanBaru';
import LabelTombolTambah from '@/components/LabelTombolTambah';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { labelKolom } from '@/lib/labelKolom';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DeleteAction, EditAction } from '@/components/RowActions';
import ConfirmDelete from '@/components/ConfirmDelete';
import { Trash2 } from '@/icons';
import { toast } from 'sonner';

const STATUS_TIPE = ['status_awal', 'status_akhir'];
const TIPE_AKTIF_KEY = 'simpes_referensi_tipe_aktif';

/** Kolom daftar tipe kamus di kolom kiri. Satu kolom saja: panelnya sempit dan
 *  isinya memang hanya nama kamus. */
const FIELDS_TIPE: ExcelField[] = [
  { key: 'tipe', label: 'Tipe kamus', width: 200, kind: 'static' },
];

/** Baris daftar tipe: `id` = kunci tipe (dipakai ExcelTable sebagai identitas
 *  baris + penanda baris aktif). */
interface BarisTipe {
  id: string;
  tipe: string;
}

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
  const canHapus = bisa(me, 'referensi.hapus');
  const myJenjang = useMemo(() => me?.lembagas?.map((l) => l.jenjang) ?? [], [me]);
  const adminFull = canManage && !isSuper && myJenjang.length === 0;

  const [types, setTypes] = useState<string[]>([]);
  /** Daftar tipe punya pemuatan sendiri: tabel kanan tetap kosong sampai
   *  tipe pertama terpilih, jadi indikatornya tak boleh menumpang `loading`. */
  const [memuatTipe, setMemuatTipe] = useState(true);
  const [tipe, setTipe] = useState('');
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const { jenjangs } = useFilterGlobalAktif();
  const targetJenjang = targetTunggal(jenjangs);
  const [rows, setRows] = useState<ReferensiRow[]>([]);
  /** Urutan aktif dari dropdown Urutkan. Halaman ini memuat seluruh baris
   *  sekaligus (endpoint mengembalikan array, bukan halaman), jadi urutannya
   *  diterapkan di klien — bukan dikirim sebagai `sort` ke server. */
  const [urut, setUrut] = useState<string[]>([]);
  const [arah, setArah] = useState<'naik' | 'turun'>('naik');
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);
  const terapkanUrut = useCallback((nilai: string[], a: 'naik' | 'turun', peta?: PetaArahKolom) => {
    setUrut(nilai);
    setArah(a);
    setArahKolom(nilai.length > 0 ? peta : undefined);
  }, []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tick] = useState(0);

  const [tambahOpen, setTambahOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Lembaga tujuan entri baru (checkbox; bisa beberapa). Kosong = belum
   *  ada pilihan — kirim nilai kosong agar backend menolak, bukan fan-out. */
  const [scope, setScope] = useState<string[]>([]);
  /** Semua jenjang yang boleh diakses — bawaan "terpilih semua". */
  const semuaJenjang = useMemo(() => lembagas.map((l) => l.jenjang), [lembagas]);
  const [fNama, setFNama] = useState('');
  const [fKode, setFKode] = useState('');
  /** Singkatan tampilan — hanya dipakai kamus `mapel`. */
  const [fSingkatan, setFSingkatan] = useState('');
  const [fUrutan, setFUrutan] = useState('0');

  const [editRow, setEditRow] = useState<ReferensiRow | null>(null);
  const [eNama, setENama] = useState('');
  const [eKode, setEKode] = useState('');
  const [eSingkatan, setESingkatan] = useState('');
  const [eUrutan, setEUrutan] = useState('0');

  const isStatus = STATUS_TIPE.includes(tipe);
  const isStatusAkhir = tipe === 'status_akhir';
  /** Kamus mapel punya kolom tambahan di tabelnya: `kode` & `singkatan`. */
  const isMapel = tipe === 'mapel';

  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const [daftar, tersimpan] = await Promise.all([referensiTypes(), prefGet(TIPE_AKTIF_KEY)]);
        if (!hidup) return;
        setTypes(daftar);
        const pilihan = tersimpan && daftar.includes(tersimpan) ? tersimpan : daftar[0] ?? '';
        setTipe(pilihan);
        if (pilihan && pilihan !== tersimpan) prefSet(TIPE_AKTIF_KEY, pilihan).catch(() => {});
      } catch (e) {
        if (hidup) {
          setErr(errorMessage(e));
          setLoading(false);
        }
      } finally {
        if (hidup) setMemuatTipe(false);
      }
    })();
    listLembaga({ per_page: 100 }).then((p) => { if (hidup) setLembagas(p.data); }).catch(() => {});
    return () => { hidup = false; };
  }, []);

  /** Baris daftar tipe kamus (kolom kiri). */
  const tipeRows = useMemo<BarisTipe[]>(() => types.map((t) => ({ id: t, tipe: t })), [types]);

  /** Pilih kamus dari kolom kiri: tabel kanan ikut berganti, pencarian direset
   *  (kata kunci kamus lama tak ada artinya di kamus baru), dan pilihan
   *  terakhir disimpan sebagai pref perangkat. */
  const pilihTipe = useCallback((nilai: string) => {
    if (nilai === tipe) return;
    setTipe(nilai);
    setSearch('');
    prefSet(TIPE_AKTIF_KEY, nilai).catch(() => {});
  }, [tipe]);

  /** Muat daftar; mengembalikan promise agar antrean simpan grid bisa menunggu
   *  baris segar TIBA sebelum membuang draft optimistis (tanpa ini toggle
   *  kelap-kelip on→off→on→off: draft dibuang saat basis masih basi). */
  const tipeRef = useRef(tipe);
  tipeRef.current = tipe;
  const lembagaRef = useRef<readonly string[]>(jenjangs);
  lembagaRef.current = jenjangs;

  const muat = useCallback(async () => {
    if (!tipeRef.current) return;
    setErr('');
    setLoading(true);
    try {
      // Mode kelola: selalu sertakan nonaktif agar toggle bisa memulihkan.
      // MySQL tinyint tiba sebagai 0/1 → normalkan ke boolean.
      const r = await referensiList(tipeRef.current, lembagaRef.current, true);
      setRows(r.map((row) => ({ ...row, is_active: !!row.is_active })));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat, tipe, jenjangs, tick]);

  const reload = useCallback(() => muat(), [muat]);

  const lembagaName = useCallback((j: string | null): string => {
    if (j === null) return 'Global';
    const l = lembagas.find((x) => x.jenjang === j);
    return l?.jenjang ?? l?.nama ?? j;
  }, [lembagas]);

  const canAccessRow = useCallback(
    (lid: string | null) =>
      lid !== null && (isSuper || adminFull || myJenjang.includes(lid)),
    [isSuper, adminFull, myJenjang],
  );
  const canUbahRow = useCallback(
    (r: ReferensiRow) => canAccessRow(r.jenjang),
    [canAccessRow],
  );
  const canNonaktifRow = useCallback(
    (r: ReferensiRow) => canAccessRow(r.jenjang),
    [canAccessRow],
  );
  const canHapusRow = useCallback(
    (r: ReferensiRow) => canHapus && canAccessRow(r.jenjang),
    [canHapus, canAccessRow],
  );

  /** Boleh toggle per baris: hak akses baris lembaganya (backend menegakkan). */
  const toggleBoleh = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) {
      const nyala = r.is_active !== false;
      m.set(String(r.id), nyala ? canNonaktifRow(r) : (r.jenjang !== null && canAccessRow(r.jenjang)));
    }
    return m;
  }, [rows, canNonaktifRow, canAccessRow]);

  const toggleBolehId = useCallback((id: string | number) => toggleBoleh.get(String(id)) ?? false, [toggleBoleh]);

  const fields = useMemo<ExcelField[]>(
    () => isStatus
      ? [
          { key: 'kode', label: 'kode', width: 150, kind: 'static' },
          { key: 'nama', label: 'nama', width: 200, kind: 'static' },
          { key: 'urutan', label: 'urutan', width: 80, kind: 'static' },
          ...(isStatusAkhir ? [{ key: 'sifat', label: 'Sifat', width: 170, kind: 'static' as const }] : []),
          { key: 'sumber', label: 'Sumber', width: 170, kind: 'static' },
          { key: 'tampil', label: 'Tampil', width: 130, kind: 'toggle', toggleTanpaEdit: true, bolehToggle: toggleBolehId },
        ]
      : [
          { key: 'nama', label: 'nama', width: 220, kind: 'static' },
          ...(isMapel
            ? [
                { key: 'kode', label: 'kode', width: 110, kind: 'static' as const },
                { key: 'singkatan', label: 'singkatan', width: 130, kind: 'static' as const },
              ]
            : []),
          { key: 'urutan', label: 'urutan', width: 80, kind: 'static' },
          { key: 'sumber', label: 'Sumber', width: 170, kind: 'static' },
          { key: 'tampil', label: 'Tampil', width: 130, kind: 'toggle', toggleTanpaEdit: true, bolehToggle: toggleBolehId,  },
        ],
    [isStatus, isStatusAkhir, isMapel, toggleBolehId],
  );

  const gridValues = useCallback((r: ReferensiRow): Record<string, string | null> => ({
    nama: r.nama ?? null,
    kode: r.kode ?? null,
    singkatan: r.singkatan ?? null,
    urutan: String(r.urutan ?? 0),
    sifat: sifatOf(r),
    sumber: lembagaName(r.jenjang),
    tampil: r.is_active === false ? 'tidak' : 'ya',
  }), [lembagaName]);

  const q = search.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    const dasar = q
      ? rows.filter((r) =>
          [r.nama, r.kode, r.singkatan].some((v) => (v ?? '').toLowerCase().includes(q)),
        )
      : rows;

    // Pengurutnya di `lib/referensiUrut` supaya logikanya bisa diuji tanpa
    // merender halaman (halaman ini butuh auth + beberapa context).
    return urutkanReferensi(dasar, urut, arah, arahKolom, lembagaName);
  }, [rows, q, urut, arah, arahKolom, lembagaName]);

  const canTambah = bisa(me, 'referensi.tambah');

  /** Urutan awal entri baru: terbesar di kamus ini + 1 (bukan selalu 0 lagi),
   *  jadi entri baru tidak menumpuk di urutan yang sama. Angkanya tetap bisa
   *  diubah pengguna di dialog. */
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const openTambah = useCallback(() => {
    setFNama(''); setFKode(''); setFSingkatan('');
    setFUrutan(String(urutanBerikutnya(rowsRef.current)));
    // Bawaan: SEMUA lembaga terpilih, entri baru dibuat di semuanya. Pengguna
    // tinggal mengucentang yang tak mau dipakai. Kalau daftar lembaga belum
    // selesai dimuat, andalkan scope filter (bukan kosong) supaya tak buntu.
    setScope(
      semuaJenjang.length > 0
        ? semuaJenjang
        : (targetJenjang ? [targetJenjang] : []),
    );
    setTambahOpen(true);
  }, [semuaJenjang, targetJenjang]);

  // Pintasan Ctrl/Cmd+N = aksi utama halaman ini ("+ Entri"). Terhalang saat
  // dialog tambah/ubah sudah terbuka atau tipe kamus belum siap (tak ada
  // tujuan tambah yang jelas).
  usePintasanBaru({
    kunci: 'n',
    aktif: canTambah && !!tipe,
    terhalang: tambahOpen || editRow !== null,
    onPicu: openTambah,
  });

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    // Tanpa pilihan lembaga tak ada tujuan simpan — backend juga menolak
    // array kosong, tapi dicegat di sini agar tak perlu bolak-balik. Pesan
    // lewat toast karena `err` halaman tertutup dialog.
    if (scope.length === 0) {
      toast.error('Pilih minimal satu lembaga.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: ReferensiInput = { urutan: fUrutan === '' ? 0 : Number(fUrutan) };
      payload.jenjang = scope;
      if (isStatus) {
        payload.kode = fKode.trim();
        payload.nama = fNama.trim() || fKode.trim();
      } else {
        payload.nama = fNama.trim();
        // Kamus mapel: kolom tambahan ikut dikirim (kosong → null di backend).
        if (isMapel) {
          payload.kode = fKode.trim();
          payload.singkatan = fSingkatan.trim();
        }
      }
      await createReferensi(tipe, payload);
      toast.success(
        scope.length === 1
          ? 'Entri referensi ditambahkan.'
          : `Entri ditambahkan ke ${scope.length} lembaga.`,
      );
      setTambahOpen(false);
      reload();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setSubmitting(false);
    }
  }, [scope, fUrutan, isStatus, isMapel, fKode, fNama, fSingkatan, tipe, reload]);

  const openEdit = useCallback((r: ReferensiRow) => {
    setEditRow(r);
    setENama(r.nama ?? '');
    setEKode(r.kode ?? '');
    setESingkatan(r.singkatan ?? '');
    setEUrutan(String(r.urutan ?? 0));
  }, []);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    setErr('');
    setSubmitting(true);
    try {
      const urutan = eUrutan === '' ? 0 : Number(eUrutan);
      await updateReferensi(tipe, editRow.id, {
        nama: eNama.trim(),
        urutan,
        // Kamus mapel: kode & nama singkat boleh diperbaiki (kosong → null).
        ...(isMapel ? { kode: eKode.trim(), singkatan: eSingkatan.trim() } : {}),
      });
      toast.success('Entri referensi diubah.');
      setEditRow(null);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [editRow, tipe, isMapel, eNama, eKode, eSingkatan, eUrutan, reload]);

  const onDelete = useCallback(async (r: ReferensiRow) => {
    // Tiap baris milik satu lembaga: padam langsung baris itu.
    // Tanpa toast/reload di sini: antrean grid memanggil onSaved (= muat) dan
    // menunggunya sebelum membuang draft; toast cukup satu dari antrean.
    const lid = r.jenjang ?? undefined;
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
      const res = await deleteReferensi(tipe, r.id, r.jenjang ?? undefined, true);
      toast.success(res.pesan);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [tipe, reload]);

  const hapusBulk = useCallback(async (list: ReferensiRow[]) => {
    if (list.length === 0) return;
    setErr('');
    const results = await Promise.allSettled(list.map((r) => (
      deleteReferensi(tipe, r.id, r.jenjang ?? undefined, true)
    )));
    const gagal = results.filter((result) => result.status === 'rejected');
    if (gagal.length > 0) {
      const alasan = gagal
        .map((result) => result.status === 'rejected' ? errorMessage(result.reason) : '')
        .filter(Boolean)
        .join(' · ');
      setErr(`${gagal.length} entri gagal dihapus${alasan ? `: ${alasan}` : '.'}`);
      toast.error('Sebagian entri referensi gagal dihapus.');
    } else {
      toast.success(`${list.length} entri referensi dihapus.`);
    }
    await reload();
  }, [tipe, reload]);

  const renderBulkActions = useCallback((checked: ReferensiRow[], clear: () => void) => {
    if (!canHapus) return null;
    const eligible = checked.filter(canHapusRow);
    if (eligible.length === 0) return null;
    return (
      <ConfirmDelete
        title={`Hapus ${eligible.length} entri referensi?`}
        description="Entri yang dipilih akan dihapus permanen dari kamus. Data yang sudah memakai teks ini tidak ikut berubah."
        confirmLabel="Hapus permanen"
        onConfirm={() => { clear(); void hapusBulk(eligible); }}
      >
        <Button id="btn_bulk_hapus_referensi" size="sm" variant="destructive">
          <Trash2 data-icon="inline-start" size={14} /> Hapus ({eligible.length})
        </Button>
      </ConfirmDelete>
    );
  }, [canHapus, canHapusRow, hapusBulk]);

  const renderActions = useCallback((r: ReferensiRow) => {
    // Tampil/padam lewat toggle di kolom is_active; aksi baris: Ubah + Hapus permanen.
    if (!canUbahRow(r)) return null;
    return (
      <>
        <EditAction id={`btn_ubah_referensi_${r.id}`} onClick={() => openEdit(r)} />
        {canHapusRow(r) ? (
          <DeleteAction
            id={`btn_hapus_referensi_${r.id}`}
            title="Hapus permanen entri?"
            description={`"${rowText(r)}" dibuang dari kamus ${lembagaName(r.jenjang)}. Data yang sudah memakai teks ini tidak ikut berubah.`}
            onConfirm={() => onHapusPermanen(r)}
          />
        ) : null}
      </>
    );
  }, [canUbahRow, canHapusRow, openEdit, onHapusPermanen, rowText, lembagaName]);

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
      <TopBarSearch value={search} onChange={setSearch} placeholder="Cari referensi…" />
      <PengaturanHalaman
        tampil={{}}
        tabel={[
          { key: 'referensi_tipe', judul: 'Tipe Kamus', fields: FIELDS_TIPE },
          { key: 'referensi', judul: 'Referensi', fields },
        ]}
      />
      {/* Dua kolom: kiri daftar TIPE kamus (pemilih), kanan isi kamusnya.
          Dulu tipe dipilih lewat dropdown di bilah filter — daftar seperti ini
          membuat seluruh kamus terlihat sekaligus dan pindah kamus cukup satu
          klik sel, tanpa membuka popover.

          Wadah `flex-1` di luar grup diperlukan karena grup panel memasang
          `height: 100%` inline: tanpa wadah, tingginya mengikuti tinggi shell
          (termasuk pesan galat) sehingga tabel bisa meluber. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <ResizablePanelGroup
          orientation="horizontal"
          id="grup_referensi"
          className="min-h-0 flex-1 overflow-hidden"
        >
          {/* Kolom kiri (bawaan 260px, bisa digeser): daftar tipe kamus. */}
          <ResizablePanel
            id="panel_referensi_tipe"
            defaultSize={260}
            minSize={180}
            maxSize={460}
            className="min-h-0"
          >
            <div className="flex h-full min-h-0 flex-col">
              <ExcelTable<BarisTipe>
                tableKey="referensi_tipe"
                fields={FIELDS_TIPE}
                rows={tipeRows}
                getValues={(r) => ({ tipe: labelKolom(r.tipe) })}
                loading={memuatTipe}
                emptyText="Belum ada tipe kamus."
                canEdit={false}
                onCommit={async () => {}}
                onSaved={() => {}}
                /* Klik sel = pilih kamus (sama seperti tabel pemilih di halaman
                   Dispensasi), jadi tak perlu kolom centang maupun Aksi. */
                onBarisKlik={(r) => pilihTipe(r.tipe)}
                barisAktifId={tipe || null}
                renderActions={() => null}
                /* Lebar kolom mengikuti rasio isi lalu diskalakan agar tabel
                   mengisi panel kiri (tanpa sisa ruang di kanan). */
                isiLebarPenuh
                hideCheckbox
                hideActions
                hidePreset
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle aria-label="Atur lebar daftar tipe kamus" />

          {/* Kolom kanan: isi kamus terpilih. `key={tipe}` mengatur ulang state
              grid (kolom, urutan, tinggi baris) tiap kamus berganti. */}
          <ResizablePanel id="panel_referensi_isi" minSize="40%" className="min-h-0">
            <div className="flex h-full min-h-0 flex-col">
              <ExcelTable
                key={tipe}
                tableKey="referensi"
                fields={fields}
                rows={visibleRows}
                getValues={gridValues}
                urutAktif={urut}
                arahUrut={arah}
                onUrut={terapkanUrut}
                loading={loading}
                emptyText="Belum ada entri."
                canEdit={false}
                onCommit={onCommit}
                onSaved={reload}
                /* Isi panel kanan sampai tepi: rasio antar kolom tetap
                   mengikuti isi datanya (lihat `excel/lebarIsi.ts`). */
                isiLebarPenuh
                /* "+ Entri" = aksi utama halaman ini, jadi tampil langsung di bilah
                   (tanpa menu hamburger `MenuAksiToolbar`) — sejalan dengan halaman
                   Pengguna & Kurikulum Mapel. */
                addButtonLangsung
                addButton={canTambah ? (
                  <Button
                    id="btn_tambah_referensi"
                    onClick={openTambah}
                    disabled={!tipe}
                    title={`Tambah entri referensi (${labelPintasan('n')})`}
                    aria-keyshortcuts="Control+N Meta+N"
                  >
                    <LabelTombolTambah pintasan={labelPintasan('n')}>+ Entri</LabelTombolTambah>
                  </Button>
                 ) : undefined}
                 renderActions={renderActions}
                 renderBulkActions={renderBulkActions}
               />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah entri referensi</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan entri referensi.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_referensi" onSubmit={onCreate} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel className="self-start pt-1.5">Lembaga</FieldLabel>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="check_scope_semua_referensi"
                className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium"
              >
                <Checkbox
                  id="check_scope_semua_referensi"
                  checked={semuaJenjang.length > 0 && scope.length === semuaJenjang.length}
                  onCheckedChange={(v) => setScope(v === true ? semuaJenjang : [])}
                />
                Semua lembaga
              </label>
              <div className="max-h-40 overflow-auto rounded-md border border-border p-1">
                {lembagas.map((l) => (
                  <label
                    key={l.jenjang}
                    htmlFor={`check_scope_referensi_${l.jenjang.toLowerCase()}`}
                    className="flex cursor-pointer items-center gap-2 rounded-xs px-1 py-1 text-xs hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`check_scope_referensi_${l.jenjang.toLowerCase()}`}
                      checked={scope.includes(l.jenjang)}
                      onCheckedChange={(v) => setScope((prev) => (
                        v === true
                          ? [...prev.filter((x) => x !== l.jenjang), l.jenjang]
                          : prev.filter((x) => x !== l.jenjang)
                      ))}
                    />
                    <span className="min-w-0 flex-1 truncate">{l.jenjang} — {l.nama}</span>
                  </label>
                ))}
                {lembagas.length === 0 && (
                  <p className="px-1 py-1 text-xs text-muted-foreground">Belum ada lembaga.</p>
                )}
              </div>
              <FieldDescription>
                {scope.length === 0
                  ? 'Pilih satu atau beberapa lembaga tujuan.'
                  : scope.length === semuaJenjang.length
                    ? `Bawaan: semua ${semuaJenjang.length} lembaga — uncentang yang tak dipakai.`
                    : `Entri baru dibuat di ${scope.length} lembaga.`}
              </FieldDescription>
            </div>
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
                {isMapel && (
                  <>
                    <FieldLabel htmlFor="input_kode_mapel_referensi">Kode</FieldLabel>
                    <Input
                      id="input_kode_mapel_referensi"
                      value={fKode}
                      onChange={(e) => setFKode(e.target.value)}
                      maxLength={20}
                      placeholder="MTK"
                    />
                    <FieldLabel htmlFor="input_singkatan_mapel_referensi">Singkatan</FieldLabel>
                    <Input
                      id="input_singkatan_mapel_referensi"
                      value={fSingkatan}
                      onChange={(e) => setFSingkatan(e.target.value)}
                      maxLength={50}
                      placeholder="Mat."
                    />
                  </>
                )}
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
              <Button id="btn_simpan_tambah_referensi" type="submit" disabled={submitting || scope.length === 0}>Tambah</Button>
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
                {isMapel && (
                  <>
                    <FieldLabel htmlFor="input_kode_mapel_referensi_ubah">Kode</FieldLabel>
                    <Input
                      id="input_kode_mapel_referensi_ubah"
                      value={eKode}
                      onChange={(e) => setEKode(e.target.value)}
                      maxLength={20}
                    />
                    <FieldLabel htmlFor="input_singkatan_mapel_referensi_ubah">Singkatan</FieldLabel>
                    <Input
                      id="input_singkatan_mapel_referensi_ubah"
                      value={eSingkatan}
                      onChange={(e) => setESingkatan(e.target.value)}
                      maxLength={50}
                    />
                  </>
                )}
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
