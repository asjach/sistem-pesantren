import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import type { Paginate } from '../api/master';
import { usePager } from './usePager';

export interface ArgsMuat {
  search: string;
  page: number;
  perPage: number;
  urut: string[];
  arah: 'naik' | 'turun';
}

export interface OpsiMuatUrut {
  urut?: string[];
  arah?: 'naik' | 'turun';
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
export function useDaftarTabel<T>({
  tableKey,
  ambil,
  deps = [],
  awalUrut = [],
  awalArah = 'naik',
}: {
  tableKey: string;
  ambil: (a: ArgsMuat) => Promise<Paginate<T>>;
  deps?: unknown[];
  awalUrut?: string[];
  awalArah?: 'naik' | 'turun';
}) {
  const [search, setSearch] = useState('');
  const [urut, setUrut] = useState<string[]>(awalUrut);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>(awalArah);
  const [rows, setRows] = useState<T[]>([]);
  const pager = usePager(tableKey);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reqRef = useRef(0);
  const ambilRef = useRef(ambil);
  ambilRef.current = ambil;

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage, o?: OpsiMuatUrut) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const u = o?.urut ?? urut;
        const a = o?.arah ?? arahUrut;
        const res = await ambilRef.current({ search, page: p, perPage: pp, urut: u, arah: a });
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
    [search, urut, arahUrut, pager.page, pager.perPage, pager.sync],
  );

  /** Ubah urutan dari header tabel: simpan lalu muat ulang dari halaman 1. */
  const terapkanUrut = useCallback(
    (nilai: string[], arah: 'naik' | 'turun') => {
      setUrut(nilai);
      setArahUrut(arah);
      pager.goFirst();
      void load(1, pager.perPage, { urut: nilai, arah });
    },
    [load, pager.goFirst, pager.perPage],
  );

  useEffect(() => {
    if (pager.ready) void load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, search, ...deps]);

  const onSearchChange = useCallback(
    (v: string) => {
      setSearch(v);
      pager.goFirst();
    },
    [pager.goFirst],
  );

  const onSearchSubmit = useCallback(() => {
    pager.goFirst();
  }, [pager.goFirst]);

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
    onSearchSubmit,
    onSaved,
  };
}
