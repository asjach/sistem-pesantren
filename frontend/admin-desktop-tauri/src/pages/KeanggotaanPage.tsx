import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  createLembagaSantri,
  generateNiskBulk,
  listKeanggotaan,
  listSantri,
  updateLembagaSantri,
  type LembagaSantri,
  type Santri,
} from '../api/santri';
import { listLembaga, type Lembaga } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FilterField from '@/components/FilterField';
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
  /** Gerbang super = EFEKTIF (mati saat bertindak; dropdown dikunci ke peran). */
  const { efektifSuper: superAdmin } = useLembagaAktif();
  const { lembagaId: lembagaTop } = useLembagaAktif();
  const canUbah = bisa(user, 'santri.ubah');
  const canTambah = bisa(user, 'santri.tambah');
  const pager = usePager('keanggotaan');

  const [lembagaId, setLembagaId] = useState('');
  const [status, setStatus] = useState('');
  const [cari, setCari] = useState('');
  /** Admin lembaga mengikuti lembaga aktif topbar; dropdown hanya super_admin. */
  const lembagaEfektif = superAdmin ? lembagaId : (lembagaTop != null ? String(lembagaTop) : '');
  /** Urut header: daftar nilai allowlist + arah global (maks 3 kunci). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
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
    f?: { lembagaId?: string; status?: string; cari?: string; urut?: string[]; arah?: 'naik' | 'turun' },
  ) => {
    setErr('');
    try {
      const fl = f ?? { lembagaId: lembagaEfektif, status, cari, urut, arah: arahUrut };
      const res = await listKeanggotaan({
        lembaga_id: fl.lembagaId ? Number(fl.lembagaId) : null,
        is_active: fl.status === '' ? null : fl.status === '1',
        search: fl.cari || undefined,
        sort: fl.urut?.length ? fl.urut : undefined,
        arah: fl.urut?.length ? (fl.arah ?? 'naik') : undefined,
        page: p,
        per_page: pp,
      });
      pager.sync(res.current_page, res.last_page);
      setRows(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) { setErr(errorMessage(e)); }
  }, [pager, lembagaEfektif, lembagaId, status, cari, urut, arahUrut]);

  /** Klik header: simpan urut baru lalu muat ulang dari halaman 1. */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun') {
    setUrut(nilai);
    setArahUrut(arah);
    pager.goFirst();
    void load(1, pager.perPage, { lembagaId: lembagaEfektif, status, cari, urut: nilai, arah });
  }

  useEffect(() => { void listLembaga({ per_page: 100 }).then((r) => setLembagaOpsi(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (pager.ready) void load(pager.page); }, [pager.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Filter Lembaga/Status langsung terapkan saat berubah. */
  function gantiFilter(patch: { lembagaId?: string; status?: string }) {
    const next = { lembagaId: lembagaEfektif, status, ...patch };
    if (patch.lembagaId !== undefined) setLembagaId(patch.lembagaId);
    if (patch.status !== undefined) setStatus(patch.status);
    pager.goFirst();
    void load(1, pager.perPage, { ...next, cari });
  }

  /** Lembaga aktif topbar berubah → muat ulang (admin lembaga, tanpa dropdown). */
  const topLalu = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (!pager.ready) return;
    if (topLalu.current === undefined) {
      topLalu.current = lembagaTop;
      return;
    }
    if (topLalu.current === lembagaTop || superAdmin) return;
    topLalu.current = lembagaTop;
    pager.goFirst();
    void load(1, pager.perPage, { lembagaId: lembagaEfektif, status, cari });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lembagaTop, pager.ready]);
  const cariAwal = useRef(true);
  useEffect(() => {
    if (!pager.ready) return;
    if (cariAwal.current) {
      cariAwal.current = false;
      return;
    }
    const t = setTimeout(() => {
      pager.goFirst();
      void load(1, pager.perPage, { lembagaId: lembagaEfektif, status, cari: cari.trim() });
    }, cari.trim() === '' ? 0 : 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari, pager.ready]);

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

  /** Generate NISK massal untuk filter saat ini (lewati: sudah ada, NIS
   *  lokal kosong, lembaga MD). */
  async function generateSemua() {
    setBusyId(-1);
    try {
      const res = await generateNiskBulk({
        ...(lembagaEfektif === '' ? {} : { lembaga_id: Number(lembagaEfektif) }),
        ...(status === '' ? {} : { is_active: status === '1' }),
        ...(cari.trim() === '' ? {} : { search: cari.trim() }),
      });
      toast.success(res.pesan);
      await load(1);
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

      <ExcelTable
        tableKey="keanggotaan"
        filter={(
          <>
            {superAdmin && (
            <FilterField label="Lembaga" htmlFor="filter_lembaga_keanggotaan">
              <Select value={lembagaEfektif || '_semua'} onValueChange={(v) => gantiFilter({ lembagaId: v === '_semua' ? '' : v })}>
                <SelectTrigger id="filter_lembaga_keanggotaan" className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_semua">Semua</SelectItem>
                    {lembagaOpsi.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FilterField>
            )}
            <FilterField label="Status" htmlFor="filter_status_keanggotaan">
              <Select value={status || '_semua'} onValueChange={(v) => gantiFilter({ status: v === '_semua' ? '' : v })}>
                <SelectTrigger id="filter_status_keanggotaan" className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_semua">Semua</SelectItem>
                    <SelectItem value="1">Aktif</SelectItem>
                    <SelectItem value="0">Nonaktif</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FilterField>
          </>
        )}
        searchValue={cari}
        onSearchChange={setCari}
        searchIds={{ form: 'form_cari_keanggotaan', input: 'input_cari_keanggotaan', button: 'btn_cari_keanggotaan' }}
        addButton={canTambah || canUbah ? (
          <>
            {canUbah && (
              <Button id="btn_generate_nisk" size="sm" variant="outline" disabled={busyId !== null}
                onClick={() => void generateSemua()}>
                {busyId !== null ? 'Memproses…' : 'Generate NISK'}
              </Button>
            )}
            {canTambah && (
              <Button id="btn_tambah_keanggotaan" size="sm" onClick={() => setTambahOpen(true)}>Tambah</Button>
            )}
          </>
        ) : null}
        fields={[
          { key: 'santri', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
          { key: 'jk', label: 'santri.jk', kind: 'static', width: 60, sumber: { tabel: 'santri', kolom: 'jk' } },
          { key: 'lembaga', label: 'lembaga.kode', kind: 'static', sumber: { tabel: 'lembaga', kolom: 'kode' } },
          { key: 'nis_lokal', label: 'nis_lokal', kind: 'text', maxLength: 20, sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } },
          { key: 'nis_kemenag', label: 'nis_kemenag', kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'nis_kemenag' } },
          { key: 'aktif', label: 'is_active', kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'is_active' } },
          { key: 'mulai', label: 'tgl_mulai', kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'tgl_mulai' } },
          { key: 'selesai', label: 'tgl_selesai', kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'tgl_selesai' } },
        ]}
        rows={rows}
        getValues={(r) => ({
          santri: r.santri?.nama_lengkap ?? null,
          jk: r.santri?.jk ?? null,
          lembaga: r.lembaga ? `${r.lembaga.kode ?? r.lembaga.nama}` : null,
          nis_lokal: r.nis_lokal,
          nis_kemenag: r.nis_kemenag,
          aktif: r.is_active ? 'Ya' : 'Tidak',
          mulai: r.tgl_mulai?.slice(0, 10) ?? null,
          selesai: r.tgl_selesai?.slice(0, 10) ?? null,
        })}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
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
