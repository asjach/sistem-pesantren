import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import type { Paginate } from '../api/master';
import { tokenUrut, type PetaArahKolom } from '../lib/urut';
import { usePager } from './usePager';

export interface ArgsMuat {
  search: string;
  page: number;
  perPage: number;
  /** Token urut siap kirim — kode ber-arah sendiri sudah bersufiks (`kode:turun`). */
  urut: string[];
  arah: 'naik' | 'turun';
  /** Arah per kode urut (dari preset, opsional) — menimpa `arah` global. */
  arahKolom?: PetaArahKolom;
  /** Sinyal pembatalan request (di-abort saat muat ulang / unmount). */
  signal?: AbortSignal;
}

export interface OpsiMuatUrut {
  urut?: string[];
  arah?: 'naik' | 'turun';
  /** Arah per kode urut (opsional) — menimpa `arah` global. */
  arahKolom?: PetaArahKolom;
}

/**
 * Pola bersama halaman tabel: state daftar (rows/loading/error), pencarian,
 * urutan header, dan paginasi (usePager) dengan penjagaan balapan permintaan.
 *
 * Pemanggil menyuplai `ambil` (memetakan args → API list) dan `deps` (nilai
 * filter tambahan yang memicu muat ulang, mis. `[lembagaId, kelasId]`).
 *
 * ```tsx
 * const daftar = useDaftarTabel<Kelas>({
 *   tableKey: 'kelas',
 *   ambil: (a) => listKelas({ ...a, lembaga_id: lembagaId || undefined }),
 *   deps: [lembagaId],
 * });
 * ```
 */
export function useDaftarTabel<T, R extends Paginate<T> = Paginate<T>>({
  tableKey,
  ambil,
  deps = [],
  awalUrut = [],
  awalArah = 'naik',
  onData,
  search: searchEksternal,
}: {
  tableKey: string;
  ambil: (a: ArgsMuat) => Promise<R>;
  deps?: unknown[];
  awalUrut?: string[];
  awalArah?: 'naik' | 'turun';
  /** Data tambahan dari respons (mis. `badge`), dipanggil setelah req valid. */
  onData?: (res: R) => void;
  /** Bila diisi, pencarian dikendalikan dari luar (mis. search tunggal topBar). */
  search?: string;
}) {
  const [search, setSearch] = useState('');
  // Pencarian efektif: eksternal (topBar) bila diisi, jika tidak state internal.
  const searchEfektif = searchEksternal ?? search;
  // Live search: nilai yang benar-benar dipakai memuat data ditunda 400 ms agar
  // tidak memanggil API tiap ketikan. Query 1 karakter tidak memicu muat.
  const [searchTertunda, setSearchTertunda] = useState('');
  const [urut, setUrut] = useState<string[]>(awalUrut);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>(awalArah);
  /** Arah per kode urut (dari preset dengan arah_kolom) — menyertai urut aktif. */
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);
  const [rows, setRows] = useState<T[]>([]);
  const pager = usePager(tableKey);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reqRef = useRef(0);
  // Request terakhir; di-abort saat muat ulang berikutnya / unmount.
  const abortRef = useRef<AbortController | null>(null);
  const ambilRef = useRef(ambil);
  ambilRef.current = ambil;
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage, o?: OpsiMuatUrut) {
      const req = ++reqRef.current;
      // Batalkan request sebelumnya agar tidak menumpuk saat mengetik/filter.
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setErr('');
      setLoading(true);
      try {
        const u = o?.urut ?? urut;
        const a = o?.arah ?? arahUrut;
        const ak = o?.arahKolom ?? arahKolom;
        // Arah per kode ditokenkan ke `sort` (`kode:naik`/`kode:turun`) —
        // backend mengenali sufiks sehingga halaman tak perlu meneruskan
        // field terpisah; kode tanpa pengaturan mengikuti `arah` global.
        const token = tokenUrut(u, ak);
        const res = await ambilRef.current({
          search: searchTertunda, page: p, perPage: pp, urut: token, arah: a, arahKolom: ak, signal: ac.signal,
        });
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        setRows(res.data);
        onDataRef.current?.(res);
        setLastPage(res.last_page);
        setTotal(res.total);
      } catch (e) {
        // Request yang dibatalkan bukan error.
        if (ac.signal.aborted) return;
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [searchTertunda, urut, arahUrut, arahKolom, pager.page, pager.perPage, pager.sync],
  );

  /**
   * Ubah urutan (dropdown Urutkan / header): simpan lalu muat ulang halaman 1.
   * `arahKolom` opsional = arah per kode dari preset (menimpa arah global).
   */
  const terapkanUrut = useCallback(
    (nilai: string[], arah: 'naik' | 'turun', arahKolomBaru?: PetaArahKolom) => {
      const peta = nilai.length > 0 ? arahKolomBaru : undefined;
      setUrut(nilai);
      setArahUrut(arah);
      setArahKolom(peta);
      pager.goFirst();
      void load(1, pager.perPage, { urut: nilai, arah, arahKolom: peta });
    },
    [load, pager.goFirst, pager.perPage],
  );

  // Live search: terapkan setelah jeda 400 ms (langsung saat dikosongkan).
  // Semua panjang query dipakai (termasuk 1 karakter) agar pencarian pendek
  // seperti nama kelas ("7") tetap berfungsi.
  useEffect(() => {
    const bersih = searchEfektif.trim();
    const t = setTimeout(() => {
      setSearchTertunda(searchEfektif);
      pager.goFirst();
    }, bersih === '' ? 0 : 400);
    return () => clearTimeout(t);
  }, [searchEfektif, pager.perPage]);

  // Batalkan request yang masih jalan saat komponen dilepas.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (pager.ready) void load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, searchTertunda, ...deps]);

  const onSearchChange = useCallback(
    (v: string) => {
      setSearch(v);
      pager.goFirst();
    },
    [pager.goFirst],
  );

  const onSaved = useCallback(() => load(), [load]);

  return {
    rows,
    setRows,
    loading,
    err,
    setErr,
    search,
    setSearch,
    urut,
    arahUrut,
    terapkanUrut,
    load,
    lastPage,
    total,
    pager,
    onSearchChange,
    onSaved,
  };
}
