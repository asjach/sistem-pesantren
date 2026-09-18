import { useEffect } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import { useStandarTampilan } from '@/standarTampilan';
import { hasOpenEditor } from '@/components/excel/helpers';
import { cn } from '@/lib/utils';
import { RotateCcw, TriangleAlert } from '@/icons';

/** Tombol cepat peran (urutan tetap sesuai permintaan). */
const CEPAT = ['MI', 'MD', 'MTS', 'MLN'];

/**
 * Banner peran super_admin: pemilih cepat MI/MD/MTS/MLN + penanda act-as.
 * Tampil saat sedang bertindak sebagai lembaga ATAU saat pemilih dibuka
 * lewat tombol "PERAN SEBAGAI" di topbar. Keluar: Esc atau tombol kembali.
 */
export default function BannerBertindak({ terbuka, onTutup }: {
  /** Pemilih peran sedang dibuka (tampil walau belum bertindak). */
  terbuka: boolean;
  onTutup: () => void;
}) {
  const { user } = useAuth();
  const { peranId, peran, pilihan, pilihPeran } = useLembagaAktif();
  const { rekam, setRekam, menyimpan } = useStandarTampilan();

  const superAdmin = !!user?.roles.some((r) => r.name === 'super_admin');
  const bertindak = peranId != null;
  const tampil = superAdmin && (bertindak || terbuka);

  const cepat = pilihan.filter((p) => CEPAT.includes(p.kode ?? ''));
  const tombol = cepat.length > 0 ? cepat : pilihan;

  // Esc = tutup pemilih / kembali ke mode super_admin. Dialog/menu yang
  // terbuka dan editor sel grid tetap didahulukan (jangan dibajak).
  useEffect(() => {
    if (!tampil) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[role="dialog"], [role="listbox"], [role="menu"]')) return;
      if (hasOpenEditor()) return;
      e.preventDefault();
      // Banner terpasang sebelum tabel halaman: cegah handler Esc grid.
      e.stopImmediatePropagation();
      if (bertindak) pilihPeran(null);
      onTutup();
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [tampil, bertindak, pilihPeran, onTutup]);

  if (!tampil) return null;

  const label = peran
    ? (peran.kode ? `${peran.kode} — ${peran.nama}` : peran.nama)
    : null;

  return (
    <div
      id="banner_bertindak"
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-black/10 px-3 py-2 text-xs md:px-5 dark:border-white/10"
      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
    >
      <TriangleAlert size={15} aria-hidden="true" />
      {bertindak ? (
        <span>
          Anda sedang bertindak sebagai <b>{label ?? `#${peranId}`}</b>
        </span>
      ) : (
        <span>
          Pilih peran lembaga <b>(Esc = batal)</b>
        </span>
      )}

      <span className="inline-flex items-center gap-1" role="group" aria-label="Peran cepat">
        {tombol.map((p) => {
          const aktif = p.id === peranId;
          return (
            <button
              key={p.id}
              id={`btn_peran_lembaga_${(p.kode ?? String(p.id)).toLowerCase()}`}
              type="button"
              title={p.nama}
              aria-label={`Berperan sebagai ${p.nama}`}
              aria-pressed={aktif}
              onClick={() => { pilihPeran(p.id); onTutup(); }}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                aktif
                  ? 'bg-black/25 dark:bg-white/25'
                  : 'bg-black/10 hover:bg-black/20 dark:bg-white/15 dark:hover:bg-white/25',
              )}
            >
              {p.kode ?? p.nama}
            </button>
          );
        })}
      </span>

      {bertindak && (
        <label
          htmlFor="chk_rekam_visual"
          className="ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/10 px-2 py-0.5 font-medium dark:bg-white/15"
          title="Jika aktif, perubahan tampilan ikut mengubah standar lembaga ini."
        >
          <input
            id="chk_rekam_visual"
            type="checkbox"
            checked={rekam}
            onChange={(e) => setRekam(e.target.checked)}
            className="size-3.5 accent-current"
            style={{ accentColor: 'currentColor' }}
          />
          Rekam visual
        </label>
      )}

      {bertindak && (
        <span className="opacity-80">
          {rekam
            ? (menyimpan ? '· menyimpan standar…' : '· perubahan tampilan tersimpan ke standar lembaga ini')
            : '· hanya berperan, tampilan lembaga tidak diubah'}
        </span>
      )}

      {/* Selalu tampil selama banner terbuka: menutup pemilih / keluar dari peran. */}
      <button
        id="btn_kembali_dari_bertindak"
        type="button"
        title="Kembali ke mode super_admin (Semua lembaga)"
        onClick={() => { pilihPeran(null); onTutup(); }}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-black/10 px-2.5 py-1 font-medium transition-colors hover:bg-black/20 dark:bg-white/15 dark:hover:bg-white/25"
      >
        <RotateCcw size={13} aria-hidden="true" /> Kembali ke {user?.name}
      </button>
    </div>
  );
}
