import PartStyleEditor from '@/components/PartStyleEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStandarTampilan } from '@/standarTampilan';
import { useTheme } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { toast } from 'sonner';

/** Pengaturan → Tampilan: gaya atomik per bagian UI (font, warna, border,
 *  radius, padding) — dipisah mode terang/gelap. */
export default function PengaturanTampilanPage() {
  const { user } = useAuth();
  const { navigasi, setNavigasi } = useTheme();
  const { tampilan, versi, pribadi, hapus } = useStandarTampilan();
  const kunci = Object.keys(pribadi);

  // Tanpa izin ubah: halaman hanya informatif (backend menolak simpan).
  if (!bisa(user, 'tampilan.ubah')) {
    return (
      <div className="flex min-h-0 flex-col gap-4">
        <p className="rounded-lg border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          Anda hanya dapat melihat tampilan. Perubahan memerlukan izin mengubah tampilan.
        </p>
      </div>
    );
  }

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
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm">
        <span className="font-medium">Mode navigasi</span>
        <span className="text-muted-foreground">(perangkat ini)</span>
        <div className="ml-auto flex gap-1.5">
          {(['sidebar', 'menubar'] as const).map((m) => (
            <Button
              key={m}
              id={`btn_navigasi_${m}`}
              size="sm"
              variant={navigasi === m ? 'default' : 'outline'}
              onClick={() => setNavigasi(m)}
            >
              {m === 'sidebar' ? 'Sidebar' : 'Menubar'}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
