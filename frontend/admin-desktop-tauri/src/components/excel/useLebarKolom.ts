import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { prefSet } from '@/api/client';
import { type KamusKolomAttr } from '@/api/kamusLabel';
import { DEFAULT_HEADER_H, MAX_HEADER_H } from '@/components/GridPrefs';
import { type TampilanData } from '@/api/tampilan';
import { toast } from 'sonner';

import { lebarJudulDuaBaris, ukurAutoFit } from './autofit';
import {
  AUTOFIT_BUFFER,
  AUTOFIT_MAX_W,
  CHECK_W,
  MIN_COL_W,
  hostUkur,
  loadWidths,
  readWidthCache,
  teksTampilSel,
  widthsKey,
  writeWidthCache,
} from './helpers';
import { LEBAR_GAGANG_GESER, ukurPerluTinggiHeader } from './header';
import { measureActionsWidth, bersihkanProbe } from './measure';
import type { ExcelField, GridRow } from './types';

/** Ref mutable yang selalu terisi (dipakai untuk cermin nilai terbaru). */
interface LiveRef<T> {
  current: T;
}

/** Potongan state standar tampilan yang dipakai pengelolaan lebar. */
export interface StdLebarApi {
  tampilan: TampilanData | null;
  isPribadi: (key: string) => boolean;
  tandai: (...keys: string[]) => void;
  hapus: (...keys: string[]) => void;
  merekam: boolean;
  simpanKeStandar: (patch: TampilanData) => void;
}

export interface LebarKolomOptions<T extends { id: string | number }> {
  tableKey: string;
  fields: ExcelField[];
  fieldsRef: LiveRef<ExcelField[]>;
  rows: T[];
  rowsRef: LiveRef<T[]>;
  /** Petakan baris domain → nilai grid (dibaca terkini saat mengukur). */
  getValuesRef: LiveRef<(row: T) => Record<string, string | null>>;
  /** Baris grid aktif per id (untuk teks sel saat AutoFit DOM). */
  gridByIdRef: LiveRef<Map<string, GridRow>>;
  visibleFields: ExcelField[];
  /** Elemen pembungkus grid (pengukuran AutoFit DOM & tinggi header). */
  wrapRef: RefObject<HTMLDivElement | null>;
  /** Key kolom grid terseleksi (resize multi-kolom saat blok terseleksi). */
  getSelectedColumnKeys: () => string[];
  attrByKey: Map<string, KamusKolomAttr>;
  labelKolom: (key: string, bawaan: string) => string;
  bolehGeser: boolean;
  hideActions: boolean;
  hideCheckbox: boolean;
  loading: boolean;
  standar: StdLebarApi;
  headerH: number | null;
  fontPx: number | null;
  fontFamily: string;
  effectiveFont: number;
  fontStack: string;
  fontStackWeight: string;
}

/**
 * Manajemen lebar kolom untuk ExcelTable: lebar tersimpan pengguna (widths) +
 * AutoFit (autoWidths), persistensi disk + cache sesi, penahan `lebarStabil`
 * (sembunyikan grid sampai DSG memakai lebar basis), seret gagang (multi-kolom
 * saat blok terseleksi), AutoFit DOM & sinkron (host offscreen), lebar kolom
 * Aksi, dan tinggi header otomatis. Semua fungsi sengaja dibuat ulang tiap
 * render (bukan useCallback) — semantik sama dengan kode asli di ExcelTable.
 */
