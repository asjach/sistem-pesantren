import { BookMarked, BookOpen, CalendarDays, Landmark, Users } from '@/icons';
import { RibbonBtn, RibbonGroup, pathAktif } from './primitives';

export function RibbonMaster({ pathname }: { pathname: string }) {
  return (
    <RibbonGroup label="Data Induk">
      <RibbonBtn id="nav_users" to="/users" icon={Users} label="Pengguna" aktif={pathAktif(pathname, '/users')} />
      <RibbonBtn id="nav_lembaga" to="/lembaga" icon={Landmark} label="Lembaga" aktif={pathAktif(pathname, '/lembaga')} />
      <RibbonBtn id="nav_tahun_ajaran" to="/tahun-ajaran" icon={CalendarDays} label="Tahun Ajaran" aktif={pathAktif(pathname, '/tahun-ajaran')} />
      <RibbonBtn id="nav_kelas" to="/kelas" icon={BookOpen} label="Kelas" aktif={pathAktif(pathname, '/kelas')} />
      <RibbonBtn id="nav_referensi" to="/referensi" icon={BookMarked} label="Referensi" aktif={pathAktif(pathname, '/referensi')} />
    </RibbonGroup>
  );
}
