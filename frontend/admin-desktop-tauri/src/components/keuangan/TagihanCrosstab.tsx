import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { CrosstabBaris, CrosstabKolom, CrosstabSel, CrosstabTagihan } from '../../api/keuangan';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Label kolom: bulan untuk jenis bulanan, kode TA untuk non-bulanan. */
export function labelKolom(k: CrosstabKolom): string {
  if (k.tipe === 'bulanan' && k.periode !== null && k.periode.length >= 7) {
    return BULAN[Number(k.periode.slice(5, 7)) - 1] ?? k.periode;
  }
  return k.periode ?? 'Tagihan';
}

/** Ringkasan sel untuk judul/actions: "Infaq Bulanan · Jul 2025". */
export function labelSel(k: CrosstabKolom): string {
  if (k.tipe === 'bulanan' && k.periode !== null && k.periode.length >= 7) {
    return `${k.jenis_nama} · ${BULAN[Number(k.periode.slice(5, 7)) - 1] ?? ''} ${k.periode.slice(0, 4)}`;
  }
  return `${k.jenis_nama} · ${k.periode ?? 'sekali'}`;
}

interface Props {
  data: CrosstabTagihan | null;
  loading: boolean;
  /** Id tagihan sel yang sedang aktif (dilingkasi di tabel). */
  terpilihId: number | null;
  /** Sel diklik (kiri maupun kanan) → halaman membuka popover aksi pada sel itu.
   *  `anchor` = elemen sel, dipakai sebagai jangkar popover. */
  onPilih: (
    sel: CrosstabSel,
    meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => void;
  emptyText: string;
}

interface GrupKolom {
  jenisId: number;
  jenisNama: string;
  kolom: CrosstabKolom[];
}

/** Kelompokkan kolom berurutan per jenis (untuk header dua tingkat). */
function grupKolom(kolom: CrosstabKolom[]): GrupKolom[] {
  const grup: GrupKolom[] = [];
  for (const k of kolom) {
    const terakhir = grup[grup.length - 1];
    if (terakhir && terakhir.jenisId === k.jenis_id) {
      terakhir.kolom.push(k);
    } else {
      grup.push({ jenisId: k.jenis_id, jenisNama: k.jenis_nama, kolom: [k] });
    }
  }
  return grup;
}

/**
 * Warna sel menurut status tunggakan:
 * - lunas → hijau
 * - terlambat (lewat jatuh tempo) → merah / amber
 * - belum jatuh tempo → sengaja dibuat SAMAR: belum jadi hutang, jadi tidak
 *   perlu bersaing dengan sel tunggakan dalam menarik perhatian.
 */
function kelasSel(sel: CrosstabSel): string {
  if (sel.status === 'lunas') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  }
  if (sel.status === 'sebagian') {
    return sel.terlambat
      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
      : 'bg-amber-500/5 text-amber-700/45 dark:text-amber-300/45';
  }

  return sel.terlambat
    ? 'bg-destructive/10 text-destructive'
    : 'bg-muted/20 text-muted-foreground/50';
}

/** "Juli 2025" dari periode bulanan 'YYYY-MM'. */
function periodePanjang(periode: string): string {
  const [y, b] = periode.split('-');
  return `${BULAN[Number(b) - 1] ?? b} ${y}`;
}

/** Data satu sel yang ditampilkan di kartu hover. */
interface TooltipSel {
  nama: string;
  jenisNama: string;
  tipe: CrosstabKolom['tipe'];
  periode: string | null;
  nominal: number;
  terbayar: number;
  sisa: number;
}

const LEBAR_TOOLTIP = 224;
const TINGGI_TOOLTIP = 200;
/** Jarak tooltip dari kursor (x, y) — dipakai juga sebagai posisi awal render. */
const JARAK_X = 12;
const JARAK_Y = 18;

/**
 * Letak tooltip. Ditulis langsung ke DOM (bukan state) — posisi mengikuti
 * kursor pada tiap frame mouse; lewat state akan merender ulang seluruh
 * tabel (ratusan sel) tiap gerakan dan terasa berat.
 */
function NeedleLetak(el: HTMLElement | null, x: number, y: number): void {
  if (el === null) return;
  el.style.left = `${Math.max(8, Math.min(x + JARAK_X, window.innerWidth - LEBAR_TOOLTIP - 8))}px`;
  el.style.top = `${Math.max(8, y + TINGGI_TOOLTIP > window.innerHeight ? y - TINGGI_TOOLTIP : y + JARAK_Y)}px`;
}

