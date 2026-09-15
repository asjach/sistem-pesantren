import { useCallback, useEffect, useState } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { PER_PAGE_DEFAULT, normalizePerPage, type PerPage } from '@/prefs';

/**
 * Pagination bawaan SEMUA halaman tabel (baru maupun lama).
 *
 * - per_page default 50, pilihan 10/50/75/100/250/500/1000 (PER_PAGE_OPTIONS).
 * - page + perPage tersimpan permanen per tabel (per perangkat).
 * - Muat simpanan sekali saat mount; `ready` menandakan nilai final
 *   sehingga halaman bisa menunda fetch pertama sampai siap.
 *
 * Pola pakai di halaman baru:
 * ```tsx
 * const pager = usePager('nama_tabel');
 * useEffect(() => { if (pager.ready) load(pager.page); }, [pager.ready]);
 * // ganti filter/search: pager.goFirst(); load(1);
 * // setelah respons: pager.sync(res.current_page, res.last_page);
 * <Pager page={pager.page} lastPage={lastPage} total={total}
 *        perPage={pager.perPage} onPage={(p) => { pager.setPage(p); load(p); }}
 *        onPerPage={(pp) => { pager.setPerPage(pp); load(1); }} />
 * ```
 */
export function usePager(tableKey: string) {
  const [page, setPageState] = useState(1);
  const [perPage, setPerPageState] = useState<PerPage>(PER_PAGE_DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    Promise.all([
      prefGet(`simpes_page_${tableKey}`),
      prefGet(`simpes_perpage_${tableKey}`),
    ])
      .then(([p, pp]) => {
        if (!alive) return;
        const pn = Number(p);
        setPageState(Number.isFinite(pn) && pn >= 1 ? Math.floor(pn) : 1);
        setPerPageState(normalizePerPage(pp));
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [tableKey]);

  const setPage = useCallback(
    (p: number) => {
      const pn = Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1;
      setPageState(pn);
      prefSet(`simpes_page_${tableKey}`, String(pn)).catch(() => {});
    },
    [tableKey],
  );

  const setPerPage = useCallback(
    (pp: PerPage) => {
      const next = normalizePerPage(pp);
      setPerPageState(next);
      prefSet(`simpes_perpage_${tableKey}`, String(next)).catch(() => {});
      setPageState(1);
      prefSet(`simpes_page_${tableKey}`, '1').catch(() => {});
    },
    [tableKey],
  );

  /** Kembali ke halaman 1 (dipakai saat search/filter berubah). */
  const goFirst = useCallback(() => {
    setPageState(1);
    prefSet(`simpes_page_${tableKey}`, '1').catch(() => {});
  }, [tableKey]);

  /**
   * Selaraskan dengan respons backend. Bila halaman tersimpan sudah tak valid
   * (data berkurang/dihapus) kembalikan halaman terakhir yang valid.
   * Mengembalikan halaman yang seharusnya dipakai, atau null bila sudah pas.
   */
  const sync = useCallback(
    (currentPage: number, lastPage: number): number | null => {
      const valid = Math.min(Math.max(1, currentPage), Math.max(1, lastPage));
      if (valid !== currentPage) {
        setPageState(valid);
        prefSet(`simpes_page_${tableKey}`, String(valid)).catch(() => {});
        return valid;
      }
      return null;
    },
    [tableKey],
  );

  return { page, perPage, ready, setPage, setPerPage, goFirst, sync };
}
