import { useMemo } from 'react';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { IsiProfilSantri, KepalaProfil, TAUT_BAGIAN_PROFIL, useProfilSantri } from '@/components/santri/IsiProfilSantri';
import DispensasiSantriPanel from '@/components/keuangan/DispensasiSantriPanel';
import TagihanSantriPanel from '@/components/keuangan/TagihanSantriPanel';
import { ChevronLeft, ChevronRight, ExternalLink, X } from '@/icons';
import { bukaDiTabBaru } from '@/lib/tabBaru';
import { toast } from 'sonner';

/** Awalan id jangkar tiap bagian isi profil di dialog ini. */
const JANGKAR_PROFIL = 'profil_santri';

/** Kerangka isi selagi data dimuat — bentuknya menyerupai isi asli (judul +
 *  panel ganda) supaya tinggi dialog tidak melompat saat data tiba. */
function KerangkaProfil() {
  return (
    <div role="status" aria-label="Memuat profil" className="h-[60vh] min-h-72 space-y-6 overflow-hidden pr-1">
      <span className="sr-only">Memuat profil…</span>
      {[0, 1].map((b) => (
        <div key={b} className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((p) => (
              <div key={p} className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-28 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Santri yang sedang dibuka + urutan tabel asal (untuk mencari tetangga). */
export interface TargetProfil {
  id: number;
  /** Id Santri sesuai urutan baris tabel asal; kosong = tanpa tetangga. */
  daftar: number[];
}

export interface ProfilSantriDialogProps {
  /** null = dialog tertutup. */
  target: TargetProfil | null;
  /** Pindah ke Santri lain (tombol Sebelumnya/Berikutnya). */
  onGanti: (santriId: number) => void;
  onOpenChange: (o: boolean) => void;
}

/** Dialog profil Santri (baca-saja): isi yang sama dengan halaman profil,
 *  dibungkus dialog agar bisa dibuka dari tabel mana pun. Ikon di footer
 *  membuka profil yang sama di tab/jendela baru supaya bisa disandingkan
 *  dengan aplikasi lain (mis. EMIS) saat mengisi formulir. */
export function ProfilSantriDialog({ target, onGanti, onOpenChange }: ProfilSantriDialogProps) {
  const open = target !== null;
  const profil = useProfilSantri(target?.id ?? null, open);
  const { user } = useAuth();
  /** Panel tagihan + chip lompatnya hanya untuk pemegang izin keuangan. */
  const bolehKeuangan = bisa(user, 'keuangan.lihat');

  /** Tetangga dari tabel asal, urut dan tanpa duplikat (satu Santri bisa
   *  muncul di beberapa baris, mis. riwayat per tahun). Satu baris dihitung
   *  sekali agar tombol tidak pernah terasa "macet". */
  const tetangga = useMemo(
    () => [...new Set(target?.daftar ?? [])],
    [target],
  );
  const posisi = target ? tetangga.indexOf(target.id) : -1;

  const adaTetangga = posisi > 0 || posisi < tetangga.length - 1;
  const bisaPrev = posisi > 0;
  const bisaNext = posisi >= 0 && posisi < tetangga.length - 1;

  async function bukaTabBaru() {
    if (!target) return;
    const hasil = await bukaDiTabBaru(
      `/santri/${target.id}/profil`,
      `Profil: ${profil?.santri.nama_lengkap ?? 'Santri'}`,
    );
    if (hasil === 'gagal') toast.error('Gagal membuka tab baru.');
  }

  /** Gulir halus ke bagian isi profil (di dalam area gulir dialog). */
  function lompatKeBagian(slug: string) {
    document.getElementById(`${JANGKAR_PROFIL}_${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="px-3 py-3 sm:max-w-4xl" showCloseButton={false}>

        <DialogClose asChild>
          <Button
            aria-label="Tutup"
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 text-destructive hover:bg-destructive/10"
          >
            <X size={16} />
          </Button>
        </DialogClose>
        <DialogHeader>

          <div className="flex items-start justify-between gap-3 pr-10">
            <div className="min-w-0">
              <DialogTitle>{profil ? profil.santri.nama_lengkap : 'Profil Santri'}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-1.5">
                <span>Detail data (baca-saja).</span>
                {profil && <KepalaProfil profil={profil} />}
              </DialogDescription>
            </div>

            {adaTetangga && (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  id="btn_profil_santri_sebelumnya"
                  variant="outline"
                  size="sm"
                  disabled={!bisaPrev}
                  onClick={() => onGanti(tetangga[posisi - 1])}
                >
                  <ChevronLeft data-icon="inline-start" size={16} /> Sebelumnya
                </Button>
                <span
                  data-part="posisi_tetangga"
                  className="px-1 text-xs tabular-nums text-muted-foreground"
                >
                  {posisi + 1} / {tetangga.length}
                </span>
                <Button
                  id="btn_profil_santri_berikutnya"
                  variant="outline"
                  size="sm"
                  disabled={!bisaNext}
                  onClick={() => onGanti(tetangga[posisi + 1])}
                >
                  Berikutnya <ChevronRight data-icon="inline-end" size={16} />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {profil && (
          <nav aria-label="Lompat ke bagian profil" className="flex shrink-0 flex-wrap gap-1">
            {TAUT_BAGIAN_PROFIL.filter((t) => t.slug !== 'tagihan' || bolehKeuangan).map((t) => (
              <Button
                key={t.slug}
                id={`btn_lompat_${t.slug}`}
                variant="outline"
                size="sm"
                className="h-[26px] px-2 text-xs"
                onClick={() => lompatKeBagian(t.slug)}
              >
                {t.judul}
              </Button>
            ))}
          </nav>
        )}

        {profil ? (
          <IsiProfilSantri
            profil={profil}
            className="h-[60vh] min-h-72"
            jangkar={JANGKAR_PROFIL}
            ekstra={
              <>
                <TagihanSantriPanel
                  santri={{ id: profil.santri.id, nama_lengkap: profil.santri.nama_lengkap }}
                  jangkar={`${JANGKAR_PROFIL}_tagihan`}
                />
                <DispensasiSantriPanel santri={{ id: profil.santri.id, nama_lengkap: profil.santri.nama_lengkap }} />
              </>
            }
          />
        ) : (
          <KerangkaProfil />
        )}

        <DialogFooter>
          <Button
            id="btn_profil_santri_tab_baru"
            variant="outline"
            disabled={!profil}
            onClick={() => void bukaTabBaru()}
          >
            <ExternalLink data-icon="inline-start" size={16} /> Buka di tab baru
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
