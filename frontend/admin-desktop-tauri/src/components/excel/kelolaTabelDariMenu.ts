/**
 * Penjaga panel Kelola Tabel saat dibuka dari MENU KLIK KANAN.
 *
 * MASALAH (dibuktikan lewat uji browser nyata — Playwright + Chromium):
 * Radix memilih item menu pada `pointerup`, lalu fokus/fokus-kembali dari
 * gestur menu itu berpindah ke luar panel tak lama sesudahnya. Panel Kelola
 * Tabel muncul NON-MODAL, jadi @radix-ui/react-dismissable-layer
 * menganggapnya "interaksi di luar" / "fokus di luar" dan menutup panel
 * yang baru saja terbuka. Lewat tombol gerigi tak terjadi karena tidak
 * melewati menu.
 *
 * Jejak terukur (klik kanan bilah judul → Kelola Tabel):
 *   @46ms   panel `open`
 *   @577ms  fokus pindah ke DIV di luar panel
 *   @594ms  panel `closed`  ← tertutup sendiri
 *
 * Kenapa BUKAN listener `click`: yang menentukan dismiss adalah
 * `pointerdown` yang sudah tercatat SEBELUM kita sempat memasang apa pun,
 * dan keputusannya dijalankan pada tick berikutnya (`setTimeout(0)`).
 * Membatalkan `click` di fase capture TIDAK mempan — dibuktikan di browser
 * (panel tetap tertutup). Karena itu penjaganya dipasang di sisi DIALOG
 * lewat `onInteractOutside` + `onFocusOutside` + `onPointerDownOutside`:
 * selama jendela tenggang singkat, ketiganya diabaikan.
 */

/** Lama jendela tenggang (ms) setelah panel dibuka dari menu klik kanan.
 *
 * 900ms dipilih dari pengukuran: fokus sisa gestur menu mendarat di luar
 * panel sekitar 530ms setelah panel terbuka, jadi 400ms (nilai awal) masih
 * kurang dan panel tetap tertutup. 900ms memberi margin aman, tapi tetap
 * jauh lebih pendek dari reaksi klik-luar manusia yang sungguhan sehingga
 * klik-luar biasa tetap menutup panel (diverifikasi di browser). */
export const TENGGANG_BUKA_DARI_MENU_MS = 900;


/**
 * Penanda waktu "baru saja dibuka dari menu klik kanan".
 *
 * Dipakai berpasangan: `tandai()` tepat sebelum membuka panel dari menu,
 * lalu `lagiTenggang()` diperiksa penjaga `onInteractOutside` milik panel.
 */
export function buatTenggangMenu() {
  let sampai = 0;
  return {
    /** Tandai bahwa panel baru saja dibuka dari menu klik kanan. */
    tandai(ms: number = TENGGANG_BUKA_DARI_MENU_MS) {
      sampai = Date.now() + ms;
    },
    /** Masih dalam jendela tenggang? */
    lagiTenggang(): boolean {
      return Date.now() < sampai;
    },
  };
}

export type TenggangMenu = ReturnType<typeof buatTenggangMenu>;
/** Penanda bersama yang dipakai pintu menu dan dibaca panel Kelola Tabel.
 *  Modul-lingkup (bukan state React) supaya pintu menu di komponen mana pun
 *  bisa menandai tanpa harus meneruskan prop berlapis-lapis. */
export const tenggangMenu = buatTenggangMenu();

/** Buka panel Kelola Tabel dari MENU KLIK KANAN: tandai jendela tenggang
 *  lebih dulu, baru jalankan pembuka. Panelnya (DialogKelolaTabel) membaca
 *  penanda ini untuk mengabaikan interaksi-luar sisa gestur menu. */
export function bukaDariMenu(buka: () => void): void {
  tenggangMenu.tandai();
  buka();
}