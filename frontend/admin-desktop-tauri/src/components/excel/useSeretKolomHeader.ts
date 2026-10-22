import { useCallback, useEffect, useRef, useState } from 'react';
import { dxPerKolom, indeksSisip, lepasSah, pindahKolom, sisipKePenuh, tandaSisip } from './seretKolom';

/** Sisi garis indikator sisip. */
export type SisiSisip = 'kiri' | 'kanan';

export interface StatusSeretKolom {
  /** Key kolom yang sedang diangkat. */
  dari: string;
  /** Indeks sisip saat ini (0..jumlah kolom). */
  sisip: number;
  /** Garis indikator: kolom acuan + sisi. */
  tanda: { indeks: number; sisi: SisiSisip } | null;
}

/** Kelas DOM garis indikator sisip (dipasang langsung, lihat `lukisIndikator`). */
const KELAS_SISIP = ['simpes-dsg-sisip-kiri', 'simpes-dsg-sisip-kanan'];
const KELAS_DISERET = 'simpes-dsg-headtitle-diserd';
/** Kelas wadah grid selama seret: menyalakan TRANSISI transform sehingga
 *  kolom yang memberi ruang bergeser mulus, bukan melompat. Hanya hidup selama
 *  seret supaya tabel tidak beranimasi pada perubahan lain (lebar kolom,
 *  pilihan preset, dsb). */
const KELAS_HIDUP = 'simpes-dsg-geser-hidup';
/** Kelas kolom yang sedang diangkat (header + sel barisnya). */
const KELAS_ANGKAT = 'simpes-dsg-angkat';

/**
 * Bersihkan semua jejak visual seret dari DOM.
 *
 * Aman dipanggil kapan pun (termasuk saat tak ada seret): hanya menyapu kelas
 * yang memang milik fitur ini, jadi tak mengganggu kelas lain.
 */
export function bersihkanIndikator(
  wrap: HTMLElement | null,
  kelasJudul = 'simpes-dsg-headtitle',
): void {
  if (!wrap) return;
  wrap.querySelectorAll<HTMLElement>(`.${kelasJudul}`).forEach((ht) => {
    ht.classList.remove(...KELAS_SISIP, KELAS_DISERET);
  });
}

/**
 * Gambar umpan balik seret langsung ke DOM: kolom yang diangkat diredupkan,
 * dan satu garis 2px menandai posisi sisip.
 *
 * Ditulis imperatif (bukan lewat prop React) karena judul header
 * react-datasheet-grid dirakit dalam `useMemo` yang tidak dihitung ulang saat
 * state seret berubah — dibuktikan lewat pengukuran di browser: state benar
 * tapi kelas dari prop tak pernah sampai ke DOM.
 */
export function lukisIndikator(
  wrap: HTMLElement | null,
  keys: readonly string[],
  dariKey: string,
  tanda: { indeks: number; sisi: SisiSisip } | null,
  kelasJudul = 'simpes-dsg-headtitle',
): void {
  if (!wrap) return;
  bersihkanIndikator(wrap, kelasJudul);
  const peta = new Map<string, HTMLElement>();
  wrap.querySelectorAll<HTMLElement>(`.dsg-row-header .${kelasJudul}`).forEach((ht) => {
    const k = ht.dataset.colKey;
    if (k) peta.set(k, ht);
  });
  peta.get(dariKey)?.classList.add(KELAS_DISERET);
  if (!tanda) return;
  const acuan = keys[tanda.indeks] ?? keys[keys.length - 1];
  const ht = acuan ? peta.get(acuan) : undefined;
  if (!ht) return;
  ht.classList.add(tanda.sisi === 'kiri' ? 'simpes-dsg-sisip-kiri' : 'simpes-dsg-sisip-kanan');
}

/** Ambang px sebelum seret dianggap serius — mencegah klik biasa
 *  (memilih/menyortir kolom) ikut tergeser karena tangan bergetar. */
const AMBANG_SERET_PX = 5;

