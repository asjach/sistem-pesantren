import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { daftarKelas, keluarKelas, pindahKelas, type RiwayatRow } from '../api/siklus';
import { listKelas, type Kelas } from '../api/master';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable from '@/components/ExcelTable';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { useSemesterAwal } from '@/hooks/useSemesterAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ActionIcon } from '@/components/RowActions';
import { MoveHorizontal, SquareMousePointer } from '@/icons';
import FilterField from '@/components/FilterField';
import { useLembagaTa } from '@/components/siklus/bersama';
import {
  daftarKelasValues,
  medanDaftarKelas,
  pakaiCommitDaftarKelas,
} from '@/components/siklus/kolomDaftarKelas';
import { toast } from 'sonner';

/** Daftar Kelas: basis status_akhir (Aktif = gabungan 5 status; Tidak aktif =
 *  Pindah/Keluar) dengan opsi lintas semester dan lintas tahun ajaran. */
export default function DaftarKelasPage() {
  const { user } = useAuth();
  const canPindah = bisa(user, 'pindah_kelas.ubah');
  const canSantri = bisa(user, 'santri.ubah');
  const canRiwayat = bisa(user, 'riwayat_belajar.ubah');
  const [lembagaId, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  const [semester, setSemester] = useState('');
  useSemesterAwal(setSemester);
  /** Kelompok status akhir: aktif (bawaan) | nonaktif | '' = semua status. */
  const [kelompok, setKelompok] = useState('aktif');
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  const [info, setInfo] = useState<{ tahun_ajaran_id: number | null; semester: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const { tas } = useLembagaTa(lembagaId);

  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [pindahRow, setPindahRow] = useState<RiwayatRow | null>(null);
  const [pindahKe, setPindahKe] = useState('');
  const [busy, setBusy] = useState(false);

  /** Seluruh kolom 3 tabel; jenis edit mengikuti izin per tabel. */
  const fields = useMemo(
    () => medanDaftarKelas({ bolehSantri: canSantri, bolehRiwayat: canRiwayat }),
    [canSantri, canRiwayat],
  );
  const commitDaftar = useMemo(() => pakaiCommitDaftarKelas(rows), [rows]);

  const load = useCallback(async () => {
    if (!lembagaId) { setRows([]); setInfo(null); return; }
    setErr('');
    setLoading(true);
    try {
      // Salah satu periode = Semua → lintas periode (tanpa default server).
      const lintas = taId === '' || semester === '';
      const res = await daftarKelas({
        lembaga_id: Number(lembagaId),
        tahun_ajaran_id: taId ? Number(taId) : undefined,
        semester: semester || undefined,
        kelompok_status: kelompok === '' ? undefined : (kelompok as 'aktif' | 'nonaktif'),
        lintas_periode: lintas || undefined,
      });
      setRows(res.data);
      setInfo({ tahun_ajaran_id: res.tahun_ajaran_id, semester: res.semester });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [lembagaId, taId, semester, kelompok]);

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
        fields={fields}
        rows={rows}
        getValues={daftarKelasValues}
        loading={loading}
        emptyText="Pilih lembaga untuk menampilkan daftar kelas."
        canEdit={canSantri || canRiwayat}
        onCommit={commitDaftar}
        onSaved={load}
        renderActions={(r) => (
          canPindah ? (
          <>
            <ActionIcon id={`btn_pindah_kelas_daftar_${r.id}`} title="Pindah kelas" onClick={() => { setPindahRow(r); setPindahKe(r.kelas_id ? String(r.kelas_id) : ''); }}><MoveHorizontal size={16} /></ActionIcon>
            <ActionIcon id={`btn_keluar_kelas_daftar_${r.id}`} title="Keluarkan dari kelas" onClick={async () => {
              try { await keluarKelas(r.id); toast.success('Santri dikeluarkan dari kelas.'); await load(); }
              catch (e) { toast.error(errorMessage(e)); }
            }}><SquareMousePointer size={16} /></ActionIcon>
          </>
          ) : null
        )}
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
                TA {info.tahun_ajaran_id == null ? 'Semua' : (tas.find((t) => t.id === info.tahun_ajaran_id)?.nama ?? info.tahun_ajaran_id)}
                {' · '}Smt {info.semester ?? 'Semua'}
                {' · '}{kelompok === 'aktif' ? 'Aktif' : kelompok === 'nonaktif' ? 'Tidak aktif' : 'Semua status'}
                {' · '}{rows.length} santri
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
