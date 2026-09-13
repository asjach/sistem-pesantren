import type { ReactNode } from 'react';
import { GridPrefsProvider } from '@/components/GridPrefs';
import { RibbonTableProvider } from '@/components/RibbonTable';
import TopBar from '@/components/TopBar';

/** Shell aplikasi: ribbon + konten (judul halaman ada di title bar jendela). */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <GridPrefsProvider>
      <RibbonTableProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <TopBar />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 md:px-4 md:py-3">
            {children}
          </main>
        </div>
      </RibbonTableProvider>
    </GridPrefsProvider>
  );
}
