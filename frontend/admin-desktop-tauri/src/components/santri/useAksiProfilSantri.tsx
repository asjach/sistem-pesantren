import { useCallback, useState, type ReactElement } from 'react';
import { ActionIcon } from '@/components/RowActions';
import { ProfilSantriDialog } from '@/components/ProfilSantriDialog';
import { Eye } from '@/icons';

export interface AksiProfilSantri {
  /** Tombol "Lihat detail Santri" untuk satu baris. Taruh di `renderActions`
   *  tabel agar muncul di kolom Aksi sekaligus di menu klik kanan baris —
   *  kolom Aksi boleh disembunyikan (`hideActions`) bila halaman hanya
   *  menampilkan lewat klik kanan saja. `prefix` membedakan id
   *  tombol untuk halaman yang punya beberapa tabel Santri. */
  aksiProfil: (santriId: number | null | undefined, prefix?: string) => ReactElement | null;
  /** Dialog profil — taruh satu kali di JSX halaman. */
  dialogProfil: ReactElement;
}

/** Aksi "Lihat detail Santri" beserta dialognya, untuk halaman yang barisnya
 *  mewakili seorang Santri. Dengan begitu profilSantri bisa dibuka dari
 *  mana saja (ikon di kolom Aksi atau klik kanan → AKSI), memakai satu
 *  dialog yang sama di semua halaman. */
export function useAksiProfilSantri(): AksiProfilSantri {
  const [santriId, setSantriId] = useState<number | null>(null);
  const aksiProfil = useCallback(
    (id: number | null | undefined, prefix?: string): ReactElement | null =>
      id == null ? null : (
        <ActionIcon
          id={`btn_profil_santri${prefix ? `_${prefix}` : ''}_${id}`}
          title="Lihat detail Santri"
          onClick={() => setSantriId(id)}
        >
          <Eye size={16} />
        </ActionIcon>
      ),
    [],
  );
  return {
    aksiProfil,
    dialogProfil: (
      <ProfilSantriDialog
        santriId={santriId}
        open={santriId !== null}
        onOpenChange={(o) => { if (!o) setSantriId(null); }}
      />
    ),
  };
}
