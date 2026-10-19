import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { prefSet } from '@/api/client';
import { EVENT_TAMPILAN_PERANGKAT_BERUBAH } from '@/components/kelolaTabel/jenis';
import { DEFAULT_HEADER_H, MAX_HEADER_H } from '@/components/GridPrefs';
import { toast } from 'sonner';

import {
  ambilContohBaris, barisSelAtauTeks, gabungLebarMaks, lebarJudulDuaBaris, ukurAutoFit,
} from './autofit';
import {
  ACTIONS_DEFAULT_W,
  AUTOFIT_BUFFER,
  AUTOFIT_MAX_W,
  MIN_COL_W,
  hostUkur,
  loadWidths,
  readWidthCache,
  teksTampilSel,
  widthsKey,
  writeWidthCache,
} from './helpers';
import { PAD_JUDUL_X, ukurPerluTinggiHeader } from './header';
import { measureActionsWidth, bersihkanProbe, dapatkanKanvas, fontKanvas } from './measure';
import type { BarisSel, ExcelField, GridRow } from './types';

/** Ref mutable yang selalu terisi (dipakai untuk cermin nilai terbaru). */
interface LiveRef<T> {
  current: T;
}

/** Lebar bawaan kolom DSG (px) — dipakai sebelum basis kita terpasang. */
const DSG_LEBAR_BAWAAN = 100;

/** Grid BELUM layak ditampilkan? Dua sebab, keduanya memicu kedip
 *  "kecil lalu membesar" bila terlihat:
 *  1. header belum lengkap (DSG baru mount, baru sebagian sel terender);
 *  2. seluruh kolom data masih seragam 100px — lebar bawaan DSG sebelum
 *     basis kita dipakai.
 *  Dibandingkan relatif (seragam 100), bukan sama-persis ke basis, agar tak
 *  salah sembunyi saat basis kebetulan mirip. */
export function gridBelumSiapTampil(root: HTMLElement | null, harapSisi = 3): boolean {
  if (!root) return true;
  const heads = root.querySelectorAll<HTMLElement>(
    '.dsg-row-header .dsg-cell:not(.dsg-cell-gutter)',
  );

  const minimal = Math.min(3, Math.max(1, harapSisi));
  if (heads.length < minimal) return true;

  if (heads.length < 2) return false;
  let seragam = 0;
  for (const h of heads) {
    if (Math.abs(h.getBoundingClientRect().width - DSG_LEBAR_BAWAAN) <= 1) seragam += 1;
  }

  return seragam >= heads.length - 1;
}

export interface LebarKolomOptions<T extends { id: string | number }> {
  tableKey: string;
  fields: ExcelField[];
  fieldsRef: LiveRef<ExcelField[]>;
  rows: T[];
  rowsRef: LiveRef<T[]>;
  /** Petakan baris domain → nilai grid (dibaca terkini saat mengukur). */
  getValuesRef: LiveRef<(row: T) => Record<string, string | null>>;
  /** true saat remount grid masih tertunda (tanda tinggi baris belum
   *  diterapkan DSG). Diisi ExcelTable setelah nilainya dihitung; dibaca
   *  gerbang pengungkapan agar tampilan pertama MENUNGGU remount selesai —
   *  tanpa ini grid tempat tampil lalu disembunyikan remount (kedip). */
  remountTertundaRef?: LiveRef<boolean>;
  /** Baris grid aktif per id (untuk teks sel saat AutoFit DOM). */
  gridByIdRef: LiveRef<Map<string, GridRow>>;
  visibleFields: ExcelField[];
  /** Elemen pembungkus grid (pengukuran AutoFit DOM & tinggi header). */
  wrapRef: RefObject<HTMLDivElement | null>;
  /** Key kolom grid terseleksi (resize multi-kolom saat blok terseleksi). */
  getSelectedColumnKeys: () => string[];
  labelKolom: (key: string, bawaan: string) => string;
  hideActions: boolean;
  hideCheckbox: boolean;
  loading: boolean;
  headerH: number | null;
  fontPx: number | null;
  fontFamily: string;
  effectiveFont: number;
  fontStack: string;
  fontStackWeight: string;
  /** Rasio skala lebar tampil (fitur `isiLebarPenuh`): lebar yang TERLIHAT =
   *  lebar basis × rasio. Seret gagang dibagi rasio ini supaya kolom tetap
   *  menempel di kursor. `1`/absen = tanpa skala. */
  skalaRef?: LiveRef<number>;
}

