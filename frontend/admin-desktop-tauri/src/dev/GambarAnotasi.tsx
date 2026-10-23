import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { GambarAnotasi as MetadataGambar } from './anotasiData';

export default function GambarAnotasi({ url, metadata }: { url: string; metadata: Omit<MetadataGambar, 'berkas'> }) {
  const [besar, setBesar] = useState(false);
  const [gagal, setGagal] = useState(false);
  return <div className="min-w-0">
    {gagal ? <p role="alert" className="text-xs text-destructive">Screenshot tidak dapat dibuka. Berkas mungkin sudah dihapus.</p> : <>
      <Button type="button" variant="ghost" size="sm" aria-expanded={besar} onClick={() => setBesar((nilai) => !nilai)}>{besar ? 'Kecilkan screenshot' : 'Perbesar screenshot'}</Button>
      <div className={besar ? 'max-h-[50vh] overflow-auto border border-border' : ''}>
        <img src={url} alt="Screenshot anotasi: asal biru dan tujuan jingga bila dipilih" className={besar ? 'max-w-none' : 'max-h-32 max-w-full object-contain'} width={metadata.lebar} height={metadata.tinggi} onError={() => setGagal(true)} />
      </div>
    </>}
    <p className="mt-1 text-[11px] text-muted-foreground">{metadata.preview_aktif ? 'Diambil dengan preview style aktif.' : 'Diambil tanpa preview style.'} {metadata.lebar} × {metadata.tinggi} px.</p>
  </div>;
}
