import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';

/**
 * Catatan kecil di halaman berproses (Mutasi Keluar, Kenaikan Kelas,
 * Kelulusan): filter tahun ajaran dipakai untuk melihat data/riwayat,
 * sedangkan proses hanya berlaku untuk Santri AKTIF pada tahun ajaran aktif.
 */
export default function CatatanProsesTahunAjaran() {
  const { tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();
  const { pilihan, loading } = useTahunAjaranAktif();

  if (loading || filterLoading) {
    return null;
  }

  const aktif = pilihan.find((p) => p.is_aktif)?.nama ?? null;
  const terpilih = tahunAjaranNames;
  const prosesBisaJalan = terpilih.length === 1 && (aktif === null || terpilih[0] === aktif);

  if (prosesBisaJalan) {
    return null;
  }

  return (
    <p className="text-xs text-muted-foreground" id="catatan_tahun_ajaran_proses">
      Filter tahun ajaran untuk melihat data. Proses hanya berlaku untuk Santri aktif pada tahun
      ajaran aktif{aktif ? ` (${aktif})` : ''}.
    </p>
  );
}
