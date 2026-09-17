import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  createLembagaSantri,
  generateNisk,
  listKeanggotaan,
  listSantri,
  updateLembagaSantri,
  type LembagaSantri,
  type Santri,
} from '../api/santri';
import { listLembaga, type Lembaga } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

/** Keanggotaan: tabel terpusat lintas santri (pengganti pengelolaan tersebar). */
export default function KeanggotaanPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'santri.ubah');
  const canTambah = bisa(user, 'santri.tambah');
  const pager = usePager('keanggotaan');

  const [lembagaId, setLembagaId] = useState('');
  const [status, setStatus] = useState('');
  const [cari, setCari] = useState('');
  const [tanpaNis, setTanpaNis] = useState(false);
  const [lembagaOpsi, setLembagaOpsi] = useState<Lembaga[]>([]);
  const [rows, setRows] = useState<LembagaSantri[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [ubah, setUbah] = useState<LembagaSantri | null>(null);
  const [fNis, setFNis] = useState('');
  const [fMulai, setFMulai] = useState('');
  const [fSelesai, setFSelesai] = useState('');

  const [tambahOpen, setTambahOpen] = useState(false);
  const [tCari, setTCari] = useState('');
  const [tHasil, setTHasil] = useState<Santri[]>([]);
  const [tPilih, setTPilih] = useState<Santri | null>(null);
  const [tLembaga, setTLembaga] = useState('');
  const [tNis, setTNis] = useState('');
  const [tMulai, setTMulai] = useState('');

  const load = useCallback(async (
    p = pager.page, pp = pager.perPage,
    f?: { lembagaId?: string; status?: string; cari?: string; tanpaNis?: boolean },
  ) => {
    setErr('');
    try {
      const fl = f ?? { lembagaId, status, cari, tanpaNis };
      const res = await listKeanggotaan({
        lembaga_id: fl.lembagaId ? Number(fl.lembagaId) : null,
        is_active: fl.status === '' ? null : fl.status === '1',
        tanpa_nis: fl.tanpaNis,
        search: fl.cari || undefined,
        page: p,
        per_page: pp,
      });
      pager.sync(res.current_page, res.last_page);
      setRows(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) { setErr(errorMessage(e)); }
  }, [pager, lembagaId, status, cari, tanpaNis]);

  useEffect(() => { void listLembaga({ per_page: 100 }).then((r) => setLembagaOpsi(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (pager.ready) void load(pager.page); }, [pager.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function terapkanFilter() {
    pager.goFirst();
    void load(1, pager.perPage, { lembagaId, status, cari, tanpaNis });
  }

  async function commitNis(id: number, f: Record<string, string | null>) {
    if (f.nis_lokal === undefined) return;
    await updateLembagaSantri(id, { nis_lokal: f.nis_lokal });
  }

  async function simpanUbah() {
    if (!ubah) return;
    setBusyId(ubah.id);
    try {
      await updateLembagaSantri(ubah.id, {
        nis_lokal: fNis.trim() === '' ? null : fNis.trim(),
        tgl_mulai: fMulai === '' ? null : fMulai,
        tgl_selesai: fSelesai === '' ? null : fSelesai,
      });
      toast.success('Keanggotaan diubah.');
      setUbah(null);
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  }

  async function togolAktif(r: LembagaSantri) {
    setBusyId(r.id);
    try {
      const aktif = !r.is_active;
      await updateLembagaSantri(r.id, {
        is_active: aktif,
        tgl_selesai: aktif ? null : new Date().toISOString().slice(0, 10),
      });
      toast.success(aktif ? 'Keanggotaan diaktifkan.' : 'Keanggotaan dinonaktifkan.');
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  }

  async function generate(r: LembagaSantri) {
    setBusyId(r.id);
    try {
      const res = await generateNisk(r.id);
      toast.success(res.pesan ?? 'NIS Kemenag digenerate.');
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  }

  async function cariSantri() {
    if (!tCari.trim()) { setTHasil([]); return; }
    try {
      const res = await listSantri({ q: tCari.trim(), per_page: 10 });
      setTHasil(res.data);
    } catch (e) { toast.error(errorMessage(e)); }
  }

  async function simpanTambah() {
    if (!tPilih || !tLembaga) return;
    setBusyId(-1);
    try {
      await createLembagaSantri(tPilih.id, {
        lembaga_id: Number(tLembaga),
        nis_lokal: tNis.trim() === '' ? null : tNis.trim(),
        tgl_mulai: tMulai === '' ? null : tMulai,
      });
      toast.success('Keanggotaan ditambahkan.');
      setTambahOpen(false);
      setTPilih(null); setTCari(''); setTHasil([]); setTLembaga(''); setTNis(''); setTMulai('');
      await load(1);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <div>
          <FieldLabel htmlFor="filter_lembaga_keanggotaan">Lembaga</FieldLabel>
          <Select value={lembagaId || '_semua'} onValueChange={(v) => setLembagaId(v === '_semua' ? '' : v)}>
            <SelectTrigger id="filter_lembaga_keanggotaan" className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_semua">Semua</SelectItem>
                {lembagaOpsi.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="filter_status_keanggotaan">Status</FieldLabel>
          <Select value={status || '_semua'} onValueChange={(v) => setStatus(v === '_semua' ? '' : v)}>
            <SelectTrigger id="filter_status_keanggotaan" className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_semua">Semua</SelectItem>
                <SelectItem value="1">Aktif</SelectItem>
                <SelectItem value="0">Nonaktif</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="input_cari_keanggotaan">Cari</FieldLabel>
          <Input id="input_cari_keanggotaan" value={cari} onChange={(e) => setCari(e.target.value)}
            placeholder="Nama / NIS" onKeyDown={(e) => { if (e.key === 'Enter') terapkanFilter(); }} />
        </div>
        <label htmlFor="chk_tanpa_nis_keanggotaan" className="flex items-center gap-2 pb-2 text-sm">
          <input id="chk_tanpa_nis_keanggotaan" type="checkbox" checked={tanpaNis}
            onChange={(e) => setTanpaNis(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Tanpa NIS
        </label>
        <Button id="btn_filter_keanggotaan" onClick={terapkanFilter}>Terapkan</Button>
        {canTambah && <Button id="btn_tambah_keanggotaan" variant="outline" onClick={() => setTambahOpen(true)}>Tambah</Button>}
      </div>

      <ExcelTable
        tableKey="keanggotaan"
        fields={[
          { key: 'santri', label: 'Santri', kind: 'static' },
          { key: 'lembaga', label: 'Lembaga', kind: 'static' },
          { key: 'nis_lokal', label: 'NIS Lokal', kind: 'text', maxLength: 20 },
          { key: 'nis_kemenag', label: 'NIS Kemenag', kind: 'static' },
          { key: 'aktif', label: 'Aktif', kind: 'static' },
          { key: 'mulai', label: 'Tgl. mulai', kind: 'static' },
          { key: 'selesai', label: 'Tgl. selesai', kind: 'static' },
        ]}
        rows={rows}
        getValues={(r) => ({
          santri: r.santri?.nama_lengkap ?? null,
          lembaga: r.lembaga ? `${r.lembaga.kode ?? r.lembaga.nama}` : null,
          nis_lokal: r.nis_lokal,
          nis_kemenag: r.nis_kemenag,
          aktif: r.is_active ? 'Ya' : 'Tidak',
          mulai: r.tgl_mulai?.slice(0, 10) ?? null,
          selesai: r.tgl_selesai?.slice(0, 10) ?? null,
        })}
        canEdit={canUbah}
        onCommit={commitNis}
        onSaved={() => void load()}
        renderActions={(r) => (
          <>
            {canUbah && (
              <Button id={`btn_ubah_anggota_${r.id}`} size="sm" variant="outline" disabled={busyId === r.id}
                onClick={() => {
                  setUbah(r);
                  setFNis(r.nis_lokal ?? '');
                  setFMulai((r.tgl_mulai ?? '').slice(0, 10));
                  setFSelesai((r.tgl_selesai ?? '').slice(0, 10));
                }}>
                Ubah
              </Button>
            )}
            {canUbah && !r.nis_kemenag && (
              <Button id={`btn_nisk_anggota_${r.id}`} size="sm" variant="outline" disabled={busyId === r.id}
                onClick={() => void generate(r)}>
                NISK
              </Button>
            )}
            {canUbah && (
              <Button id={`btn_aktif_anggota_${r.id}`} size="sm" variant="outline" disabled={busyId === r.id}
                onClick={() => void togolAktif(r)}>
                {r.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>
            )}
          </>
        )}
        emptyText="Belum ada keanggotaan."
      />
      <Pager page={pager.page} lastPage={lastPage} total={total} perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); void load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); void load(1, pp); }} />

      <Dialog open={ubah !== null} onOpenChange={(o) => { if (!o) setUbah(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ubah keanggotaan</DialogTitle>
            <DialogDescription>{ubah?.santri?.nama_lengkap} — {ubah?.lembaga?.kode ?? ubah?.lembaga?.nama}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
            <FieldLabel htmlFor="input_ubah_nis_anggota">NIS lokal</FieldLabel>
            <Input id="input_ubah_nis_anggota" value={fNis} onChange={(e) => setFNis(e.target.value)} maxLength={20} />
            <FieldLabel htmlFor="input_ubah_mulai_anggota">Tgl. mulai</FieldLabel>
            <Input id="input_ubah_mulai_anggota" type="date" value={fMulai} onChange={(e) => setFMulai(e.target.value)} />
            <FieldLabel htmlFor="input_ubah_selesai_anggota">Tgl. selesai</FieldLabel>
            <Input id="input_ubah_selesai_anggota" type="date" value={fSelesai} onChange={(e) => setFSelesai(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUbah(null)}>Batal</Button>
            <Button id="btn_simpan_anggota" disabled={busyId === ubah?.id} onClick={() => void simpanUbah()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tambahOpen} onOpenChange={(o) => { if (!o) setTambahOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah keanggotaan</DialogTitle>
            <DialogDescription>Pilih santri lalu lembaga tujuannya.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
            <FieldLabel htmlFor="input_cari_santri_anggota">Santri</FieldLabel>
            <div className="flex gap-2">
              <Input id="input_cari_santri_anggota" value={tCari} onChange={(e) => setTCari(e.target.value)}
                placeholder="Ketik nama…" onKeyDown={(e) => { if (e.key === 'Enter') void cariSantri(); }} />
              <Button type="button" variant="outline" onClick={() => void cariSantri()}>Cari</Button>
            </div>
            {tHasil.length > 0 && !tPilih && (
              <>
                <span />
                <div className="max-h-32 overflow-y-auto rounded border">
                  {tHasil.map((s) => (
                    <button key={s.id} type="button" className="block w-full px-2 py-1 text-left text-sm hover:bg-muted"
                      onClick={() => setTPilih(s)}>
                      {s.nama_lengkap}
                    </button>
                  ))}
                </div>
              </>
            )}
            {tPilih && (
              <>
                <span />
                <div className="text-sm">Terpilih: <b>{tPilih.nama_lengkap}</b> <Button type="button" variant="ghost" size="sm" onClick={() => setTPilih(null)}>Ganti</Button></div>
              </>
            )}
            <FieldLabel htmlFor="select_lembaga_anggota">Lembaga</FieldLabel>
            <Select value={tLembaga || '_pilih'} onValueChange={(v) => setTLembaga(v === '_pilih' ? '' : v)}>
              <SelectTrigger id="select_lembaga_anggota"><SelectValue placeholder="Pilih lembaga" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_pilih">Pilih lembaga</SelectItem>
                  {lembagaOpsi.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_nis_anggota">NIS lokal</FieldLabel>
            <Input id="input_nis_anggota" value={tNis} onChange={(e) => setTNis(e.target.value)} maxLength={20} />
            <FieldLabel htmlFor="input_mulai_anggota">Tgl. mulai</FieldLabel>
            <Input id="input_mulai_anggota" type="date" value={tMulai} onChange={(e) => setTMulai(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
            <Button id="btn_simpan_tambah_anggota" disabled={busyId === -1 || !tPilih || !tLembaga} onClick={() => void simpanTambah()}>Tambah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
