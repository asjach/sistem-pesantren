import { GraduationCap, History, NotebookTabs } from '@/icons';
import { RibbonBtn, RibbonGroup, pathAktif } from './primitives';

export function RibbonSantri({ pathname }: { pathname: string }) {
  return (
    <RibbonGroup label="Kesiswaan">
      <RibbonBtn id="nav_santri" to="/santri" icon={GraduationCap} label="Data Santri" aktif={pathAktif(pathname, '/santri')} />
      <RibbonBtn id="nav_siklus" to="/siklus" icon={History} label="Mutasi & Alumni" aktif={pathAktif(pathname, '/siklus')} />
      <RibbonBtn id="nav_pengajuan_biodata" to="/pengajuan-biodata" icon={NotebookTabs} label="Pengajuan Biodata" aktif={pathAktif(pathname, '/pengajuan-biodata')} />
    </RibbonGroup>
  );
}
