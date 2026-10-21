import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import {
  type BarisPesertaKegiatanEvaluatif, type DesainKartuResp, type KegiatanEvaluatif,
} from '@/api/penilaian';
import { Button } from '@/components/ui/button';
import { pilihDesainKartu, type KonteksKartuPeserta } from '@/lib/desainKartuPeserta';
import KartuPeserta, { PX_PER_MM } from './KartuPeserta';
import { useLatarDesain } from './useLatarDesain';

interface Props {
  kegiatanEvaluatif: KegiatanEvaluatif;
  semester: string;
  lembaga: string;
  peserta: BarisPesertaKegiatanEvaluatif[];
  foto: Record<number, string>;
  memuatFoto: boolean;
  muatan: DesainKartuResp | null;
}

export default function KartuPesertaCetakTab({
  kegiatanEvaluatif, semester, lembaga, peserta, foto, memuatFoto, muatan,
}: Props) {
  const desain = useMemo(
    () => muatan ? pilihDesainKartu(muatan.desain, muatan.pengaturan) : null,
    [muatan],
  );
  const lebarMm = muatan?.pengaturan.lebar_mm ?? 85.6;
  const tinggiMm = muatan?.pengaturan.tinggi_mm ?? 53.98;
  const latarUrl = useLatarDesain(desain);

  const [dipilih, setDipilih] = useState<Set<number>>(new Set());
  const [siapCetak, setSiapCetak] = useState<BarisPesertaKegiatanEvaluatif[] | null>(null);

  useEffect(() => {
    setDipilih(new Set());
  }, [peserta]);

  useEffect(() => {
    if (!siapCetak) return;
    const jeda = setTimeout(() => window.print(), 250);
    return () => clearTimeout(jeda);
  }, [siapCetak]);

  useEffect(() => {
    const selesai = () => setSiapCetak(null);
    window.addEventListener('afterprint', selesai);
    return () => window.removeEventListener('afterprint', selesai);
  }, []);

  const terpilih = peserta.filter((item) => dipilih.has(item.santri_id));

  const toggle = (santriId: number) => {
    setDipilih((saatIni) => {
      const berikut = new Set(saatIni);
      if (berikut.has(santriId)) berikut.delete(santriId);
      else berikut.add(santriId);
      return berikut;
    });
  };

  const cetak = (daftar: BarisPesertaKegiatanEvaluatif[]) => {
    if (daftar.length === 0) return;
    if (memuatFoto) {
      toast.info('Foto peserta sedang disiapkan. Coba lagi sebentar.');
      return;
    }
    setSiapCetak(daftar);
  };

  if (muatan === null || desain === null) {
    return <p className="text-xs text-muted-foreground">Memuat desain kartu…</p>;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col gap-2 border border-border p-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold">Peserta</h3>
          <span className="text-[11px] text-muted-foreground">{terpilih.length}/{peserta.length}</span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            id="btn_pilih_semua_peserta_kartu"
            className="h-8 flex-1 text-xs"
            onClick={() => setDipilih(new Set(peserta.map((item) => item.santri_id)))}
          >
            Pilih semua
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            id="btn_kosongkan_peserta_kartu"
            className="h-8 flex-1 text-xs"
            onClick={() => setDipilih(new Set())}
          >
            Kosongkan
          </Button>
        </div>
        <div className="max-h-[520px] overflow-auto border border-border">
          {peserta.map((item) => (
            <label
              key={item.santri_id}
              className="flex cursor-pointer items-center gap-2 border-b border-border px-2 py-1.5 text-xs last:border-b-0 hover:bg-muted/40"
            >
              <input
                type="checkbox"
                id={`cek_peserta_kartu_${item.santri_id}`}
                checked={dipilih.has(item.santri_id)}
                onChange={() => toggle(item.santri_id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.nama}</span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {item.nomor_peserta ?? 'Belum bernomor'} · {item.kelas ?? '—'}
                </span>
              </span>
            </label>
          ))}
          {peserta.length === 0 && (
            <p className="p-3 text-center text-xs text-muted-foreground">Tidak ada peserta pada lingkup ini.</p>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {memuatFoto && <span className="text-[11px] text-muted-foreground">Menyiapkan foto…</span>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            id="btn_cetak_terpilih_kartu"
            disabled={terpilih.length === 0 || memuatFoto}
            onClick={() => cetak(terpilih)}
          >
            Cetak terpilih ({terpilih.length})
          </Button>
          <Button
            type="button"
            size="sm"
            id="btn_cetak_semua_kartu"
            disabled={peserta.length === 0 || memuatFoto}
            onClick={() => cetak(peserta)}
          >
            Cetak semua ({peserta.length})
          </Button>
        </div>

        <div className="overflow-auto border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap gap-3">
            {terpilih.map((item) => (
              <div
                key={item.santri_id}
                style={{ width: lebarMm * 2.4, height: tinggiMm * 2.4 }}
                className="shadow-sm"
              >
                <KartuPeserta
                  desain={desain}
                  konteks={konteksKartu(item, kegiatanEvaluatif, semester, lembaga)}
                  lebarMm={lebarMm}
                  tinggiMm={tinggiMm}
                  skala={2.4}
                  fotoUrl={foto[item.santri_id] ?? null}
                  latarUrl={latarUrl}
                />
              </div>
            ))}
            {terpilih.length === 0 && (
              <p className="text-xs text-muted-foreground">Belum ada peserta terpilih.</p>
            )}
          </div>
        </div>
      </section>

      {siapCetak !== null && (
        <div
          id="area_cetak_kartu_peserta"
          data-area-cetak="kartu_peserta"
          data-cetak-aktif="true"
          className="hidden print:block"
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as CSSProperties}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, ${lebarMm}mm)`,
              gap: '4mm',
              justifyContent: 'center',
            }}
          >
            {siapCetak.map((item) => (
              <div
                key={item.santri_id}
                style={{
                  width: `${lebarMm}mm`,
                  height: `${tinggiMm}mm`,
                  breakInside: 'avoid',
                  border: '0.2mm dashed #cbd5e1',
                }}
              >
                <KartuPeserta
                  desain={desain}
                  konteks={konteksKartu(item, kegiatanEvaluatif, semester, lembaga)}
                  lebarMm={lebarMm}
                  tinggiMm={tinggiMm}
                  skala={PX_PER_MM}
                  fotoUrl={foto[item.santri_id] ?? null}
                  latarUrl={latarUrl}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function konteksKartu(
  peserta: BarisPesertaKegiatanEvaluatif,
  kegiatanEvaluatif: KegiatanEvaluatif,
  semester: string,
  lembaga: string,
): KonteksKartuPeserta {
  return { peserta, kegiatanEvaluatif, semester, lembaga };
}
