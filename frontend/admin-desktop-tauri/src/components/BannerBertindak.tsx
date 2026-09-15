import { useAuth } from '@/auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import { RotateCcw, TriangleAlert } from '@/icons';

/**
 * Banner peringatan saat super_admin "bertindak sebagai lembaga" (act-as).
 * Selalu terlihat (di luar area scroll konten) + tombol kembali ke mode penuh.
 */
export default function BannerBertindak() {
  const { user } = useAuth();
  const { lembagaId, lembaga, pilih } = useLembagaAktif();

  const superAdmin = !!user?.roles.some((r) => r.name === 'super_admin');
  if (!superAdmin || lembagaId == null) return null;

  const label = lembaga
    ? (lembaga.kode ? `${lembaga.kode} — ${lembaga.nama}` : lembaga.nama)
    : `#${lembagaId}`;

  return (
    <div
      id="banner_bertindak"
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-black/10 px-3 py-2 text-xs md:px-5 dark:border-white/10"
      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
    >
      <TriangleAlert size={15} aria-hidden="true" />
      <span>
        Anda sedang bertindak sebagai <b>{label}</b>
      </span>
      <button
        id="btn_kembali_dari_bertindak"
        type="button"
        title="Kembali ke mode super_admin (Semua lembaga)"
        onClick={() => pilih(null)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-black/10 px-2.5 py-1 font-medium transition-colors hover:bg-black/20 dark:bg-white/15 dark:hover:bg-white/25"
      >
        <RotateCcw size={13} aria-hidden="true" /> Kembali ke {user?.name}
      </button>
    </div>
  );
}
