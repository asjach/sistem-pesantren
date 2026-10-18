import { cn } from '@/lib/utils';
import { htmlAdaIsi, sanitasiHtml } from './sanitasiHtml';

/**
 * HTML info tabel yang SIAP dirender (popover bilah judul & pratinjau di
 * dialog Kelola Tabel).
 *
 * Sanitasi dilakukan lagi di sini meski backend sudah menyaringnya: respons
 * server bisa datang dari cache/proxy/skema lama, dan `dangerouslySetInnerHTML`
 * adalah satu-satunya tempat di klien yang mengeksekusi HTML. Allowlist-nya
 * sama persis dengan backend, jadi yang lolos di sini juga lolos di sana.
 */
export default function InfoTampil({
  html,
  className,
  kosong = null,
}: {
  html: string | null | undefined;
  className?: string;
  /** Yang dirender bila HTML tak berisi apa pun (bawaan: tidak ada). */
  kosong?: React.ReactNode;
}) {
  const aman = html === null || html === undefined ? '' : sanitasiHtml(html);
  if (!htmlAdaIsi(aman)) return <>{kosong}</>;
  return (
    <div
      className={cn('info-tabel-isi text-xs', className)}
      dangerouslySetInnerHTML={{ __html: aman }}
    />
  );
}
