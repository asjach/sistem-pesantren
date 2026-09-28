import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IsiProfilSantri, KepalaProfil, useProfilSantri } from '@/components/santri/IsiProfilSantri';
import { ChevronLeft, ChevronRight, ExternalLink } from '@/icons';
import { bukaDiTabBaru } from '@/lib/tabBaru';
import { toast } from 'sonner';

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

  /** Tetangga dari tabel asal, urut dan tanpa duplikat (satu Santri bisa
   *  muncul di beberapa baris, mis. riwayat per tahun). Satu baris dihitung
   *  sekali agar tombol tidak pernah terasa "macet". */
  const tetangga = useMemo(
    () => [...new Set(target?.daftar ?? [])],
    [target],
  );
  const posisi = target ? tetangga.indexOf(target.id) : -1;
  // Tampil bila ada tetangga di salah satu sisi (bukan hanya di tengah
  // daftar); tiap tombol tetap dimatikan sendiri di ujungnya.
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>{profil ? profil.santri.nama_lengkap : 'Profil Santri'}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-1.5">
                <span>Detail data (baca-saja).</span>
                {profil && <KepalaProfil profil={profil} />}
              </DialogDescription>
            </div>

            {/* Navigasi tetangga: hanya tampil bila tabel asal punya baris
                Santri lain di kiri/kanan posisi sekarang. */}
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

        {profil ? (
          <IsiProfilSantri profil={profil} className="h-[60vh] min-h-72" />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Memuat data…</p>
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
