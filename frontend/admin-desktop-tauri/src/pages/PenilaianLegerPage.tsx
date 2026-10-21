import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Pager from '@/components/Pager';
import ExcelTable, { type ExcelField, type GridRow } from '@/components/ExcelTable';
import { freezeKey } from '@/components/excel/helpers';
import { usePager } from '@/hooks/usePager';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { listKelas, type Kelas } from '@/api/master';
import { errorMessage, prefGet, prefSet } from '@/api/client';
import { Download, RefreshCw } from '@/icons';
import {
  daftarKegiatanEvaluatif, hitungUlang, legerNilai, simpanNilaiManual, ubahKegiatanEvaluatif, unduhLeger,
  type BarisLeger, type LegerResp, type KegiatanEvaluatif, type RentangNilai,
} from '@/api/penilaian';
import { batasAtasRentang, nilaiDalamRentang } from '@/lib/nilaiRentang';

type BarisLegerGrid = BarisLeger & { id: number };

/** Nilai sel: kosong = null; koma diterima sebagai pemisah desimal. */
function angkaNilai(teks: string): number | null {
  const bersih = teks.trim().replace(',', '.');
  if (bersih === '') return null;
  const angka = Number(bersih);
  return Number.isFinite(angka) ? angka : Number.NaN;
}

/** Latar seluruh baris peringkat 1-3; opasitas dijaga agar teks tetap terbaca. */
function kelasPeringkat(row: GridRow): string | undefined {
  const peringkat = Number(row.peringkat);
  if (peringkat === 1) return 'simpes-baris-peringkat-1 !bg-emerald-500/20 dark:!bg-emerald-400/15';
  if (peringkat === 2) return 'simpes-baris-peringkat-2 !bg-amber-400/30 dark:!bg-amber-300/15';
  if (peringkat === 3) return 'simpes-baris-peringkat-3 !bg-sky-500/20 dark:!bg-sky-400/15';
  return undefined;
}