export function useLebarKolom<T extends { id: string | number }>({
  tableKey,
  fields,
  fieldsRef,
  rows,
  rowsRef,
  getValuesRef,
  gridByIdRef,
  visibleFields,
  wrapRef,
  getSelectedColumnKeys,
  attrByKey,
  labelKolom,
  bolehGeser,
  hideActions,
  hideCheckbox,
  loading,
  standar: { tampilan: standarTampilan, isPribadi, tandai, hapus, merekam, simpanKeStandar },
  headerH,
  fontPx,
  fontFamily,
  effectiveFont,
  fontStack,
  fontStackWeight,
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
  /** Tinggi header otomatis (konten-driven) — dari judul terpanjang yang
   *  membungkus; dipakai bila pengguna tidak mengunci tinggi manual. */
  const [headerAutoH, setHeaderAutoH] = useState<number | null>(null);
  /** Lewati AutoFit pada commit pertama: cache sudah memuat lebar final. */
  const skipFitPertamaRef = useRef(!!cacheHit);
  const fittedRef = useRef<string | null>(cacheHit ? tableKey : null);
  /** Sedang mencoba mengukur kolom Aksi yang baru ter-render (hindari loop ganda). */
  const aksiFitRef = useRef(false);
  const resizeRef = useRef<{ key: string; startX: number; startW: number; targets: string[] } | null>(null);
  /** Listener resize aktif (dibersihkan saat unmount bila masih menyeret). */
  const resizeListenersRef = useRef<{ move: (ev: MouseEvent) => void; up: () => void } | null>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Standar lembaga untuk tabel ini (diabaikan bila user menyesuaikan sendiri).
  const stdLebar = merekam
    ? (standarTampilan?.lebar?.[tableKey] ?? undefined)
    : (isPribadi(`lebar.${tableKey}`) ? undefined : standarTampilan?.lebar?.[tableKey] ?? undefined);

  // Muat lebar dari disk (dilewati bila cache sesi sudah ada).
  useEffect(() => {
    // Cache sesi: lebar sudah final, tidak perlu muat dari disk (menghindari
    // render perantara yang menggeser kolom).
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

  // Simpan lebar terbaru ke cache sesi (dipakai kunjungan ulang).
  useEffect(() => {
    writeWidthCache(tableKey, { widths });
  }, [tableKey, widths]);
  useEffect(() => {
    writeWidthCache(tableKey, { autoWidths });
  }, [tableKey, autoWidths]);

  // Tampilkan grid setelah DSG benar-benar memakai lebar basis kita. Pada frame
  // pertama DSG merender semua kolom 100px (bawaan) sebelum basis kita dipakai —
  // tanpa penahan ini header tampak "melompat". Kolom pertama (checkbox) selalu
  // CHECK_W, jadi kita tunggu sampai lebarnya bukan lagi 100 (bawaan DSG).
  useEffect(() => {
    if (lebarStabil) return;
    // Tanpa kolom centang tak ada penanda lebar basis pertama → tunggu lebar
    // basis kolom data siap, lalu tampilkan.
    if (hideCheckbox) {
      if (widthsReady && !loading) setLebarStabil(true);
      return;
    }
    if (!widthsReady || loading) return;
    if (rows.length === 0) {
      setLebarStabil(true);
      return;
    }
    let tries = 0;
    let raf = 0;
    let batal = false;
    const cek = () => {
      if (batal) return;
      const head = wrapRef.current?.querySelector<HTMLElement>(
        '.dsg-row-header .dsg-cell:not(.dsg-cell-gutter)',
      );
      const w = head ? Math.round(head.getBoundingClientRect().width) : 0;
      if (Math.abs(w - CHECK_W) <= 1 || ++tries > 20) {
        setLebarStabil(true);
        return;
      }
      raf = requestAnimationFrame(cek);
    };
    raf = requestAnimationFrame(cek);
    return () => {
      batal = true;
      cancelAnimationFrame(raf);
    };
  }, [lebarStabil, widthsReady, loading, rows.length, tableKey, hideCheckbox, wrapRef]);

  useEffect(() => {
    const t = setTimeout(() => setLebarStabil(true), 1500);
    return () => clearTimeout(t);
  }, [tableKey]);

  // Ukur lebar kolom Aksi dari tombol yang benar-benar dirender SEBELUM cat
  // (useLayoutEffect). Kolom teks sudah final dari syncAutoWidths; hanya Aksi
  // yang tak bisa dihitung sinkron karena jumlah/isi tombol bergantung data.
  useLayoutEffect(() => {
    if (hideActions) return;
    if (widthsRef.current.__aksi !== undefined) return;
    const w = measureActionsWidth(wrapRef.current);
    if (w == null) return;
    setAutoWidths((prev) => (prev.__aksi === w ? prev : { ...prev, __aksi: w }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lebarStabil, rows, fields, visibleFields]);

  // Tinggi header otomatis: judul yang membungkus beberapa baris butuh baris
  // header lebih tinggi agar tidak meluber. Manual (pref headerH) menang;
  // observer memantau perubahan lebar kolom/font yang mengubah jumlah baris.
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
      teksSel: (f, rowId, k) =>
        teksTampilSel(f, gridByIdRef.current.get(String(rowId))?.[k], attrByKey.get(k)?.format),
      dapatkanCtx: () => (measureCtxRef.current ??= document.createElement('canvas').getContext('2d')),
    });
  }

  /** AutoFit semua kolom yang belum punya lebar tersimpan (muat awal).
   *  `ignoreSaved = true` untuk reset: lebar simpanan baru dibuang, jadi
   *  semua kolom dihitung ulang. */
  function computeAutoWidths(ignoreSaved = false): Record<string, number> {
    const out: Record<string, number> = {};
    const keys = [
      ...visibleFieldsRef.current.map((f) => f.key),
      ...(hideActions ? [] : ['__aksi']),
    ];
    for (const key of keys) {
      if (!ignoreSaved && widthsRef.current[key] !== undefined) continue;
      // Bila pengukuran gagal sesaat (sel aksi/teks belum dirender virtualisasi),
      // pertahankan hasil ukur terakhir — lebih baik daripada jatuh ke lebar bawaan.
      const w = autoFitWidth(key) ?? autoWidthsRef.current[key] ?? null;
      if (w != null) out[key] = w;
    }
    return out;
  }

  /** Terapkan AutoFit kolom non-manual, diulang satu frame lagi supaya sel
   *  yang telat dirender DSG ikut terukur (kolom Aksi paling sering telat). */
  function scheduleAutoFit() {
    let raf2 = 0;
    const terapkan = () =>
      setAutoWidths((prev) => {
        const auto = computeAutoWidths();
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

  // Muat awal: kolom yang belum punya lebar tersimpan disesuaikan dengan isi
  // (judul dipakai bila lebih panjang dari data). Menunggu widthsReady supaya
  // tidak menimpa sesaat lebar simpanan pengguna yang sedang dibaca, dan
  // menunggu font selesai dimuat agar pengukuran teks akurat.
  useEffect(() => {
    if (fittedRef.current === tableKey) return;
    if (!widthsReady || loading || rows.length === 0) return;
    // Virtualizer DSG baru merender baris setelah mengukur wadah, jadi tunggu
    // sampai sel data benar-benar ada di DOM sebelum mengukur teks.
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
      // Lebar sudah tampil dari syncAutoWidths; AutoFit DOM di sini hanya
      // menyempurnakan kolom (mis. Aksi) tanpa menahan tampilnya grid.
      batalFit = scheduleAutoFit();
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

  // Bersihkan span pengukur teks saat tabel dilepas.
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
    const startW = widthsRef.current[key] ?? autoWidthsRef.current[key] ?? f?.width ?? 150;
    const group = getSelectedColumnKeys();
    const targets = group.length > 1 && group.includes(key) ? group : [key];
    resizeRef.current = { key, startX: e.clientX, startW, targets };
    const onMove = (ev: MouseEvent) => {
      const d = resizeRef.current;
      if (!d) return;
      const w = Math.max(MIN_COL_W, Math.round(d.startW + (ev.clientX - d.startX)));
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
      if (merekam) {
        // Bertindak sebagai lembaga → lebar kolom disimpan ke standar lembaga.
        const map = { ...(stdLebar ?? {}), ...widthsRef.current };
        hapus(`lebar.${tableKey}`);
        simpanKeStandar({ lebar: { [tableKey]: map } });
        setWidths({});
        prefSet(widthsKey(tableKey), '{}').catch(() => {});
        return;
      }
      setWidths((prev) => {
        persistWidths(prev);
        return prev;
      });
      tandai(`lebar.${tableKey}`);
    };
    resizeListenersRef.current = { move: onMove, up: onUp };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Unmount saat masih menyeret gagang → lepas listener agar tidak bocor.
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
    if (merekam) {
      // Bertindak sebagai lembaga → lepas lebar kolom itu dari standar lembaga.
      const map = { ...(stdLebar ?? {}) };
      delete map[key];
      hapus(`lebar.${tableKey}`);
      simpanKeStandar({
        lebar: { [tableKey]: Object.keys(map).length > 0 ? map : null },
      });
      setWidths({});
      prefSet(widthsKey(tableKey), '{}').catch(() => {});
      toast.success('Lebar kolom disesuaikan dengan isi.');
      return;
    }
    setWidths((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      persistWidths(next);
      return next;
    });
    // AutoFit = user menentukan lebar sendiri → lepas dari standar lembaga.
    tandai(`lebar.${tableKey}`);
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
    if (merekam) {
      hapus(`lebar.${tableKey}`);
      simpanKeStandar({ lebar: { [tableKey]: null } });
      setWidths({});
      prefSet(widthsKey(tableKey), '{}').catch(() => {});
      toast.success(n > 0 ? `${n} kolom disesuaikan lebarnya.` : 'Tidak ada kolom yang bisa disesuaikan.');
      return;
    }
    setWidths((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      persistWidths({});
      return {};
    });
    tandai(`lebar.${tableKey}`);
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

  // Ukuran/jenis huruf berubah → teks butuh lebar baru: hitung ulang AutoFit
  // (lebar yang sudah diatur pengguna tetap dipertahankan).
  useEffect(() => {
    if (skipFitPertamaRef.current) return;
    if (fittedRef.current !== tableKey) return;
    return scheduleAutoFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontPx, fontFamily]);

  // Data berubah (ganti kegiatan/filter/muat ulang) → sesuaikan ulang lebar
  // kolom yang belum diatur pengguna.
  useEffect(() => {
    if (skipFitPertamaRef.current) return;
    if (fittedRef.current !== tableKey) return;
    return scheduleAutoFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fields, visibleFields]);

  // Setelah commit pertama, AutoFit kembali normal (perubahan berikutnya —
  // huruf/data/filter — boleh menyesuaikan lebar). Efek ini SENGAJA ditaruh
  // setelah efek AutoFit agar urutan mount tidak melewati penjagaan cache.
  useEffect(() => {
    skipFitPertamaRef.current = false;
  }, []);

  /** Lebar kolom awal yang dihitung SINKRON saat render (tanpa DOM grid/font
   *  ready) memakai host pengukuran offscreen. Grid jadi bisa tampil langsung
   *  dengan lebar final — tidak ada geseran, tidak ada jeda muat tambahan.
   *  Hasil ini hanya dipakai untuk kolom yang belum punya lebar tersimpan;
   *  AutoFit DOM (saat font/data berubah) tetap boleh menyempurnakan. */
  const syncAutoWidths = useMemo<Record<string, number>>(() => {
    const host = hostUkur();
    if (!host) return {};
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
    if (!cellEl || !headCellEl || !headContEl || !cellProbe || !headProbe) return {};
    const csCell = getComputedStyle(cellEl);
    const csHeadCell = getComputedStyle(headCellEl);
    const csHeadCont = getComputedStyle(headContEl);
    const pasangFont = (probe: HTMLElement, cs: CSSStyleDeclaration) => {
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontSize = cs.fontSize;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.fontStyle = cs.fontStyle;
      probe.style.fontVariantNumeric = cs.fontVariantNumeric;
      probe.style.fontFeatureSettings = cs.fontFeatureSettings;
      probe.style.letterSpacing = cs.letterSpacing;
      probe.style.whiteSpace = 'pre';
    };
    const lebar = (probe: HTMLElement, cs: CSSStyleDeclaration, text: string) => {
      pasangFont(probe, cs);
      probe.textContent = text;
      return probe.getBoundingClientRect().width;
    };
    const padOf = (cs: CSSStyleDeclaration) =>
      (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padCell = padOf(csCell);
    const padHead = padOf(csHeadCell) + padOf(csHeadCont);
    const out: Record<string, number> = {};
    const values = rows.map((r) => getValuesRef.current(r) as Record<string, unknown>);
    for (const f of visibleFields) {
      // Gagang geser (super_admin) memakan ruang judul: hitung dalam AutoFit
      // agar judul 1–2 baris tak terpotong/terbungkus sia-sia.
      let w = lebarJudulDuaBaris(
        labelKolom(f.key, f.label),
        (text) => lebar(headProbe, csHeadCont, text),
      ) + padHead + AUTOFIT_BUFFER + (bolehGeser ? LEBAR_GAGANG_GESER : 0);
      for (const v of values) {
        const s = teksTampilSel(f, v[f.key], attrByKey.get(f.key)?.format);
        if (!s) continue;
        w = Math.max(w, lebar(cellProbe, csCell, s) + padCell + AUTOFIT_BUFFER);
      }
      out[f.key] = Math.min(AUTOFIT_MAX_W, Math.max(MIN_COL_W, Math.ceil(w)));
    }
    return out;
  }, [rows, visibleFields, effectiveFont, fontStack, fontStackWeight, labelKolom, attrByKey, bolehGeser, getValuesRef]);

  /** Reset bagian lebar dari "kembalikan tampilan bawaan" (ribbon): buang
   *  lebar simpanan, hitung ulang AutoFit penuh. Seleksi & toast tetap di
   *  ExcelTable (onResetView). */
  function resetLebar() {
    setWidths({});
    prefSet(widthsKey(tableKey), '{}').catch(() => {});
    // Kembali ke standar/bawaan = lebar menyesuaikan isi (dihitung ulang).
    hapus(`lebar.${tableKey}`);
    if (merekam) simpanKeStandar({ lebar: { [tableKey]: null } });
    fittedRef.current = null;
    setAutoWidths(computeAutoWidths(true));
  }

  return {
    widths,
    autoWidths,
    widthsReady,
    lebarStabil,
    headerAutoH,
    stdLebar,
    syncAutoWidths,
    startResize,
    onAutoFit,
    onAutoFitAll,
    fitActionsIfNeeded,
    resetLebar,
  };
}
