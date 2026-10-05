import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { daftarSemester, tetapkanSemester, type SemesterLembaga } from '../api/semesterAktif';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import { Button } from '@/components/ui/button';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

/** Kolom tabel semester aktif per lembaga. */
const FIELDS_SEMESTER: ExcelField[] = [
  { key: 'jenjang', label: 'Jenjang', kind: 'static' },
  { key: 'nama', label: 'Nama Lembaga', kind: 'static' },
  { key: 'semester', label: 'Semester', kind: 'static',  },
];

/** Semester: aktivasi semester berjalan per lembaga (khusus super_admin).
 *  Baris = lembaga operasional; aksi Ganjil/Genap menetapkan semester aktif. */
export default function SemesterPage() {
  const [rows, setRows] = useState<SemesterLembaga[]>([]);
  const [cari, setCari] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Urut header tabel semester (perubahan memicu muat ulang via effect). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);

  const load = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const res = await daftarSemester({
        sort: urut.length ? tokenUrut(urut, arahKolom) : undefined,
        arah: urut.length ? arahUrut : undefined,
      });
      setRows(res.data);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [urut, arahUrut, arahKolom]);

  useEffect(() => { void load(); }, [load]);

  /** Klik header: simpan urut baru (effect memuat ulang). */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun', peta?: PetaArahKolom) {
    setUrut(nilai);
    setArahUrut(arah);
    setArahKolom(nilai.length > 0 ? peta : undefined);
  }

  const q = cari.trim().toLowerCase();
  const rowsTampil = q === ''
    ? rows
    : rows.filter((r) => r.jenjang.toLowerCase().includes(q) || (r.nama ?? '').toLowerCase().includes(q));

  async function tetapkan(r: SemesterLembaga, semester: '1' | '2') {
    if (r.semester === semester) return;
    setBusyId(r.jenjang);
    try {
      const res = await tetapkanSemester(r.jenjang, semester);
      toast.success(res.pesan);
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari lembaga…" />
      <PengaturanHalaman tampil={{}} tabel={[{ key: 'semester_aktif', judul: 'Semester aktif', fields: FIELDS_SEMESTER }]} />
      <ExcelTable<SemesterLembaga & { id: string }>
        tableKey="semester_aktif"
        fields={FIELDS_SEMESTER}
        rows={rowsTampil.map((r) => ({ ...r, id: r.jenjang }))}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        getValues={(r) => ({
          jenjang: r.jenjang,
          nama: r.nama,
          semester: r.label ?? 'Belum diatur',
        })}
        loading={loading}
        emptyText="Belum ada lembaga operasional."
        canEdit={false}
        onCommit={async () => {}}
        onSaved={() => {}}
        renderActions={(r) => (
          <>
            <Button
              id={`btn_semester_ganjil_${r.jenjang}`}
              size="sm"
              variant={r.semester === '1' ? 'default' : 'outline'}
              disabled={busyId === r.jenjang || r.semester === '1'}
              onClick={() => void tetapkan(r, '1')}
            >
              Ganjil
            </Button>
            <Button
              id={`btn_semester_genap_${r.jenjang}`}
              size="sm"
              variant={r.semester === '2' ? 'default' : 'outline'}
              disabled={busyId === r.jenjang || r.semester === '2'}
              onClick={() => void tetapkan(r, '2')}
            >
              Genap
            </Button>
          </>
        )}
        hideCheckbox
      />
    </div>
  );
}
