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
  /** Id tagihan sel yang sedang dipilih (form bayar di action bar halaman). */
  terpilihId: number | null;
  onPilih: (sel: CrosstabSel, meta: { nama: string; label: string }) => void;
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

const KELAS_SEL: Record<CrosstabSel['status'], string> = {
  lunas: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  sebagian: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  belum: 'bg-destructive/10 text-destructive',
};

/** Tabel silang tagihan: baris = santri, kolom = jenis (bulanan per bulan).
 *  Sel berisi nominal dengan warna status; klik sel memilih tagihan itu. */
export default function TagihanCrosstab({ data, loading, terpilihId, onPilih, emptyText }: Props) {
  const kolom = data?.kolom ?? [];
  const baris: CrosstabBaris[] = data?.baris ?? [];
  const grup = grupKolom(kolom);

  if (kolom.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{loading ? 'Memuat…' : emptyText}</p>;
  }

  return (
    <div className="h-full overflow-auto rounded-xl border bg-card">
      <table id="tbl_tagihan_crosstab" className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th rowSpan={2} className="sticky top-0 left-0 z-30 border-b border-r bg-muted/40 p-2 text-left align-bottom">
              Santri
            </th>
            {grup.map((g) => (
              <th
                key={g.jenisId}
                colSpan={g.kolom.length}
                className="sticky top-0 z-20 border-b border-r bg-muted/40 p-1.5 text-center font-medium"
              >
                {g.jenisNama}
              </th>
            ))}
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-l bg-muted/40 p-2 text-right align-bottom">Tagihan</th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-l bg-muted/40 p-2 text-right align-bottom">Terbayar</th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-l bg-muted/40 p-2 text-right align-bottom">Tunggakan</th>
          </tr>
          <tr>
            {kolom.map((k) => (
              <th
                key={k.key}
                className={`sticky top-[22px] z-10 border-b border-r bg-muted/40 p-1.5 text-center font-normal ${k.tipe === 'non_bulanan' ? 'text-muted-foreground' : ''}`}
                title={labelSel(k)}
              >
                {labelKolom(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((r) => (
            <tr key={r.santri_id}>
              <th scope="row" className="sticky left-0 z-10 max-w-56 border-b border-r bg-card p-2 text-left font-normal">
                <span className="block truncate font-medium">{r.nama}</span>
                <span className="block text-[10px] text-muted-foreground">{r.paket}</span>
              </th>
              {kolom.map((k) => {
                const sel = r.sel[k.key];
                if (!sel) {
                  return <td key={k.key} className="border-b border-r p-1.5 text-center text-muted-foreground/40">·</td>;
                }
                const dipilih = terpilihId === sel.id;
                return (
                  <td key={k.key} className="border-b border-r p-0.5">
                    <button
                      type="button"
                      id={`btn_tagihan_sel_${sel.id}`}
                      onClick={() => onPilih(sel, { nama: r.nama, label: labelSel(k) })}
                      title={`${labelSel(k)} · ${r.nama} — sisa Rp ${sel.sisa.toLocaleString('id')}`}
                      className={`w-full rounded px-1.5 py-1 text-right tabular-nums hover:ring-1 hover:ring-ring ${KELAS_SEL[sel.status]} ${dipilih ? 'ring-2 ring-ring' : ''}`}
                    >
                      {sel.nominal.toLocaleString('id')}
                    </button>
                  </td>
                );
              })}
              <td className="border-b border-l p-1.5 text-right tabular-nums">{r.total_tagihan.toLocaleString('id')}</td>
              <td className="border-b border-l p-1.5 text-right tabular-nums">{r.total_terbayar.toLocaleString('id')}</td>
              <td className={`border-b border-l p-1.5 text-right tabular-nums ${r.tunggakan > 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                {r.tunggakan.toLocaleString('id')}
              </td>
            </tr>
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
    </div>
  );
}