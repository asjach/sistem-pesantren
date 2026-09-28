import { useCallback, useState, type ReactElement } from 'react';
import { ActionIcon } from '@/components/RowActions';
import { ProfilSantriDialog } from '@/components/ProfilSantriDialog';
import { Eye } from '@/icons';

/** Opsi satu tombol profil di dalam `renderActions`. */
export interface OpsiAksiProfil {
  /** Membedakan id tombol antar tabel di halaman yang sama. */
  prefix?: string;
  /** Id Santri sesuai urutan tabel asal (baris yang sedang tampil). Mengisi
   *  tombol Sebelumnya/Berikutnya pada dialog profil. Kosongkan bila tabel
   *  tidak punya tetangga yang perlu dijejaki. */
  daftar?: number[];
}

export interface AksiProfilSantri {
  /** Tombol "Lihat detail Santri" untuk satu baris. Taruh di `renderActions`
   *  tabel agar muncul di kolom Aksi sekaligus di menu klik kanan baris —
   *  kolom Aksi boleh disembunyikan (`hideActions`) bila halaman hanya
   *  menampilkan lewat klik kanan saja. */
  aksiProfil: (santriId: number | null | undefined, opsi?: OpsiAksiProfil) => ReactElement | null;
  /** Dialog profil — taruh satu kali di JSX halaman. */
  dialogProfil: ReactElement;
}

/** Santri yang sedang profilnya dibuka + urutan tabel asal untuk navigasi. */
interface Target {
  id: number;
  daftar: number[];
}

/** Aksi "Lihat detail Santri" beserta dialognya, untuk halaman yang barisnya
 *  mewakili seorang Santri. Dengan begitu profil Santri bisa dibuka dari
 *  mana saja (ikon di kolom Aksi atau klik kanan → AKSI), memakai satu
 *  dialog yang sama di semua halaman, dan profil bisa dijelajahi ke Santri
 *  tetangga sesuai urutan tabel asalnya. */
export function useAksiProfilSantri(): AksiProfilSantri {
  const [target, setTarget] = useState<Target | null>(null);
  const aksiProfil = useCallback(
    (id: number | null | undefined, opsi?: OpsiAksiProfil): ReactElement | null => {
      if (id == null) return null;
      const prefix = opsi?.prefix;
      return (
        <ActionIcon
          id={`btn_profil_santri${prefix ? `_${prefix}` : ''}_${id}`}
          title="Lihat detail Santri"
          onClick={() => setTarget({ id, daftar: opsi?.daftar ?? [] })}
        >
          <Eye size={16} />
        </ActionIcon>
      );
    },
    [],
  );
  return {
    aksiProfil,
    dialogProfil: (
      <ProfilSantriDialog
        target={target}
        onGanti={(id) => setTarget((t) => (t ? { ...t, id } : t))}
        onOpenChange={(o) => { if (!o) setTarget(null); }}
      />
    ),
  };
}
