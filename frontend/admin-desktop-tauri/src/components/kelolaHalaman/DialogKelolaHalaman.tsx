import { useCallback, useEffect, useMemo, useState } from 'react';

import { errorMessage } from '@/api/client';
import {
  hapusPengaturanHalaman,
  muatPengaturanHalaman,
  simpanPengaturanHalaman,
} from '@/api/pengaturanHalaman';
import { useLembagaAktif } from '@/lembagaAktif';
import type { HalamanDef } from '@/lib/halaman';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw } from '@/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Urutan rute per halaman, dikelola dalam satu daftar: geser naik/turun
 *  untuk memindahkan, sakelar mata untuk sembunyikan. Semua tab tersimpan di
 *  satu daftar supaya menyembunyikan tidak menghapus posisinya. */
export default function DialogKelolaHalaman({
  open,
  onOpenChange,
  def,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  def: HalamanDef;
}) {
  const { efektifSuper: bolehUbah } = useLembagaAktif();
  const pageKey = def.to.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  const tabKode = useMemo(() => def.tabHalaman ?? [], [def]);

  /** Daftar kerja: SEMUA rute tab kode, dalam urutan tampil saat ini. */
  const [urutan, setUrutan] = useState<string[]>([]);
  const [sembunyi, setSembunyi] = useState<string[]>([]);
  const [acuan, setAcuan] = useState('');
  const [busy, setBusy] = useState(false);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await muatPengaturanHalaman([pageKey]);
      const d = res.data.peta[pageKey];
      const semua = tabKode.map((t) => t.to);

      const tersimpan = (d?.urutan ?? []).filter((r) => semua.includes(r));
      const baru = semua.filter((r) => !tersimpan.includes(r));
      const urut = [...tersimpan, ...baru];
      const semb = (d?.sembunyi ?? []).filter((r) => semua.includes(r));
      setUrutan(urut);
      setSembunyi(semb);
      setAcuan(JSON.stringify({ urut, semb }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setMemuat(false);
    }
  }, [pageKey, tabKode]);

  useEffect(() => {
    if (open) void muat();
  }, [open, muat]);

  const kotor = JSON.stringify({ urut: urutan, semb: sembunyi }) !== acuan;

  function geser(rute: string, arah: -1 | 1) {
    setUrutan((kini) => {
      const i = kini.indexOf(rute);
      const j = i + arah;
      if (i < 0 || j < 0 || j >= kini.length) return kini;
      const salinan = [...kini];
      [salinan[i], salinan[j]] = [salinan[j], salinan[i]];
      return salinan;
    });
  }

  function balikSembunyi(rute: string) {
    setSembunyi((kini) => (kini.includes(rute) ? kini.filter((r) => r !== rute) : [...kini, rute]));
  }

  async function simpan() {
    setBusy(true);
    try {

      await simpanPengaturanHalaman(pageKey, urutan, sembunyi);
      setAcuan(JSON.stringify({ urut: urutan, semb: sembunyi }));
      toast.success('Urutan tab disimpan.');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function kembalikan() {
    setBusy(true);
    try {
      await hapusPengaturanHalaman(pageKey);
      await muat();
      toast.success('Urutan tab dikembalikan ke bawaan.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const peta = new Map(tabKode.map((t) => [t.to, t]));
  const terlihat = urutan.filter((r) => !sembunyi.includes(r)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kelola halaman: {def.label}</DialogTitle>
          <DialogDescription>
            Atur urutan dan tab yang tampil. Berlaku untuk semua pengguna —
            {` ${terlihat} dari ${urutan.length} tab ditampilkan.`}
          </DialogDescription>
        </DialogHeader>

        {memuat ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Memuat…</p>
        ) : (
          <ul className="flex flex-col gap-1" id={`daftar_tab_${pageKey}`}>
            {urutan.map((rute, i) => {
              const tab = peta.get(rute);
              if (!tab) return null;
              const tampil = !sembunyi.includes(rute);
              return (
                <li
                  key={rute}
                  className={cn(
                    'flex items-center gap-2 border border-border px-2 py-1.5',
                    !tampil && 'opacity-60',
                  )}
                >
                  <span className="w-4 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{tab.label}</span>
                  <Button
                    id={`btn_tab_naik_${i}`}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Naikkan ${tab.label}`}
                    disabled={!bolehUbah || busy || i === 0}
                    onClick={() => geser(rute, -1)}
                    className="size-6"
                  >
                    <ChevronUp size={13} />
                  </Button>
                  <Button
                    id={`btn_tab_turun_${i}`}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Turunkan ${tab.label}`}
                    disabled={!bolehUbah || busy || i === urutan.length - 1}
                    onClick={() => geser(rute, 1)}
                    className="size-6"
                  >
                    <ChevronDown size={13} />
                  </Button>
                  <Button
                    id={`btn_tab_tampil_${i}`}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={tampil ? `Sembunyikan ${tab.label}` : `Tampilkan ${tab.label}`}
                    aria-pressed={!tampil}
                    disabled={!bolehUbah || busy}
                    onClick={() => balikSembunyi(rute)}
                    className="size-6"
                  >
                    {tampil ? <Eye size={13} /> : <EyeOff size={13} />}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            id="btn_kembalikan_tab"
            type="button"
            variant="ghost"
            disabled={!bolehUbah || busy || memuat}
            onClick={() => void kembalikan()}
          >
            <RotateCcw size={14} />
            Kembalikan bawaan
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              id="btn_simpan_tab"
              type="button"
              disabled={!bolehUbah || busy || memuat || !kotor}
              onClick={() => void simpan()}
            >
              Simpan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