interface Props {
  /** Urutan key kolom data yang sedang tampil (tanpa kolom Aksi). */
  terlihat: readonly string[];
  /** Wadah grid; jangkar pemasangan listener + pengukur posisi header. */
  wrapRef: React.RefObject<HTMLDivElement>;
  /** Izin dari Kelola Tabel. Saat mati, tak ada listener sama sekali —
   *  jadi perilaku klik judul lama tetap persis seperti sebelumnya. */
  aktif: boolean;
  /** Kelas penanda pembungkus judul. V1 memakai `simpes-dsg-headtitle`,
   *  V2 memakai `simpes-dsg-v2-headtitle`. */
  kelasJudul?: string;
  /** Dipanggil saat seret selesai dengan urutan BARU (hanya kolom data). */
  onPindah: (urutanBaru: string[]) => void;
}

/** Geometri baris header saat seret DIMULAI.
 *
 *  Diukur SEKALI, sebelum transform pratinjau apa pun dipasang. Bukan diukur
 *  ulang tiap gerakan: sel-sel yang sedang digeser mengubah posisi terukurnya
 *  sendiri, jadi mengukur ulang lalu memakai hasilnya sebagai \"slot tujuan\"
 *  membuat geseran menumpuk (kolom melenceng makin jauh tiap gerakan). Slot
 *  tujuan karena itu dihitung dari posisi TATA LETAK yang tetap, dan hanya
 *  digeser oleh gulir grid — `left` baris header selalu ikut isi yang digulir,
 *  jadi selisihnya cukup ditambahkan. */
interface GeometriAwal {
  /** Kiri baris header (koordinat viewport) saat seret dimulai. */
  kiriBaris: number;
  keys: string[];
  /** Indeks tiap kolom TERUKUR di DAFTAR PENUH kolom (sejajar `keys`).
   *
   *  Wajib ada karena DSG mem-`virtualize` kolom mendatar: yang terukur hanya
   *  potongan yang terlihat. Geseran kursor dinyatakan dulu sebagai indeks di
   *  dalam potongan itu, lalu diterjemahkan ke indeks daftar penuh
   *  (`sisipKePenuh`) — tanpa itu, kolom dari ujung kanan tabel meloncat ke
   *  kolom awal begitu tombol dilepas. */
  iFull: number[];
  /** Kiri TATA LETAK tiap kolom (tanpa transform), sejajar `keys`. */
  kiri: number[];
  lebar: number[];
}

/**
 * Seret judul kolom untuk menyusun ulang posisi kolom.
 *
 * PEGANGAN = SELURUH AREA JUDUL, bukan gagang khusus: pointerdown di mana pun
 * pada sel header (kecuali gagang ubah-lebar di tepinya) memulai kandidat
 * seret. Seret baru benar-benar dimulai setelah kursor bergerak melewati
 * `AMBANG_SERET_PX`, sehingga klik biasa pada judul tetap berfungsi normal.
 *
 * PENTING — kenapa listener NATIVE fase CAPTURE, bukan `onPointerDown` React:
 * react-datasheet-grid memasang listener `mousedown` di level DOKUMEN yang
 * memanggil `event.preventDefault()` untuk mengelola pemilihan sel. Efeknya
 * `pointerdown` React di dalam grid tak pernah sampai ke penanganan kita
 * (dibuktikan di browser: pointerdown nyata terjadi, tapi state seret nol).
 * Capture pada wadah berjalan lebih dulu daripada listener dokumen mana pun,
 * jadi gestur kita selalu kebaca tanpa mengganggu pemilihan sel DSG.
 *
 * Selama seret, listener `pointermove/up` dipasang di `window` (bukan elemen)
 * agar kursor yang keluar area tabel tak memutus seret. `pointercancel`/`blur`
 * ikut membersihkan supaya tak ada seret \"hantu\".
 */
