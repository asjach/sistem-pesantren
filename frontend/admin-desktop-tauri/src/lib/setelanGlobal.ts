/**
 * Resolusi setelan bertingkat: server (standar super_admin) -> perangkat
 * (selera sendiri) -> `null`.
 *
 * Aturan: nilai perangkat MENANG bila ada; server mengisi saat perangkat
 * belum pernah mengubah. Jadi pengguna yang sudah menyetel sendiri tidak
 * berubah perilakunya saat super_admin menetapkan standar - sedangkan
 * perangkat baru langsung mengikuti standar.
 *
 * Mengembalikan `null` bila TIDAK ADA nilai di lapisan mana pun: pemanggil
 * memperlakukannya sebagai "ikuti jalur lain" (mis. `ExcelTable` memakai
 * density bawaan DSG). Karena itu fungsi ini tidak menerima bawaan angka -
 * mengembalikan angka di sini akan mematikan jalur cadangan itu.
 */
export function nilaiBerlapis(
  server: number | null | undefined,
  perangkat: number | null | undefined,
): number | null {
  if (perangkat !== null && perangkat !== undefined) return perangkat;
  if (server !== null && server !== undefined) return server;
  return null;
}

/**
 * Sumber nilai yang menang - dipakai UI untuk menyatakan "mengikuti standar"
 * vs "diatur sendiri" supaya pengguna tahu kenapa nilainya berubah.
 */
export function sumberNilai(
  server: number | null | undefined,
  perangkat: number | null | undefined,
): 'perangkat' | 'server' | 'bawaan' {
  if (perangkat !== null && perangkat !== undefined) return 'perangkat';
  if (server !== null && server !== undefined) return 'server';
  return 'bawaan';
}
