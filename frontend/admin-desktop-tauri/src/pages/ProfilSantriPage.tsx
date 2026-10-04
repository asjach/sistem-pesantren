import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IsiProfilSantri, KepalaProfil, useProfilSantri } from '@/components/santri/IsiProfilSantri';
import { ArrowLeft } from '@/icons';

/** Halaman profil Santri mandiri (`/santri/:id/profil`) — tujuan tombol
 *  "Buka di tab baru" pada dialog profil. Sengaja DI LUAR kerangka aplikasi
 *  (tanpa sidebar/topbar/rail filter): jendela atau tab ini hanya berisi
 *  profil, supaya mudah disandingkan dengan aplikasi lain seperti EMIS.
 *  Karena tidak berada di dalam `<main>` Layout, halaman ini mengisi tinggi
 *  viewport sendiri. */
export default function ProfilSantriPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const parsed = Number(id);
  const profil = useProfilSantri(Number.isFinite(parsed) ? parsed : null);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xs font-semibold">
              {profil ? profil.santri.nama_lengkap : 'Profil Santri'}
            </h1>
            {profil && <KepalaProfil profil={profil} />}
          </div>
          <p className="text-xs text-muted-foreground">
            Detail data (baca-saja). Setiap baris punya tombol salin untuk menyalin satu nilai.
          </p>
        </div>
        <Button variant="outline" onClick={() => void navigate(-1)}>
          <ArrowLeft data-icon="inline-start" size={16} /> Kembali
        </Button>
      </div>

      {profil ? (
        <IsiProfilSantri profil={profil} className="min-h-0 flex-1 px-3" />
      ) : (
        <p className="py-10 text-center text-xs text-muted-foreground">Memuat data…</p>
      )}
    </div>
  );
}
