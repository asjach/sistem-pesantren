import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import BilahToolbarV2 from './BilahToolbarV2';
import GridV2 from './GridV2';
import TableFooterV2 from './TableFooterV2';
import MenuPengaturanV2 from './MenuPengaturanV2';
import { susunKolom } from './kolom';
import { errorMessage } from '@/api/client';
import { listPresetTabel, setPresetAktif, updatePresetTabel } from '@/api/preset';
import { judulTabel } from '@/components/excel/judul';
import { useToolbarPresetState } from '@/components/excel/useToolbarPreset';
import { gabungUrutan } from '@/components/excel/urutanKolom';
import { komponenAktif, type InfoKomponenTabel } from '@/components/excel/komponenTabel';
import { kabariPreset, kabariTampilanPerangkat } from '@/components/kelolaTabel/jenis';
import DialogKelolaTabel from '@/components/kelolaTabel/DialogKelolaTabel';
import FilterRail from '@/components/FilterRail';
import { DEFAULT_HEADER_H, useGridPrefs } from '@/components/GridPrefs';
import { useLembagaAktif } from '@/lembagaAktif';
import { useVisibilitasFilter } from '@/components/VisibilitasFilter';
import { Button } from '@/components/ui/button';
import { Settings } from '@/icons';
import { cn } from '@/lib/utils';
import { bisaInput, useBarisInputV2 } from './useBarisInputV2';
import type { ExcelField, GridRow } from '@/components/excel/types';

/** Samakan nama preset "Lengkap" tanpa peduli besar-kecil huruf. */
function namaLengkap(nama: string): boolean {
  return nama.trim().toLowerCase() === 'lengkap';
}

export interface ExcelTabelV2Props<T extends { id: string | number }> {
  /** Judul tabel berupa teks. Dipakai bila `header` tidak diberikan. */
  judul?: string;
  /** Judul tabel berupa node (mis. `<span>{judul}</span>`), mengikuti V1.
   *  Menang atas `judul` teks, kalah dari judul setelan pengguna. */
  header?: ReactNode;
  tableKey: string;
  fields: ExcelField[];
  rows: T[];
  /** Petakan baris domain ke nilai field grid. */
  getValues: (row: T) => Record<string, string | null>;
  loading?: boolean;
  emptyText?: string;
  /** Isi kolom Aksi per baris (sudah digerbang izin oleh halaman). */
  renderActions?: (row: T) => ReactNode;
  /** Tombol aksi halaman di area aksi toolbar. */
  aksi?: ReactNode;
  /** Isi subzona kiri area filter. */
  filter?: ReactNode;
  /** Kontrol paginasi di kanan footer. */
  pager?: ReactNode;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  onUrut?: (nilai: string[], arah: 'naik' | 'turun', arahKolom?: Record<string, 'naik' | 'turun'>) => void;
  /** Dipanggil saat preset kolom dipilih. V2 menerapkan sendiri kolom yang
   *  tampil; halaman boleh memakai presetId untuk mencatat preset aktif. */
  onApplyPreset: (keys: string[] | null, presetId?: number | null) => void;
  /** Kabarkan baris tercentang setiap pilihan berubah (urut tabel). */
  onCheckedChange?: (rows: T[]) => void;
  /** Baris dipilih lewat sel aktif (klik/panah), bukan centang. Dipakai tabel
   *  pemilih yang panel sebelahnya mengikuti baris. */
  onBarisKlik?: (row: T) => void;
  /** Id baris yang disorot; hanya berarti bersama onBarisKlik. */
  barisAktifId?: T['id'] | null;
  /** Tabel ringkas baca-saja: sembunyikan kolom centang. */
  hideCheckbox?: boolean;
  /** Tabel ringkas baca-saja: sembunyikan kolom Aksi. */
  hideActions?: boolean;
  /** Tabel ringkas baca-saja: sembunyikan pemilih preset kolom. */
  hidePreset?: boolean;
  /** Kontrol bebas halaman di awal area judul (mis. pemilih tabel). */
  awalanToolbar?: ReactNode;
  /** Kontrol bebas halaman di ujung kanan area judul, sebelum aksi massal. */
  akhirToolbar?: ReactNode;
  /** Tombol aksi utama halaman (mis. "+ Tambah"). */
  addButton?: ReactNode;
  /** Tampilkan `addButton` langsung (bawaan V2). `false` = dibungkus menu
   *  hamburger "Aksi" (MenuAksiToolbar). */
  addButtonLangsung?: boolean;
  /** Aksi massal untuk baris tercentang. Hanya dipanggil saat ada centang;
   *  `clearSelection` mengosongkan pilihan setelah aksi selesai. */
  renderBulkActions?: (checkedRows: T[], clearSelection: () => void) => ReactNode;
  /** Batasi tinggi badan grid maksimal N row. Tabel mengikuti jumlah data
   *  sampai batas ini, lalu memakai scroll vertikal di dalam grid. */
  maxRows?: number;
  /** Absen = tombol tambah tidak ditawarkan. Halaman mengurus izin tambah
   *  dan memperbarui rows setelah record berhasil dibuat. */
  onCreateRow?: (fields: Record<string, string | null>) => Promise<void>;
  /** Nilai awal row input; draft pengguna, termasuk null, selalu menang. */
  inputRowValues?: Record<string, string | null>;
  /** Introspeksi lebar kolom (AutoFit semua, reset lebar). Dipanggil saat grid
   *  siap; dipakai menu klik kanan dan kontrol halaman pada poin berikutnya. */
  onSiapLebar?: (aksi: { autoFitSemua: () => void; resetLebar: () => void }) => void;
  /** Keadaan awal "tabel mengisi lebar wadah" untuk tabel ini. Pref perangkat
   *  (diatur dari Kelola Tabel -> Umum) menang atas nilai ini. */
  isiLebarPenuh?: boolean;
  /** Izin menyunting sel (klik 2x menyalakan Mode Ubah). */
  canEdit?: boolean;
  /** Simpan satu baris ke server; dipakai antrean simpan otomatis. */
  onCommit?: (id: T['id'], fields: Record<string, string | null>) => Promise<void>;
  /** Muat ulang data setelah antrean simpan habis (satu kali, bukan per sel). */
  onSaved?: () => Promise<void> | void;
  /** Tampilkan rel filter Tingkat/Kelas di kiri grid (di bawah bilah judul,
   *  sejajar judul kolom). Pakai hanya pada tabel utama halaman — satu rel
   *  per halaman; halaman tanpa filter tingkat/kelas tidak menampilkannya. */
  rail?: boolean;
}

