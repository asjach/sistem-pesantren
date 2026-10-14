import { useCallback, useEffect, useState } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { muatPengaturanGlobal, type PetaGlobal } from '@/api/pengaturanGlobal';
import { nilaiBerlapis } from '@/lib/setelanGlobal';
import { PER_PAGE_DEFAULT, PER_PAGE_OPTIONS, normalizePerPage, type PerPage } from '@/prefs';

/** Kunci global jumlah baris per halaman — SATU untuk semua tabel. */
export const KUNCI_PERPAGE_GLOBAL = 'simpes_perpage';
/** Kunci warisan per-tabel (tak lagi dibaca; hanya dimigrasi sekali-jalan). */
const kunciPerpageLama = (tableKey: string) => `simpes_perpage_${tableKey}`;
/** Event antar-instance: satu tabel ganti perPage → semua yang mounted ikut. */
const EVENT_PERPAGE_GLOBAL = 'simpes:perpage-global';

/** Nilai mentah → opsi valid, atau null bila tak dikenal (bedakan "kosong"
 *  dari "sama dengan bawaan" untuk migrasi). */
function cobaPerPage(v: unknown): PerPage | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(n) ? (n as PerPage) : null;
}

/** Baca perPage global (untuk kontrol paginasi di luar `usePager`,
 *  mis. tabel kandidat di dalam dialog). */
export async function bacaPerPageGlobal(): Promise<PerPage> {
  try {
    return normalizePerPage(await prefGet(KUNCI_PERPAGE_GLOBAL));
  } catch {
    return PER_PAGE_DEFAULT;
  }
}

/** Tulis perPage global + siarkan ke semua hook/dialog yang mounted.
 *  Mengembalikan nilai ternormalisasi yang dipakai. */
export function tulisPerPageGlobal(pp: PerPage): PerPage {
  const next = normalizePerPage(pp);
  prefSet(KUNCI_PERPAGE_GLOBAL, String(next)).catch(() => {});
  window.dispatchEvent(new CustomEvent<number>(EVENT_PERPAGE_GLOBAL, { detail: next }));
  return next;
}

/** Langganan perubahan perPage global; mengembalikan fungsi berhenti. */
export function langgananPerPageGlobal(cb: (pp: PerPage) => void): () => void {
  const h = (e: Event) => cb(normalizePerPage((e as CustomEvent<unknown>).detail));
  window.addEventListener(EVENT_PERPAGE_GLOBAL, h);
  return () => window.removeEventListener(EVENT_PERPAGE_GLOBAL, h);
}

/**
 * Pagination bawaan SEMUA halaman tabel (baru maupun lama).
 *
 * - per_page default 50, pilihan 10/50/100/"Semua" (PER_PAGE_OPTIONS).
 * - page tersimpan permanen per tabel; perPage SATU global untuk semua tabel
 *   (ganti di satu tabel → semua tabel ikut).
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
      prefGet(KUNCI_PERPAGE_GLOBAL),
      prefGet(kunciPerpageLama(tableKey)),
      /* Standar server: kegagalan diperlakukan sebagai "tidak ada standar"
         supaya tabel tetap jalan dengan nilai perangkat/bawaan. */
      muatPengaturanGlobal()
        .then((r) => r.data.peta)
        .catch(() => ({} as PetaGlobal)),
    ])
      .then(([p, ppGlobal, ppLama, standar]) => {
        if (!alive) return;
        const pn = Number(p);
        setPageState(Number.isFinite(pn) && pn >= 1 ? Math.floor(pn) : 1);
        /* BERTINGKAT: perangkat menang bila sudah pernah diubah; standar server
           mengisi saat belum. Bila belum ada (pengguna lama), angkat nilai
           warisan per-tabel jadi perangkat sekali-jalan supaya pengaturan yang
           sudah ada tidak hilang diam-diam - dan itu MENANG atas standar. */
        let perangkat = cobaPerPage(ppGlobal);
        if (perangkat === null) {
          perangkat = cobaPerPage(ppLama);
          if (perangkat !== null) {
            prefSet(KUNCI_PERPAGE_GLOBAL, String(perangkat)).catch(() => {});
          }
        }
        const dariStandar = cobaPerPage(standar.baris_per_halaman);
        setPerPageState(
          (nilaiBerlapis(dariStandar, perangkat) as PerPage | null) ?? PER_PAGE_DEFAULT,
        );
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

  /* Ikut perubahan global dari tabel lain yang sedang mounted (kembali ke
     halaman 1; effect muat-ulang induk otomatis jalan karena perPage berubah).
     Listener tak menyiarkan ulang, jadi tak ada loop. */
  useEffect(() => langgananPerPageGlobal((next) => {
    setPerPageState(next);
    setPageState(1);
    prefSet(`simpes_page_${tableKey}`, '1').catch(() => {});
  }), [tableKey]);

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
      // Tulis global + siarkan; listener di atas (termasuk milik sendiri)
      // menyelaraskan state — React mengabaikan nilai yang sama.
      const next = tulisPerPageGlobal(pp);
      setPerPageState(next);
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