/** Satu baris tabel. `memo` + props stabil → saat tooltip berpindah sel, hanya
 *  baris yang di-hover yang dirender ulang, bukan seluruh tabel (ratusan sel). */
const BarisCrosstab = memo(function BarisCrosstab({
  baris, kolom, onPilih, onHoverMasuk, onHoverGerak, onHoverKeluar,
}: {
  baris: CrosstabBaris;
  kolom: CrosstabKolom[];
  onPilih: (
    sel: CrosstabSel,
    meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => void;
  onHoverMasuk: (isi: TooltipSel, anchor: HTMLElement) => void;
  onHoverGerak: (isi: TooltipSel, e: React.MouseEvent<HTMLElement>) => void;
  onHoverKeluar: () => void;
}) {
  return (
    <tr>
      <th scope="row" className="sticky left-0 z-10 max-w-56 border-b border-r bg-card py-0.5 pl-3 pr-0.5 text-left font-normal">
        <span className="block truncate font-medium">{baris.nama}</span>
      </th>
      {kolom.map((k) => {
        const sel = baris.sel[k.key];
        if (!sel) {
          return <td key={k.key} className="border-b border-r p-0.5 text-center text-muted-foreground/40">·</td>;
        }
        const isiTooltip: TooltipSel = {
          nama: baris.nama, jenisNama: k.jenis_nama, tipe: k.tipe, periode: k.periode,
          nominal: sel.nominal, terbayar: sel.terbayar, sisa: sel.sisa,
        };
        const meta = {
          nama: baris.nama, label: labelSel(k),
          ayah_nama: baris.ayah_nama, ibu_nama: baris.ibu_nama,
        };
        return (
          <td key={k.key} className="border-b border-r p-0.5">
            <button
              type="button"
              id={`btn_tagihan_sel_${sel.id}`}
              /* Klik kiri dan klik kanan sama-sama membuka popover aksi. */
              /* Pemilihan harus di pointerdown, bukan click: selama popover
                 terbuka, Radix DismissableLayer memanggil preventDefault()
                 pada pointerdown di luar (agar fokus tak bergeser), dan
                 membatalkan pointerdown berarti browser tak lagi melempar
                 `click`. Kalau menunggu `click`, klik di sel lain hanya
                 memunculkan "tutup" dan popover baru butuh klik kedua. */
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                onPilih(sel, meta, e.currentTarget, k);
              }}
              onClick={(e) => onPilih(sel, meta, e.currentTarget, k)}
              onContextMenu={(e) => { e.preventDefault(); onPilih(sel, meta, e.currentTarget, k); }}
              onMouseEnter={(e) => onHoverMasuk(isiTooltip, e.currentTarget)}
              onMouseMove={(e) => onHoverGerak(isiTooltip, e)}
              onMouseLeave={onHoverKeluar}
              aria-describedby="tip_tagihan_sel"
              title={`${baris.nama} — sisa Rp ${sel.sisa.toLocaleString('id')}`}
              className={`w-full rounded px-1.5 py-0.5 text-right tabular-nums hover:ring-1 hover:ring-ring ${kelasSel(sel)} ${sel.terlambat ? 'font-semibold' : ''}`}
            >
              {sel.nominal.toLocaleString('id')}
            </button>
          </td>
        );
      })}
      <td className="border-b border-l p-0.5 text-right tabular-nums">{baris.total_tagihan.toLocaleString('id')}</td>
      <td className="border-b border-l p-0.5 text-right tabular-nums">{baris.total_terbayar.toLocaleString('id')}</td>
      <td className={`border-b border-l p-0.5 text-right tabular-nums ${baris.tunggakan > 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
        {baris.tunggakan.toLocaleString('id')}
      </td>
    </tr>
  );
});

/**
 * Mematikan pointer pada pembungkus Popper milik Radix.
 *
 * `pointer-events: none` pada isi kartu saja tak cukup: Radix menyisipkan
 * `<div data-radix-popper-content-wrapper>` yang tetap menahan pointer, sehingga
 * sel yang tertutup kartu tak bisa di-hover. Wrapper itu ikut dimatikan.
 */
function WrapperTanPointer({ children }: { children: React.ReactNode }) {
  const ref = useCallback((el: HTMLDivElement | null) => {
    const bungkus = el?.parentElement?.parentElement;
    if (bungkus instanceof HTMLElement) bungkus.style.pointerEvents = 'none';
  }, []);
  return <div ref={ref}>{children}</div>;
}

/** Isi kartu hover: rincian tagihan per sel (dipakai di dalam HoverCardContent). */
function IsiKartuTagihan({ data }: { data: TooltipSel }) {
  return (
    <div className="text-xs">
      <p className="font-semibold">{data.nama}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt className="text-muted-foreground">Nama Tarif</dt>
        <dd className="text-right">{data.jenisNama}</dd>
        {data.tipe === 'bulanan' && data.periode !== null && (
          <>
            <dt className="text-muted-foreground">Periode</dt>
            <dd className="text-right">{periodePanjang(data.periode)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Nominal Tagihan</dt>
        <dd className="text-right tabular-nums">Rp {data.nominal.toLocaleString('id')}</dd>
        <dt className="text-muted-foreground">Nominal Terbayar</dt>
        <dd className="text-right tabular-nums">Rp {data.terbayar.toLocaleString('id')}</dd>
        <dt className="text-muted-foreground">Sisa</dt>
        <dd className={`text-right font-semibold tabular-nums ${data.sisa > 0 ? 'text-destructive' : ''}`}>
          Rp {data.sisa.toLocaleString('id')}
        </dd>
      </dl>
    </div>
  );
}

/** Tabel silang tagihan: baris = santri, kolom = jenis (bulanan per bulan).
 *  Sel berisi nominal dengan warna status; klik sel (kiri maupun kanan)
 *  melaporkan tagihan terpilih ke halaman, yang membuka popover aksi. */
function TagihanCrosstab({ data, loading, terpilihId, onPilih, emptyText }: Props) {
  const kolom = data?.kolom ?? [];
  const baris: CrosstabBaris[] = data?.baris ?? [];
  const grup = grupKolom(kolom);

  // Tinggi baris header grup diukur, bukan di-hardcode: baris daun harus
  // menempel tepat di bawahnya, dan salah ukur => sel data terlihat
  // menembus header saat digulir.
  const grupRef = useRef<HTMLTableRowElement>(null);
  /** Wadah gulir; sekaligus offsetParent cincin sel terpilih. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tinggiGrup, setTinggiGrup] = useState(0);
  /** Sel yang sedang di-hover + elemen selnya (jangkar kartu). */
  const [hover, setHover] = useState<{ isi: TooltipSel; anchor: HTMLElement } | null>(null);
  /* Cincin sel terpilih digambar sebagai overlay, bukan class di tiap sel.
    mengoper `terpilihId` ke baris berarti props SEMUA baris berubah tiap
     klik → memo tak berlaku → ribuan tombol dirender ulang (~250ms, memblokir
     main thread) dan popover ikut terlambat muncul. Overlay cuma satu
     elemen, jadi yang dirender ulang hanya dirinya sendiri. */
  const [cincin, setCincin] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const wadah = scrollRef.current;
    if (wadah === null || terpilihId === null) { setCincin(null); return; }
    const sel = wadah.querySelector<HTMLElement>(`#btn_tagihan_sel_${terpilihId}`);
    if (sel === null) { setCincin(null); return; }
    /* offsetParent tak bisa dipakai: untuk elemen di dalam <td>, offsetParent
       adalah sel itu sendiri (aturan CSSOM View), bukan container kita --
       offsetLeft hanya memberi padding td. Jadi diukur dari rect, lalu
       ditambah scroll agar dalam koordinat konten (cincin ikut tergulir). */
    const kotakWadah = wadah.getBoundingClientRect();
    const kotakSel = sel.getBoundingClientRect();
    /* clientLeft/clientTop = lebar border container; rect memuat border, sedangkan
       koordinat `left/top` diukur dari padding box → tanpa dikurangi, cincin
       bergeser 1px. */
    setCincin({
      left: kotakSel.left - kotakWadah.left - wadah.clientLeft + wadah.scrollLeft,
      top: kotakSel.top - kotakWadah.top - wadah.clientTop + wadah.scrollTop,
      width: kotakSel.width,
      height: kotakSel.height,
    });
  }, [terpilihId, data]);

  /** Elemen jangkar HoverCard (diposisikan di atas sel yang di-hover). */
  const jangkarRef = useRef<HTMLDivElement | null>(null);
  /** Tenggang sebelum menutup, agar perpindahan sel tak berkedip. */
  const tutupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Posisi terakhir saat kartu ditutup karena klik. Pointer harus bergerak
   *  jauh dari titik ini dulu, supaya jittersaat klik tak menyalakannya
   *  kembali (dan menumpuk dengan popover). */
  const agarJauhRef = useRef<{ x: number; y: number } | null>(null);

  // Handler stabil (dipakai props memo BarisCrosstab): `onPilih` & friends
  // dibuat ulang tiap render bila ditulis inline, sehingga memo tidak berlaku.
  const pilihRef = useRef(onPilih);
  pilihRef.current = onPilih;

  /* Kartu sengaja dimatikan saat klik. Kalau pointer lalu bergerak (mis. saat
     popover ditutup), kartu boleh hidup lagi — tapi hanya setelah keluar dari
     titik klik, supaya gerak kecil saat klik tidak langsung menumpukkannya. */
  const hoverGerak = useCallback((isi: TooltipSel, e: React.MouseEvent<HTMLElement>) => {
    const agarJauh = agarJauhRef.current;
    if (agarJauh === null) return;
    if (Math.hypot(e.clientX - agarJauh.x, e.clientY - agarJauh.y) < 6) return;
    agarJauhRef.current = null;
    setHover({ isi, anchor: e.currentTarget });
  }, []);

  /* Idempoten per gesture: di browser nyata `click` tak pernah menyusul
     `pointerdown` (Radix membatalkan event itu), tapi di jsdom tetap datang —
     dan klik keyboard hanya menghasilkan `click`.

     Flag ini di-reset lewat task berikutnya; sisa event gesture (pointerup,
     click) diproses browser dalam satu task input, jadi masih terpasang saat
     `click` tiba. */
  const baruPilihRef = useRef(false);
  const pilihStabil = useCallback(
    (
      sel: CrosstabSel,
      meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null },
      anchor: HTMLElement,
      kolom: CrosstabKolom,
    ) => {
      // Gesture ini sudah diproses (pointerdown lebih dulu) — abaikan click
      // yang menyusul agar `onPilih` tak dipanggil dua kali.
      if (baruPilihRef.current) return;
      baruPilihRef.current = true;
      setTimeout(() => { baruPilihRef.current = false; }, 0);

      // Klik kiri/kanan membuka popover aksi → tutup kartu hover seketika,
      // jangan sampai dua-duanya menumpuk di atas sel yang sama. Pointer tak
      // bergerak lagi, jadi mouseenter tak akan menyalakannya kembali.
      if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; }
      const kotak = anchor.getBoundingClientRect();
      agarJauhRef.current = { x: kotak.left + kotak.width / 2, y: kotak.top + kotak.height / 2 };
      setHover(null);
      pilihRef.current(sel, meta, anchor, kolom);
    },
    [],
  );
  const hoverMasuk = useCallback((isi: TooltipSel, anchor: HTMLElement) => {
    if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; }
    setHover({ isi, anchor });
  }, []);
  const hoverKeluar = useCallback(() => {
    if (tutupRef.current !== null) clearTimeout(tutupRef.current);
    tutupRef.current = setTimeout(() => setHover(null), 400);
  }, []);

  /* Radix HoverCard tidak punya virtualRef seperti PopoverAnchor, jadi
     jangkarnya harus elemen nyata. Kita taruh satu elemen tak terlihat persis
     di atas sel yang di-hover; posisinya ditulis sebelum browser melukis. */
  const tempatkanJangkar = useCallback(() => {
    const el = jangkarRef.current;
    if (el === null || hover === null) return;
    const r = hover.anchor.getBoundingClientRect();
    el.style.left = `${r.left}px`;
    el.style.top = `${r.top}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
  }, [hover]);

  useLayoutEffect(tempatkanJangkar, [tempatkanJangkar]);

  /* Tabel digulir → tutup kartu. Radix tidak memantau pergeseran posisi
     jangkar, jadi tanpa ini kartu melayang jauh dari sel asalnya. */
  useEffect(() => {
    const wrap = document.getElementById('crosstab_tagihan_scroll');
    if (wrap === null) return;
    const tutup = () => {
      if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; }
      setHover(null);
    };
    wrap.addEventListener('scroll', tutup, { passive: true });
    return () => wrap.removeEventListener('scroll', tutup);
  }, []);
  useLayoutEffect(() => {
    const el = grupRef.current;
    if (!el) return;
    const ukur = () => setTinggiGrup(el.getBoundingClientRect().height);
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, [grup.length, kolom.length]);

  if (kolom.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{loading ? 'Memuat…' : emptyText}</p>;
  }

  return (
    <div id="crosstab_tagihan_scroll" ref={scrollRef} className="relative h-full overflow-auto rounded-xl border bg-card">
      <table id="tbl_tagihan_crosstab" className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr ref={grupRef}>
            <th rowSpan={2} className="sticky left-0 top-0 z-30 border-b border-r bg-muted p-2 text-left align-bottom">
              Santri
            </th>
            {grup.map((g) => (
              <th
                key={g.jenisId}
                colSpan={g.kolom.length}
                className="sticky top-0 z-20 border-b border-r bg-muted px-1.5 py-[3.5px] text-center font-medium"
              >
                {g.jenisNama}
              </th>
            ))}
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-l bg-muted p-2 text-right align-bottom">Tagihan</th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-l bg-muted p-2 text-right align-bottom">Terbayar</th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-l bg-muted p-2 text-right align-bottom" title="Sisa tagihan yang sudah lewat jatuh tempo">
              Tunggakan
            </th>
          </tr>
          <tr>
            {kolom.map((k) => (
              <th
                key={k.key}
                style={{ top: tinggiGrup }}
                className={`sticky z-10 border-b border-r bg-muted px-1.5 py-[3.5px] text-center font-normal ${k.tipe === 'non_bulanan' ? 'text-muted-foreground' : ''}`}
                title={labelSel(k)}
              >
                {labelKolom(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((r) => (
            <BarisCrosstab
              key={r.santri_id}
              baris={r}
              kolom={kolom}
              onPilih={pilihStabil}
              onHoverMasuk={hoverMasuk}
              onHoverGerak={hoverGerak}
              onHoverKeluar={hoverKeluar}
            />
          ))}
          {baris.length === 0 && (
            <tr>
              <td colSpan={kolom.length + 4} className="p-8 text-center text-muted-foreground">
                {loading ? 'Memuat…' : emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {cincin !== null && (
        <div
          id="cincin_sel_tagihan"
          aria-hidden
          /* pointer-events-none: cincin tak boleh menutupi selnya sendiri. */
          className="pointer-events-none absolute z-20 rounded ring-2 ring-ring"
          style={{ left: cincin.left, top: cincin.top, width: cincin.width, height: cincin.height }}
        />
      )}
      <HoverCard
      open={hover !== null}
      /* `open` di sini dikontrol, jadi tanpa onOpenChange permintaan tutup dari
         Radix (mis. Escape) diabaikan: kartu tetap terbuka sekaligus memakan
         Escape yang seharusnya sampai ke popover. */
      onOpenChange={(o) => { if (!o) { if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; } setHover(null); } }}
      openDelay={0}
      closeDelay={200}
    >
        <HoverCardTrigger asChild>
          <div
            ref={jangkarRef}
            aria-hidden
            className="pointer-events-none fixed z-0 h-0 w-0 opacity-0"
          />
        </HoverCardTrigger>
        <HoverCardContent
          /* Radix tak memberi role pada content; kita pasang agar
             aria-describedby pada sel tetap menunjuk elemen yang benar. */
          id="tip_tagihan_sel"
          role="tooltip"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          /* Kartu TIDAK interaktif → pointer-events-none. Tanpa ini kartu
             menutupi sel di bawahnya dan pointer tak pernah sampai ke sana,
             sehingga sel yang tertutup tak bisa di-hover. Tembusnya membuat
             hover selalu mendarat di sel yang sebenarnya di bawah kursor,
             dan kartu ikut berganti isi. */
          className="pointer-events-none w-56 p-2.5"
        >
          {hover !== null && (
            <WrapperTanPointer>
              <IsiKartuTagihan data={hover.isi} />
            </WrapperTanPointer>
          )}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

/* `memo`: tabel ini berat (ratusan baris × puluhan kolom), sedangkan props-nya
   stabil kecuali `data`/`loading`/pilihan sel. Tanpa memo, tiap perubahan state
   halaman (mis. mengetik di pencarian, buka dialog) ikut merekonsiliasi seluruh
   tabel dan membuat interaksi lain (termasuk membuka dropdown) terasa lambat. */
export default memo(TagihanCrosstab);