export function useSeretKolomHeader({
  terlihat,
  wrapRef,
  aktif,
  kelasJudul = 'simpes-dsg-headtitle',
  onPindah,
}: Props) {
  const selectorJudul = `.${kelasJudul}`;
  const [status, setStatus] = useState<StatusSeretKolom | null>(null);
  /** Cermin terbaru untuk listener (dipasang sekali per seret). */
  const terlihatRef = useRef(terlihat);
  terlihatRef.current = terlihat;
  const onPindahRef = useRef(onPindah);
  onPindahRef.current = onPindah;
  const aktifRef = useRef(aktif);
  aktifRef.current = aktif;
  /** Bersihkan listener seret yang sedang berjalan. */
  const bersihRef = useRef<(() => void) | null>(null);
  /** Urutan PRATINJAU yang sedang tampil selama seret (null = tak ada).
   *  Dipakai saat melepas: yang ditulis ke server adalah urutan yang benar-
   *  benar terlihat terakhir, bukan hitungan ulang dari posisi kursor. */
  const pratinjauRef = useRef<string[] | null>(null);

  /**
   * Geser VISUAL seluruh kolom ke susunan pratinjau: setiap sel (header +
   * baris data) yang pindah slot diberi `transform: translateX(dx)`, sehingga
   * kolom lain kelihatan memberi ruang sambil pointer bergerak — bukan baru
   * setelah tombol dilepas.
   *
   * Ditulis langsung ke DOM (bukan prop React) dengan alasan yang sama seperti
   * indikator sisip: judul header DSG dirakit di `useMemo` yang tak selalu
   * dihitung ulang saat state seret berubah. Sel baris data dipetakan lewat
   * INDEKS anak baris — DSG merender kolom dengan urutan yang sama di header
   * dan di setiap baris — sedangkan kolom Aksi (sticky kanan) & gutter
   * dilewati karena bukan bagian dari urutan kolom data.
   */
  const lukisGeser = useCallback(
    (wrap: HTMLElement | null, dx: Record<string, number>, angkat: string) => {
      if (!wrap) return;
      const hdr = wrap.querySelector<HTMLElement>('.dsg-row-header');
      if (!hdr) return;
      const kunci = [...hdr.children].map((el) =>
        el.classList.contains('dsg-cell-sticky-right')
          ? null
          : ((el.querySelector<HTMLElement>(selectorJudul)?.dataset.colKey) ?? null),
      );
      const baris: Element[] = [hdr, ...wrap.querySelectorAll('.dsg-row:not(.dsg-row-header)')];
      for (const row of baris) {
        const anak = [...row.children];
        for (let i = 0; i < anak.length && i < kunci.length; i += 1) {
          const k = kunci[i];
          if (!k) continue;
          const sel = anak[i] as HTMLElement;
          const d = dx[k];
          sel.style.transform = d ? `translateX(${d}px)` : '';
          sel.classList.toggle(KELAS_ANGKAT, k === angkat);
        }
      }
    },
    [selectorJudul],
  );

  /** Bersihkan semua jejak geser (transform, kelas angkat, kelas transisi). */
  const bersihkanGeser = useCallback((wrap: HTMLElement | null) => {
    if (!wrap) return;
    wrap.classList.remove(KELAS_HIDUP);
    wrap.querySelectorAll<HTMLElement>('.dsg-cell').forEach((sel) => {
      sel.style.transform = '';
      sel.classList.remove(KELAS_ANGKAT);
    });
  }, []);

  /** Ukur tata letak kolom saat seret dimulai (lihat `GeometriAwal`). */
  const ukurAwal = useCallback((): GeometriAwal | null => {
    const wrap = wrapRef.current;
    const wadah = wrap?.querySelector<HTMLElement>('.dsg-row-header');
    if (!wadah) return null;
    const kotak = wadah.getBoundingClientRect();
    const peta = new Map<string, DOMRect>();
    wadah.querySelectorAll<HTMLElement>('.dsg-cell-header').forEach((sel) => {

      const key = sel.querySelector<HTMLElement>(selectorJudul)?.dataset.colKey;
      if (key) peta.set(key, sel.getBoundingClientRect());
    });
    const keys: string[] = [];
    const iFull: number[] = [];
    const kiri: number[] = [];
    const lebar: number[] = [];
    for (const k of terlihatRef.current) {
      const r = peta.get(k);
      if (!r) continue;
      keys.push(k);
      iFull.push(terlihatRef.current.indexOf(k));
      kiri.push(r.left);
      lebar.push(r.width);
    }
    return { kiriBaris: kotak.left, keys, iFull, kiri, lebar };
  }, [wrapRef, selectorJudul]);

  /** Selisih gulir grid sejak seret dimulai (baris header ikut isi yang digulir). */
  const geserGulir = useCallback(
    (awal: GeometriAwal): number => {
      const wadah = wrapRef.current?.querySelector<HTMLElement>('.dsg-row-header');
      return wadah ? wadah.getBoundingClientRect().left - awal.kiriBaris : 0;
    },
    [wrapRef],
  );

  /** Mulai kandidat seret untuk satu kolom. `x0/y0` = titik pointerdown. */
  const mulai = useCallback((key: string, x0: number, y0: number) => {

    const awal = ukurAwal();
    if (!awal || awal.keys.length === 0) return;
    const { keys: keys0, iFull, kiri: kiri0, lebar: lebar0 } = awal;
    const lebarKey: Record<string, number> = {};
    const kiriKey: Record<string, number> = {};
    keys0.forEach((k, i) => { lebarKey[k] = lebar0[i]; kiriKey[k] = kiri0[i]; });

    const penuh = [...terlihatRef.current];
    const asalPenuh = penuh.indexOf(key);
    if (asalPenuh < 0) return;
    /** Slot = posisi tata letak kolom (tetap sepanjang seret; hanya bergeser
     *  bila grid digulir horizontal). */
    const slot = [...kiri0];
    const lebarTotal = lebar0.reduce((a, b) => a + b, 0);
    let jalan = false;

    const geser = (e: { clientX: number; clientY: number; preventDefault(): void }) => {
      if (!jalan) {
        if (Math.abs(e.clientX - x0) < AMBANG_SERET_PX && Math.abs(e.clientY - y0) < AMBANG_SERET_PX) return;
        jalan = true;
      }
      const wrap = wrapRef.current;

      const x = e.clientX - geserGulir(awal);
      const dari = pratinjauRef.current ?? penuh;

      const terukur = dari.filter((k) => lebarKey[k] !== undefined);
      const sisipLokal = indeksSisip(slot, terukur.map((k) => lebarKey[k] ?? 0), x);
      const sisip = sisipKePenuh(iFull, sisipLokal);
      const tanda = tandaSisip(dari.length, sisip);
      setStatus({ dari: key, sisip, tanda });
      const baru = pindahKolom(penuh, asalPenuh, sisip);
      if (!baru.every((k, i) => k === dari[i])) {
        wrap?.classList.add(KELAS_HIDUP);
        lukisGeser(wrap, dxPerKolom(kiriKey, lebarKey, baru), key);
        pratinjauRef.current = baru;
      }

      lukisIndikator(wrap, terukur, key, tandaSisip(terukur.length, sisipLokal), kelasJudul);
      e.preventDefault();
    };

    /** True bila titik lepas masih berada di jalur header tabel (kolom mana pun)
     *  secara VERTIKAL, dan tak jauh di luar tepi kiri/kanan.
     *
     *  Tanpa gerbang ini, melepas kursor di bilah toolbar atas atau di luar
     *  tabel tetap \"menempel\" ke kolom pada `clientX` terakhir — pengguna
     *  melihat kolom pindah ke posisi yang tak pernah ia tuju.
     *  Lihat `lepasSah` di `seretKolom.ts` untuk aturan lengkapnya; rentang
     *  mendatar diambil dari kolom yang diukur saat seret dimulai (transform
     *  pratinjau tak boleh ikut terhitung). */
    const lepasMasihSah = (e: { clientX: number; clientY: number }): boolean => {
      const wadah = wrapRef.current?.querySelector<HTMLElement>('.dsg-row-header');
      const kotak = wadah ? wadah.getBoundingClientRect() : null;
      const geser = kotak ? kotak.left - awal.kiriBaris : 0;
      return lepasSah(kotak, [kiri0[0] + geser], [lebarTotal], e.clientX, e.clientY);
    };

    const lepas = (e: { clientX: number; clientY: number }) => {
      bersih();
      bersihkanIndikator(wrapRef.current, kelasJudul);
      const pratinjau = pratinjauRef.current;
      pratinjauRef.current = null;

      bersihkanGeser(wrapRef.current);
      setStatus(null);

      if (!jalan || !lepasMasihSah(e)) return;

      const baru = pratinjau ?? penuh;

      if (baru.every((k, i) => k === terlihatRef.current[i])) return;
      onPindahRef.current([...baru]);
    };

    /** Batalkan seret tanpa menulis apa pun (Esc, pointercancel, blur). */
    const batal = () => {
      bersih();
      setStatus(null);
      bersihkanIndikator(wrapRef.current, kelasJudul);
      pratinjauRef.current = null;
      bersihkanGeser(wrapRef.current);
    };

    const tombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') batal();
    };

    function bersih() {
      window.removeEventListener('pointermove', geser, true);
      window.removeEventListener('pointerup', lepas, true);
      window.removeEventListener('mousemove', geserMouse, true);
      window.removeEventListener('mouseup', lepasMouse, true);
      window.removeEventListener('pointercancel', batal, true);
      window.removeEventListener('blur', batal);
      window.removeEventListener('keydown', tombol, true);
      bersihRef.current = null;
    }

    let terakhir = 0;
    const sekaliPerGerak = <T,>(fn: (e: T) => void) => (e: T & { timeStamp: number }) => {
      const t = e.timeStamp || Date.now();
      if (t === terakhir) return;
      terakhir = t;
      fn(e);
    };
    const geserMouse = sekaliPerGerak(geser);
    const lepasMouse = sekaliPerGerak(lepas);

    bersihRef.current?.();
    bersihRef.current = bersih;
    window.addEventListener('pointermove', geser, true);
    window.addEventListener('pointerup', lepas, true);
    window.addEventListener('mousemove', geserMouse, true);
    window.addEventListener('mouseup', lepasMouse, true);
    window.addEventListener('pointercancel', batal, true);
    window.addEventListener('blur', batal);
    window.addEventListener('keydown', tombol, true);
  }, [geserGulir, lukisGeser, bersihkanGeser, ukurAwal, wrapRef, kelasJudul]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !aktif) return;

    const turun = (e: PointerEvent) => {
      if (!aktifRef.current || e.button !== 0) return;
      const target = e.target as HTMLElement | null;

      if (target?.closest('.simpes-dsg-resizer')) return;
      if (target?.closest('[data-gagang-lebar]')) return;
      const ht = target?.closest<HTMLElement>(selectorJudul);
      const key = ht?.dataset.colKey;
      if (!key) return;

      if (!ht.closest('.dsg-row-header')) return;
      mulai(key, e.clientX, e.clientY);
    };

    const tahan = (e: MouseEvent) => {
      if (!aktifRef.current || e.button !== 0 || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.simpes-dsg-resizer')) return;
      if (target?.closest('[data-gagang-lebar]')) return;
      const ht = target?.closest<HTMLElement>(selectorJudul);
      if (!ht?.closest('.dsg-row-header')) return;
      e.preventDefault();
      e.stopPropagation();
    };

    wrap.addEventListener('pointerdown', turun, true);
    wrap.addEventListener('mousedown', tahan, true);
    return () => {
      wrap.removeEventListener('pointerdown', turun, true);
      wrap.removeEventListener('mousedown', tahan, true);
    };
  }, [aktif, mulai, wrapRef, selectorJudul]);

  useEffect(() => () => {
    bersihRef.current?.();

    bersihkanGeser(wrapRef.current);
    pratinjauRef.current = null;
  }, [bersihkanGeser, wrapRef]);

  return { status, mulai };
}
