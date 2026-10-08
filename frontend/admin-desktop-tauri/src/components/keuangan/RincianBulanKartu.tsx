import type { PratinjauBaris, PratinjauLangkah } from '@/api/keuangan';
import { labelRentangPanjang, rentangPeriode } from '@/lib/dispensasi';

/** Ringkasan aturan satu langkah: "50%", "Rp 10.000", "Bebas". */
function ringkasLangkah(l: PratinjauLangkah): string {
  if (l.tipe === 'persen') return `${l.nilai}%`;
  if (l.tipe === 'bebas') return 'Bebas';
  return `Rp ${l.nilai.toLocaleString('id')}`;
}

/** Isi kartu hover kolom "Rincian Bulan": potongan per paket per rentang bulan.
 *  Data mentahnya dari pratinjau generate (backend otoritatif), jadi angka di
 *  kartu ini sama dengan yang akan ditulis generate. */
export default function RincianBulanKartu({ periode }: { periode: PratinjauBaris[] }) {
  const rentang = rentangPeriode(periode);
  if (rentang.length === 0) {
    return <p className="text-muted-foreground">Belum ada rincian periode.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">Rincian potongan per bulan</p>
      {rentang.map((r) => (
        <div key={`${r.dari}-${r.sampai}`} className="border-t pt-2 first:border-t-0 first:pt-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">
              {labelRentangPanjang(r.dari, r.sampai)}
              <span className="ml-1 font-normal text-muted-foreground">
                ({r.bulan} bulan)
              </span>
            </span>
            <span className="tabular-nums">{r.nominal.toLocaleString('id')}</span>
          </div>

          {r.sebab !== null && (
            <p className="mt-0.5 text-muted-foreground">
              Tidak digenerate — {r.sebab}; baris dibiarkan apa adanya.
            </p>
          )}

          {r.langkah.length > 0 && (
            <ul className="mt-0.5 flex flex-col gap-0.5">
              {r.langkah.map((l) => (
                <li key={l.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">
                    {l.nama} · {ringkasLangkah(l)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {l.potongan > 0 ? `−${l.potongan.toLocaleString('id')}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {r.sebab === null && r.langkah.length === 0 && (
            <p className="mt-0.5 text-muted-foreground">Tanpa dispensasi pada rentang ini.</p>
          )}
        </div>
      ))}
    </div>
  );
}
