import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  muatSetelanPencarian,
  simpanSetelanPencarian,
  type SetelanPencarianGlobal,
} from '@/api/pencarianGlobal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/** Pengaturan halaman yang ikut pencarian global non-Board. */
export default function PencarianGlobalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [daftar, setDaftar] = useState<SetelanPencarianGlobal[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await muatSetelanPencarian();
      setDaftar(res.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    if (open) void muat();
  }, [open, muat]);

  function jungkit(pageKey: string) {
    setDaftar((prev) => prev.map((item) => (
      item.page_key === pageKey ? { ...item, aktif: !item.aktif } : item
    )));
  }

  async function simpan() {
    setMenyimpan(true);
    try {
      const aktif = Object.fromEntries(daftar.map((item) => [item.page_key, item.aktif]));
      const res = await simpanSetelanPencarian(aktif);
      setDaftar(res.data);
      toast.success('Pengaturan pencarian global disimpan.');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pengaturan pencarian global</DialogTitle>
          <DialogDescription>
            Pilih halaman yang ikut dicari dari TopBar di halaman non-Board.
            Halaman baru default nonaktif.
          </DialogDescription>
        </DialogHeader>

        {memuat ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Memuat…</p>
        ) : (
          <ul className="flex flex-col gap-1" id="daftar_pencarian_global">
            {daftar.map((item) => (
              <li key={item.page_key}>
                <label className="flex items-center gap-2 border border-border px-2 py-2 text-xs">
                  <input
                    id={`cek_pencarian_${item.page_key}`}
                    type="checkbox"
                    checked={item.aktif}
                    onChange={() => jungkit(item.page_key)}
                    className="size-3.5 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            id="btn_simpan_pencarian_global"
            type="button"
            disabled={memuat || menyimpan}
            onClick={() => void simpan()}
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
