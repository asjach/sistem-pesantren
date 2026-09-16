import { Fragment, type ReactNode } from 'react';
import { GridPrefsProvider } from '@/components/GridPrefs';
import { RibbonTableProvider } from '@/components/RibbonTable';
import { RibbonSlotProvider } from '@/components/RibbonSlot';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import BannerBertindak from '@/components/BannerBertindak';
import { useLembagaAktif } from '@/lembagaAktif';

/** Shell aplikasi: sidebar navigasi + kolom (ribbon tools + konten). */
export default function Layout({ children }: { children: ReactNode }) {
  const { lembagaId } = useLembagaAktif();

  return (
    <GridPrefsProvider>
      <RibbonTableProvider>
        <RibbonSlotProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <BannerBertindak />
              {/* Ganti lembaga aktif → remount halaman: filter & data ikut scope baru. */}
              <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1">
                <Fragment key={lembagaId ?? 'semua'}>{children}</Fragment>
              </main>
            </div>
          </div>
        </RibbonSlotProvider>
      </RibbonTableProvider>
    </GridPrefsProvider>
  );
}
