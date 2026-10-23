import { useReducer, useState } from 'react';
import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';
import { GRUP_STYLE } from './anotasiData';
import { bacaStyleElemen, teksStyleElemen } from './styleAnotasi';

export default function DetailStyleAnotasi({ elemen, label }: { elemen: Element; label: string }) {
  const [terbuka, setTerbuka] = useState(false);
  const [, muatUlang] = useReducer((versi: number) => versi + 1, 0);
  const [statusSalin, setStatusSalin] = useState<{ elemen: Element; pesan: string } | null>(null);
  const [menyalin, setMenyalin] = useState(false);
  const style = terbuka ? bacaStyleElemen(elemen) : undefined;

  async function salin() {
    if (!style || menyalin) return;
    setMenyalin(true);
    setStatusSalin(null);
    try {
      const sukses = await copyText(teksStyleElemen(style));
      setStatusSalin({ elemen, pesan: sukses ? 'Detail tampilan tersalin.' : 'Tidak dapat menyalin. Pilih teks nilainya lalu salin secara manual.' });
    } catch {
      setStatusSalin({ elemen, pesan: 'Tidak dapat menyalin. Pilih teks nilainya lalu salin secara manual.' });
    } finally {
      setMenyalin(false);
    }
  }

  return (
    <div className="mt-2 border-t border-border pt-1">
      <Button
        type="button" variant="ghost" size="sm"
        aria-label={`Detail tampilan ${label}`}
        aria-expanded={terbuka}
        onClick={() => { setTerbuka((nilai) => !nilai); setStatusSalin(null); }}
      >{terbuka ? '▾' : '▸'} Detail tampilan</Button>
      {terbuka && <section aria-label={`Style ${label}`} className="mt-1 min-w-0">
        <p className="mb-2 text-[11px] text-muted-foreground">
          Nilai aktual browser saat detail dimuat. Warna mempertahankan transparansi;
          background transparan tidak berarti warna parent. Nilai kosong ditampilkan sebagai —.
        </p>
        <div className="mb-2 flex flex-wrap gap-1">
          <Button type="button" variant="outline" size="sm" disabled={!style || !Object.keys(style).length || menyalin} onClick={() => void salin()}>
            {menyalin ? 'Menyalin…' : 'Salin detail'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { muatUlang(); setStatusSalin(null); }}>Muat ulang detail</Button>
        </div>
        {statusSalin?.elemen === elemen && <p role="status" className="mb-2 text-[11px]">{statusSalin.pesan}</p>}
        {style ? GRUP_STYLE.map((grup) => (
          <section aria-label={grup.label} key={grup.label} className="mb-2 last:mb-0">
            <h4 className="mb-1 text-[11px] font-semibold">{grup.label}</h4>
            <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-1 text-[11px] leading-snug">
              {grup.properti.map((properti) => {
                const nilai = style[properti];
                return (
                  <div key={properti} className="contents">
                    <dt className="min-w-0 break-all font-mono text-muted-foreground select-text">{properti}</dt>
                    <dd className="min-w-0 break-all font-mono select-text">
                      {properti.endsWith('color') && nilai && <span
                        aria-hidden="true"
                        className="mr-1 inline-block size-3 border border-border align-middle"
                        style={{ backgroundImage: 'conic-gradient(#bbb 25%, #fff 0 50%, #bbb 0 75%, #fff 0)', backgroundSize: '6px 6px' }}
                      ><span className="block size-full" style={{ backgroundColor: nilai }} /></span>}
                      {nilai || '—'}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )) : <p role="status" className="text-[11px] text-muted-foreground">Detail tampilan tidak tersedia. Pilih kembali elemen atau muat ulang detail.</p>}
      </section>}
    </div>
  );
}
