import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { daftarKelas, listMutasiKeluar, mutasiSantri, type MutasiKeluar, type RiwayatRow } from '../api/siklus';
import { referensiList } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable from '@/components/ExcelTable';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { toast } from 'sonner';

/** Mutasi Keluar: kiri santri aktif (nama + kelas) → kanan arsip mutasi. */
export default function MutasiKeluarPage() {
  const { user } = useAuth();
  const [lembagaId, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [kiri, setKiri] = useState<RiwayatRow[]>([]);
  const [arsip, setArsip] = useState<MutasiKeluar[]>([]);
  const [alasanOpsi, setAlasanOpsi] = useState<{ value: string; label: string }[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pager = usePager('mutasi_keluar');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  /** Urut header arsip: daftar nilai allowlist + arah global (maks 3 kunci). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');

  const [baris, setBaris] = useState<RiwayatRow | null>(null);
  const [tanggal, setTanggal] = useState('');
  const [alasan, setAlasan] = useState('');
  const [noSurat, setNoSurat] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [npsn, setNpsn] = useState('');
  const [nsm, setNsm] = useState('');
  const [keterangan, setKeterangan] = useState('');

  const loadKiri = useCallback(async () => {
    if (!lembagaId) { setKiri([]); return; }
    setErr('');
    try {
      const res = await daftarKelas({ lembaga_id: Number(lembagaId) });
      setKiri(res.data);
    } catch (e) { setErr(errorMessage(e)); }
  }, [lembagaId]);

  const loadArsip = useCallback(async (
    p = pager.page, pp = pager.perPage,
    f?: { urut?: string[]; arah?: 'naik' | 'turun' },
  ) => {
    if (!lembagaId) { setArsip([]); return; }
    try {
      const u = f?.urut ?? urut;
      const a = f?.arah ?? arahUrut;
      const res = await listMutasiKeluar({
        lembaga_id: Number(lembagaId),
        sort: u.length ? u : undefined,
        arah: u.length ? a : undefined,
        page: p, per_page: pp,
      });
      setArsip(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) { setErr(errorMessage(e)); }
  }, [lembagaId, pager.page, pager.perPage, urut, arahUrut]);

  /** Klik header: simpan urut baru lalu muat ulang arsip dari halaman 1. */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun') {
    setUrut(nilai);
    setArahUrut(arah);
    pager.goFirst();
    void loadArsip(1, pager.perPage, { urut: nilai, arah });
  }

  useEffect(() => { void loadKiri(); }, [loadKiri]);
  useEffect(() => { void loadArsip(); }, [loadArsip]);

  useEffect(() => {
    referensiList('alasan_mutasi', lembagaId ? Number(lembagaId) : undefined)
      .then((r) => setAlasanOpsi(r.map((x) => ({ value: x.kode ?? x.nama ?? '', label: x.nama ?? x.kode ?? '' }))))
      .catch(() => setAlasanOpsi([]));
  }, [lembagaId]);

  const simpan = async () => {
    if (!baris || !lembagaId || !tanggal || !alasan) return;
    setBusy(true);
    try {
      await mutasiSantri(baris.santri_id, {
        lembaga_id: Number(lembagaId),
        tanggal_mutasi: tanggal,
        alasan_mutasi: alasan,
        kelas_terakhir_id: baris.kelas_id ?? undefined,
        no_surat: noSurat.trim() || undefined,
        nama_sekolah_tujuan: tujuan.trim() || undefined,
        npsn_sekolah_tujuan: npsn.trim() || undefined,
        nsm_sekolah_tujuan: nsm.trim() || undefined,
        keterangan: keterangan.trim() || undefined,
      });
      toast.success('Santri dimutasi keluar.');
      setBaris(null);
      setTanggal(''); setAlasan(''); setNoSurat(''); setTujuan(''); setNpsn(''); setNsm(''); setKeterangan('');
      await Promise.all([loadKiri(), loadArsip(1)]);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-md border">
          <header className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Santri aktif ({kiri.length})</header>
          <div className="px-2 pb-1">
            <ExcelTable
              tableKey="mutasi_santri_aktif"
              fields={[
                { key: 'nama', label: 'Nama', kind: 'static' },
                { key: 'kelas', label: 'Kelas', kind: 'static' },
              ]}
              rows={kiri}
              getValues={(r) => ({ nama: r.santri?.nama_lengkap ?? null, kelas: r.kelas?.nama_kelas ?? null })}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={(r) => (
                bisa(user, 'mutasi_keluar.ubah') ? (
                  <Button id={`btn_mutasi_${r.id}`} size="sm" variant="outline" onClick={() => { setBaris(r); setTanggal(''); setAlasan(''); setNoSurat(''); setTujuan(''); setNpsn(''); setNsm(''); setKeterangan(''); }}>
                    Mutasi
                  </Button>
                ) : null
              )}
              hideCheckbox
              maxRows={12}
              emptyText="Pilih lembaga dulu."
            />
          </div>
        </section>

        <section className="rounded-md border">
          <header className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Arsip mutasi keluar</header>
          <div className="px-2 pb-1">
            <ExcelTable
              tableKey="mutasi_arsip"
              fields={[
                { key: 'santri', label: 'Nama', kind: 'static' },
                { key: 'tanggal', label: 'Tanggal', kind: 'static' },
                { key: 'alasan', label: 'Alasan', kind: 'static' },
                { key: 'tujuan', label: 'Tujuan', kind: 'static' },
              ]}
              rows={arsip}
              getValues={(m) => ({
                santri: m.santri?.nama_lengkap ?? '—',
                tanggal: m.tanggal_mutasi?.slice(0, 10) ?? '—',
                alasan: m.alasan_mutasi ?? '—',
                tujuan: m.nama_sekolah_tujuan ?? '—',
              })}
              opsiUrut={[
                { kunci: 'santri', nilai: 'santri' },
                { kunci: 'tanggal', nilai: 'tanggal' },
              ]}
              urutAktif={urut}
              arahUrut={arahUrut}
              onUrut={terapkanUrut}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={() => null}
              hideCheckbox
              hideActions
              hidePreset
              maxRows={8}
              emptyText="Belum ada arsip mutasi."
            />
          </div>
          <Pager page={pager.page} lastPage={lastPage} total={total} perPage={pager.perPage} onPage={(p) => { pager.setPage(p); void loadArsip(p); }} onPerPage={(pp) => { pager.setPerPage(pp); void loadArsip(1, pp); }} />
        </section>
      </div>

      <Dialog open={baris !== null} onOpenChange={(o) => { if (!o) setBaris(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mutasi keluar</DialogTitle>
            <DialogDescription>{baris?.santri?.nama_lengkap} — {baris?.kelas?.nama_kelas ?? 'tanpa kelas'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
            <FieldLabel htmlFor="input_tanggal_mutasi">Tanggal</FieldLabel>
            <Input id="input_tanggal_mutasi" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            <FieldLabel htmlFor="select_alasan_mutasi">Alasan</FieldLabel>
            <Select value={alasan || '_kosong'} onValueChange={(v) => setAlasan(v === '_kosong' ? '' : v)}>
              <SelectTrigger id="select_alasan_mutasi"><SelectValue placeholder="Pilih alasan" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_kosong">Pilih alasan</SelectItem>
                  {alasanOpsi.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_no_surat_mutasi">No. surat</FieldLabel>
            <Input id="input_no_surat_mutasi" value={noSurat} onChange={(e) => setNoSurat(e.target.value)} />
            <FieldLabel htmlFor="input_tujuan_mutasi">Sekolah tujuan</FieldLabel>
            <Input id="input_tujuan_mutasi" value={tujuan} onChange={(e) => setTujuan(e.target.value)} />
            <FieldLabel htmlFor="input_npsn_mutasi">NPSN tujuan</FieldLabel>
            <Input id="input_npsn_mutasi" value={npsn} onChange={(e) => setNpsn(e.target.value)} />
            <FieldLabel htmlFor="input_nsm_mutasi">NSM tujuan</FieldLabel>
            <Input id="input_nsm_mutasi" value={nsm} onChange={(e) => setNsm(e.target.value)} />
            <FieldLabel htmlFor="input_keterangan_mutasi">Keterangan</FieldLabel>
            <Input id="input_keterangan_mutasi" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBaris(null)}>Batal</Button>
            <Button id="btn_simpan_mutasi" disabled={busy || !tanggal || !alasan} onClick={() => void simpan()}>Proses mutasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