/**
 * ExcelTabelV2 — tabel gaya baru.
 *
 *  Tiga zona: toolbar, badan (grid), footer. Setelan tabel (judul, label,
 *  perataan, visibilitas komponen, tampilan perangkat) dibaca dari setelan
 *  yang sama dengan ExcelTable V1; pengaturan cepatnya ada di dropdown
 *  "Menu lainnya", sedangkan penyuntingan teks/angka tetap di Kelola Tabel.
 */
export default function ExcelTabelV2<T extends { id: string | number }>({
  judul,
  header,
  tableKey,
  fields,
  rows,
  getValues,
  loading = false,
  emptyText = 'Belum ada data.',
  renderActions,
  aksi,
  filter,
  pager,
  urutAktif,
  arahUrut,
  onUrut,
  onApplyPreset,
  onCheckedChange,
  onBarisKlik,
  barisAktifId,
  hideCheckbox = false,
  hideActions = false,
  hidePreset = false,
  awalanToolbar,
  akhirToolbar,
  addButton,
  addButtonLangsung = true,
  renderBulkActions,
  maxRows,
  onCreateRow,
  inputRowValues,
  onSiapLebar,
  isiLebarPenuh = false,
  canEdit = false,
  onCommit,
  onSaved,
  rail = false,
}: ExcelTabelV2Props<T>) {
  const [dipilih, setDipilih] = useState<Set<string | number>>(() => new Set());
  /** Susunan kolom dari preset. null = semua kolom, urutan asli halaman. */
  const [kolomPreset, setKolomPreset] = useState<string[] | null>(null);
  /** Id preset aktif; null = susunan Lengkap/kustom tanpa preset bernama. */
  const [presetId, setPresetId] = useState<number | null>(null);
  const kolomPresetRef = useRef(kolomPreset);
  kolomPresetRef.current = kolomPreset;
  const [kelolaOpen, setKelolaOpen] = useState(false);
  /** Nilai efektif dari GridV2, termasuk hasil ukur headerAutoH. */
  const [tinggiHeaderGrid, setTinggiHeaderGrid] = useState(DEFAULT_HEADER_H);
  const input = useBarisInputV2({ fields, onCreateRow, inputRowValues, loading: !!loading, tableKey });
  const tombolTambahRef = useRef<HTMLButtonElement>(null);
  const inputAktifSebelumnya = useRef(false);
  useEffect(() => {
    if (inputAktifSebelumnya.current && !input.state) tombolTambahRef.current?.focus();
    inputAktifSebelumnya.current = !!input.state;
  }, [input.state]);

  /** Setelan tabel milik pengguna: judul, label, perataan, visibilitas, urutan. */
  const {
    judulDb, labelDb, alignDb, visibilitas, infoHtmlDb, simpanAlign, urutanDb, simpanUrutan,
  } = useToolbarPresetState(tableKey);
  /** Presedensi judul mengikuti V1: setelan pengguna → header (node) →
   *  judul teks → bawaan dari tableKey. */
  const judulTampil: ReactNode = judulDb?.trim() || header || judul || judulTabel(tableKey);
  /** Judul untuk input di Kelola Tabel harus teks; node header tak bisa
   *  dipakai sebagai nilai input, jadi jatuh ke judul teks/tableKey. */
  const judulDbDefault = typeof judulTampil === 'string' ? judulTampil : (judul ?? judulTabel(tableKey));

  const { efektifSuper } = useLembagaAktif();
  const { headerH } = useGridPrefs();
  const visHalaman = useVisibilitasFilter();
  const tabelTerdaftar = visHalaman?.registrasi != null;
  const bolehKelola = tabelTerdaftar && efektifSuper;

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const dipilihRef = useRef(dipilih);
  dipilihRef.current = dipilih;
  const onCheckedChangeRef = useRef(onCheckedChange);
  onCheckedChangeRef.current = onCheckedChange;
  const onBarisKlikRef = useRef(onBarisKlik);
  onBarisKlikRef.current = onBarisKlik;

  const nilai = useMemo<GridRow[]>(
    () => rows.map((r) => ({ id: r.id, checked: false, ...getValues(r) })),
    [rows, getValues],
  );

  /** Semua jalur ubah pilihan lewat sini supaya halaman selalu menerima satu
   *  kabar dengan baris domain (bukan id grid). */
  const terapkanPilih = useCallback((baru: Set<string | number>) => {
    setDipilih(baru);
    const domain = rowsRef.current.filter((r) => baru.has(r.id));
    onCheckedChangeRef.current?.(domain);
  }, []);

  const togglePilih = useCallback((id: string | number) => {
    const baru = new Set(dipilihRef.current);
    if (baru.has(id)) baru.delete(id);
    else baru.add(id);
    terapkanPilih(baru);
  }, [terapkanPilih]);

  const togglePilihSemua = useCallback((centang: boolean) => {
    terapkanPilih(centang ? new Set(rowsRef.current.map((r) => r.id)) : new Set());
  }, [terapkanPilih]);

  /** Id baris dari grid dipetakan kembali ke baris domain halaman. */
  const tanganiBarisAktif = useCallback((id: string | number) => {
    const sumber = rowsRef.current.find((r) => r.id === id);
    if (sumber) onBarisKlikRef.current?.(sumber);
  }, []);

  const terapkanPreset = useCallback((keys: string[] | null, id?: number | null) => {
    setKolomPreset(keys && keys.length > 0 ? keys : null);
    setPresetId(id ?? null);
    onApplyPreset(keys, id);
  }, [onApplyPreset]);

  /** Muat preset aktif saat mount supaya urutan kolom tetap sama setelah
   *  reload walau area filter (tempat `PresetKolom` hidup) masih tertutup.
   *  Dilewati bila pengguna sudah memilih preset lebih dulu. */
  useEffect(() => {
    let batal = false;
    const fieldKeys = new Set(fields.map((f) => f.key));
    void listPresetTabel(tableKey)
      .then((res) => {
        if (batal || kolomPresetRef.current !== null) return;
        const aktifId = res.data.aktif_preset_id;
        let target = aktifId == null
          ? null
          : res.data.presets.find((p) => p.id === aktifId) ?? null;

        const kustom = target === null ? res.data.aktif_kolom : null;
        if (kustom && kustom.length > 0) {
          const dikenal = kustom.filter((k) => fieldKeys.has(k));
          if (dikenal.length > 0) {
            terapkanPreset(dikenal, null);
            return;
          }
        }

        if (target === null) {
          target = res.data.presets.find((p) => namaLengkap(p.nama)) ?? null;
        }
        if (target === null) return;

        const dikenal = target.kolom.filter((k) => fieldKeys.has(k));
        const urut = namaLengkap(target.nama)
          ? [...dikenal, ...[...fieldKeys].filter((k) => !dikenal.includes(k))]
          : dikenal;
        terapkanPreset(urut.length > 0 ? urut : null, target.id);
      })
      .catch(() => {});
    return () => { batal = true; };
    // Hanya saat tabel berganti; `terapkanPreset` stabil per render callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  const fieldsTampil = useMemo(() => {
    let tampil = susunKolom(fields, kolomPreset);
    // Tanpa preset: urutan global tersimpan (super_admin) menata kolom.
    if (kolomPreset === null && urutanDb != null && urutanDb.length > 0) {
      const byKey = new Map(tampil.map((f) => [f.key, f]));
      const urut = gabungUrutan(urutanDb, tampil.map((f) => f.key));
      const hasil = urut.map((k) => byKey.get(k)).filter((f): f is ExcelField => !!f);
      if (hasil.length > 0) tampil = hasil;
    }
    if (!input.state) return tampil;
    const keys = new Set(tampil.map((f) => f.key));
    return [...tampil, ...fields.filter((f) => f.required && bisaInput(f) && !keys.has(f.key))];
  }, [fields, kolomPreset, urutanDb, !!input.state]);

  /** Simpan urutan hasil geser judul: preset aktif → preset kustom → urutan
   *  global. Optimistis, dengan rollback saat server menolak. */
  const simpanUrutanKolom = useCallback((urutan: string[]) => {
    const sebelum = kolomPresetRef.current;
    if (presetId !== null) {
      setKolomPreset(urutan);
      void updatePresetTabel(presetId, { kolom: urutan })
        .then(() => {
          kabariPreset(tableKey);
          kabariTampilanPerangkat(tableKey);
        })
        .catch((e: unknown) => {
          setKolomPreset(sebelum);
          toast.error(errorMessage(e));
        });
      return;
    }
    if (sebelum !== null) {
      setKolomPreset(urutan);
      void setPresetAktif(tableKey, null, urutan)
        .then(() => {
          kabariPreset(tableKey);
          kabariTampilanPerangkat(tableKey);
        })
        .catch((e: unknown) => {
          setKolomPreset(sebelum);
          toast.error(errorMessage(e));
        });
      return;
    }
    simpanUrutan(urutan);
  }, [presetId, tableKey, simpanUrutan]);

  /** Baris domain yang tercentang, seurutan tabel. */
  const checkedRows = useMemo(() => rows.filter((r) => dipilih.has(r.id)), [rows, dipilih]);
  const clearSelection = useCallback(() => terapkanPilih(new Set()), [terapkanPilih]);
  /** Aksi massal hanya diberikan saat ada centang, seperti V1. */
  const aksiMassal = renderBulkActions && checkedRows.length > 0
    ? renderBulkActions(checkedRows, clearSelection)
    : null;

  /** Komponen yang BENAR-BENAR ada di V2 (bukan yang sedang tampil) — dipakai
   *  dialog dan menu agar tak menawarkan sakelar mati. */
  const infoKomponen = useMemo<InfoKomponenTabel>(() => ({
    adaBilahJudul: true,
    infoTengah: false,
    filter: filter != null,
    cari: false,
    keaktifan: false,
    urut: onUrut != null,
    kolom: !hidePreset,
    tombolAksi: aksi != null || addButton != null,
    relFilter: rail,
    pager: pager != null,
    tombolTambah: onCreateRow != null,
    tombolEdit: false,
    kolomCentang: !hideCheckbox,
    kolomAksi: !hideActions,
  }), [filter, onUrut, hidePreset, aksi, addButton, rail, pager, hideCheckbox, hideActions, onCreateRow]);

  const judulAktif = komponenAktif(visibilitas, 'judul_tabel');
  const aksiAktif = aksi != null && komponenAktif(visibilitas, 'tombol_aksi');
  const addAktif = addButton != null && komponenAktif(visibilitas, 'tombol_aksi');
  const filterAktif = filter != null && komponenAktif(visibilitas, 'filter');
  const urutTampil = onUrut != null && komponenAktif(visibilitas, 'urutan');
  const kolomTampil = !hidePreset && komponenAktif(visibilitas, 'kolom');
  const headerAktif = komponenAktif(visibilitas, 'header_kolom');
  const centangAktif = !hideCheckbox && komponenAktif(visibilitas, 'kolom_centang');
  const aksiKolomAktif = !hideActions && komponenAktif(visibilitas, 'kolom_aksi');
  const pagerAktif = pager != null && komponenAktif(visibilitas, 'pager');
  const pengaturanAktif = komponenAktif(visibilitas, 'tombol_pengaturan');
  const railTampil = rail && komponenAktif(visibilitas, 'rel_filter');
  /** Tinggi manual langsung menang; bila mode otomatis, ikuti hasil ukur grid. */
  const tinggiLabelRail = headerAktif ? (headerH ?? tinggiHeaderGrid) : 0;

  const pengaturan = pengaturanAktif ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      id={`btn_pengaturan_tabel_${tableKey}`}
      aria-label="Pengaturan tabel"
      title={tabelTerdaftar ? 'Pengaturan tabel (kolom, urutan, info)' : 'Halaman ini belum mendaftarkan tabelnya'}
      disabled={!tabelTerdaftar}
      onClick={() => setKelolaOpen(true)}
      className="!h-full !w-6"
    >
      <Settings size={14} />
    </Button>
  ) : undefined;

  const menu = (
    <MenuPengaturanV2
      tableKey={tableKey}
      info={infoKomponen}
      tabelTerdaftar={tabelTerdaftar}
      bolehKelola={bolehKelola}
      onKelolaTabel={() => setKelolaOpen(true)}
    />
  );

  return (
    <div
      data-slot="excel-table"
      data-varian="v2"
      className={cn(
        'relative flex min-h-0 flex-col border border-border bg-card',
        maxRows === undefined ? 'flex-1' : 'shrink-0',
      )}
    >
      <BilahToolbarV2
        judul={judulTampil}
        tableKey={tableKey}
        fields={fields}
        aksi={aksiAktif ? aksi : undefined}
        filter={filterAktif ? filter : undefined}
        hidePreset={hidePreset}
        tampilJudul={judulAktif}
        tampilUrut={urutTampil}
        tampilKolom={kolomTampil}
        infoHtml={infoHtmlDb}
        pengaturan={pengaturan}
        menu={menu}
        awalanToolbar={awalanToolbar}
        akhirToolbar={akhirToolbar}
        addButton={addAktif ? addButton : undefined}
        addButtonLangsung={addButtonLangsung}
        aksiMassal={aksiMassal}
        urutAktif={urutAktif}
        arahUrut={arahUrut}
        onUrut={onUrut}
        onApplyPreset={terapkanPreset}
      />

      <div className={railTampil ? 'flex min-h-0 flex-1' : 'contents'}>
        {railTampil && <FilterRail tinggiLabel={tinggiLabelRail} />}

        <GridV2
          tableKey={tableKey}
          fields={fieldsTampil}
          rows={nilai}
          loading={loading}
          emptyText={emptyText}
          renderActions={aksiKolomAktif && renderActions ? (id) => {
            const sumber = rows.find((r) => r.id === id);
            return sumber ? renderActions(sumber) : null;
          } : undefined}
          hideCheckbox={!centangAktif}
          hideHeader={!headerAktif}
          labelDb={labelDb}
          alignDb={alignDb}
          dipilih={dipilih}
          onTogglePilih={togglePilih}
          onTogglePilihSemua={togglePilihSemua}
          barisAktifId={barisAktifId ?? null}
          onBarisAktif={onBarisKlik ? tanganiBarisAktif : undefined}
          onSiapLebar={onSiapLebar}
          maxRows={maxRows}
          isiLebarPenuh={isiLebarPenuh}
          canEdit={canEdit && !input.state}
          inputRow={input.state}
          onCommit={onCommit}
          onSaved={onSaved}
          onKelolaTabel={tabelTerdaftar ? () => setKelolaOpen(true) : undefined}
          onUbahAlign={bolehKelola ? simpanAlign : undefined}
          bolehGeser={bolehKelola}
          onPindahKolom={simpanUrutanKolom}
          onTinggiHeaderChange={setTinggiHeaderGrid}
        />
      </div>

      {input.state && <p role="status" aria-live="polite" className="px-2 text-xs text-muted-foreground">{input.pesan || 'Mode Input aktif'}</p>}
      <TableFooterV2 jumlah={rows.length} dipilih={dipilih.size} pager={pagerAktif ? pager : undefined}
        aksi={onCreateRow && (input.state || komponenAktif(visibilitas, 'tombol_tambah')) ? (
          input.state ? <>
            <Button type="button" size="sm" disabled={input.state.menyimpan} onClick={() => void input.state?.simpan()}>{input.menyimpan ? 'Menyimpan…' : 'Simpan'}</Button>
            <Button type="button" variant="outline" size="sm" disabled={input.state.menyimpan} onClick={input.state.batal}>Batal</Button>
          </> : <Button ref={tombolTambahRef} id={`btn_tambah_baris_${tableKey}`} type="button" size="sm" variant="outline" disabled={loading} onClick={input.mulai}>Tambah baris</Button>
        ) : undefined} />

      {tabelTerdaftar && (
        <DialogKelolaTabel
          open={kelolaOpen}
          onOpenChange={setKelolaOpen}
          tableKey={tableKey}
          judul={judulDbDefault}
          fields={fields}
          infoKomponen={infoKomponen}
          nonModal
          ringkas
        />
      )}
    </div>
  );
}
