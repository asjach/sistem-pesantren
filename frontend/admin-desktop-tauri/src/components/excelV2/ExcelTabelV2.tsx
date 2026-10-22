import BilahHeaderV2 from './BilahHeaderV2';
import KakiTabelV2 from './KakiTabelV2';

/**
 * ExcelTabelV2. Tahap ini menyusun tiga zona layout dan kerangka toolbar;
 * isi tiap zona ditambahkan bertahap.
 */
export default function ExcelTabelV2({ judul }: { judul: string }) {
  return (
    <div
      data-slot="excel-table"
      data-varian="v2"
      className="flex min-h-0 flex-1 flex-col"
    >
      <BilahHeaderV2 judul={judul} />

      <div
        data-slot="excel-table-body"
        /* Sementara: hijau = area tabel; hapus setelah identifikasi visual. */
        className="flex min-h-0 flex-1 flex-col bg-emerald-500/20"
      />

      <KakiTabelV2 />
    </div>
  );
}
