import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { sedangMengetik } from '@/hooks/usePintasanBaru';

interface Pintasan {
  kunci: string;
  label: string;
}

const GLOBAL: Pintasan[] = [
  { kunci: 'Ctrl/⌘ K', label: 'Palet perintah' },
  { kunci: '/', label: 'Cari di halaman' },
  { kunci: 'Ctrl/⌘ B', label: 'Tampilkan atau sembunyikan sidebar' },
  { kunci: 'Ctrl/⌘ N', label: 'Aksi tambah utama di halaman yang mendukung' },
  { kunci: '?', label: 'Bantuan keyboard' },
  { kunci: 'Esc', label: 'Tutup dialog atau menu' },
  { kunci: 'Tab / Shift+Tab', label: 'Pindah fokus antar kontrol' },
];

const KONTEKSTUAL: Pintasan[] = [
  { kunci: 'Panah', label: 'Pindah sel grid atau baris' },
  { kunci: 'Enter', label: 'Mulai mengedit sel' },
  { kunci: 'Esc', label: 'Keluar dari mode edit' },
  { kunci: 'Ctrl/⌘ C', label: 'Salin blok sel saat Mode Ubah' },
  { kunci: 'Ctrl/⌘ V', label: 'Tempel blok sel saat Mode Ubah' },
  { kunci: '← / →', label: 'Pindahkan poin Board saat baris fokus' },
];

function Bagian({ judul, baris }: { judul: string; baris: Pintasan[] }) {
  return (
    <section aria-label={judul} className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {judul}
      </h3>
      <dl className="flex flex-col gap-1.5">
        {baris.map((item) => (
          <div key={`${item.kunci}-${item.label}`} className="flex items-start justify-between gap-3">
            <dt className="text-xs leading-snug">{item.label}</dt>
            <dd className="shrink-0">
              <kbd className="rounded border border-border bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
                {item.kunci}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Overlay bantuan keyboard. Dibuka dari tombol TopBar atau tombol `?`. */
export default function BantuanKeyboard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (buka: boolean) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (open) return;
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (sedangMengetik(e.target as HTMLElement | null)) return;
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      e.preventDefault();
      onOpenChange(true);
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" id="dialog_bantuan_keyboard">
        <DialogHeader>
          <DialogTitle className="text-sm">Bantuan keyboard</DialogTitle>
          <DialogDescription>
            Pintasan yang tersedia di aplikasi. Tekan Esc untuk menutup.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 sm:grid-cols-2">
          <Bagian judul="Global" baris={GLOBAL} />
          <Bagian judul="Grid dan Board" baris={KONTEKSTUAL} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
