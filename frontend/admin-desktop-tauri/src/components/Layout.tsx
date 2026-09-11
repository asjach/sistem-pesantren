import type { ReactNode } from 'react';
import { GridPrefsProvider } from '@/components/GridPrefs';
import TopBar from '@/components/TopBar';

/** Shell aplikasi: top bar (brand, nav, kontrol tabel, pengguna) + konten. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <GridPrefsProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <TopBar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:px-8 md:py-6">
          {children}
        </main>
      </div>
    </GridPrefsProvider>
  );
}
