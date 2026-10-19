import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import SpinBox from '@/components/SpinBox';
import {
  DEFAULT_HEADER_H, MAX_HEADER_H, MAX_ROW_H, MIN_HEADER_H, MIN_ROW_H,
} from '@/components/GridPrefs';
import {
  hapusPengaturanGlobal, muatPengaturanGlobal, simpanPengaturanGlobal,
  type KunciGlobal, type PetaGlobal,
} from '@/api/pengaturanGlobal';
import { PER_PAGE_DEFAULT } from '@/prefs';
import { RotateCcw } from '@/icons';

/** Batas & label tiap kunci — sejajar `KUNCI` di PengaturanGlobalController. */
const KETERANGAN: Record<
  KunciGlobal,
  { label: string; min: number; maks: number; bawaan: number; satuan?: string }
> = {
  tinggi_baris: { label: 'Tinggi baris sel', min: MIN_ROW_H, maks: MAX_ROW_H, bawaan: 26, satuan: 'px' },
  tinggi_header: { label: 'Tinggi baris header', min: MIN_HEADER_H, maks: MAX_HEADER_H, bawaan: DEFAULT_HEADER_H, satuan: 'px' },

  baris_per_halaman: { label: 'Baris per halaman', min: PER_PAGE_DEFAULT, maks: 500, bawaan: PER_PAGE_DEFAULT, satuan: 'baris' },
};

/**
 * Penetapan STANDAR tampilan bersama untuk semua pengguna (super_admin).
 *
 * Sengaja dialog TERPISAH dari panel Tampilan: panel itu berisi selera
 * pribadi di perangkat ini, sedangkan dialog ini mengubah apa yang diterima
 * SELURUH pengguna. Mencampur keduanya membuat orang tak sengaja mengubah
 * standar pesantren saat berniat menghias tampilannya sendiri.
 */
export default function DialogStandarTampilan({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [peta, setPeta] = useState<PetaGlobal>({});
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    muatPengaturanGlobal()
      .then((res) => setPeta(res.data.peta))
      .catch(() => toast.error('Gagal memuat standar tampilan.'));
  }, []);

  useEffect(() => {
    if (open) muat();
  }, [open, muat]);

  /** Setel standar satu kunci; `null` = hapus standar (kembali ke bawaan). */
  const setel = async (kunci: KunciGlobal, nilai: number | null) => {
    setSibuk(true);
    try {
      await simpanPengaturanGlobal(kunci, nilai);
      setPeta((prev) => {
        const next = { ...prev };
        if (nilai === null) delete next[kunci];
        else next[kunci] = nilai;
        return next;
      });
      toast.success(nilai === null
        ? `Standar ${KETERANGAN[kunci].label.toLowerCase()} dihapus.`
        : `Standar ${KETERANGAN[kunci].label.toLowerCase()} disimpan.`);
    } catch {
      toast.error('Gagal menyimpan standar tampilan.');
    } finally {
      setSibuk(false);
    }
  };

  const hapusSemua = async () => {
    setSibuk(true);
    try {
      await Promise.all((Object.keys(KETERANGAN) as KunciGlobal[]).map((k) => hapusPengaturanGlobal(k)));
      setPeta({});
      toast.success('Semua standar tampilan dihapus.');
    } catch {
      toast.error('Gagal menghapus standar tampilan.');
    } finally {
      setSibuk(false);
    }
  };

  const ada = Object.keys(peta).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-label="Standar tampilan pesantren">
        <DialogHeader>
          <DialogTitle>Standar tampilan pesantren</DialogTitle>
          <DialogDescription>
            Berlaku untuk <strong>semua pengguna</strong>. Pengguna tetap boleh
            menimpanya di perangkatnya sendiri — nilainya hanya dipakai saat
            mereka belum mengubah apa pun.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3" id="daftar_standar_tampilan">
          {(Object.keys(KETERANGAN) as KunciGlobal[]).map((kunci) => {
            const k = KETERANGAN[kunci];
            const nilai = peta[kunci];
            return (
              <div key={kunci} className="flex items-center justify-between gap-3">
                <label htmlFor={`standar_${kunci}`} className="text-sm">{k.label}</label>
                <div className="flex items-center gap-2">
                  <SpinBox
                    id={`standar_${kunci}`}
                    value={nilai ?? 0}
                    min={k.min}
                    max={k.maks}
                    title={nilai == null
                      ? `${k.label} — belum ada standar`
                      : `${k.label} — standar aktif`}
                    ariaLabel={`Standar ${k.label.toLowerCase()} (${k.satuan ?? 'px'})`}
                    onChange={(n) => setel(kunci, n)}
                  />
                  {nilai == null ? (
                    <span className="text-xs text-muted-foreground" id={`status_${kunci}`}>
                      belum ada
                    </span>
                  ) : (
                    <Button
                      id={`btn_hapus_standar_${kunci}`}
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={sibuk}
                      aria-label={`Hapus standar ${k.label.toLowerCase()}`}
                      title="Hapus standar"
                      onClick={() => setel(kunci, null)}
                    >
                      <RotateCcw size={14} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            id="btn_hapus_semua_standar"
            type="button"
            variant="outline"
            disabled={!ada || sibuk}
            onClick={hapusSemua}
          >
            Hapus semua standar
          </Button>
          <Button id="btn_tutup_standar" type="button" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
