/** Footer ExcelTabelV2. Tahap awal hanya menyediakan wrapper-nya. */
export default function KakiTabelV2() {
  return (
    <div
      data-slot="excel-table-footer"
      data-part="kaki_tabel"
      /* Sementara: kuning = footer; hapus setelah identifikasi visual. */
      className="flex h-8 shrink-0 items-center border-t border-border bg-amber-500/25 px-2"
    />
  );
}
