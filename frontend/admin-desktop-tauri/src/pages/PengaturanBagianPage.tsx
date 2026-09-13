import PartStyleEditor from '@/components/PartStyleEditor';

/** Pengaturan → Bagian UI: gaya atomik per bagian (font, warna, border,
 *  radius, padding) — dipisah mode terang/gelap. */
export default function PengaturanBagianPage() {
  return (
    <div className="flex flex-col gap-4">
      <PartStyleEditor />
    </div>
  );
}
