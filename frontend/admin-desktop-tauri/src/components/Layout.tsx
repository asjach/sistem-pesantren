import { Fragment, type ReactNode } from 'react';
import { GridPrefsProvider } from '@/components/GridPrefs';
import { TopBarSearchProvider } from '@/components/TopBarSearch';
import { CariGlobalProvider } from '@/hooks/useCariGlobal';
import { VisibilitasFilterProvider } from '@/components/VisibilitasFilter';
import Sidebar from '@/components/Sidebar';
import Menubar from '@/components/Menubar';
import TopBar from '@/components/TopBar';
import { SeretSidebarProvider } from '@/components/SeretSidebar';
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
      <VisibilitasFilterProvider>
        <CariGlobalProvider>
          <TopBarSearchProvider>
            {/* Seret lebar navigasi satu instans untuk Sidebar + TopBar
                (kenop lipat ikut bisa diseret) — lihat SeretSidebar. */}
            <SeretSidebarProvider>
              <div className="flex h-screen overflow-hidden bg-background">
                {!pakaiMenubar && <Sidebar />}
                <div className="flex min-w-0 flex-1 flex-col">
                  {pakaiMenubar && <Menubar />}
                  <TopBar />
                  <div className="flex min-h-0 flex-1 bg-background">
                    {/* Ganti lembaga/tahun ajaran aktif → remount halaman: filter & data ikut scope baru. */}
                    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background p-0">
                      <Fragment key={`${jenjang ?? 'semua'}:${tahunAjaranNama ?? 'semua'}`}>{children}</Fragment>
                    </main>
                  </div>
                </div>
              </div>
            </SeretSidebarProvider>
          </TopBarSearchProvider>
        </CariGlobalProvider>
      </VisibilitasFilterProvider>
    </GridPrefsProvider>
  );
}