/** Halaman Leger Nilai: crosstab santri × mapel untuk SATU KEGIATAN EVALUATIF. */
export default function PenilaianLegerPage() {
  const { jenjangs, tahunAjaranNames, semesters, tingkat, kelas: kelasAktif, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canUbah = bisa(user, 'penilaian.ubah');
  const pager = usePager('penilaian_leger');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const semester = targetTunggal(semesters);
  const siap = jenjang !== null && ta !== null && semester !== null;

  const [kegiatanEvaluatif, setKegiatanEvaluatif] = useState<KegiatanEvaluatif[]>([]);
  const [kegiatanEvaluatifId, setKegiatanEvaluatifId] = useState<number | ''>('');
  const [data, setData] = useState<LegerResp | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [cari, setCari] = useState('');
  const [cariTertunda, setCariTertunda] = useState('');
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [bekuSiap, setBekuSiap] = useState(false);
  const [rentangAktif, setRentangAktif] = useState<RentangNilai>('0-100');
  const [menyimpanRentang, setMenyimpanRentang] = useState(false);

  useEffect(() => {
    let hidup = true;
    const kunci = freezeKey('penilaian_leger');
    prefGet(kunci)
      .then((nilai) => (nilai === null ? prefSet(kunci, '2') : null))
      .catch(() => {})
      .finally(() => { if (hidup) setBekuSiap(true); });
    return () => { hidup = false; };
  }, []);

  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang, tahun_ajaran: ta, per_page: 1000 })
      .then((p) => { if (hidup) setKelasOpsi(p.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta]);

  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKegiatanEvaluatif([]); setKegiatanEvaluatifId(''); return; }
    let hidup = true;
    daftarKegiatanEvaluatif({ jenjang, tahun_ajaran: ta })
      .then((r) => {
        if (!hidup) return;
        setKegiatanEvaluatif(r.kegiatan_evaluatif);
        setKegiatanEvaluatifId((v) => (r.kegiatan_evaluatif.some((p) => p.id === v) ? v : (r.kegiatan_evaluatif[0]?.id ?? '')));
      })
      .catch((e) => { if (hidup) { setKegiatanEvaluatif([]); setKegiatanEvaluatifId(''); setErr(errorMessage(e)); } });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta]);

  const kegiatanEvaluatifAktif = useMemo(
    () => kegiatanEvaluatif.find((p) => p.id === kegiatanEvaluatifId) ?? null,
    [kegiatanEvaluatif, kegiatanEvaluatifId],
  );

  useEffect(() => {
    setRentangAktif(kegiatanEvaluatifAktif?.rentang_nilai ?? '0-100');
  }, [kegiatanEvaluatifAktif]);

  const kelasIds = useMemo(
    () => kelasOpsi.filter((k) => kelasAktif.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasAktif],
  );

  useEffect(() => {
    const bersih = cari.trim();
    const t = setTimeout(() => setCariTertunda(bersih), bersih === '' ? 0 : 400);
    return () => clearTimeout(t);
  }, [cari]);

  const reqRef = useRef(0);
  const muat = useCallback(async (page: number, perPage: number) => {
    if (kegiatanEvaluatifId === '' || semester === null) { setData(null); return; }
    const req = ++reqRef.current;
    setErr(''); setLoading(true);
    try {
      const res = await legerNilai({
        kegiatan_evaluatif_id: Number(kegiatanEvaluatifId),
        semester,
        tingkat: tingkat.length ? tingkat : undefined,
        kelas_id: kelasIds.length ? kelasIds : undefined,
        q: cariTertunda || undefined,
        page, per_page: perPage === 0 ? 'all' : String(perPage),
      });
      if (req !== reqRef.current) return;
      setData(res);
      pager.sync(res.current_page, res.last_page);
    } catch (e) {
      if (req !== reqRef.current) return;
      setErr(errorMessage(e));
      setData(null);
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, [kegiatanEvaluatifId, semester, tingkat, kelasIds, cariTertunda, pager]);

  useEffect(() => {
    if (!pager.ready || filterLoading) return;
    void muat(pager.page, pager.perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, filterLoading, kegiatanEvaluatifId, semester, tingkat, kelasIds, cariTertunda, pager.perPage]);

  const unduh = useCallback(() => {
    if (kegiatanEvaluatifId === '') return;
    void unduhLeger({
      kegiatan_evaluatif_id: Number(kegiatanEvaluatifId), semester: semester ?? undefined,
      tingkat: tingkat.length ? tingkat : undefined,
      kelas_id: kelasIds.length ? kelasIds : undefined,
      q: cariTertunda || undefined,
    }).catch((e) => toast.error(errorMessage(e)));
  }, [kegiatanEvaluatifId, semester, tingkat, kelasIds, cariTertunda]);

  const hitung = useCallback(async () => {
    if (kegiatanEvaluatifId === '' || semester === null) return;
    try {
      const r = await hitungUlang({
        kegiatan_evaluatif_id: Number(kegiatanEvaluatifId), semester,
        kelas_id: kelasIds.length === 1 ? kelasIds[0] : null,
      });
      toast.success(r.pesan);
      await muat(pager.page, pager.perPage);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [kegiatanEvaluatifId, semester, kelasIds, muat, pager.page, pager.perPage]);

  const ubahRentang = useCallback(async (nilai: RentangNilai) => {
    if (kegiatanEvaluatifAktif === null || !canUbah || nilai === rentangAktif) return;
    const lama = rentangAktif;
    setRentangAktif(nilai);
    setMenyimpanRentang(true);
    try {
      await ubahKegiatanEvaluatif(kegiatanEvaluatifAktif.id, { rentang_nilai: nilai });
      setKegiatanEvaluatif((daftar) => daftar.map((p) => (
        p.id === kegiatanEvaluatifAktif.id ? { ...p, rentang_nilai: nilai } : p
      )));
      setData((d) => d === null ? d : { ...d, kegiatan_evaluatif: { ...d.kegiatan_evaluatif, rentang_nilai: nilai } });
      toast.success(`Rentang nilai ${nilai.replace('-', '–')} disimpan.`);
    } catch (e) {
      setRentangAktif(lama);
      toast.error(errorMessage(e));
    } finally {
      setMenyimpanRentang(false);
    }
  }, [kegiatanEvaluatifAktif, canUbah, rentangAktif]);

  const baris = useMemo<BarisLegerGrid[]>(
    () => (data?.baris ?? []).map((b) => ({ ...b, id: b.santri_id })),
    [data],
  );

  const laporNilaiLewat = useCallback((info: { id: string | number; key: string; pesan: string }) => {
    const baris = data?.baris.find((b) => b.santri_id === Number(info.id));
    const kolom = data?.kolom.find((k) => k.key === info.key);
    toast.warning(`${baris?.nama ?? 'Peserta'} — ${kolom?.nama_mapel ?? info.key}: ${info.pesan}`);
  }, [data]);

  const sumberSel = useMemo(() => {
    const peta = new Map<string, string | null>();
    for (const b of data?.baris ?? []) {
      for (const k of data?.kolom ?? []) {
        peta.set(`${b.santri_id}:${k.key}`, b.sel[k.key]?.sumber ?? null);
      }
    }
    return peta;
  }, [data]);

  const fields = useMemo<ExcelField[]>(() => {
    const mapel: ExcelField[] = (data?.kolom ?? []).map((k) => ({
      key: k.key,
      label: k.judul,
      width: 84,
      kind: canUbah ? 'text' : 'static',
      maxLength: 6,
      cellClass: kelasPeringkat,
      validate: canUbah
        ? (nilai) => {
          if (nilai === null || nilai.trim() === '') return null;
          const angka = angkaNilai(nilai);
          return angka !== null && nilaiDalamRentang(angka, rentangAktif)
            ? null
            : `Nilai harus 0–${batasAtasRentang(rentangAktif)}.`;
        }
        : undefined,
      renderCell: (row: GridRow) => {
        const nilai = row[k.key];
        if (nilai === null || nilai === '') {
          return <span className="text-muted-foreground">·</span>;
        }
        const sumber = sumberSel.get(`${row.id}:${k.key}`);
        return (
          <span className="inline-flex items-center gap-1">
            {String(nilai)}
            {sumber === 'impor' && (
              <span
                className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-700 dark:text-amber-300"
                title="Diisi lewat impor"
              >
                I
              </span>
            )}
            {sumber === 'manual' && (
              <span
                className="rounded bg-emerald-500/20 px-1 text-[10px] text-emerald-700 dark:text-emerald-300"
                title="Diisi manual"
              >
                M
              </span>
            )}
          </span>
        );
      },
    }));

    return [
      {
        key: 'nis_lokal', label: 'NIS', kind: 'static', width: 100, cellClass: kelasPeringkat,
        renderCell: (row) => row.nis_lokal === null || row.nis_lokal === ''
          ? <span className="text-muted-foreground">—</span>
          : String(row.nis_lokal),
      },
      { key: 'nama', label: 'Nama', kind: 'static', width: 200, cellClass: kelasPeringkat },
      {
        key: 'kelas', label: 'Kelas', kind: 'static', width: 90, cellClass: kelasPeringkat,
        renderCell: (row) => row.kelas === null || row.kelas === ''
          ? <span className="text-muted-foreground">—</span>
          : String(row.kelas),
      },
      ...mapel,
      {
        key: 'rata_rata', label: 'Rata²', kind: 'static', width: 80, cellClass: kelasPeringkat,
        renderCell: (row) => row.rata_rata === null || row.rata_rata === ''
          ? <span className="text-muted-foreground">—</span>
          : String(row.rata_rata),
      },
      {
        key: 'jumlah', label: 'Jumlah', kind: 'static', width: 80, cellClass: kelasPeringkat,
        renderCell: (row) => row.jumlah === null || row.jumlah === ''
          ? <span className="text-muted-foreground">—</span>
          : String(row.jumlah),
      },
      {
        key: 'peringkat', label: 'Peringkat', kind: 'static', width: 90, cellClass: kelasPeringkat,
        renderCell: (row) => row.peringkat === null || row.peringkat === ''
          ? <span className="text-muted-foreground">—</span>
          : <span className="font-semibold">{String(row.peringkat)}</span>,
      },

    ];
  }, [data, sumberSel, canUbah, rentangAktif]);

  const getValues = useCallback((b: BarisLegerGrid) => {
    const nilai: Record<string, string | null> = {
      nis_lokal: b.nis_lokal,
      nama: b.nama,
      kelas: b.kelas,
      rata_rata: b.rata_rata === null ? null : String(b.rata_rata),
      jumlah: b.jumlah === null ? null : String(b.jumlah),
      peringkat: b.peringkat === null ? null : String(b.peringkat),
    };
    for (const k of data?.kolom ?? []) {
      const angka = b.sel[k.key]?.nilai;
      nilai[k.key] = angka === null || angka === undefined ? null : String(angka);
    }
    return nilai;
  }, [data]);

  const simpanSel = useCallback(async (santriId: number, fields: Record<string, string | null>) => {
    if (kegiatanEvaluatifId === '' || semester === null || data === null) return;
    const petaMapel = new Map(data.kolom.map((k) => [k.key, k.mapel_id]));
    for (const [key, nilai] of Object.entries(fields)) {
      const mapelId = petaMapel.get(key);
      if (mapelId === undefined) continue;
      const angka = nilai === null ? null : angkaNilai(nilai);
      if (angka !== null && !nilaiDalamRentang(angka, rentangAktif)) {
        throw new Error(`Nilai harus 0–${batasAtasRentang(rentangAktif)}.`);
      }
      await simpanNilaiManual({
        kegiatan_evaluatif_id: Number(kegiatanEvaluatifId),
        semester,
        santri_id: santriId,
        mapel_id: mapelId,
        nilai_akhir: angka,
      });
    }
  }, [kegiatanEvaluatifId, semester, data, rentangAktif]);

  const selesaiSimpan = useCallback(async () => {
    await muat(pager.page, pager.perPage);
  }, [muat, pager.page, pager.perPage]);

  const presetLuar = useMemo(
    () => ({ keys: fields.map((f) => f.key), presetId: null }),
    [fields],
  );

  const pagerNode = data !== null ? (
    <Pager
      page={pager.page}
      lastPage={data.last_page ?? 1}
      total={data.total ?? 0}
      perPage={pager.perPage}
      onPage={(p) => { pager.setPage(p); void muat(p, pager.perPage); }}
      onPerPage={(pp) => { pager.setPerPage(pp); void muat(1, pp); }}
    />
  ) : undefined;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <label className="text-xs text-muted-foreground" htmlFor="select_kegiatan_evaluatif_leger">Kegiatan Evaluatif</label>
        <select
          id="select_kegiatan_evaluatif_leger"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={kegiatanEvaluatifId === '' ? '' : String(kegiatanEvaluatifId)}
          onChange={(e) => { setKegiatanEvaluatifId(e.target.value === '' ? '' : Number(e.target.value)); pager.goFirst(); }}
        >
          <option value="">— pilih kegiatan evaluatif —</option>
          {kegiatanEvaluatif.map((p) => (
            <option key={p.id} value={p.id}>
              {p.kode} — {p.nama}{p.jenis_rapor === 'tidak_ada' ? ' (nilai ujian, tanpa rapor)' : ''}
            </option>
          ))}
        </select>
        <label className="ml-2 text-xs text-muted-foreground" htmlFor="select_rentang_nilai_leger">Rentang nilai</label>
        <select
          id="select_rentang_nilai_leger"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={rentangAktif}
          onChange={(e) => void ubahRentang(e.target.value as RentangNilai)}
          disabled={!canUbah || kegiatanEvaluatifAktif === null || menyimpanRentang}
          title={!canUbah ? 'Butuh izin ubah nilai.' : 'Batas nilai input dan impor kegiatan evaluatif ini'}
        >
          <option value="0-100">0–100</option>
          <option value="0-10">0–10</option>
          <option value="0-4">0–4</option>
        </select>
        <Input
          id="input_cari_leger"
          aria-label="Cari nama / NIS"
          placeholder="Cari nama / NIS…"
          className="h-8 w-56 text-xs"
          value={cari}
          onChange={(e) => { setCari(e.target.value); pager.goFirst(); }}
        />
        {!siap && (
          <span className="text-xs text-muted-foreground">Pilih satu jenjang, TA, dan semester pada filter di atas.</span>
        )}
        {siap && kegiatanEvaluatif.length === 0 && (
          <span className="text-xs text-muted-foreground">Belum ada kegiatan evaluatif — muat bawaan di halaman Master Penilaian.</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" id="btn_hitung_ulang" disabled={!canUbah || kegiatanEvaluatifId === ''}
            title="Hitung ulang nilai akhir dari komponen (baris hasil impor dilewati)"
            onClick={() => void hitung()}>
            <RefreshCw data-icon="inline-start" size={16} /> Hitung ulang
          </Button>
          <Button type="button" variant="outline" size="sm" id="btn_unduh_leger" disabled={kegiatanEvaluatifId === ''} onClick={unduh}>
            <Download data-icon="inline-start" size={16} /> Unduh Excel
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-6">
        {loading && data === null && <p className="p-3 text-xs text-muted-foreground">Memuat…</p>}
        {bekuSiap && data !== null && (
          <ExcelTable<BarisLegerGrid>
            tableKey="penilaian_leger"
            header={kegiatanEvaluatifAktif === null ? 'Leger Nilai' : `Leger Nilai · ${kegiatanEvaluatifAktif.kode} — ${kegiatanEvaluatifAktif.nama}`}
            tengah={data === null ? undefined : `${data.total} santri · ${data.kolom.length} mapel`}
            fields={fields}
            rows={baris}
            getValues={getValues}
            loading={loading}
            emptyText="Tidak ada santri pada lingkup ini."
            canEdit={canUbah}
            simpanSaatKeluarMode
            onValidasiGagal={laporNilaiLewat}
            onCommit={simpanSel}
            onSaved={selesaiSimpan}
            renderActions={() => null}
            hideCheckbox
            hideActions
            hidePreset
            presetLuar={presetLuar}
            rail
            pager={pagerNode}
          />
        )}
      </div>
    </div>
  );
}
