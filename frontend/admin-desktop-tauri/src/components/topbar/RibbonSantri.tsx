import {
  Ban,
  ChevronUp,
  ClipboardList,
  Copy,
  GraduationCap,
  History,
  LogOut,
  MoveHorizontal,
  NotebookTabs,
  ReceiptText,
  Users,
} from '@/icons';
import { RibbonBtn, RibbonGroup, pathAktif } from './primitives';

export function RibbonSantri({ pathname }: { pathname: string }) {
  return (
    <>
      <RibbonGroup label="Kesiswaan">
        <RibbonBtn id="nav_santri" to="/santri" icon={GraduationCap} label="Data Santri" aktif={pathAktif(pathname, '/santri')} />
        <RibbonBtn id="nav_siklus" to="/siklus" icon={History} label="Mutasi & Alumni" aktif={pathAktif(pathname, '/siklus')} />
        <RibbonBtn id="nav_pengajuan_biodata" to="/pengajuan-biodata" icon={NotebookTabs} label="Pengajuan Biodata" aktif={pathAktif(pathname, '/pengajuan-biodata')} />
      </RibbonGroup>

      <RibbonGroup label="Kelas">
        <RibbonBtn id="nav_daftar_kelas" to="/daftar-kelas" icon={ClipboardList} label="Daftar Kelas" aktif={pathAktif(pathname, '/daftar-kelas')} />
        <RibbonBtn id="nav_roster_kelas" to="/roster-kelas" icon={Users} label="Roster & Pindah" aktif={pathAktif(pathname, '/roster-kelas')} />
        <RibbonBtn id="nav_penempatan_kelas" to="/penempatan-kelas" icon={MoveHorizontal} label="Penempatan" aktif={pathAktif(pathname, '/penempatan-kelas')} />
        <RibbonBtn id="nav_rekap_penempatan" to="/rekap-penempatan" icon={ReceiptText} label="Rekap Penempatan" aktif={pathAktif(pathname, '/rekap-penempatan')} />
      </RibbonGroup>

      <RibbonGroup label="Proses Akademik">
        <RibbonBtn id="nav_salin_genap" to="/salin-genap" icon={Copy} label="Salin Genap" aktif={pathAktif(pathname, '/salin-genap')} />
        <RibbonBtn id="nav_kenaikan_kelas" to="/kenaikan-kelas" icon={ChevronUp} label="Kenaikan Kelas" aktif={pathAktif(pathname, '/kenaikan-kelas')} />
      </RibbonGroup>

      <RibbonGroup label="Arsip">
        <RibbonBtn id="nav_mutasi_keluar" to="/mutasi-keluar" icon={LogOut} label="Mutasi Keluar" aktif={pathAktif(pathname, '/mutasi-keluar')} />
        <RibbonBtn id="nav_alumni" to="/alumni" icon={GraduationCap} label="Alumni" aktif={pathAktif(pathname, '/alumni')} />
        <RibbonBtn id="nav_arsip_berhenti" to="/arsip-berhenti" icon={Ban} label="Arsip Berhenti" aktif={pathAktif(pathname, '/arsip-berhenti')} />
      </RibbonGroup>
    </>
  );
}
