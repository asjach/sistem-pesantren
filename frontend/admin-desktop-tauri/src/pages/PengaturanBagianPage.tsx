import PartStyleEditor from '@/components/PartStyleEditor';

/** Pengaturan → Bagian UI: gaya atomik per bagian (font, warna, border,
 *  radius, padding) — dipisah mode terang/gelap. */
export default function PengaturanBagianPage() {
  return (
    <div className="flex flex-col gap-4">
      <p id="info_pengaturan_bagian" className="text-sm text-muted-foreground">
        Atur tampilan <b className="text-foreground">18 bagian</b> antarmuka (ribbon,
        judul, kartu, tabel, tombol, input, overlay). Tersimpan otomatis per
        pengguna, terpisah untuk mode terang & gelap.
      </p>
      <PartStyleEditor />
    </div>
  );
}
