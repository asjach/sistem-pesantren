import {
  ChevronUp,
  ClipboardList,
  GraduationCap,
  History,
  LogOut,
  MoveHorizontal,
  NotebookTabs,
  ReceiptText,
} from '@/icons';
import { RibbonBtn, RibbonGroup, pathAktif } from './primitives';

export function RibbonSantri({ pathname }: { pathname: string }) {
  return (
    <>
      <RibbonGroup label="Kesiswaan">
        <RibbonBtn id="nav_santri" to="/santri" icon={GraduationCap} label="Buku Induk" aktif={pathAktif(pathname, '/santri')} />
        <RibbonBtn id="nav_pengajuan_biodata" to="/pengajuan-biodata" icon={NotebookTabs} label="Pengajuan Biodata" aktif={pathAktif(pathname, '/pengajuan-biodata')} />
      </RibbonGroup>

      <RibbonGroup label="Akademik">
        <RibbonBtn id="nav_riwayat_belajar" to="/riwayat-belajar" icon={History} label="Riwayat Belajar" aktif={pathAktif(pathname, '/riwayat-belajar')} />
        <RibbonBtn id="nav_daftar_kelas" to="/daftar-kelas" icon={ClipboardList} label="Daftar Kelas" aktif={pathAktif(pathname, '/daftar-kelas')} />
        <RibbonBtn id="nav_pindah_kelas" to="/pindah-kelas" icon={MoveHorizontal} label="Pindah Kelas" aktif={pathAktif(pathname, '/pindah-kelas')} />
        <RibbonBtn id="nav_kenaikan" to="/kenaikan" icon={ChevronUp} label="Kenaikan" aktif={pathAktif(pathname, '/kenaikan')} />
        <RibbonBtn id="nav_kelulusan" to="/kelulusan" icon={GraduationCap} label="Kelulusan" aktif={pathAktif(pathname, '/kelulusan')} />
        <RibbonBtn id="nav_mutasi_keluar" to="/mutasi-keluar" icon={LogOut} label="Mutasi Keluar" aktif={pathAktif(pathname, '/mutasi-keluar')} />
        <RibbonBtn id="nav_rekap_santri" to="/rekap-santri" icon={ReceiptText} label="Rekap Santri" aktif={pathAktif(pathname, '/rekap-santri')} />
      </RibbonGroup>
    </>
  );
}
