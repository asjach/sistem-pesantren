import { DEFAULT_PREFS } from '@/prefs';
import { THEME_PRESETS } from '@/themes';
import type { ThemeName } from '@/theme';
import { Paintbrush, Palette, Server } from '@/icons';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RibbonBtn, RibbonGroup, RibbonPemisah, pathAktif } from './primitives';

export function RibbonPengaturan({
  pathname,
  theme,
  customHex,
  dark,
  setTheme,
}: {
  pathname: string;
  theme: ThemeName;
  customHex: string;
  dark: boolean;
  setTheme: (t: ThemeName) => void;
}) {
  return (
    <>
      <RibbonGroup label="Tema">
        <Select value={theme} onValueChange={(v) => setTheme(v as ThemeName)}>
          <SelectTrigger
            id="select_tema_ribbon"
            title="Tema warna"
            aria-label="Tema warna"
            className="h-6 w-56 border-white/20 bg-white/5 text-white [&_svg]:text-white/70"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectGroup>
              <SelectLabel>Tema</SelectLabel>
              {THEME_PRESETS.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-3 shrink-0 rounded-full border border-black/20"
                      style={{ background: dark ? t.gelap.accent : t.terang.accent }}
                    />
                    {t.nama}
                    {t.id === DEFAULT_PREFS.theme ? ' • bawaan' : ''}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Kustom</SelectLabel>
              <SelectItem value="kustom">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 shrink-0 rounded-full border border-black/20"
                    style={{ background: customHex }}
                  />
                  Kustom (atur warna di Tampilan)
                </span>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Pengaturan">
        <RibbonBtn id="nav_pengaturan_tampilan" to="/pengaturan/tampilan" icon={Palette} label="Tampilan" aktif={pathAktif(pathname, '/pengaturan/tampilan')} />
        <RibbonBtn id="nav_pengaturan_bagian" to="/pengaturan/bagian" icon={Paintbrush} label="Bagian UI" aktif={pathAktif(pathname, '/pengaturan/bagian')} />
        <RibbonBtn id="nav_pengaturan_server" to="/pengaturan/server" icon={Server} label="Server" aktif={pathAktif(pathname, '/pengaturan/server')} />
      </RibbonGroup>
    </>
  );
}
