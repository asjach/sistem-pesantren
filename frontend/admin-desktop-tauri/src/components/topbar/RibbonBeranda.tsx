import { ClipboardList, GraduationCap, Home, ScrollText } from '@/icons';
import { RibbonBtn, RibbonGroup, RibbonPemisah, pathAktif } from './primitives';

export function RibbonBeranda({ pathname }: { pathname: string }) {
  return (
    <>
      <RibbonGroup label="Mulai">
        <RibbonBtn id="nav_dashboard" to="/" icon={Home} label="Dashboard" aktif={pathAktif(pathname, '/')} />
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Pintasan">
        <RibbonBtn id="nav_pintasan_psb" to="/psb" icon={ClipboardList} label="Antrean PSB" aktif={pathAktif(pathname, '/psb')} />
        <RibbonBtn id="nav_pintasan_santri" to="/santri" icon={GraduationCap} label="Data Santri" aktif={pathAktif(pathname, '/santri')} />
        <RibbonBtn id="nav_pintasan_keuangan" to="/keuangan" icon={ScrollText} label="Tagihan & Bayar" aktif={pathAktif(pathname, '/keuangan')} />
      </RibbonGroup>
    </>
  );
}
