import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { daftarSemester, tetapkanSemester, type SemesterLembaga } from '../api/semesterAktif';
import { Button } from '@/components/ui/button';
import ExcelTable from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

/** Semester: aktivasi semester berjalan per lembaga (khusus super_admin).
 *  Baris = lembaga operasional; aksi Ganjil/Genap menetapkan semester aktif. */
export default function SemesterPage() {
  const [rows, setRows] = useState<SemesterLembaga[]>([]);
  const [cari, setCari] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const res = await daftarSemester();
      setRows(res.data);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      <ExcelTable<SemesterLembaga & { id: string }>
        tableKey="semester_aktif"
        fields={[
          { key: 'jenjang', label: 'lembaga.jenjang', kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
          { key: 'nama', label: 'lembaga.nama', kind: 'static', sumber: { tabel: 'lembaga', kolom: 'nama' } },
          { key: 'semester', label: 'semester_aktif.semester', kind: 'static', sumber: { tabel: 'semester_aktif', kolom: 'semester' } },
        ]}
        rows={rows.map((r) => ({ ...r, id: r.jenjang }))}
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
        searchValue={cari}
        onSearchChange={setCari}
        searchIds={{ form: 'form_cari_semester', input: 'input_cari_semester', button: 'btn_cari_semester' }}
        searchPlaceholder="Cari lembaga…"
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
