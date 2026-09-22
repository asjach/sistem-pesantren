import { Fragment, type ReactNode } from 'react';
import { GridPrefsProvider } from '@/components/GridPrefs';
import { RibbonTableProvider } from '@/components/RibbonTable';
import { RibbonSlotProvider } from '@/components/RibbonSlot';
import Sidebar from '@/components/Sidebar';
import Menubar from '@/components/Menubar';
import TopBar from '@/components/TopBar';
import { useTheme } from '@/theme';
import { useLembagaAktif } from '@/lembagaAktif';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';

/** Shell aplikasi: navigasi (sidebar/menubar sesuai pref) + kolom (ribbon tools + konten). */
export default function Layout({ children }: { children: ReactNode }) {
  const { jenjang } = useLembagaAktif();
  const { tahunAjaranNama } = useTahunAjaranAktif();
  const { navigasi } = useTheme();
  const pakaiMenubar = navigasi === 'menubar';

  return (
    <GridPrefsProvider>
      <RibbonTableProvider>
        <RibbonSlotProvider>
          <div className="flex h-screen overflow-hidden">
            {!pakaiMenubar && <Sidebar />}
            <div className="flex min-w-0 flex-1 flex-col">
              {pakaiMenubar && <Menubar />}
              <TopBar />
              {/* Ganti lembaga/tahun ajaran aktif → remount halaman: filter & data ikut scope baru. */}
              <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1">
                <Fragment key={`${jenjang ?? 'semua'}:${tahunAjaranNama ?? 'semua'}`}>{children}</Fragment>
              </main>
            </div>
          </div>
        </RibbonSlotProvider>
      </RibbonTableProvider>
    </GridPrefsProvider>
  );
}
