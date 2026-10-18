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
  /* Cermin SINKRON state urut & pencarian. `load` bisa dipanggil dari closure
     lama (mis. efek muat awal yang sudah terjadwal sebelum nilai default
     diterapkan) — tanpa cermin ini, muat itu memakai urut KOSONG dan menimpa
     hasil yang sudah urut default (bug: nilai awal tak bertahan saat refresh). */
  const urutRef = useRef(urut);
  const arahRef = useRef(arahUrut);
  const arahKolomRef = useRef(arahKolom);
  const searchRef = useRef(searchTertunda);
  const [rows, setRows] = useState<T[]>([]);
  const pager = usePager(tableKey);
  // Metode pager beridentitas stabil (useCallback per `tableKey`). Diambil
  // terpisah supaya hook di bawah bisa menyandangnya sebagai dependensi TANPA
  // objek `pager` yang beridentitas baru tiap render (→ loop/kedip).
  const { goFirst, sync } = pager;
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
  // Sinkronkan cermin tiap render (nilai default/urut terbaru).
  urutRef.current = urut;
  arahRef.current = arahUrut;
  arahKolomRef.current = arahKolom;
  searchRef.current = searchTertunda;

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
        const u = o?.urut ?? urutRef.current;
        const a = o?.arah ?? arahRef.current;
        const ak = o?.arahKolom ?? arahKolomRef.current;
        // Arah per kode ditokenkan ke `sort` (`kode:naik`/`kode:turun`) —
        // backend mengenali sufiks sehingga halaman tak perlu meneruskan
        // field terpisah; kode tanpa pengaturan mengikuti `arah` global.
        const token = tokenUrut(u, ak);
        const res = await ambilRef.current({
          search: searchRef.current, page: p, perPage: pp, urut: token, arah: a, arahKolom: ak, signal: ac.signal,
        });
        if (req !== reqRef.current) return;
        const fix = sync(res.current_page, res.last_page);
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
    [pager.page, pager.perPage, sync],
  );

  /**
   * Ubah urutan (dropdown Urutkan / header): simpan lalu muat ulang halaman 1.
   * `arahKolom` opsional = arah per kode dari preset (menimpa arah global).
   * Cermin ref diisi SINKRON agar muat berikutnya (termasuk dari closure lama)
   * langsung memakai urutan baru.
   */
  const terapkanUrut = useCallback(
    (nilai: string[], arah: 'naik' | 'turun', arahKolomBaru?: PetaArahKolom) => {
      const peta = nilai.length > 0 ? arahKolomBaru : undefined;
      urutRef.current = nilai;
      arahRef.current = arah;
      arahKolomRef.current = peta;
      setUrut(nilai);
      setArahUrut(arah);
      setArahKolom(peta);
      goFirst();
      void load(1, pager.perPage, { urut: nilai, arah, arahKolom: peta });
    },
    [load, goFirst, pager.perPage],
  );

  // Live search: terapkan setelah jeda 400 ms (langsung saat dikosongkan).
  // Semua panjang query dipakai (termasuk 1 karakter) agar pencarian pendek
  // seperti nama kelas ("7") tetap berfungsi.
  //
  // Dulu efek ini ikut bergantung pada `pager.perPage`, dan itu BUG:
  // `usePager` memuat per-baris tersimpan secara async, jadi `perPage`
  // bergerak bawaan -> tersimpan sesaat setelah mount. Transisi itu
  // menjalankan ulang efek lalu memanggil `goFirst()`, sehingga halaman
  // tersimpan ditendang ke 1 - tabel SELALU mulai dari halaman 1 setiap
  // dimuat ulang, walau pengguna sedang di halaman lain.
  //
  // Perubahan `perPage` oleh pengguna tidak perlu ditangani di sini:
  // `usePager.setPerPage` sudah mengembalikan ke halaman 1 sendiri.
  //
  // `goFirst()` DILEWATI pada pemanggilan pertama (mount): tak ada pencarian
  // yang berubah, jadi tak ada alasan mereset halaman. Tanpa penjaga ini,
  // halaman tersimpan (mis. 9) ditendang ke 1 sesaat setelah dipulihkan
  // `usePager`, sehingga tabel sesungguhnya tak pernah bertahan di halaman
  // selain 1. Hanya perubahan pencarian SESUDAHNYA yang mereset.
  const lewatMountRef = useRef(false);
  useEffect(() => {
    const bersih = searchEfektif.trim();
    const pertama = !lewatMountRef.current;
    lewatMountRef.current = true;
    const t = setTimeout(() => {
      // Simpan versi TER-TRIM, bukan mentah: dulu `trim()` hanya dipakai
      // menghitung jeda, lalu nilai mentah disimpan - sehingga `"budi  "`
      // dianggap berbeda dari `"budi"` dan tiap perubahan spasi memicu
      // permintaan yang isinya sama (query spasi ikut terkirim ke API).
      // Karena state-nya kini kanonis, `setSearchTertunda` pada nilai yang
      // sama tak menghasilkan render - permintaan sia-sia ikut hilang.
      setSearchTertunda(bersih);
      if (!pertama) {
        pager.goFirst();
      }
    }, bersih === '' ? 0 : 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchEfektif]);

  // Batalkan request yang masih jalan saat komponen dilepas.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (pager.ready) void load(pager.page);
    // Kunci ISI deps (bukan identitas array): turunan filter seperti
    // `kelasFilterIds` (hasil map/filter) berganti identitas tiap render
    // walau isinya sama — tanpa kunci ini tabel memuat 2× (satu diabort)
    // setiap identitas berganti. Konvensi: `deps` hanya berisi data
    // ter-JSON-kan (string/boolean/array), bukan fungsi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, searchTertunda, JSON.stringify(deps)]);

  const onSearchChange = useCallback(
    (v: string) => {
      setSearch(v);
      goFirst();
    },
    [goFirst],
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
