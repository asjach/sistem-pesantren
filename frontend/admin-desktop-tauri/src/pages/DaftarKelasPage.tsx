import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { daftarKelas, type RiwayatRow } from '../api/siklus';
import type { SantriPenuh } from '../api/santri';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable from '@/components/ExcelTable';
import { FilterTingkatKelas, useFilterTingkatKelas } from '@/components/FilterTingkatKelas';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { useSemesterAwal } from '@/hooks/useSemesterAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ActionIcon } from '@/components/RowActions';
import { Eye, Pencil } from '@/icons';
import FilterField from '@/components/FilterField';
import { ProfilSantriDialog } from '@/components/ProfilSantriDialog';
import { EditSantriDialog } from '@/components/santri/EditSantriDialog';
import {
  daftarKelasValues,
  medanDaftarKelas,
  pakaiCommitDaftarKelas,
} from '@/components/siklus/kolomDaftarKelas';

/** Daftar Kelas: basis status_akhir (Aktif = gabungan 5 status; Tidak aktif =
 *  Pindah/Keluar) dengan opsi lintas semester dan lintas tahun ajaran. */
export default function DaftarKelasPage() {
  const { user } = useAuth();
  const canSantri = bisa(user, 'santri.ubah');
  const canRiwayat = bisa(user, 'riwayat_belajar.ubah');
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  const [semester, setSemester] = useState('');
  useSemesterAwal(setSemester);
  /** Kelompok status akhir: aktif (bawaan) | nonaktif | '' = semua status. */
  const [kelompok, setKelompok] = useState('aktif');
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  /** Filter tingkat & kelas (multi-pilih) di topBar. */
  const filter = useFilterTingkatKelas(rows, (r) => r.tingkat, (r) => r.kelas?.nama_kelas);
  const [info, setInfo] = useState<{ tahun_ajaran: string | null; semester: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [profilRow, setProfilRow] = useState<SantriPenuh | null>(null);
  const [editRow, setEditRow] = useState<SantriPenuh | null>(null);

  /** Seluruh kolom 3 tabel; jenis edit mengikuti izin per tabel. */
  const fields = useMemo(
    () => medanDaftarKelas({ bolehSantri: canSantri, bolehRiwayat: canRiwayat }),
    [canSantri, canRiwayat],
  );
  const commitDaftar = useMemo(() => pakaiCommitDaftarKelas(rows), [rows]);

  const load = useCallback(async () => {
    if (!jenjang) { setRows([]); setInfo(null); return; }
    setErr('');
    setLoading(true);
    try {
      // Salah satu periode = Semua → lintas periode (tanpa default server).
      const lintas = taId === '' || semester === '';
      const res = await daftarKelas({
        jenjang: jenjang,
        tahun_ajaran: taId || undefined,
        semester: semester || undefined,
        kelompok_status: kelompok === '' ? undefined : (kelompok as 'aktif' | 'nonaktif'),
        lintas_periode: lintas || undefined,
      });
      setRows(res.data);
      setInfo({ tahun_ajaran: res.tahun_ajaran, semester: res.semester });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [jenjang, taId, semester, kelompok]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <FilterTingkatKelas filter={filter} />
      <ExcelTable<RiwayatRow>
        tableKey="daftar_kelas"
        fields={fields}
        rows={filter.tersaring}
        getValues={daftarKelasValues}
        loading={loading}
        emptyText="Pilih lembaga untuk menampilkan daftar kelas."
        canEdit={canSantri || canRiwayat}
        onCommit={commitDaftar}
        onSaved={load}
        renderActions={(r) => (r.santri ? (
          <>
            <ActionIcon id={`btn_detail_santri_${r.id}`} title="Lihat detail santri" onClick={() => setProfilRow(r.santri as SantriPenuh)}><Eye size={16} /></ActionIcon>
            {canSantri && (
              <ActionIcon id={`btn_edit_santri_${r.id}`} title="Ubah detail santri" onClick={() => setEditRow(r.santri as SantriPenuh)}><Pencil size={16} /></ActionIcon>
            )}
          </>
        ) : null)}
        filter={(
          <>
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
            {info ? (
              <span className="text-xs text-muted-foreground">
                TA {info.tahun_ajaran ?? 'Semua'}
                {' · '}Smt {info.semester ?? 'Semua'}
                {' · '}{kelompok === 'aktif' ? 'Aktif' : kelompok === 'nonaktif' ? 'Tidak aktif' : 'Semua status'}
                {' · '}{rows.length} santri
              </span>
            ) : null}
          </>
        )}
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
