import type { ReactNode } from 'react';
import { GridPrefsProvider } from '@/components/GridPrefs';
import { RibbonTableProvider } from '@/components/RibbonTable';
import { RibbonSlotProvider } from '@/components/RibbonSlot';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import BannerBertindak from '@/components/BannerBertindak';

/** Shell aplikasi: sidebar navigasi + kolom (ribbon tools + konten). */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <GridPrefsProvider>
      <RibbonTableProvider>
        <RibbonSlotProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <BannerBertindak />
              <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1">{children}</main>
            </div>
          </div>
        </RibbonSlotProvider>
      </RibbonTableProvider>
    </GridPrefsProvider>
  );
}
