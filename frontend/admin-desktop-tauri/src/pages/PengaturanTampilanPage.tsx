import PartStyleEditor from '@/components/PartStyleEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStandarTampilan } from '@/standarTampilan';
import { toast } from 'sonner';

/** Pengaturan → Tampilan: gaya atomik per bagian UI (font, warna, border,
 *  radius, padding) — dipisah mode terang/gelap. */
export default function PengaturanTampilanPage() {
  const { tampilan, versi, pribadi, hapus } = useStandarTampilan();
  const kunci = Object.keys(pribadi);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {tampilan !== null && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm">
          <Badge variant="secondary">Standar lembaga · versi {versi}</Badge>
          <span className="text-muted-foreground">
            {kunci.length > 0
              ? `${kunci.length} setelan disesuaikan pribadi (menimpa standar).`
              : 'Semua setelan mengikuti standar lembaga.'}
          </span>
          {kunci.length > 0 && (
            <Button
              id="btn_kembalikan_standar_tampilan"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                hapus(...kunci);
                toast.success('Setelan dikembalikan ke standar lembaga.');
              }}
            >
              Kembalikan ke standar
            </Button>
          )}
        </div>
      )}
      <PartStyleEditor />
    </div>
  );
}
