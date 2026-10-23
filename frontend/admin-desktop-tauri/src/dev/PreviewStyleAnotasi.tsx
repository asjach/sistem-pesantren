import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GRUP_PREVIEW, type PropertiStyle } from './anotasiData';
import type { PengelolaPreviewStyle } from './previewStyle';
import { bacaStyleElemen } from './styleAnotasi';

export default function PreviewStyleAnotasi({ elemen, label, pengelola, onUbah, disabled }: {
  elemen: Element;
  label: string;
  pengelola: PengelolaPreviewStyle;
  onUbah: () => void;
  disabled: boolean;
}) {
  const idDasar = useId().replaceAll(':', '');
  const [terbuka, setTerbuka] = useState(false);
  const [properti, setProperti] = useState<PropertiStyle>('color');
  const [nilai, setNilai] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const preview = pengelola.snapshot(elemen);

  function terapkan() {
    try {
      pengelola.terapkan(elemen, properti, nilai);
      setGalat(null);
      onUbah();
    } catch (error) {
      setGalat(error instanceof Error ? error.message : 'Preview gagal diterapkan.');
    }
  }

  return (
    <div className="mt-2 border-t border-border pt-1">
      <Button type="button" size="sm" variant="ghost" aria-label={`Preview tampilan ${label}`} aria-expanded={terbuka} onClick={() => setTerbuka((open) => !open)}>
        {terbuka ? '▾' : '▸'} Preview tampilan{preview ? ' · Aktif' : ''}
      </Button>
      {terbuka && <section aria-label={`Preview ${label}`} className="mt-1 flex min-w-0 flex-col gap-2 text-xs">
        <p className="text-[11px] text-muted-foreground">Preview sementara pada elemen. Reset atau Batal mengembalikan tampilan awal. Font memakai font yang tersedia di perangkat.</p>
        <label htmlFor={`properti_preview_${idDasar}`}>Properti</label>
        <select id={`properti_preview_${idDasar}`} value={properti} disabled={disabled} className="min-w-0 border border-border bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" onChange={(e) => { setProperti(e.target.value as PropertiStyle); setNilai(''); setGalat(null); }}>
          {GRUP_PREVIEW.map((grup) => <optgroup key={grup.label} label={grup.label}>
            {grup.properti.map((p) => <option key={p} value={p}>{p}</option>)}
          </optgroup>)}
        </select>
        <label htmlFor={`nilai_preview_${idDasar}`}>Nilai CSS</label>
        <input id={`nilai_preview_${idDasar}`} value={nilai} disabled={disabled} maxLength={256} placeholder={bacaStyleElemen(elemen)?.[properti] || 'Contoh: 8px, #334155, rgba(0, 0, 0, 0.5)'} className="min-w-0 border border-border bg-background px-2 py-1 font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" onChange={(e) => setNilai(e.target.value)} onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); terapkan(); }
        }} />
        {galat && <p role="alert" className="text-destructive">{galat}</p>}
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" disabled={disabled || !nilai.trim()} onClick={terapkan}>Terapkan preview</Button>
          <Button type="button" size="sm" variant="ghost" disabled={disabled || !preview} onClick={() => { pengelola.reset(elemen); setGalat(null); setNilai(''); onUbah(); }}>Reset preview</Button>
        </div>
        {preview && <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-1 text-[11px] leading-snug">
          {Object.keys(preview.perubahan).map((p) => {
            const propertiUbah = p as PropertiStyle;
            return <div key={p} className="contents">
              <dt className="min-w-0 break-all font-mono">{p}</dt>
              <dd className="min-w-0 break-all font-mono select-text">{preview.sebelum[propertiUbah] || '—'} → {preview.sesudah[propertiUbah] || '—'}</dd>
            </div>;
          })}
        </dl>}
      </section>}
    </div>
  );
}
