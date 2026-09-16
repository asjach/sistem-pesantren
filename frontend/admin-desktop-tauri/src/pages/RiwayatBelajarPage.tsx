import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  createRiwayatBelajar,
  importRiwayatBelajar,
  keluarKelas,
  listRiwayatBelajar,
  periksaImportRiwayatBelajar,
  pindahKelas,
  setKelas,
  unduhTemplateRiwayatBelajar,
  type RiwayatRow,
} from '../api/siklus';
import { listSantri, type ImportPeriksa, type Santri } from '../api/santri';
import { listKelas, listTahunAjaran, type Kelas } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable from '@/components/ExcelTable';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { ActionIcon } from '@/components/RowActions';
import { MoveHorizontal, Plus, SquareMousePointer, FileUp, Download } from '@/icons';
import {
  FilterSemester,
  ROSTER_FIELDS,
  noopCommit,
  riwayatValues,
} from '@/components/siklus/bersama';
import { toast } from 'sonner';

/** Riwayat Belajar: tabel + dialog input + import Excel terpisah dari buku induk. */
export default function RiwayatBelajarPage() {
  const { user } = useAuth();
  const canTambah = bisa(user, 'riwayat_belajar.tambah');
  const canPindah = bisa(user, 'pindah_kelas.ubah');
  const pager = usePager('riwayat_belajar');
  const reqRef = useRef(0);
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [lembagaId, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  const [semester, setSemester] = useState('');
  const [tanpaKelas, setTanpaKelas] = useState(false);
  const [arsip, setArsip] = useState(false);
  const [search, setSearch] = useState('');
  const [terapkanCari, setTerapkanCari] = useState('');
  const [kelas, setKelasOpsi] = useState<Kelas[]>([]);

  const [inputOpen, setInputOpen] = useState(false);
  const [kelasPilih, setKelasPilih] = useState('');
  const [pindahRow, setPindahRow] = useState<RiwayatRow | null>(null);
  const [pindahKe, setPindahKe] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [periksaHasil, setPeriksaHasil] = useState<ImportPeriksa | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listRiwayatBelajar({
          lembaga_id: lembagaId ? Number(lembagaId) : undefined,
          tahun_ajaran_id: taId ? Number(taId) : undefined,
          semester: semester || undefined,
          tanpa_kelas: tanpaKelas || undefined,
          is_aktif: arsip ? false : true,
          q: terapkanCari || undefined,
          page: p,
          per_page: pp,
        });
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        setRows(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [pager.page, pager.perPage, pager.sync, lembagaId, taId, semester, tanpaKelas, arsip, terapkanCari],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, lembagaId, taId, semester, tanpaKelas, arsip, terapkanCari]);

  useEffect(() => {
    if (!lembagaId) { setKelasOpsi([]); return; }
    listKelas({ lembaga_id: Number(lembagaId), tahun_ajaran_id: taId ? Number(taId) : undefined, per_page: 1000 })
      .then((p) => setKelasOpsi(p.data))
      .catch(() => setKelasOpsi([]));
  }, [lembagaId, taId]);

  const bukaPindah = useCallback((r: RiwayatRow) => {
    setPindahRow(r);
    setPindahKe(r.kelas_id ? String(r.kelas_id) : '');
  }, []);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<RiwayatRow>
        tableKey="riwayat_belajar"
        fields={ROSTER_FIELDS}
        rows={rows}
        getValues={riwayatValues}
        loading={loading}
        emptyText="Tidak ada riwayat pada filter ini."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={(r) => (
          canPindah ? (
          <>
            <ActionIcon id={`btn_pindah_kelas_${r.id}`} title="Pindah / set kelas" onClick={() => bukaPindah(r)}><MoveHorizontal size={16} /></ActionIcon>
            {r.kelas_id ? (
              <ActionIcon id={`btn_keluar_kelas_${r.id}`} title="Keluarkan dari kelas" onClick={async () => {
                try {
                  await keluarKelas(r.id);
                  toast.success('Santri dikeluarkan dari kelas.');
                  await load();
                } catch (e) { toast.error(errorMessage(e)); }
              }}><SquareMousePointer size={16} /></ActionIcon>
            ) : null}
          </>
          ) : null
        )}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { setTerapkanCari(search.trim()); pager.goFirst(); }}
        searchPlaceholder="Nama / NIK"
        searchIds={{ form: 'form_cari_riwayat_belajar', input: 'input_cari_riwayat_belajar', button: 'btn_cari_riwayat_belajar' }}
        filter={(
          <>
            <FilterSemester id="select_semester_riwayat_belajar" value={semester} onChange={(v) => { setSemester(v); pager.goFirst(); }} />
            {canTambah && (
            <Button id="btn_buka_input_riwayat" size="sm" onClick={() => { setKelasPilih(''); setInputOpen(true); }}>
              <Plus data-icon="inline-start" size={16} /> Riwayat
            </Button>
            )}
            {canTambah && (
            <Button id="btn_buka_import_riwayat" size="sm" variant="outline" onClick={() => { setImportFile(null); setPeriksaHasil(null); setImportOpen(true); }}>
              <FileUp data-icon="inline-start" size={16} /> Import
            </Button>
            )}
            <Button id="btn_toggle_tanpa_kelas" size="sm" variant={tanpaKelas ? 'default' : 'outline'} onClick={() => { setTanpaKelas((v) => !v); pager.goFirst(); }}>
              Tanpa kelas
            </Button>
            <Button id="btn_toggle_arsip_riwayat" size="sm" variant={arsip ? 'default' : 'outline'} onClick={() => { setArsip((v) => !v); pager.goFirst(); }}>
              Arsip
            </Button>
          </>
        )}
      />
      <Pager page={pager.page} lastPage={lastPage} total={total} perPage={pager.perPage} onPage={(p) => { pager.setPage(p); load(p); }} onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }} />

      <InputRiwayatDialog
        open={inputOpen}
        onOpenChange={setInputOpen}
        lembagaId={lembagaId}
        taId={taId}
        kelas={kelas}
        onSaved={() => load(1)}
      />

      {/* Pindah/set kelas */}
      <Dialog open={pindahRow !== null} onOpenChange={(o) => { if (!o) setPindahRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set / pindah kelas</DialogTitle>
            <DialogDescription>{pindahRow?.santri?.nama_lengkap}</DialogDescription>
          </DialogHeader>
          <Select value={kelasPilih || '_kosong'} onValueChange={(v) => setKelasPilih(v === '_kosong' ? '' : v)}>
            <SelectTrigger id="select_kelas_pindah"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_kosong">Pilih kelas</SelectItem>
                {kelas.map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPindahRow(null)}>Batal</Button>
            <Button id="btn_simpan_pindah_kelas" disabled={!kelasPilih || busy} onClick={async () => {
              if (!pindahRow || !kelasPilih) return;
              setBusy(true);
              try {
                if (pindahRow.kelas_id) await pindahKelas(pindahRow.id, Number(kelasPilih));
                else await setKelas(pindahRow.id, Number(kelasPilih));
                toast.success('Kelas disimpan.');
                setPindahRow(null);
                setKelasPilih('');
                await load();
              } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
            }}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import riwayat */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import riwayat belajar</DialogTitle>
            <DialogDescription>Kolom mengikuti tabel riwayat; kunci: NIK → fallback NIS lokal + lembaga.</DialogDescription>
          </DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
            e.preventDefault();
            if (!importFile || !periksaHasil?.siap_import) return;
            setBusy(true);
            try {
              const res = await importRiwayatBelajar({ file: importFile });
              if (res.errors?.length) toast.error(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
              else {
                toast.success(res.pesan ?? 'Import selesai.');
                setImportOpen(false);
                await load(1);
              }
            } catch (e2) { toast.error(errorMessage(e2)); } finally { setBusy(false); }
          }}>
            <Button id="btn_unduh_template_riwayat" type="button" variant="link" className="col-span-2 h-auto justify-start px-0"
              onClick={() => void unduhTemplateRiwayatBelajar().catch((e) => toast.error(errorMessage(e)))}>
              <Download data-icon="inline-start" size={16} /> Unduh template Excel riwayat
            </Button>
            <Input id="input_file_import_riwayat" className="col-span-2" type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setPeriksaHasil(null); }} required />
            {periksaHasil ? (
              <div className="col-span-2 rounded-md border p-3 text-sm" id="hasil_periksa_import_riwayat">
                <p className="font-medium">
                  {periksaHasil.ringkasan.baris_diproses} baris diperiksa · {periksaHasil.ringkasan.baris_valid} valid · {periksaHasil.ringkasan.baris_gagal} bermasalah
                </p>
                {periksaHasil.errors.length > 0 ? (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                    {periksaHasil.errors.slice(0, 50).map((x, i) => <li key={`${x.row}-${x.attribute}-${i}`}>Baris {x.row} ({x.attribute}): {x.errors.join(', ')}</li>)}
                  </ul>
                ) : <p className="mt-1 text-xs text-emerald-600">Tidak ada masalah — siap diimport.</p>}
              </div>
            ) : null}
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
              <Button id="btn_periksa_import_riwayat" type="button" variant="outline" disabled={!importFile || busy}
                onClick={async () => {
                  if (!importFile) return;
                  setBusy(true);
                  try {
                    const res = await periksaImportRiwayatBelajar({ file: importFile });
                    setPeriksaHasil(res);
                    if (res.siap_import) toast.success(res.pesan); else toast.error(res.pesan);
                  } catch (e2) { setPeriksaHasil(null); toast.error(errorMessage(e2)); } finally { setBusy(false); }
                }}>Periksa</Button>
              <Button id="btn_import_riwayat" type="submit" disabled={busy || !periksaHasil?.siap_import}>Import</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Dialog input riwayat: pilih santri (cari) + lembaga/TA + kelas/status + NIS lokal. */
