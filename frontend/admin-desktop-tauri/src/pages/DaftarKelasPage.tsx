import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { daftarKelas, type DaftarKelasHasil, type RiwayatRow } from '../api/siklus';
import type { SantriPenuh } from '../api/santri';
import { listKelas, type Kelas } from '../api/master';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable from '@/components/ExcelTable';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ActionIcon } from '@/components/RowActions';
import { Eye, Pencil } from '@/icons';
import FilterField from '@/components/FilterField';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { ProfilSantriDialog } from '@/components/ProfilSantriDialog';
import { EditSantriDialog } from '@/components/santri/EditSantriDialog';
import {
  daftarKelasValues,
  medanDaftarKelas,
  pakaiCommitDaftarKelas,
} from '@/components/siklus/kolomDaftarKelas';

/** Daftar Kelas: basis status_akhir (Aktif = gabungan 5 status; Tidak aktif =
 *  Pindah/Keluar) dengan opsi lintas semester dan lintas tahun ajaran.
 *  Urut + paginasi sisi server; tingkat/kelas global + cari via server. */
export default function DaftarKelasPage() {
  const { user } = useAuth();
  const canSantri = bisa(user, 'santri.ubah');
  const canRiwayat = bisa(user, 'riwayat_belajar.ubah');
  const {
    jenjangs,
    tahunAjaranNames,
    semesters,
    tingkat: tingkatAktif,
    kelas: kelasAktif,
    loading: filterLoading,
  } = useFilterGlobalAktif();
  /** Kelompok status akhir: aktif (bawaan) | nonaktif | '' = semua status. */
  const [kelompok, setKelompok] = useState('aktif');
  /** Pencarian tunggal halaman (topBar). */
  const [cari, setCari] = useState('');
  /** Opsi kelas lingkup (tanpa TA saat lintas periode) untuk memetakan nama
   *  filter global → id kelas param server. */
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 1000 })
      .then((p) => { if (hidup) setKelasOpsi(p.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjangs, tahunAjaranNames]);
  /** Id kelas terpilih (dari nama di filter global) untuk param server. */
  const kelasFilterIds = useMemo(
    () => kelasOpsi.filter((k) => kelasAktif.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasAktif],
  );

  const {
    rows,
    loading,
    err,
    urut,
    arahUrut,
    terapkanUrut,
    load,
    lastPage,
    total,
    pager,
    onSaved,
  } = useDaftarTabel<RiwayatRow>({
    tableKey: 'daftar_kelas',
    search: cari,
    ambil: (a): Promise<DaftarKelasHasil> => {
      if (filterLoading || jenjangs.length === 0) {
        return Promise.resolve({
          jenjang: [], tahun_ajaran: null, semester: null,
          data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0,
        });
      }
      // Salah satu periode = Semua → lintas periode (tanpa default server).
      const lintas = tahunAjaranNames.length === 0 || semesters.length === 0;
      return daftarKelas({
        jenjang: jenjangs,
        tahun_ajaran: tahunAjaranNames,
        semester: semesters,
        kelompok_status: kelompok === '' ? 'semua' : (kelompok as 'aktif' | 'nonaktif'),

        lintas_periode: lintas || undefined,
        tingkat: tingkatAktif,
        kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
        search: a.search || undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      });
    },
    deps: [filterLoading, jenjangs, tahunAjaranNames, semesters, kelompok, tingkatAktif, kelasFilterIds],
  });

  /** Seluruh kolom 3 tabel; jenis edit mengikuti izin per tabel. */
  const fields = useMemo(
    () => medanDaftarKelas({ bolehSantri: canSantri, bolehRiwayat: canRiwayat }),
    [canSantri, canRiwayat],
  );
  const commitDaftar = useMemo(() => pakaiCommitDaftarKelas(rows), [rows]);
  const [profilRow, setProfilRow] = useState<SantriPenuh | null>(null);
  const [editRow, setEditRow] = useState<SantriPenuh | null>(null);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <PengaturanHalaman tampil={{ tingkat: true, kelas: true }} tabel={[{ key: 'daftar_kelas', judul: 'Daftar kelas', fields }]} />
      <ExcelTable<RiwayatRow>
        tableKey="daftar_kelas"
        fields={fields}
        rows={rows}
        getValues={daftarKelasValues}
        loading={loading}
        emptyText="Pilih lembaga untuk menampilkan daftar kelas."
        canEdit={canSantri || canRiwayat}
        onCommit={commitDaftar}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        renderActions={(r) => (r.santri ? (
          <>
            <ActionIcon id={`btn_detail_santri_${r.id}`} title="Lihat detail santri" onClick={() => setProfilRow(r.santri as SantriPenuh)}><Eye size={16} /></ActionIcon>
            {canSantri && (
              <ActionIcon id={`btn_edit_santri_${r.id}`} title="Ubah detail santri" onClick={() => setEditRow(r.santri as SantriPenuh)}><Pencil size={16} /></ActionIcon>
            )}
          </>
        ) : null)}
        filter={(
          <FilterField label="Status" htmlFor="select_status_daftar_kelas">
            <Select value={kelompok === '' ? '_semua' : kelompok} onValueChange={(v) => setKelompok(v === '_semua' ? '' : v)}>
              <SelectTrigger id="select_status_daftar_kelas" title="Filter status akhir" aria-label="Filter status akhir" size="sm">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="nonaktif">Tidak aktif</SelectItem>
                  <SelectItem value="_semua">Semua status</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FilterField>
        )}
        tengah={(
          <span>
            TA {tahunAjaranNames.length === 0 ? 'Semua' : tahunAjaranNames.join(', ')}
            {' · '}Smt {semesters.length === 0 ? 'Semua' : semesters.join(', ')}
            {' · '}{kelompok === 'aktif' ? 'Aktif' : kelompok === 'nonaktif' ? 'Tidak aktif' : 'Semua status'}

            {' · '}{total} santri
          </span>
        )}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />

      <ProfilSantriDialog
        santriId={profilRow?.id ?? null}
        open={profilRow !== null}
        onOpenChange={(o) => { if (!o) setProfilRow(null); }}
      />
      <EditSantriDialog
        santri={editRow}
        open={editRow !== null}
        onOpenChange={(o) => { if (!o) setEditRow(null); }}
        onSaved={load}
      />
    </div>
  );
}
