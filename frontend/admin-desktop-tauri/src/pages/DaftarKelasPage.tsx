import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { daftarKelas, keluarKelas, pindahKelas, type RiwayatRow } from '../api/siklus';
import { listKelas, type Kelas } from '../api/master';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ActionIcon } from '@/components/RowActions';
import { MoveHorizontal, SquareMousePointer } from '@/icons';
import { FilterLembaga, FilterSemester, FilterTahunAjaran, ROSTER_FIELDS, noopCommit, riwayatValues, useLembagaTa } from '@/components/siklus/bersama';
import { toast } from 'sonner';

/** Daftar Kelas: santri aktif pada TA aktif & semester berjalan (baca + pindah/keluar kelas). */
export default function DaftarKelasPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [semester, setSemester] = useState('');
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  const [info, setInfo] = useState<{ tahun_ajaran_id: number; semester: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const { lembagas, tas } = useLembagaTa(lembagaId);

  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [pindahRow, setPindahRow] = useState<RiwayatRow | null>(null);
  const [pindahKe, setPindahKe] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!lembagaId) { setRows([]); setInfo(null); return; }
    setErr('');
    setLoading(true);
    try {
      const res = await daftarKelas({
        lembaga_id: Number(lembagaId),
        tahun_ajaran_id: taId ? Number(taId) : undefined,
        semester: semester || undefined,
      });
      setRows(res.data);
      setInfo({ tahun_ajaran_id: res.tahun_ajaran_id, semester: res.semester });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [lembagaId, taId, semester]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!lembagaId) { setKelas([]); return; }
    listKelas({ lembaga_id: Number(lembagaId), tahun_ajaran_id: taId ? Number(taId) : undefined, per_page: 1000 })
      .then((p) => setKelas(p.data))
      .catch(() => setKelas([]));
  }, [lembagaId, taId]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<RiwayatRow>
        tableKey="daftar_kelas"
        fields={ROSTER_FIELDS}
        rows={rows}
        getValues={riwayatValues}
        loading={loading}
        emptyText="Pilih lembaga untuk menampilkan daftar kelas."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={(r) => (
          <>
            <ActionIcon id={`btn_pindah_kelas_daftar_${r.id}`} title="Pindah kelas" onClick={() => { setPindahRow(r); setPindahKe(r.kelas_id ? String(r.kelas_id) : ''); }}><MoveHorizontal size={16} /></ActionIcon>
            <ActionIcon id={`btn_keluar_kelas_daftar_${r.id}`} title="Keluarkan dari kelas" onClick={async () => {
              try { await keluarKelas(r.id); toast.success('Santri dikeluarkan dari kelas.'); await load(); }
              catch (e) { toast.error(errorMessage(e)); }
            }}><SquareMousePointer size={16} /></ActionIcon>
          </>
        )}
        filter={(
          <>
            <FilterLembaga id="select_lembaga_daftar_kelas" value={lembagaId} onChange={(v) => { setLembagaId(v); setTaId(''); }} lembagas={lembagas} />
            <FilterTahunAjaran id="select_ta_daftar_kelas" value={taId} onChange={setTaId} tas={tas} />
            <FilterSemester id="select_semester_daftar_kelas" value={semester} onChange={setSemester} />
            {info ? (
              <span className="text-xs text-muted-foreground">
                TA {tas.find((t) => t.id === info.tahun_ajaran_id)?.nama ?? info.tahun_ajaran_id} · Smt {info.semester} · {rows.length} santri
              </span>
            ) : null}
          </>
        )}
      />

      <Dialog open={pindahRow !== null} onOpenChange={(o) => { if (!o) setPindahRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pindah kelas</DialogTitle>
            <DialogDescription>{pindahRow?.santri?.nama_lengkap}</DialogDescription>
          </DialogHeader>
          <FieldLabel htmlFor="select_pindah_kelas_daftar">Kelas tujuan</FieldLabel>
          <Select value={pindahKe || '_kosong'} onValueChange={(v) => setPindahKe(v === '_kosong' ? '' : v)}>
            <SelectTrigger id="select_pindah_kelas_daftar"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_kosong">Pilih kelas</SelectItem>
                {kelas.map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPindahRow(null)}>Batal</Button>
            <Button id="btn_simpan_pindah_kelas_daftar" disabled={!pindahKe || busy} onClick={async () => {
              if (!pindahRow || !pindahKe) return;
              setBusy(true);
              try {
                await pindahKelas(pindahRow.id, Number(pindahKe));
                toast.success('Kelas dipindah.');
                setPindahRow(null);
                setPindahKe('');
                await load();
              } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
            }}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
