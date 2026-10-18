import { useEffect, useState } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { EVENT_TAMPILAN_PERANGKAT_BERUBAH } from '@/components/kelolaTabel/jenis';

/** Pref perangkat "tabel mengisi lebar pembungkus" per tabel. */
export function isiLebarKey(tableKey: string): string {
  return `simpes_grid_${tableKey}_isi_lebar`;
}

/**
 * Sakelar "Tabel mengisi lebar" (fitur `isiLebarPenuh`) untuk satu tabel.
 *
 * Tersimpan PER PERANGKAT (pref), sama seperti kolom beku & baris-ikut-isi —
 * lebarnya bergantung pada ukuran jendela pengguna, jadi tak masuk akal
 * disimpan sebagai setelan server yang berlaku untuk semua orang.
 *
 * Nilai pref (`'1'`/`'0'`) MENANG atas `bawaan` dari halaman: halaman hanya
 * menentukan keadaan awal tabelnya (mis. tabel kamus bawaan menyala), lalu
 * pengguna bebas mematikannya lewat gerigi "Pengaturan tabel" → Umum.
 * Perubahan dari dialog itu masuk lewat `EVENT_TAMPILAN_PERANGKAT_BERUBAH`
 * sehingga grid di belakang ikut berubah tanpa reload.
 */
export function useIsiLebar(tableKey: string, bawaan: boolean): boolean {
  /** null = pref belum pernah diatur → pakai `bawaan` halaman. */
  const [pilihan, setPilihan] = useState<boolean | null>(null);

  useEffect(() => {
    let hidup = true;
    const muat = () => {
      prefGet(isiLebarKey(tableKey))
        .then((v) => {
          if (!hidup) return;
          const kosong = v === null || v.trim() === '';
          setPilihan(kosong ? null : v === '1');
          /* Bawaan halaman yang MENYALA ditulis sekali ke pref supaya
             sakelar di Kelola Tabel → Umum membaca keadaan sebenarnya
             (tanpa ini dialog menampilkan "mati" padahal tabelnya menyala). */
          if (kosong && bawaan) setIsiLebar(tableKey, true).catch(() => {});
        })
        .catch(() => { /* pref gagal dibaca → ikut bawaan halaman */ });
    };
    muat();
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey === tableKey) muat();
    };
    window.addEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
    return () => {
      hidup = false;
      window.removeEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
    };
  }, [tableKey, bawaan]);

  return pilihan ?? bawaan;
}

/** Tulis pref-nya (dipakai dialog Kelola Tabel → Umum). */
export function setIsiLebar(tableKey: string, nyala: boolean): Promise<void> {
  return prefSet(isiLebarKey(tableKey), nyala ? '1' : '0');
}
