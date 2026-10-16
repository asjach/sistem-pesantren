import type { ReactNode } from 'react';

export interface LabelTombolTambahProps {
  /** Isi tombol di kiri chip (ikon dan/atau teks). */
  children: ReactNode;
  /** Label pintasan yang ditampilkan, mis. "⌘N". `null` = tanpa chip. */
  pintasan?: string | null;
}

/**
 * Isi tombol aksi-tambah dengan **chip pintasan** di kanannya, mis.
 * `<LabelTombolTambah pintasan="⌘N">+ Entri</LabelTombolTambah>`.
 *
 * Chip-nya memakai warna teks tombol (`border-current`), jadi tetap terbaca
 * pada tombol primary maupun outline, juga saat `disabled:opacity-50`.
 * `aria-hidden` dipasang agar pembaca layar tidak mengeja "⌘N" sebagai nama
 * tombol — pintasannya sudah diumumkan lewat `title`/`aria-keyshortcuts` di
 * sisi pemanggil.
 */
export default function LabelTombolTambah({ children, pintasan }: LabelTombolTambahProps) {
  if (!pintasan) return <>{children}</>;
  return (
    <>
      {children}
      <kbd
        aria-hidden="true"
        data-pintasan={pintasan}
        className="ml-1 rounded border border-current/40 px-1 font-mono text-[10px] leading-[14px] opacity-70"
      >
        {pintasan}
      </kbd>
    </>
  );
}