/**
 * Manajemen lebar kolom untuk ExcelTable: lebar tersimpan pengguna (widths) +
 * AutoFit (autoWidths), persistensi disk + cache sesi, penahan `lebarStabil`
 * (sembunyikan grid sampai DSG memakai lebar basis), seret gagang (multi-kolom
 * saat blok terseleksi), AutoFit DOM & sinkron (host offscreen), lebar kolom
 * Aksi, dan tinggi header otomatis. Semua fungsi sengaja dibuat ulang tiap
 * render (bukan useCallback) — semantik sama dengan kode asli di ExcelTable.
 * PENGECUALIAN: `computeAutoWidths` di-memo (deps `hideActions` + `labelKolom`)
 * agar identitas `resetLebarInternal` stabil — listener event global tak
 * pasang-lepas tiap render.
 */
export function useLebarKolom<T extends { id: string | number }>({
  tableKey,
  fields,
  fieldsRef,
  rows,
  rowsRef,
  getValuesRef,
  remountTertundaRef,
  gridByIdRef,
  visibleFields,
  wrapRef,
  getSelectedColumnKeys,
  labelKolom,
  hideActions,
  hideCheckbox,
  loading,
  headerH,
  fontPx,
  fontFamily,
  effectiveFont,
  fontStack,
  fontStackWeight,
  skalaRef,
}: LebarKolomOptions<T>) {
  const visibleFieldsRef = useRef(visibleFields);
  visibleFieldsRef.current = visibleFields;

  /** Cache sesi untuk tabel ini (bila ada): lebar langsung final di render
   *  pertama sehingga tidak ada geseran saat kembali ke halaman. */
  const cacheHit = readWidthCache(tableKey);
  /** Ada cache SAAT render pertama (sebelum efek menulis apa pun) — dipakai
   *  agar muat-lebar-dari-disk tidak dilewati keliru (mis. StrictMode). */
  const cacheHadRef = useRef(!!cacheHit);
  const [widths, setWidths] = useState<Record<string, number>>(() => cacheHit?.widths ?? {});
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  /** Lebar AutoFit bawaan — TIDAK disimpan, dipakai hanya untuk kolom yang
   *  belum pernah diatur lebarnya oleh pengguna. Dihitung ulang tiap muat
   *  awal supaya selalu pas dengan data aktual. */
  const [autoWidths, setAutoWidths] = useState<Record<string, number>>(() => cacheHit?.autoWidths ?? {});
  const autoWidthsRef = useRef(autoWidths);
  autoWidthsRef.current = autoWidths;
  const [widthsReady, setWidthsReady] = useState(!!cacheHit);
  /** Grid disembunyikan (space tetap dialokasikan) sampai lebar kolom BENAR
   *  diterapkan DSG. DSG merender semua kolom dengan lebar bawaan (100px) pada
   *  frame pertama sebelum basis kita dipakai — tanpa penahan ini terlihat
   *  header "melompat". Selalu mulai tersembunyi, termasuk saat cache ada. */
  const [lebarStabil, setLebarStabil] = useState(false);
  /** Grid TAMPIL hanya saat DOM-nya sudah memakai lebar basis (bukan lebar
   *  bawaan DSG). Dikendalikan gerbang kontinu di bawah — bukan sekali jalan,
   *  sebab tiap remount DSG memulai lagi dari lebar bawaan. */
  const [tampilGrid, setTampilGrid] = useState(false);
  /** Failsafe gerbang sudah lewat: jangan pernah menyembunyikan grid lagi. */
  const menyerahRef = useRef(false);
  /** Cermin `sedangLebar` untuk dibaca di dalam callback gerbang. */
  const sedangLebarRef = useRef(false);
  /** Perkiraan jumlah sel header (checkbox + kolom tampil + Aksi). */
  const harapSisiRef = useRef(3);
  harapSisiRef.current = (hideCheckbox ? 0 : 1) + visibleFields.length + (hideActions ? 0 : 1);
  /** Tinggi header otomatis (konten-driven) — dari judul terpanjang yang
   *  membungkus; dipakai bila pengguna tidak mengunci tinggi manual. */
  const [headerAutoH, setHeaderAutoH] = useState<number | null>(null);
  /** Lewati AutoFit pada commit pertama: cache sudah memuat lebar final. */
  const skipFitPertamaRef = useRef(!!cacheHit);
  const fittedRef = useRef<string | null>(cacheHit ? tableKey : null);
  /** Sedang mencoba mengukur kolom Aksi yang baru ter-render (hindari loop ganda). */
  const aksiFitRef = useRef(false);
  /** True selama gagang lebar kolom sedang diseret (grid tidak boleh
   *  di-remount di tengah gerakan — lihat ExcelTable). */
  const [sedangLebar, setSedangLebar] = useState(false);
  sedangLebarRef.current = sedangLebar;
  const resizeRef = useRef<{ key: string; startX: number; startW: number; targets: string[] } | null>(null);
  /** Listener resize aktif (dibersihkan saat unmount bila masih menyeret). */
  const resizeListenersRef = useRef<{ move: (ev: MouseEvent) => void; up: () => void } | null>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {

    if (cacheHadRef.current) {
      setWidthsReady(true);
      return;
    }
    setWidthsReady(false);
    loadWidths(widthsKey(tableKey)).then((w) => {
      setWidths(w);
      setWidthsReady(true);
    });
  }, [tableKey]);

  useEffect(() => {
    writeWidthCache(tableKey, { widths });
  }, [tableKey, widths]);
  useEffect(() => {
    writeWidthCache(tableKey, { autoWidths });
  }, [tableKey, autoWidths]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof MutationObserver === 'undefined') {
      setTampilGrid(true);
      setLebarStabil(true);
      return;
    }
    let raf = 0;
    let batal = false;
    /** Saat grid pertama kali terlihat: pengungkapan PERTAMA menunggu masa
     *  tenang 200 ms agar remount susulan (tanda tinggi baris berubah ~120 ms
     *  setelah data tiba) tak membuat tabel tampil lalu tersembunyi lagi.
     *  Setelah pernah tampil, pengungkapan kembali dilakukan secepatnya. */
    let siapSejak = 0;
    let pernahTampil = false;

    let contTerlihat: Element | null = null;
    let remountBaru = false;

    let mulai = performance.now();
    const periksa = () => {
      raf = 0;
      if (batal) return;
      const cont = el.querySelector('.dsg-container');
      if (cont !== contTerlihat) {
        contTerlihat = cont;

        if (pernahTampil) {
          remountBaru = true;
          menyerahRef.current = false;
          mulai = performance.now();
        }
      }
      const lewatFailsafe = performance.now() - mulai > 2500;
      const bacaSeragam = !lewatFailsafe && !menyerahRef.current && !sedangLebarRef.current
        ? gridBelumSiapTampil(el, harapSisiRef.current)
        : false;

      const belumSiap = bacaSeragam && (!pernahTampil || remountBaru);
      if (lewatFailsafe) menyerahRef.current = true;
      if (belumSiap) {
        siapSejak = 0;
        setTampilGrid(false);
        jadwalkan();
        return;
      }

      if (!pernahTampil && remountTertundaRef?.current === true) {
        siapSejak = 0;
        setTampilGrid(false);
        return;
      }
      const kini = performance.now();
      if (!pernahTampil) {
        if (siapSejak === 0) {
          siapSejak = kini;
          jadwalkan();
          return;
        }
        if (kini - siapSejak < 200) {
          jadwalkan();
          return;
        }
      }
      pernahTampil = true;
      remountBaru = false;
      setTampilGrid(true);
      setLebarStabil(true);
    };
    const jadwalkan = () => {
      if (!raf && !batal) raf = requestAnimationFrame(periksa);
    };
    const mo = new MutationObserver(jadwalkan);
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    jadwalkan();
    return () => {
      batal = true;
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, wrapRef]);

  const layoutContRef = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (sedangLebarRef.current) return;
    const el = wrapRef.current;
    const cont = el?.querySelector('.dsg-container') ?? null;
    const ganti = cont !== layoutContRef.current;
    layoutContRef.current = cont;
    if (!el || !ganti || !cont) return;

    menyerahRef.current = false;
    if (gridBelumSiapTampil(el, harapSisiRef.current)) setTampilGrid(false);
  });

  useEffect(() => {
    setTampilGrid(false);
    menyerahRef.current = false;
  }, [tableKey]);

  useLayoutEffect(() => {
    if (hideActions) return;
    if (widthsRef.current.__aksi !== undefined) return;
    const w = measureActionsWidth(wrapRef.current);
    if (w == null) return;
    setAutoWidths((prev) => (prev.__aksi === w ? prev : { ...prev, __aksi: w }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lebarStabil, rows, fields, visibleFields]);

  useLayoutEffect(() => {
    if (headerH != null || !lebarStabil) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ukur = () => {
      const perlu = Math.min(MAX_HEADER_H, Math.max(DEFAULT_HEADER_H, ukurPerluTinggiHeader(el)));
      setHeaderAutoH((prev) => (prev === perlu ? prev : perlu));
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    const barisHeader = el.querySelector<HTMLElement>('.dsg-row.dsg-row-header');
    ro.observe(barisHeader ?? el);
    return () => ro.disconnect();
  }, [headerH, lebarStabil, tableKey, visibleFields, fontPx, fontFamily, wrapRef]);

  /** Ukur lebar teks dengan font & padding nyata dari DOM (akurat ikut tema). */
  function autoFitWidth(key: string): number | null {
    return ukurAutoFit(wrapRef.current, key, {
      fields: fieldsRef.current,
      rows: rowsRef.current,
      labelKolom,
      teksSel: (f, rowId) => teksTampilSel(f, gridByIdRef.current.get(String(rowId))?.[f.key]),
      barisSel: (f, baris) => f.barisSel?.(baris),
      dapatkanCtx: () => (measureCtxRef.current ??= document.createElement('canvas').getContext('2d')),
    });
  }

  /** AutoFit semua kolom yang belum punya lebar tersimpan (muat awal).
   *  `ignoreSaved = true` untuk reset: lebar simpanan baru dibuang, jadi
   *  semua kolom dihitung ulang. `lewati` = kunci yang sudah final dari
   *  `syncAutoWidths` (isi awal hanya mengisi kekosongan agar tak menimpa
   *  lalu membuat kolom berkedip kecil-besar-kecil). */
  const computeAutoWidths = useCallback((ignoreSaved = false, lewati: Record<string, number> = {}): Record<string, number> => {
    const out: Record<string, number> = {};
    const keys = [
      ...visibleFieldsRef.current.map((f) => f.key),
      ...(hideActions ? [] : ['__aksi']),
    ];
    for (const key of keys) {
      if (!ignoreSaved && widthsRef.current[key] !== undefined) continue;
      if (!ignoreSaved && lewati[key] !== undefined) continue;

      const w = autoFitWidth(key) ?? autoWidthsRef.current[key] ?? null;
      if (w != null) out[key] = w;
    }
    return out;
  }, [hideActions, labelKolom]);

  /** Terapkan AutoFit kolom non-manual, diulang satu frame lagi supaya sel
   *  yang telat dirender DSG ikut terukur (kolom Aksi paling sering telat).
   *  `isiKosong` = hanya mengisi kunci yang belum ada di `syncAutoWidths`
   *  (dipakai isi awal; penyempurnaan font/data tetap hitung ulang penuh). */
  function scheduleAutoFit(isiKosong = false) {
    let raf2 = 0;
    const terapkan = () =>
      setAutoWidths((prev) => {
        const auto = computeAutoWidths(false, isiKosong ? syncAutoWidths : {});
        const keys = Object.keys(auto);
        if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === auto[k])) return prev;
        return auto;
      });
    const raf1 = requestAnimationFrame(() => {
      terapkan();
      raf2 = requestAnimationFrame(terapkan);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }

  useEffect(() => {
    if (fittedRef.current === tableKey) return;
    if (!widthsReady || loading || rows.length === 0) return;

    let tries = 0;
    let raf = 0;
    let batal = false;
    let batalFit: (() => void) | null = null;
    const attempt = () => {
      if (batal || fittedRef.current === tableKey) return;
      const ready = !!wrapRef.current?.querySelector(
        '.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter)',
      );
      if (!ready) {
        if (++tries < 120) raf = requestAnimationFrame(attempt);
        return;
      }
      fittedRef.current = tableKey;

      batalFit = scheduleAutoFit(true);
    };
    const mulai = () => {
      if (!batal) raf = requestAnimationFrame(attempt);
    };
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(mulai).catch(mulai);
    } else {
      mulai();
    }
    return () => {
      batal = true;
      cancelAnimationFrame(raf);
      batalFit?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, widthsReady, loading, rows, fields, visibleFields]);

  useEffect(
    () => () => {
      bersihkanProbe();
    },
    [],
  );

  /** Simpan lebar ke disk (persistensi pengguna). */
  function persistWidths(next: Record<string, number>) {
    prefSet(widthsKey(tableKey), JSON.stringify(next)).catch(() => {});
  }

  /** Seret gagang tepi kanan judul untuk ubah lebar kolom.
   *  Bila beberapa kolom penuh terseleksi, semuanya diubah ke lebar sama. */
  function startResize(
    key: string,
    e: { preventDefault(): void; stopPropagation(): void; clientX: number },
  ) {
    e.preventDefault();
    e.stopPropagation();
    const f = fieldsRef.current.find((x) => x.key === key);

    const bawaan = key === '__aksi'
      ? ACTIONS_DEFAULT_W
      : syncAutoWidths[key] ?? f?.width ?? 150;
    const startW = Math.max(
      MIN_COL_W,
      widthsRef.current[key] ?? autoWidthsRef.current[key] ?? bawaan,
    );
    const group = getSelectedColumnKeys();
    const targets = group.length > 1 && group.includes(key) ? group : [key];
    resizeRef.current = { key, startX: e.clientX, startW, targets };
    setSedangLebar(true);
    const onMove = (ev: MouseEvent) => {
      const d = resizeRef.current;
      if (!d) return;

      const rasio = skalaRef?.current || 1;
      const w = Math.max(MIN_COL_W, Math.round(d.startW + (ev.clientX - d.startX) / rasio));
      setWidths((prev) => {
        const next = { ...prev };
        for (const t of d.targets) next[t] = w;
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      resizeListenersRef.current = null;
      resizeRef.current = null;
      setSedangLebar(false);
      setWidths((prev) => {
        persistWidths(prev);
        return prev;
      });
    };
    resizeListenersRef.current = { move: onMove, up: onUp };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  useEffect(
    () => () => {
      const l = resizeListenersRef.current;
      if (!l) return;
      window.removeEventListener('mousemove', l.move);
      window.removeEventListener('mouseup', l.up);
      resizeListenersRef.current = null;
    },
    [],
  );

  /** AutoFit satu kolom: klik 2× pada gagang tepi kanan judul (seperti Excel).
   *  Hasilnya TIDAK disimpan sebagai lebar pengguna: kolom dinamis (mis. Status,
   *  Aksi) berubah isi kapan saja dan harus selalu dihitung ulang. Menekan
   *  AutoFit pada kolom yang pernah diseret manual = melepas lebar manualnya. */
  function onAutoFit(key: string) {
    const w = autoFitWidth(key);
    if (w == null) return;
    setAutoWidths((prev) => ({ ...prev, [key]: w }));
    setWidths((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      persistWidths(next);
      return next;
    });
    toast.success('Lebar kolom disesuaikan dengan isi.');
  }

  /** AutoFit seluruh kolom (tombol toolbar). Sama: tidak disimpan permanen. */
  function onAutoFitAll() {
    const nextAuto: Record<string, number> = {};
    let n = 0;
    for (const key of [...visibleFieldsRef.current.map((f) => f.key), '__aksi']) {
      const w = autoFitWidth(key);
      if (w != null) {
        nextAuto[key] = w;
        n++;
      }
    }
    setAutoWidths(nextAuto);
    setWidths((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      persistWidths({});
      return {};
    });
    toast.success(n > 0 ? `${n} kolom disesuaikan lebarnya.` : 'Tidak ada kolom yang bisa disesuaikan.');
  }

  /** Kolom Aksi hanya terender saat berada di viewport (virtualisasi kolom
   *  DSG), jadi lebarnya dipaskan begitu grid digeser horizontal — selama
   *  pengguna belum pernah mengatur lebarnya sendiri. Sel yang baru muncul
   *  kadang belum ada saat event scroll tiba, jadi coba ulang beberapa frame. */
  function fitActionsIfNeeded() {
    if (hideActions) return;
    if (aksiFitRef.current || widthsRef.current.__aksi !== undefined) return;
    aksiFitRef.current = true;
    let tries = 0;
    const coba = () => {
      const w = measureActionsWidth(wrapRef.current);
      if (w != null) {
        aksiFitRef.current = false;
        setAutoWidths((prev) => (prev.__aksi === w ? prev : { ...prev, __aksi: w }));
        return;
      }
      if (++tries < 12) requestAnimationFrame(coba);
      else aksiFitRef.current = false;
    };
    requestAnimationFrame(coba);
  }

  useEffect(() => {
    if (skipFitPertamaRef.current) return;
    if (fittedRef.current !== tableKey) return;
    return scheduleAutoFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontPx, fontFamily]);

  useEffect(() => {
    if (skipFitPertamaRef.current) return;
    if (fittedRef.current !== tableKey) return;
    return scheduleAutoFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, visibleFields]);

  useEffect(() => {
    skipFitPertamaRef.current = false;
  }, []);

  /** Lebar kolom awal yang dihitung SINKRON saat render (tanpa DOM grid/font
   *  ready) memakai host pengukuran offscreen. Grid jadi bisa tampil langsung
   *  dengan lebar final — tidak ada geseran, tidak ada jeda muat tambahan.
   *  Hasil ini hanya dipakai untuk kolom yang belum punya lebar tersimpan;
   *  AutoFit DOM (saat font/data berubah) tetap boleh menyempurnakan.
   *
   *  MONOTON + IDENTITAS STABIL: hasil segar diukur dari SAMPEL halaman aktif,
   *  sehingga halaman teks panjang vs pendek akan membuat kolom berdenyut
   *  kecil-besar bila dipakai mentah. `gabungLebarMaks` memastikan kolom hanya
   *  membesar (pola Excel) dan mengembalikan objek lama bila tak ada yang
   *  berubah — memutus rantai render ulang `dsgColumns`/`tinggiBarisSatuan`/
   *  `gridRowHeight` tiap pagination. Cakupan direset per tabel+font agar
   *  perubahan font (mis. diperkecil) tetap boleh menyusutkan kolom. */
  const syncPrevRef = useRef<Record<string, number>>({});
  const syncScopeRef = useRef('');
  const syncAutoWidths = useMemo<Record<string, number>>(() => {
    const host = hostUkur();
    const cakupan = `${tableKey}|${effectiveFont}|${fontStack}|${fontStackWeight}`;
    const segarAwal = syncPrevRef.current;
    if (!host) return segarAwal;
    host.style.setProperty('--simpes-font-size', `${effectiveFont}px`);
    if (fontStack) {
      host.style.setProperty('--simpes-font-family', fontStack);
      host.style.setProperty('--simpes-font-weight', fontStackWeight || '400');
    } else {
      host.style.removeProperty('--simpes-font-family');
      host.style.removeProperty('--simpes-font-weight');
    }
    const cellEl = host.querySelector<HTMLElement>('.dsg-row:not(.dsg-row-header) .dsg-cell');
    const headCellEl = host.querySelector<HTMLElement>('.dsg-row.dsg-row-header .dsg-cell');
    const headContEl = host.querySelector<HTMLElement>('.dsg-cell-header-container');
    const cellProbe = host.querySelector<HTMLElement>('[data-ukur="cell"]');
    const headProbe = host.querySelector<HTMLElement>('[data-ukur="head"]');
    if (!cellEl || !headCellEl || !headContEl || !cellProbe || !headProbe) return segarAwal;
    const csCell = getComputedStyle(cellEl);
    const csHeadCell = getComputedStyle(headCellEl);
    const csHeadCont = getComputedStyle(headContEl);
    const pasangFont = (probe: HTMLElement, cs: CSSStyleDeclaration, ukuranPx?: number) => {
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontSize = ukuranPx != null ? `${ukuranPx}px` : cs.fontSize;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.fontStyle = cs.fontStyle;
      probe.style.fontVariantNumeric = cs.fontVariantNumeric;
      probe.style.fontFeatureSettings = cs.fontFeatureSettings;
      probe.style.letterSpacing = cs.letterSpacing;
      probe.style.whiteSpace = 'pre';
    };
    const lebar = (probe: HTMLElement, cs: CSSStyleDeclaration, text: string, ukuranPx?: number) => {
      pasangFont(probe, cs, ukuranPx);
      probe.textContent = text;
      return probe.getBoundingClientRect().width;
    };
    const padOf = (cs: CSSStyleDeclaration) =>
      (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padCell = padOf(csCell);

    const padHead = padOf(csHeadCell) + padOf(csHeadCont) + PAD_JUDUL_X;
    const out: Record<string, number> = {};

    const samples = ambilContohBaris(rows).map(
      (r) => [r, getValuesRef.current(r) as Record<string, unknown>] as const,
    );
    const cacheTeks = new Map<string, number>();
    const lebarCache = (text: string, ukuranPx?: number): number => {

      const kunci = ukuranPx != null ? `${ukuranPx}px|${text}` : text;
      const ada = cacheTeks.get(kunci);
      if (ada !== undefined) return ada;
      const hasil = lebar(cellProbe, csCell, text, ukuranPx);
      cacheTeks.set(kunci, hasil);
      return hasil;
    };

    const barisOf = (
      f: ExcelField,
      r: { id: string | number },
      nilai: Record<string, unknown>,
    ): BarisSel[] => barisSelAtauTeks(f.barisSel?.(r), teksTampilSel(f, nilai[f.key]));
    /** Lebar sel = baris TERLEBAR, bukan penjumlahan baris-barisnya. */
    const lebarSel = (b: readonly BarisSel[]): number => {
      let w = 0;
      for (const satu of b) {
        if (satu.teks === '') continue;
        w = Math.max(w, lebarCache(satu.teks, satu.ukuran));
      }
      return w;
    };
    /** Lebar sel versi kanvas (penyaring cepat): baris terlebar. */
    const cwSel = (ctx: CanvasRenderingContext2D, b: readonly BarisSel[]): number => {
      let cw = 0;
      for (const satu of b) {
        if (satu.teks === '') continue;
        ctx.font = fontKanvas(csCell, satu.ukuran);
        cw = Math.max(cw, ctx.measureText(satu.teks).width);
      }
      return cw;
    };

    const ctxKan = dapatkanKanvas();
    for (const f of visibleFields) {
      let w = lebarJudulDuaBaris(
        labelKolom(f.key, f.label),
        (text) => lebar(headProbe, csHeadCont, text),
      ) + padHead + AUTOFIT_BUFFER;
      if (ctxKan == null) {
        for (const [r, nilai] of samples) {
          const b = barisOf(f, r, nilai);
          if (b.length === 0) continue;
          w = Math.max(w, lebarSel(b) + padCell + AUTOFIT_BUFFER);
        }
      } else {
        let maksKan = -1;
        const kandidat: { b: BarisSel[]; cw: number }[] = [];
        for (const [r, nilai] of samples) {
          const b = barisOf(f, r, nilai);
          if (b.length === 0) continue;
          const cw = cwSel(ctxKan, b);
          if (cw > maksKan) maksKan = cw;
          kandidat.push({ b, cw });
        }
        for (const { b, cw } of kandidat) {
          if (cw < maksKan - 40) continue;
          w = Math.max(w, lebarSel(b) + padCell + AUTOFIT_BUFFER);
        }
      }
      out[f.key] = Math.min(AUTOFIT_MAX_W, Math.max(MIN_COL_W, Math.ceil(w)));
    }

    if (syncScopeRef.current !== cakupan) {
      syncScopeRef.current = cakupan;
      syncPrevRef.current = out;
      return out;
    }
    const stabil = gabungLebarMaks(syncPrevRef.current, out);
    syncPrevRef.current = stabil;
    return stabil;
  }, [tableKey, rows, visibleFields, effectiveFont, fontStack, fontStackWeight, labelKolom, getValuesRef]);

  const resetLebarInternal = useCallback(() => {
    setWidths({});
    prefSet(widthsKey(tableKey), '{}').catch(() => {});

    fittedRef.current = null;
    setAutoWidths(computeAutoWidths(true));
  }, [tableKey, computeAutoWidths]);

  useEffect(() => {
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey !== tableKey) return;
      writeWidthCache(tableKey, { widths: {}, autoWidths: {} });
      resetLebarInternal();
    };
    window.addEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
    return () => window.removeEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
  }, [tableKey, resetLebarInternal]);

  return {
    widths,
    sedangLebar,
    autoWidths,
    widthsReady,
    lebarStabil,
    tampilGrid,
    headerAutoH,
    syncAutoWidths,
    startResize,
    onAutoFit,
    onAutoFitAll,
    fitActionsIfNeeded,
    /** Reset bagian lebar dari "kembalikan tampilan bawaan" (ribbon):
     *  buang lebar simpanan, hitung ulang AutoFit penuh. Seleksi & toast
     *  tetap di ExcelTable (onResetView). */
    resetLebar: resetLebarInternal,
  };
}
