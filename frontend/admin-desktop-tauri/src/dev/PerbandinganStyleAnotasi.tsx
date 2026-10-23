import { useReducer, useState } from 'react';
import { Button } from '@/components/ui/button';
import { bandingkanStyle, GRUP_PREVIEW, stylePerbandinganTersedia } from './anotasiData';
import { bacaStyleElemen } from './styleAnotasi';

export default function PerbandinganStyleAnotasi({ asal, referensi, previewAktif, disabled }: {
  asal: Element;
  referensi: Element;
  previewAktif: boolean;
  disabled: boolean;
}) {
  const [semua, setSemua] = useState(false);
  const [, muatUlang] = useReducer((versi: number) => versi + 1, 0);
  const styleAsal = bacaStyleElemen(asal);
  const styleReferensi = bacaStyleElemen(referensi);
  const tersedia = stylePerbandinganTersedia(styleAsal) && stylePerbandinganTersedia(styleReferensi);
  const beda = tersedia ? bandingkanStyle(styleAsal, styleReferensi) : [];
  const propertiBerbeda = new Set(beda.map((item) => item.properti));

  return <section aria-label="Perbandingan tampilan" className="min-w-0 border border-border p-2">
    <h3 className="mb-1 text-xs font-semibold">Perbandingan tampilan</h3>
    <p className="text-[11px] text-muted-foreground">Computed style saat dibaca, bukan rule CSS asal. Background transparan tidak otomatis sama dengan parent. Tidak ada CSS yang diterapkan otomatis.</p>
    {previewAktif && <p className="mt-1 text-[11px] font-semibold">Preview aktif · perbandingan mengikuti tampilan saat ini.</p>}
    <div className="my-1 flex flex-wrap gap-1">
      <Button type="button" variant="outline" size="sm" disabled={disabled || !tersedia} aria-pressed={semua} onClick={() => setSemua((nilai) => !nilai)}>{semua ? 'Hanya perbedaan' : 'Tampilkan semua'}</Button>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={muatUlang}>Muat ulang perbandingan</Button>
    </div>
    {!tersedia ? <p role="status" className="text-xs text-destructive">Style asal atau referensi tidak tersedia. Muat ulang, pilih kembali, atau hapus referensi.</p> : <>
      <p role="status" className="mb-1 text-xs">{beda.length ? `${beda.length} properti berbeda.` : 'Tidak ada perbedaan pada properti yang dibandingkan.'}</p>
      {GRUP_PREVIEW.map((grup) => {
        const properti = grup.properti.filter((p) => semua || propertiBerbeda.has(p));
        return properti.length ? <section key={grup.label} aria-label={`Perbandingan ${grup.label}`} className="mt-2">
          <h4 className="text-[11px] font-semibold">{grup.label}</h4>
          {properti.map((p) => <div key={p} className="border-b border-border py-1 text-[11px] last:border-0">
            <p className="break-all font-mono select-text">{p} <span className="font-sans text-muted-foreground">· {propertiBerbeda.has(p) ? 'Berbeda' : 'Sama'}</span></p>
            <dl className="mt-0.5 grid min-w-0 grid-cols-2 gap-x-2">
              <div className="min-w-0"><dt className="text-muted-foreground">Asal</dt><dd className="break-all font-mono select-text">{styleAsal?.[p] || '—'}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">Referensi</dt><dd className="break-all font-mono select-text">{styleReferensi?.[p] || '—'}</dd></div>
            </dl>
          </div>)}
        </section> : null;
      })}
    </>}
  </section>;
}
