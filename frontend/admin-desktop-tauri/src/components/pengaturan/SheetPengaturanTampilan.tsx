import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import IsiPengaturanTampilan from './IsiPengaturanTampilan';

/** Event jendela untuk membuka panel ini dari mana pun (mis. tombol gerigi di
 *  kaki tabel) tanpa perlu mengoper state lewat banyak lapisan. */
export const EVENT_PENGATURAN_TAMPILAN = 'simpes:pengaturan-tampilan';

/** Buka panel pengaturan tampilan global secara terprogram. */
export function bukaPengaturanTampilan(): void {
  window.dispatchEvent(new CustomEvent(EVENT_PENGATURAN_TAMPILAN));
}

/** Rumah pengaturan GLOBAL untuk tampilan tabel: tinggi baris, huruf, dan
 *  warna. Dibuka dari TopBar sebagai panel geser NON-MODAL — penggelap tidak
 *  dipakai agar tabel di belakangnya tetap terlihat berubah saat nilai
 *  disetel (inilah alasan bentuknya Sheet, bukan halaman/dialog).
 *
 *  Semua nilai di sini berlaku untuk SELURUH tabel di SEMUA halaman, bukan
 *  per tabel — karena itu kontrolnya tidak lagi berada di dalam ExcelTable.
 *  Disimpan per perangkat (pref) dan di bagian tema tabel_header/tabel_sel. */
export default function SheetPengaturanTampilan({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Buka-tutup di sini juga memantau event global.
  const [terbuka, setTerbuka] = useState(open);
  useEffect(() => { setTerbuka(open); }, [open]);
  useEffect(() => {
    const buka = () => { setTerbuka(true); onOpenChange(true); };
    window.addEventListener(EVENT_PENGATURAN_TAMPILAN, buka);
    return () => window.removeEventListener(EVENT_PENGATURAN_TAMPILAN, buka);
  }, [onOpenChange]);
  const ubah = (o: boolean) => { setTerbuka(o); onOpenChange(o); };

  return (
    <Sheet open={terbuka} onOpenChange={ubah} modal={false}>
      <SheetContent
        side="right"
        overlay={false}
        className="w-full gap-3 sm:max-w-md"
        aria-label="Pengaturan tampilan tabel"
        /* Non-modal: klik di luar TIDAK menutup — pengguna bisa menyetel lalu
           langsung mencoba tabelnya. Tutup lewat tombol X atau tombol Esc. */
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Pengaturan tampilan tabel</SheetTitle>
          <SheetDescription>
            Berlaku untuk <strong>semua tabel</strong> di semua halaman. Ini setelan
            pribadi Anda di perangkat ini; bila belum diubah, nilai mengikuti standar
            pesantren.
          </SheetDescription>
        </SheetHeader>
        <IsiPengaturanTampilan />
      </SheetContent>
    </Sheet>
  );
}
