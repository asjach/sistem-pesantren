import { useCallback, useEffect, useRef, useState } from 'react';
import { indeksSisip, pindahKolom, tandaSisip } from './seretKolom';

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

/**
 * Bersihkan semua jejak visual seret dari DOM.
 *
 * Aman dipanggil kapan pun (termasuk saat tak ada seret): hanya menyapu kelas
 * yang memang milik fitur ini, jadi tak mengganggu kelas lain.
 */
export function bersihkanIndikator(wrap: HTMLElement | null): void {
  if (!wrap) return;
  wrap.querySelectorAll<HTMLElement>('.simpes-dsg-headtitle').forEach((ht) => {
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
): void {
  if (!wrap) return;
  bersihkanIndikator(wrap);
  const peta = new Map<string, HTMLElement>();
  wrap.querySelectorAll<HTMLElement>('.dsg-row-header .simpes-dsg-headtitle').forEach((ht) => {
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
  /** Dipanggil saat seret selesai dengan urutan BARU (hanya kolom data). */
  onPindah: (urutanBaru: string[]) => void;
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
 * Posisi sel header dibaca dari DOM (`data-col-key` pada `.simpes-dsg-headtitle`
 * di dalam `.dsg-row-header .dsg-cell`), supaya tetap benar walau kolom beku
 * membuat susunan visual berbeda dari urutan logis.
 *
 * Selama seret, listener `pointermove/up` dipasang di `window` (bukan elemen)
 * agar kursor yang keluar area tabel tak memutus seret. `pointercancel`/`blur`
 * ikut membersihkan supaya tak ada seret "hantu".
 */
export function useSeretKolomHeader({ terlihat, wrapRef, aktif, onPindah }: Props) {
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

  /** Ukur batas/lebar tiap sel header data, sejajar urutan `terlihat`. */
  const ukurKolom = useCallback((): { batas: number[]; lebar: number[]; keys: string[] } => {
    const wrap = wrapRef.current;
    if (!wrap) return { batas: [], lebar: [], keys: [] };
    const wadah = wrap.querySelector('.dsg-row-header');
    if (!wadah) return { batas: [], lebar: [], keys: [] };
    const peta = new Map<string, DOMRect>();
    wadah.querySelectorAll<HTMLElement>('.dsg-cell-header').forEach((sel) => {
      const ht = sel.querySelector<HTMLElement>('.simpes-dsg-headtitle');
      const key = ht?.dataset.colKey;
      // Kolom Aksi & sel tanpa key (mis. gutter) tidak ikut disusun.
      if (key) peta.set(key, sel.getBoundingClientRect());
    });
    const batas: number[] = [];
    const lebar: number[] = [];
    const keys: string[] = [];
    for (const k of terlihatRef.current) {
      const r = peta.get(k);
      if (!r) continue;
      batas.push(r.left);
      lebar.push(r.width);
      keys.push(k);
    }
    return { batas, lebar, keys };
  }, [wrapRef]);

  /** Mulai kandidat seret untuk satu kolom. `x0/y0` = titik pointerdown. */
  const mulai = useCallback((key: string, x0: number, y0: number) => {
    let jalan = false;

    const hitung = (x: number) => {
      const { batas, lebar } = ukurKolom();
      const sisip = indeksSisip(batas, lebar, x);
      return { sisip, tanda: tandaSisip(lebar.length, sisip) };
    };

    const geser = (e: { clientX: number; clientY: number; preventDefault(): void }) => {
      if (!jalan) {
        if (Math.abs(e.clientX - x0) < AMBANG_SERET_PX && Math.abs(e.clientY - y0) < AMBANG_SERET_PX) return;
        jalan = true;
      }
      const { sisip, tanda } = hitung(e.clientX);
      setStatus({ dari: key, sisip, tanda });
      /* Indikator digambar LANGSUNG ke DOM, bukan lewat prop React: judul
         header react-datasheet-grid dirakit di dalam useMemo yang terbukti
         tidak selalu dihitung ulang saat state seret berubah, sehingga kelas
         dari prop tak pernah muncul. Menulis kelas di sini selalu bekerja
         dan memang tepat untuk umpan balik sesaat. */
      lukisIndikator(wrapRef.current, terlihatRef.current, key, tanda);
      e.preventDefault();
    };

    const lepas = (e: { clientX: number }) => {
      bersih();
      bersihkanIndikator(wrapRef.current);
      if (!jalan) return;
      const { keys } = ukurKolom();
      const { sisip } = hitung(e.clientX);
      setStatus(null);
      const dari = keys.indexOf(key);
      if (dari < 0) return;
      const baru = pindahKolom(terlihatRef.current, dari, sisip);
      // Tak ada perubahan nyata → jangan tulis apa pun ke server.
      if (baru.every((k, i) => k === terlihatRef.current[i])) return;
      onPindahRef.current(baru);
    };

    const batal = () => { bersih(); setStatus(null); bersihkanIndikator(wrapRef.current); };

    function bersih() {
      window.removeEventListener('pointermove', geser, true);
      window.removeEventListener('pointerup', lepas, true);
      window.removeEventListener('mousemove', geserMouse, true);
      window.removeEventListener('mouseup', lepasMouse, true);
      window.removeEventListener('pointercancel', batal, true);
      window.removeEventListener('blur', batal);
      bersihRef.current = null;
    }

    /* react-datasheet-grid memanggil preventDefault() pada mousedown dokumen.
       Akibatnya event POINTER lanjutan tak selalu sampai ke window (terbukti
       di browser: pointermove nol). Karena itu kami memasang listener di fase
       CAPTURE dan menambahkan jalur MOUSE sebagai cadangan yang selalu
       terkirim. `terakhir` mencegah satu gerakan dihitung dua kali. */
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
  }, [ukurKolom, wrapRef]);

  /* Pemasangan listener native fase CAPTURE pada wadah grid. Dipasang ulang
     saat sakelar berubah supaya mati-benar-benar-mati. */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !aktif) return;

    const turun = (e: PointerEvent) => {
      if (!aktifRef.current || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      // Gagang ubah-lebar punya urusannya sendiri.
      if (target?.closest('.simpes-dsg-resizer')) return;
      const ht = target?.closest<HTMLElement>('.simpes-dsg-headtitle');
      const key = ht?.dataset.colKey;
      if (!key) return;
      // Hanya header (bukan judul di sembarang tempat).
      if (!ht.closest('.dsg-row-header')) return;
      mulai(key, e.clientX, e.clientY);
    };

    wrap.addEventListener('pointerdown', turun, true);
    return () => wrap.removeEventListener('pointerdown', turun, true);
  }, [aktif, mulai, wrapRef]);

  useEffect(() => () => { bersihRef.current?.(); }, []);

  return { status, mulai };
}
