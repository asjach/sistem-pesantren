import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

/** Format tanggal sel grid: YYYY-MM-DD (kosong = boleh, berarti NULL). */
const tglValidator = (v: string | null) =>
  (!v || v.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : 'Format tanggal: YYYY-MM-DD.');

/** Nilai teks dari grid → nilai API: kosong = NULL (bukan string kosong). */
function teksAtauNull(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();

  return s === '' ? null : s;
}

/** Tanggal hari ini (YYYY-MM-DD) — dipakai saat keanggotaan dinonaktifkan. */
function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Keanggotaan: tabel terpusat lintas santri (pengganti pengelolaan tersebar). */
export default function KeanggotaanPage() {
  const { user } = useAuth();
  /** Lembaga selalu mengikuti topbar (satu-satunya sumber); null = Semua. */
  const { jenjang: lembagaTop } = useLembagaAktif();
  const canUbah = bisa(user, 'santri.ubah');
  const canTambah = bisa(user, 'santri.tambah');
  const pager = usePager('keanggotaan');

  const [status, setStatus] = useState('');
  const [cari, setCari] = useState('');
  const lembagaEfektif = lembagaTop != null ? String(lembagaTop) : '';
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
  const [fKemenag, setFKemenag] = useState('');
  const [fAktif, setFAktif] = useState('1');
  const [fMulai, setFMulai] = useState('');
  const [fSelesai, setFSelesai] = useState('');

  const [tambahOpen, setTambahOpen] = useState(false);
  const [tCari, setTCari] = useState('');
  const [tHasil, setTHasil] = useState<Santri[]>([]);
  const [tPilih, setTPilih] = useState<Santri | null>(null);
  const [tLembaga, setTLembaga] = useState('');
  const [tNis, setTNis] = useState('');
  const [tKemenag, setTKemenag] = useState('');
  const [tAktif, setTAktif] = useState('1');
  const [tMulai, setTMulai] = useState('');
  const [tSelesai, setTSelesai] = useState('');

  const load = useCallback(async (
    p = pager.page, pp = pager.perPage,
    f?: { jenjang?: string; status?: string; cari?: string; urut?: string[]; arah?: 'naik' | 'turun' },
  ) => {
    setErr('');
    try {
      const fl = f ?? { jenjang: lembagaEfektif, status, cari, urut, arah: arahUrut };
      const res = await listKeanggotaan({
        jenjang: fl.jenjang || null,
        is_active_lembaga: fl.status === '' ? null : fl.status === '1',
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
  }, [pager, lembagaEfektif, status, cari, urut, arahUrut]);

  /** Klik header: simpan urut baru lalu muat ulang dari halaman 1. */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun') {
    setUrut(nilai);
    setArahUrut(arah);
    pager.goFirst();
    void load(1, pager.perPage, { jenjang: lembagaEfektif, status, cari, urut: nilai, arah });
  }

  useEffect(() => { void listLembaga({ per_page: 100 }).then((r) => setLembagaOpsi(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (pager.ready) void load(pager.page); }, [pager.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Filter Status langsung terapkan saat berubah. */
  function gantiFilter(patch: { status?: string }) {
    const next = { jenjang: lembagaEfektif, status, ...patch };
    if (patch.status !== undefined) setStatus(patch.status);
    pager.goFirst();
    void load(1, pager.perPage, { ...next, cari });
  }

  /** Lembaga aktif topbar berubah → muat ulang dari halaman 1. */
  const topLalu = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!pager.ready) return;
    if (topLalu.current === undefined) {
      topLalu.current = lembagaTop;
      return;
    }
    if (topLalu.current === lembagaTop) return;
    topLalu.current = lembagaTop;
    pager.goFirst();
    void load(1, pager.perPage, { jenjang: lembagaEfektif, status, cari });
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
      void load(1, pager.perPage, { jenjang: lembagaEfektif, status, cari: cari.trim() });
    }, cari.trim() === '' ? 0 : 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari, pager.ready]);

  /** Mode Edit sel: simpan kolom yang berubah (NIS, konteks masuk, sekolah asal, tanggal). */
  async function commitBaris(id: number, f: Record<string, string | null>) {
    const body: {
      nis_lokal?: string | null; nis_kemenag?: string | null;
      tahaj_masuk?: string | null; tingkat_masuk?: string | null; no_urut?: number | null;
      nama_sekolah_asal?: string | null; npsn_sekolah_asal?: string | null;
      nss_sekolah_asal?: string | null; alamat_sekolah_asal?: string | null;
      is_active_lembaga?: 'Ya' | 'Tidak';
      tgl_masuk?: string | null; tgl_selesai?: string | null;
    } = {};
    if (f.nis_lokal !== undefined) body.nis_lokal = teksAtauNull(f.nis_lokal);
    if (f.nis_kemenag !== undefined) body.nis_kemenag = teksAtauNull(f.nis_kemenag);
    if (f.tahaj_masuk !== undefined) body.tahaj_masuk = teksAtauNull(f.tahaj_masuk);
    if (f.tingkat_masuk !== undefined) body.tingkat_masuk = teksAtauNull(f.tingkat_masuk);
    if (f.no_urut !== undefined) body.no_urut = teksAtauNull(f.no_urut) === null ? null : Number(f.no_urut);
    if (f.nama_sekolah_asal !== undefined) body.nama_sekolah_asal = teksAtauNull(f.nama_sekolah_asal);
    if (f.npsn_sekolah_asal !== undefined) body.npsn_sekolah_asal = teksAtauNull(f.npsn_sekolah_asal);
    if (f.nss_sekolah_asal !== undefined) body.nss_sekolah_asal = teksAtauNull(f.nss_sekolah_asal);
    if (f.alamat_sekolah_asal !== undefined) body.alamat_sekolah_asal = teksAtauNull(f.alamat_sekolah_asal);
    if (f.masuk !== undefined) body.tgl_masuk = teksAtauNull(f.masuk);
    if (f.selesai !== undefined) body.tgl_selesai = teksAtauNull(f.selesai);
    if (Object.keys(body).length === 0) return;
    await updateLembagaSantri(id, body);
  }

  async function simpanUbah() {
    if (!ubah) return;
    setBusyId(ubah.id);
    try {
      await updateLembagaSantri(ubah.id, {
        nis_lokal: teksAtauNull(fNis),
        nis_kemenag: teksAtauNull(fKemenag),
        is_active_lembaga: fAktif === '1' ? 'Ya' : 'Tidak',
        tgl_masuk: teksAtauNull(fMulai),
        tgl_selesai: teksAtauNull(fSelesai),
      });
      toast.success('Keanggotaan diubah.');
      setUbah(null);
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  }

  async function togolAktif(r: LembagaSantri) {
    setBusyId(r.id);
    try {
      const aktif = r.is_active_lembaga !== 'Ya';
      await updateLembagaSantri(r.id, {
        is_active_lembaga: aktif ? 'Ya' : 'Tidak',
        tgl_selesai: aktif ? null : hariIni(),
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
        ...(lembagaEfektif === '' ? {} : { jenjang: lembagaEfektif }),
        ...(status === '' ? {} : { is_active_lembaga: status === '1' }),
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
        jenjang: tLembaga,
        nis_lokal: teksAtauNull(tNis),
        nis_kemenag: teksAtauNull(tKemenag),
        is_active_lembaga: tAktif === '1' ? 'Ya' : 'Tidak',
        tgl_masuk: teksAtauNull(tMulai),
        tgl_selesai: teksAtauNull(tSelesai),
      });
      toast.success('Keanggotaan ditambahkan.');
      setTambahOpen(false);
      setTPilih(null); setTCari(''); setTHasil([]); setTLembaga('');
      setTNis(''); setTKemenag(''); setTAktif('1'); setTMulai(''); setTSelesai('');
      await load(1);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  }

  /** Kolom grid: NIS, konteks masuk, sekolah asal, dan tanggal bisa diedit;
   *  santri & lembaga tampil saja (tambah lewat dialog Tambah). */
  const fields = useMemo<ExcelField[]>(() => [
    {
      key: 'santri', label: 'santri.nama_lengkap', kind: 'static',
      sumber: { tabel: 'santri', kolom: 'nama_lengkap' },
    },
    { key: 'jk', label: 'santri.jk', kind: 'static', width: 60, sumber: { tabel: 'santri', kolom: 'jk' } },
    {
      key: 'lembaga', label: 'lembaga.jenjang', kind: 'static',
      sumber: { tabel: 'lembaga', kolom: 'jenjang' },
    },
    { key: 'nis_lokal', label: 'nis_lokal', kind: 'text', maxLength: 20, sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } },
    { key: 'nis_kemenag', label: 'nis_kemenag', kind: 'text', maxLength: 20, sumber: { tabel: 'lembaga_santri', kolom: 'nis_kemenag' } },
    { key: 'tahaj_masuk', label: 'tahaj_masuk', kind: 'text', maxLength: 50, width: 120, sumber: { tabel: 'lembaga_santri', kolom: 'tahaj_masuk' } },
    { key: 'tingkat_masuk', label: 'tingkat_masuk', kind: 'text', maxLength: 20, width: 110, sumber: { tabel: 'lembaga_santri', kolom: 'tingkat_masuk' } },
    { key: 'no_urut', label: 'no_urut', kind: 'text', maxLength: 6, width: 90, sumber: { tabel: 'lembaga_santri', kolom: 'no_urut' } },
    { key: 'nama_sekolah_asal', label: 'nama_sekolah_asal', kind: 'text', maxLength: 255, width: 180, sumber: { tabel: 'lembaga_santri', kolom: 'nama_sekolah_asal' } },
    { key: 'npsn_sekolah_asal', label: 'npsn_sekolah_asal', kind: 'text', maxLength: 20, width: 130, sumber: { tabel: 'lembaga_santri', kolom: 'npsn_sekolah_asal' } },
    { key: 'nss_sekolah_asal', label: 'nss_sekolah_asal', kind: 'text', maxLength: 30, width: 130, sumber: { tabel: 'lembaga_santri', kolom: 'nss_sekolah_asal' } },
    { key: 'alamat_sekolah_asal', label: 'alamat_sekolah_asal', kind: 'text', maxLength: 500, width: 200, sumber: { tabel: 'lembaga_santri', kolom: 'alamat_sekolah_asal' } },
    { key: 'aktif', label: 'is_active_lembaga', kind: 'static', width: 90, sumber: { tabel: 'lembaga_santri', kolom: 'is_active_lembaga' } },
    { key: 'masuk', label: 'tgl_masuk', kind: 'text', maxLength: 10, width: 110, validate: tglValidator, sumber: { tabel: 'lembaga_santri', kolom: 'tgl_masuk' } },
    { key: 'selesai', label: 'tgl_selesai', kind: 'text', maxLength: 10, width: 110, validate: tglValidator, sumber: { tabel: 'lembaga_santri', kolom: 'tgl_selesai' } },
  ], []);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>

      <ExcelTable
        tableKey="keanggotaan"
        filter={(
          <>
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
        fields={fields}
        rows={rows}
        getValues={(r) => ({
          santri: r.santri?.nama_lengkap ?? null,
          jk: r.santri?.jk ?? null,
          lembaga: r.lembaga ? r.lembaga.jenjang : null,
          nis_lokal: r.nis_lokal,
          nis_kemenag: r.nis_kemenag,
          tahaj_masuk: r.tahaj_masuk,
          tingkat_masuk: r.tingkat_masuk,
          no_urut: r.no_urut !== null && r.no_urut !== undefined ? String(r.no_urut) : null,
          nama_sekolah_asal: r.nama_sekolah_asal,
          npsn_sekolah_asal: r.npsn_sekolah_asal,
          nss_sekolah_asal: r.nss_sekolah_asal,
          alamat_sekolah_asal: r.alamat_sekolah_asal,
          aktif: r.is_active_lembaga,
          masuk: r.tgl_masuk?.slice(0, 10) ?? null,
          selesai: r.tgl_selesai?.slice(0, 10) ?? null,
        })}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        canEdit={canUbah}
        onCommit={commitBaris}
        onSaved={() => void load()}
        renderActions={(r) => (
          <>
            {canUbah && (
              <Button id={`btn_ubah_anggota_${r.id}`} size="sm" variant="outline" disabled={busyId === r.id}
                onClick={() => {
                  setUbah(r);
                  setFNis(r.nis_lokal ?? '');
                  setFKemenag(r.nis_kemenag ?? '');
                  setFAktif(r.is_active_lembaga === 'Ya' ? '1' : '0');
                  setFMulai((r.tgl_masuk ?? '').slice(0, 10));
                  setFSelesai((r.tgl_selesai ?? '').slice(0, 10));
                }}>
                Ubah
              </Button>
            )}
            {canUbah && (
              <Button id={`btn_aktif_anggota_${r.id}`} size="sm" variant="outline" disabled={busyId === r.id}
                onClick={() => void togolAktif(r)}>
                {r.is_active_lembaga === 'Ya' ? 'Nonaktifkan' : 'Aktifkan'}
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
            <DialogDescription>{ubah?.santri?.nama_lengkap} — {ubah?.lembaga?.jenjang ?? ubah?.lembaga?.nama}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
            <FieldLabel htmlFor="input_ubah_nis_anggota">NIS lokal</FieldLabel>
            <Input id="input_ubah_nis_anggota" value={fNis} onChange={(e) => setFNis(e.target.value)} maxLength={20} />
            <FieldLabel htmlFor="input_ubah_kemenag_anggota">NIS Kemenag</FieldLabel>
            <Input id="input_ubah_kemenag_anggota" value={fKemenag} onChange={(e) => setFKemenag(e.target.value)}
              maxLength={20} placeholder="Kosong = belum ada" />
            <FieldLabel htmlFor="select_ubah_aktif_anggota">Status</FieldLabel>
            <Select value={fAktif || '1'} onValueChange={setFAktif}>
              <SelectTrigger id="select_ubah_aktif_anggota"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">Aktif</SelectItem>
                  <SelectItem value="0">Nonaktif</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
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
                  {lembagaOpsi.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_nis_anggota">NIS lokal</FieldLabel>
            <Input id="input_nis_anggota" value={tNis} onChange={(e) => setTNis(e.target.value)} maxLength={20} />
            <FieldLabel htmlFor="input_kemenag_anggota">NIS Kemenag</FieldLabel>
            <Input id="input_kemenag_anggota" value={tKemenag} onChange={(e) => setTKemenag(e.target.value)}
              maxLength={20} placeholder="Boleh dikosongkan" />
            <FieldLabel htmlFor="select_aktif_anggota">Status</FieldLabel>
            <Select value={tAktif || '1'} onValueChange={setTAktif}>
              <SelectTrigger id="select_aktif_anggota"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">Aktif</SelectItem>
                  <SelectItem value="0">Nonaktif</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_mulai_anggota">Tgl. mulai</FieldLabel>
            <Input id="input_mulai_anggota" type="date" value={tMulai} onChange={(e) => setTMulai(e.target.value)} />
            <FieldLabel htmlFor="input_selesai_anggota">Tgl. selesai</FieldLabel>
            <Input id="input_selesai_anggota" type="date" value={tSelesai} onChange={(e) => setTSelesai(e.target.value)} />
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
