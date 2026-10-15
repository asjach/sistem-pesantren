import { useMemo, useState } from 'react';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { KolomRekapCrosstab, RekapDispensasiCrosstab } from '@/api/keuangan';
import { cn } from '@/lib/utils';

/** Angka polos dipisah ribuan (tanpa "Rp") — ringkas untuk sel grid. */
function angka(nilai: number): string {
  return nilai.toLocaleString('id');
}

/**
 * Crosstab REKAP dispensasi (baca-saja): baris = paket × lembaga × TA,
 * kolom = jenis tagihan yang terdampak, sel = TOTAL POTONGAN paket pada
 * jenis itu. Berbeda dari `TagihanCrosstab` yang berbaris santri dan punya
 * seleksi/aksi batch, tabel ini murni laporan — karena itu komponennya
 * dipisah agar tak memaksakan mesin seleksi ke data agregat.
 *
 * Sel kosong = paket tidak menyentuh jenis itu (bukan potongan Rp 0),
 * jadi dibiarkan hampa alih-alih diisi angka yang salah baca.
 *
 * Tarif master jenis itu ditampilkan sebagai tooltip bersama nominal kotor
 * & persennya — sel tetap ringkas, konteksnya tetap terjangkau.
 */
export default function RekapDispensasiCrosstab({ data, loading, emptyText }: {
  data: RekapDispensasiCrosstab | null;
  loading: boolean;
  emptyText: string;
}) {
  const [hover, setHover] = useState<{ kunciBaris: string; kolom: KolomRekapCrosstab } | null>(null);

  /** Sel yang sedang di-hover, dicari dari data (bukan disalin ke state). */
  const selHover = useMemo(() => {
    if (hover === null || data === null) return null;
    const baris = data.baris.find((b) => b.id === hover.kunciBaris);
    const sel = baris?.sel[hover.kolom.key];
    return baris && sel ? { baris, sel } : null;
  }, [hover, data]);

  if (loading && data === null) {
    return <div className="p-4 text-sm text-muted-foreground">Memuat…</div>;
  }
  if (data === null || data.kolom.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">{emptyText}</div>;
  }

  const { kolom, baris } = data;
  const totalKolom = baris.reduce((a, b) => a + b.total_potongan, 0);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr>
            <th className="border-b border-r px-2 py-1.5 text-left font-medium" colSpan={3}>
              Paket dispensasi
            </th>
            {kolom.map((k) => (
              <th
                key={k.key}
                id={`th_rekap_crosstab_${k.key}`}
                className="min-w-28 border-b border-r px-2 py-1.5 text-right font-medium"
                title={k.jenis_nama}
              >
                <span className="block max-w-40 truncate">{k.jenis_nama}</span>
              </th>
            ))}
            <th className="min-w-28 border-b px-2 py-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.id} className="hover:bg-muted/40">
              <td className="border-b border-r px-2 py-1.5">{b.jenjang}</td>
              <td className="border-b border-r px-2 py-1.5">{b.paket}</td>
              <td className="border-b border-r px-2 py-1.5 tabular-nums">{b.tahun_ajaran}</td>
              {kolom.map((k) => {
                const sel = b.sel[k.key];
                if (!sel) {
                  return (
                    <td
                      key={k.key}
                      id={`td_rekap_crosstab_${b.id}_${k.key}`}
                      className="border-b border-r px-2 py-1.5 text-center text-muted-foreground/30"
                      title={`${b.paket} tidak menyentuh ${k.jenis_nama}`}
                    >
                      ·
                    </td>
                  );
                }
                const isHover = hover?.kunciBaris === b.id && hover.kolom.key === k.key;
                return (
                  <HoverCard key={k.key} open={isHover} onOpenChange={(o) => setHover(o ? { kunciBaris: b.id, kolom: k } : null)}>
                    <HoverCardTrigger asChild>
                      <td
                        id={`td_rekap_crosstab_${b.id}_${k.key}`}
                        className={cn(
                          'border-b border-r px-2 py-1.5 text-right tabular-nums transition-colors',
                          isHover ? 'bg-accent' : '',
                        )}
                      >
                        Rp {angka(sel.potongan)}
                      </td>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-60 text-xs" align="start">
                      <div className="font-medium">{b.paket}</div>
                      <div className="text-muted-foreground">{b.jenjang} · {b.tahun_ajaran} · {k.jenis_nama}</div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                        <dt className="text-muted-foreground">Tarif</dt>
                        <dd className="text-right tabular-nums">{sel.tarif === null ? '—' : `Rp ${angka(sel.tarif)}`}</dd>
                        <dt className="text-muted-foreground">Nominal kotor</dt>
                        <dd className="text-right tabular-nums">Rp {angka(sel.kotor)}</dd>
                        <dt className="text-muted-foreground">Potongan</dt>
                        <dd className="text-right tabular-nums">Rp {angka(sel.potongan)} ({sel.persen}%)</dd>
                        <dt className="text-muted-foreground">Tagihan</dt>
                        <dd className="text-right tabular-nums">{angka(sel.jumlah_tagihan)}</dd>
                      </dl>
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
              <td className="border-b bg-muted/30 px-2 py-1.5 text-right font-medium tabular-nums">
                Rp {angka(b.total_potongan)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="border-r px-2 py-1.5 font-medium" colSpan={3}>Total (tampil)</td>
            {kolom.map((k) => {
              const jumlah = baris.reduce((a, b) => a + (b.sel[k.key]?.potongan ?? 0), 0);
              return (
                <td key={k.key} className="border-r px-2 py-1.5 text-right font-medium tabular-nums">
                  Rp {angka(jumlah)}
                </td>
              );
            })}
            <td className="bg-muted/30 px-2 py-1.5 text-right font-semibold tabular-nums">Rp {angka(totalKolom)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
