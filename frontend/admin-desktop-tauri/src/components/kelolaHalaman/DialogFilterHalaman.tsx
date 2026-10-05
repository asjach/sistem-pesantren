import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BagianProvider, useRegistriBagian, type AksiBagian } from '@/components/kelolaHalaman/kotor';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RotateCcw } from '@/icons';
import TabFilterTabel from '@/components/kelolaTabel/TabFilterTabel';
import type { KunciFilterGlobal } from '@/components/VisibilitasFilter';
import type { ModeSemuaFilterGlobal, TampilFilterGlobal } from '@/lib/filterHalaman';

/** Dialog filter untuk halaman TANPA tabel (mis. Dokumen Santri Lihat):
 *  halaman bertabel memakai dialog Kelola Tabel masing-masing. Memakai
 *  `page_key` sebagai kunci penyimpanan. */
export default function DialogFilterHalaman({
  open,
  onOpenChange,
  pageKey,
  judul,
  filterRelevan,
  bawaan,
  modeBawaan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageKey: string;
  judul: string;
  filterRelevan: readonly KunciFilterGlobal[];
  bawaan: TampilFilterGlobal;
  modeBawaan: ModeSemuaFilterGlobal;
}) {
  const [kotor, setKotor] = useState(false);
  const kotorRef = useRef(false);
  kotorRef.current = kotor;
  const simpanRef = useRef<(() => void) | null>(null);
  const [aksi, setAksi] = useState<AksiBagian | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [aksiTertunda, setAksiTertunda] = useState<(() => void) | null>(null);

  const lapor = useCallback((id: string, v: boolean) => {
    if (id === 'filter') setKotor(v);
  }, []);
  const daftarSimpan = useCallback((id: string, simpan: (() => void) | null) => {
    if (id !== 'filter') return;
    simpanRef.current = simpan;
  }, []);
  const daftarAksi = useCallback((id: string, a: AksiBagian | null) => {
    if (id === 'filter') setAksi(a);
  }, []);
  const registri = useRegistriBagian(lapor, daftarSimpan, daftarAksi);

  const coba = useCallback((fn: () => void) => {
    if (kotorRef.current) setAksiTertunda(() => fn);
    else fn();
  }, []);
  const tutup = useCallback(() => coba(() => onOpenChange(false)), [coba, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setKotor(false);
    setAksiTertunda(null);
    simpanRef.current = null;
  }, [open, pageKey]);

  async function simpan() {
    setMenyimpan(true);
    try {
      await simpanRef.current?.();
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : tutup())}>
      <DialogContent className="!flex max-h-[85dvh] flex-col !overflow-hidden !p-2 sm:max-w-xl [&>[data-slot=dialog-close]]:top-2 [&>[data-slot=dialog-close]]:right-2">
        <BagianProvider value={registri}>
          <DialogHeader className="shrink-0">
            <DialogTitle>Filter halaman: {judul}</DialogTitle>
            <DialogDescription className="sr-only">
              Atur visibilitas dan mode filter topBar halaman ini.
            </DialogDescription>
          </DialogHeader>

          <section id="bagian_filter_tabel" aria-label="Filter" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            <div className="flex items-center gap-2 border-b pb-1">
              <h3 className="text-xs font-semibold">Filter</h3>
              {aksi ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      id="btn_kembalikan_bagian_filter_tabel"
                      className="ml-auto"
                      aria-label={aksi.label}
                      disabled={aksi.disabled}
                      onClick={aksi.onClick}
                    >
                      <RotateCcw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{aksi.label}</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <TabFilterTabel
              tableKey={pageKey}
              filterRelevan={filterRelevan}
              bawaan={bawaan}
              modeBawaan={modeBawaan}
              labelKembalikan="Kembalikan ke bawaan halaman"
            />
          </section>

          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button type="button" variant="outline" id="btn_tutup_kelola_filter" onClick={tutup}>
              Tutup
            </Button>
            <Button
              type="button"
              id="btn_simpan_kelola_filter"
              disabled={!kotor || menyimpan}
              onClick={() => void simpan()}
            >
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </BagianProvider>
      </DialogContent>

      <AlertDialog open={aksiTertunda !== null} onOpenChange={(o) => { if (!o) setAksiTertunda(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Perubahan belum disimpan</AlertDialogTitle>
            <AlertDialogDescription>
              Perubahan yang belum disimpan akan hilang bila dilanjutkan. Pilih Batal lalu tekan
              Simpan untuk menyimpannya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              id="btn_buang_perubahan_kelola_filter"
              onClick={() => {
                const lanjut = aksiTertunda;
                setAksiTertunda(null);
                lanjut?.();
              }}
            >
              Buang perubahan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
