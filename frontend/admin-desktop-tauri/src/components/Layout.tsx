import { Fragment, type ReactNode } from 'react';
import { GridPrefsProvider } from '@/components/GridPrefs';
import { RibbonTableProvider } from '@/components/RibbonTable';
import { RibbonSlotProvider } from '@/components/RibbonSlot';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useLembagaAktif } from '@/lembagaAktif';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';

/** Shell aplikasi: sidebar navigasi + kolom (ribbon tools + konten). */
export default function Layout({ children }: { children: ReactNode }) {
  const { lembagaId } = useLembagaAktif();
  const { tahunAjaranId } = useTahunAjaranAktif();

  return (
    <GridPrefsProvider>
      <RibbonTableProvider>
        <RibbonSlotProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              {/* Ganti lembaga/tahun ajaran aktif → remount halaman: filter & data ikut scope baru. */}
              <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1">
                <Fragment key={`${lembagaId ?? 'semua'}:${tahunAjaranId ?? 'semua'}`}>{children}</Fragment>
              </main>
            </div>
          </div>
        </RibbonSlotProvider>
      </RibbonTableProvider>
    </GridPrefsProvider>
  );
}
