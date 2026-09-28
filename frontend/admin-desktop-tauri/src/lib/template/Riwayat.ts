/**
 * Riwayat perubahan untuk undo/redo pada kanvas.
 *
 * Seret pointer menghasilkan banyak perubahan kecil dalam satu gestur. Kalau
 * tiap perubahan masuk riwayat, satu seret bisa butuh puluhan Ctrl+Z. Karena
 * itu perubahan berturut-turut dengan label sama digabung menjadi satu
 * langkah, dan langkah ditutup secara eksplisit saat gestur berakhir.
 */

export interface Langkah<T> {
  label: string;
  sebelum: T;
  sesudah: T;
}

const BATAS_LANGKAH = 100;

export class Riwayat<T> {
  private langkah: Langkah<T>[] = [];

  private indeks = -1;

  /** Label yang masih dibuka; perubahan berikutnya akan digabung. */
  private gabungLabel: string | null = null;

  /**
   * Nilai dasar saat semua langkah yang tersisa sudah dibatalkan. Awalnya sama
   * dengan nilai awal, tetapi setelah riwayat dipangkas harus ikut bergeser ke
   * nilai sebelum langkah tertua yang masih tersimpan. Kalau tidak, undo melewati
   * langkah tertua akan melompat jauh ke belakang dan melewati nilai yang
   * sebenarnya sedang tampil.
   */
  private bawah: T;

  /** Dipanggil setiap kali nilai berubah, untuk.memberi tahu React. */
  menggambar: ((nilai: T, label: string) => void) | null = null;

  constructor(private awal: T) {
    this.bawah = awal;
  }

  nilai(): T {
    return this.indeks < 0 ? this.bawah : this.langkah[this.indeks].sesudah;
  }

  bisaUndo(): boolean {
    return this.indeks >= 0;
  }

  bisaRedo(): boolean {
    return this.indeks < this.langkah.length - 1;
  }

  jumlah(): number {
    return this.langkah.length;
  }

  /**
   * Catat sebuah perubahan. `gabungkan` bernilai true menggabungkannya dengan
   * langkah sebelumnya selama label-nya sama; inilah yang membuat satu seret
   * dihitung sebagai satu langkah.
   */
  catat(label: string, sesudah: T, gabungkan = false): void {
    const sebelum = this.nilai();

    if (Object.is(sebelum, sesudah)) {
      return;
    }

    const bolehGabung = gabungkan && this.gabungLabel === label && this.indeks >= 0;

    if (bolehGabung) {
      this.langkah[this.indeks] = { label, sebelum, sesudah };

      if (this.menggambar) {
        this.menggambar(sesudah, label);
      }

      return;
    }

    // Cabut langkah yang sudah dibatalkan (redo).
    this.langkah = this.langkah.slice(0, this.indeks + 1);
    this.langkah.push({ label, sebelum, sesudah });
    this.indeks = this.langkah.length - 1;
    this.gabungLabel = gabungkan ? label : null;

    if (this.langkah.length > BATAS_LANGKAH) {
      const dipangkas = this.langkah.length - BATAS_LANGKAH;
      this.langkah = this.langkah.slice(dipangkas);
      this.indeks -= dipangkas;
      // Dasar riwayat ikut bergeser, kalau tidak undo melompati nilai.
      this.bawah = this.langkah[0].sebelum;
    }

    if (this.menggambar) {
      this.menggambar(sesudah, label);
    }
  }

  /** Tutup gestur yang sedang digabung agar langkah berikutnya jadi baru. */
  tutupGabung(): void {
    this.gabungLabel = null;
  }

  undo(): T {
    if (!this.bisaUndo()) {
      return this.nilai();
    }

    const label = this.langkah[this.indeks].label;
    this.indeks -= 1;
    this.gabungLabel = null;

    if (this.menggambar) {
      this.menggambar(this.nilai(), label);
    }

    return this.nilai();
  }

  redo(): T {
    if (!this.bisaRedo()) {
      return this.nilai();
    }

    this.indeks += 1;
    this.gabungLabel = null;
    const label = this.langkah[this.indeks].label;

    if (this.menggambar) {
      this.menggambar(this.nilai(), label);
    }

    return this.nilai();
  }

  /** Kembalikan dasar riwayat, dipakai setelah memuat template dari server. */
  setAwal(nilai: T): void {
    this.awal = nilai;
    this.bawah = nilai;
    this.langkah = [];
    this.indeks = -1;
    this.gabungLabel = null;
  }
}
