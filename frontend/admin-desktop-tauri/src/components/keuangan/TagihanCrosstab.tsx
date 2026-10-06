import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';

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
    meta: { nama: string; label: string },
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

/** "10 Agu 2025" untuk tooltip; input ISO date. */
export function tanggalPanjang(iso: string): string {
  const [y, b, h] = iso.split('-');
  return `${h} ${BULAN[Number(b) - 1]} ${y}`;
}

/** "Juli 2025" dari periode bulanan 'YYYY-MM'. */
function periodePanjang(periode: string): string {
  const [y, b] = periode.split('-');
  return `${BULAN[Number(b) - 1] ?? b} ${y}`;
}

/** Baris tooltip hover: rincian tagihan per sel. */
interface TooltipSel {
  nama: string;
  jenisNama: string;
  tipe: CrosstabKolom['tipe'];
  periode: string | null;
  nominal: number;
  terbayar: number;
  sisa: number;
  status: CrosstabSel['status'];
  terlambat: boolean;
  jatuhTempo: string | null;
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
  baris, kolom, terpilihId, onPilih, onHoverMasuk, onHoverGerak, onHoverKeluar,
}: {
  baris: CrosstabBaris;
  kolom: CrosstabKolom[];
  terpilihId: number | null;
  onPilih: (
    sel: CrosstabSel,
    meta: { nama: string; label: string },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => void;
  onHoverMasuk: (isi: TooltipSel, e: React.MouseEvent) => void;
  onHoverGerak: (e: React.MouseEvent) => void;
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
        const dipilih = terpilihId === sel.id;
        const isiTooltip: TooltipSel = {
          nama: baris.nama, jenisNama: k.jenis_nama, tipe: k.tipe, periode: k.periode,
          nominal: sel.nominal, terbayar: sel.terbayar, sisa: sel.sisa,
          status: sel.status, terlambat: sel.terlambat, jatuhTempo: sel.jatuh_tempo,
        };
        const meta = { nama: baris.nama, label: labelSel(k) };
        return (
          <td key={k.key} className="border-b border-r p-0.5">
            <button
              type="button"
              id={`btn_tagihan_sel_${sel.id}`}
              /* Klik kiri dan klik kanan sama-sama membuka popover aksi. */
              onClick={(e) => onPilih(sel, meta, e.currentTarget, k)}
              onContextMenu={(e) => { e.preventDefault(); onPilih(sel, meta, e.currentTarget, k); }}
              onMouseEnter={(e) => onHoverMasuk(isiTooltip, e)}
              onMouseMove={onHoverGerak}
              onMouseLeave={onHoverKeluar}
              aria-describedby="tip_tagihan_sel"
              title={`${baris.nama} — sisa Rp ${sel.sisa.toLocaleString('id')}`}
              className={`w-full rounded px-1.5 py-0.5 text-right tabular-nums hover:ring-1 hover:ring-ring ${kelasSel(sel)} ${sel.terlambat ? 'font-semibold' : ''} ${dipilih ? 'ring-2 ring-ring' : ''}`}
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

function TooltipTagihan({ data, tipRef }: { data: TooltipSel; tipRef: React.Ref<HTMLDivElement> }) {
  const status = data.status === 'lunas'
    ? 'Lunas'
    : data.terlambat ? 'Tunggakan' : 'Belum jatuh tempo';

  return (
    <div
      id="tip_tagihan_sel"
      role="tooltip"
      ref={tipRef}
      className="pointer-events-none fixed left-0 top-0 z-50 w-56 rounded-lg border bg-popover p-2.5 text-xs shadow-md"
    >
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
      <p className="mt-2 border-t pt-1.5 text-[11px] text-muted-foreground">
        {status}
        {data.jatuhTempo === null
          ? ' · tanpa batas jatuh tempo'
          : ` · jatuh tempo ${tanggalPanjang(data.jatuhTempo)}`}
      </p>
    </div>
  );
}

/** Tabel silang tagihan: baris = santri, kolom = jenis (bulanan per bulan).
 *  Sel berisi nominal dengan warna status; klik sel (kiri maupun kanan)
 *  melaporkan tagihan terpilih ke halaman, yang membuka popover aksi. */
export default function TagihanCrosstab({ data, loading, terpilihId, onPilih, emptyText }: Props) {
  const kolom = data?.kolom ?? [];
  const baris: CrosstabBaris[] = data?.baris ?? [];
  const grup = grupKolom(kolom);

  // Tinggi baris header grup diukur, bukan di-hardcode: baris daun harus
  // menempel tepat di bawahnya, dan salah ukur => sel data terlihat
  // menembus header saat digulir.
  const grupRef = useRef<HTMLTableRowElement>(null);
  const [tinggiGrup, setTinggiGrup] = useState(0);
  /** Sel yang sedang di-hover. Isinya berubah → render ulang; posisinya ditulis ke DOM. */
  const [hover, setHover] = useState<TooltipSel | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  /** Posisi kursor terakhir (ref: tidak memicu render). Dipakai untuk
   *  menempatkan tooltip pada frame yang sama saat pertama kali muncul —
   *  tanpa ini tooltip sempat berkedip di pojok kiri atas. */
  const kursorRef = useRef<{ x: number; y: number } | null>(null);

  // Handler stabil (dipakai props memo BarisCrosstab): `onPilih` & friends
  // dibuat ulang tiap render bila ditulis inline, sehingga memo tidak berlaku.
  const pilihRef = useRef(onPilih);
  pilihRef.current = onPilih;
  const pilihStabil = useCallback(
    (
      sel: CrosstabSel,
      meta: { nama: string; label: string },
      anchor: HTMLElement,
      kolom: CrosstabKolom,
    ) => pilihRef.current(sel, meta, anchor, kolom),
    [],
  );
  const hoverMasuk = useCallback((isi: TooltipSel, e: React.MouseEvent) => {
    kursorRef.current = { x: e.clientX, y: e.clientY };
    setHover(isi);
  }, []);
  const hoverGerak = useCallback((e: React.MouseEvent) => NeedleLetak(tipRef.current, e.clientX, e.clientY), []);
  const hoverKeluar = useCallback(() => setHover(null), []);

  // useLayoutEffect: posisi dipasang sebelum browser melukis => tooltip tidak
  // pernah tampil di posisi default sesaat.
  useLayoutEffect(() => {
    if (hover !== null && kursorRef.current !== null) {
      NeedleLetak(tipRef.current, kursorRef.current.x, kursorRef.current.y);
    }
  }, [hover]);
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
    <div className="h-full overflow-auto rounded-xl border bg-card">
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
                className="sticky top-0 z-20 border-b border-r bg-muted p-1.5 text-center font-medium"
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
                className={`sticky z-10 border-b border-r bg-muted p-1.5 text-center font-normal ${k.tipe === 'non_bulanan' ? 'text-muted-foreground' : ''}`}
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
              terpilihId={terpilihId}
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
      {hover !== null && <TooltipTagihan data={hover} tipRef={tipRef} />}
    </div>
  );
}