function InputRiwayatDialog({
  open, onOpenChange, lembagaId, taId, kelas, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lembagaId: string;
  taId: string;
  kelas: Kelas[];
  onSaved: () => void;
}) {
  const [cari, setCari] = useState('');
  const [hasilSantri, setHasilSantri] = useState<Santri[]>([]);
  const [santriPilih, setSantriPilih] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [kelasId, setKelasId] = useState('');
  const [tingkat, setTingkat] = useState('');
  const [noAbsen, setNoAbsen] = useState('');
  const [statusAwal, setStatusAwal] = useState('santri_baru');
  const [tglMasuk, setTglMasuk] = useState('');
  const [nisLokal, setNisLokal] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCari(''); setHasilSantri([]); setSantriPilih('');
    setTahunAjaran(taId); setKelasId(''); setTingkat(''); setNoAbsen('');
    setStatusAwal('santri_baru'); setTglMasuk(''); setNisLokal('');
  }, [open, taId]);

  const cariSantri = useCallback(async () => {
    if (!cari.trim()) return;
    try {
      const res = await listSantri({ q: cari.trim(), per_page: 20 });
      setHasilSantri(res.data);
    } catch (e) { toast.error(errorMessage(e)); }
  }, [cari]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah riwayat belajar</DialogTitle>
          <DialogDescription>Penerimaan santri ke lembaga + jejak kelas/semester.</DialogDescription>
        </DialogHeader>
        <form className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (!santriPilih || !lembagaId || !tahunAjaran) return;
          setBusy(true);
          try {
            await createRiwayatBelajar({
              santri_id: Number(santriPilih),
              lembaga_id: Number(lembagaId),
              tahun_ajaran_id: Number(tahunAjaran),
              kelas_id: kelasId ? Number(kelasId) : null,
              tingkat: tingkat.trim() || null,
              no_absen: noAbsen.trim() ? Number(noAbsen) : null,
              status_awal: statusAwal,
              tgl_masuk: tglMasuk || null,
              nis_lokal: nisLokal.trim() || null,
            });
            toast.success('Riwayat ditambahkan.');
            onOpenChange(false);
            onSaved();
          } catch (e2) { toast.error(errorMessage(e2)); } finally { setBusy(false); }
        }}>
          <FieldLabel htmlFor="input_cari_santri_riwayat">Cari santri</FieldLabel>
          <div className="flex gap-2">
            <Input id="input_cari_santri_riwayat" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Nama / NIK / NISN" />
            <Button id="btn_cari_santri_riwayat" type="button" variant="outline" onClick={() => void cariSantri()}>Cari</Button>
          </div>
          <FieldLabel htmlFor="select_santri_riwayat">Santri</FieldLabel>
          <Select value={santriPilih || '_kosong'} onValueChange={(v) => setSantriPilih(v === '_kosong' ? '' : v)}>
            <SelectTrigger id="select_santri_riwayat"><SelectValue placeholder="Pilih santri" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_kosong">Pilih santri</SelectItem>
                {hasilSantri.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nama_lengkap}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="input_ta_riwayat">Tahun ajaran</FieldLabel>
          <TahunAjaranSelect id="select_ta_input_riwayat" lembagaId={lembagaId} value={tahunAjaran} onChange={setTahunAjaran} />
          <FieldLabel htmlFor="select_kelas_riwayat">Kelas</FieldLabel>
          <Select value={kelasId || '_kosong'} onValueChange={(v) => setKelasId(v === '_kosong' ? '' : v)}>
            <SelectTrigger id="select_kelas_riwayat"><SelectValue placeholder="Belum ditempatkan" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_kosong">Belum ditempatkan</SelectItem>
                {kelas.map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="input_tingkat_riwayat">Tingkat</FieldLabel>
          <Input id="input_tingkat_riwayat" value={tingkat} onChange={(e) => setTingkat(e.target.value)} maxLength={20} />
          <FieldLabel htmlFor="input_absen_riwayat">No. absen</FieldLabel>
          <Input id="input_absen_riwayat" value={noAbsen} onChange={(e) => setNoAbsen(e.target.value)} />
          <FieldLabel htmlFor="select_status_awal_riwayat">Status awal</FieldLabel>
          <Select value={statusAwal} onValueChange={setStatusAwal}>
            <SelectTrigger id="select_status_awal_riwayat"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="santri_baru">Santri baru</SelectItem>
                <SelectItem value="pindahan">Pindahan</SelectItem>
                <SelectItem value="mengulang">Mengulang</SelectItem>
                <SelectItem value="kenaikan">Kenaikan</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor="input_masuk_riwayat">Tgl masuk</FieldLabel>
          <Input id="input_masuk_riwayat" type="date" value={tglMasuk} onChange={(e) => setTglMasuk(e.target.value)} />
          <FieldLabel htmlFor="input_nis_lokal_riwayat">NIS lokal</FieldLabel>
          <Input id="input_nis_lokal_riwayat" value={nisLokal} onChange={(e) => setNisLokal(e.target.value)} maxLength={20} placeholder="Opsional" />
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button id="btn_simpan_input_riwayat" type="submit" disabled={busy || !santriPilih || !lembagaId || !tahunAjaran}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TahunAjaranSelect({ id, lembagaId, value, onChange }: { id: string; lembagaId: string; value: string; onChange: (v: string) => void }) {
  const [tas, setTas] = useState<{ id: number; nama: string; is_aktif?: boolean }[]>([]);
  useEffect(() => {
    if (!lembagaId) { setTas([]); return; }
    listTahunAjaran({ lembaga_id: Number(lembagaId), per_page: 100 }).then((p) => setTas(p.data)).catch(() => setTas([]));
  }, [lembagaId]);
  return (
    <Select value={value || '_kosong'} onValueChange={(v) => onChange(v === '_kosong' ? '' : v)}>
      <SelectTrigger id={id}><SelectValue placeholder="Pilih tahun ajaran" /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="_kosong">Pilih tahun ajaran</SelectItem>
          {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
