import { Paintbrush, Palette, Server } from '@/icons';
import { RibbonBtn, RibbonGroup, pathAktif } from './primitives';

export function RibbonPengaturan({ pathname }: { pathname: string }) {
  return (
    <RibbonGroup label="Pengaturan">
      <RibbonBtn id="nav_pengaturan_server" to="/pengaturan/server" icon={Server} label="Server" aktif={pathAktif(pathname, '/pengaturan/server')} />
      <RibbonBtn id="nav_pengaturan_tampilan" to="/pengaturan/tampilan" icon={Palette} label="Tampilan" aktif={pathAktif(pathname, '/pengaturan/tampilan')} />
      <RibbonBtn id="nav_pengaturan_bagian" to="/pengaturan/bagian" icon={Paintbrush} label="Bagian UI" aktif={pathAktif(pathname, '/pengaturan/bagian')} />
    </RibbonGroup>
  );
}
