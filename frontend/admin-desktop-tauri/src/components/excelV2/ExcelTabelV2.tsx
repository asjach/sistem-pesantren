import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import BilahToolbarV2 from './BilahToolbarV2';
import GridV2 from './GridV2';
import TableFooterV2 from './TableFooterV2';
import MenuPengaturanV2 from './MenuPengaturanV2';
import { susunKolom } from './kolom';
import { useToolbarPresetState } from '@/components/excel/useToolbarPreset';
import { komponenAktif, type InfoKomponenTabel } from '@/components/excel/komponenTabel';
import DialogKelolaTabel from '@/components/kelolaTabel/DialogKelolaTabel';
import { useLembagaAktif } from '@/lembagaAktif';
import { useVisibilitasFilter } from '@/components/VisibilitasFilter';
import { Button } from '@/components/ui/button';
import { Settings } from '@/icons';
import type { ExcelField, GridRow } from '@/components/excel/types';

export interface ExcelTabelV2Props<T extends { id: string | number }> {
  judul: string;
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
}: ExcelTabelV2Props<T>) {
  const [dipilih, setDipilih] = useState<Set<string | number>>(() => new Set());
  /** Susunan kolom dari preset. null = semua kolom, urutan asli halaman. */
  const [kolomPreset, setKolomPreset] = useState<string[] | null>(null);
  const [kelolaOpen, setKelolaOpen] = useState(false);

  /** Setelan tabel milik pengguna: judul, label, perataan, visibilitas. */
  const { judulDb, labelDb, alignDb, visibilitas, infoHtmlDb } = useToolbarPresetState(tableKey);
  const judulTampil = judulDb?.trim() || judul;

  const { efektifSuper } = useLembagaAktif();
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

  const terapkanPreset = useCallback((keys: string[] | null, presetId?: number | null) => {
    setKolomPreset(keys && keys.length > 0 ? keys : null);
    onApplyPreset(keys, presetId);
  }, [onApplyPreset]);

  const fieldsTampil = useMemo(() => susunKolom(fields, kolomPreset), [fields, kolomPreset]);

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
    tombolAksi: aksi != null,
    relFilter: false,
    pager: pager != null,
    tombolTambah: false,
    tombolEdit: false,
    kolomCentang: !hideCheckbox,
    kolomAksi: !hideActions,
  }), [filter, onUrut, hidePreset, aksi, pager, hideCheckbox, hideActions]);

  const judulAktif = komponenAktif(visibilitas, 'judul_tabel');
  const aksiAktif = aksi != null && komponenAktif(visibilitas, 'tombol_aksi');
  const filterAktif = filter != null && komponenAktif(visibilitas, 'filter');
  const urutTampil = onUrut != null && komponenAktif(visibilitas, 'urutan');
  const kolomTampil = !hidePreset && komponenAktif(visibilitas, 'kolom');
  const headerAktif = komponenAktif(visibilitas, 'header_kolom');
  const centangAktif = !hideCheckbox && komponenAktif(visibilitas, 'kolom_centang');
  const aksiKolomAktif = !hideActions && komponenAktif(visibilitas, 'kolom_aksi');
  const pagerAktif = pager != null && komponenAktif(visibilitas, 'pager');
  const pengaturanAktif = komponenAktif(visibilitas, 'tombol_pengaturan');

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
      className="relative flex min-h-0 flex-1 flex-col border border-border bg-card"
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
        urutAktif={urutAktif}
        arahUrut={arahUrut}
        onUrut={onUrut}
        onApplyPreset={terapkanPreset}
      />

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
      />

      <TableFooterV2 jumlah={rows.length} dipilih={dipilih.size} pager={pagerAktif ? pager : undefined} />

      {tabelTerdaftar && (
        <DialogKelolaTabel
          open={kelolaOpen}
          onOpenChange={setKelolaOpen}
          tableKey={tableKey}
          judul={judulTampil}
          fields={fields}
          infoKomponen={infoKomponen}
          nonModal
          ringkas
        />
      )}
    </div>
  );
}
