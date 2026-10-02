import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

import { LembagaAktifProvider } from '@/lembagaAktif';
import { ThemeProvider } from '@/theme';
import { GridPrefsProvider } from '@/components/GridPrefs';

/**
 * Bungkus provider yang dibutuhkan komponen UI app: ThemeProvider (dibaca
 * ikon dinamis `src/icons`) dan GridPrefsProvider. Komponen yang memakai
 * `@/icons` wajib memakai pembungkus ini di test. Diekspor agar test bisa
 * membungkus UI kustom dengan provider sama.
 */
export function PembungkusTema({ children }: { children: ReactNode }) {
  return (
    <LembagaAktifProvider>
      <ThemeProvider>
        <GridPrefsProvider>{children}</GridPrefsProvider>
      </ThemeProvider>
    </LembagaAktifProvider>
  );
}

/** `render` RTL + PembungkusTema sebagai wrapper bawaan. */
export function renderDenganTema(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: PembungkusTema, ...options });
}
