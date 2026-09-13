import { CalendarRange, ClipboardList, FileCheck2 } from '@/icons';
import { RibbonBtn, RibbonGroup, pathAktif } from './primitives';

export function RibbonPsb({ pathname }: { pathname: string }) {
  return (
    <RibbonGroup label="PSB">
      <RibbonBtn id="nav_psb" to="/psb" icon={ClipboardList} label="Antrean" aktif={pathAktif(pathname, '/psb')} />
      <RibbonBtn id="nav_kegiatan_psb" to="/kegiatan-psb" icon={CalendarRange} label="Kegiatan PSB" aktif={pathAktif(pathname, '/kegiatan-psb')} />
      <RibbonBtn id="nav_dokumen_wajib" to="/dokumen-wajib" icon={FileCheck2} label="Dokumen Wajib" aktif={pathAktif(pathname, '/dokumen-wajib')} />
    </RibbonGroup>
  );
}
