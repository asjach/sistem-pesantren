import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

import { LembagaAktifProvider } from '@/lembagaAktif';
import { StandarTampilanProvider } from '@/standarTampilan';
import { ThemeProvider } from '@/theme';
import { GridPrefsProvider } from '@/components/GridPrefs';

/**
 * Bungkus provider yang dibutuhkan komponen UI app: StandarTampilanProvider
 * (dibaca ThemeProvider) dan ThemeProvider sendiri (dibaca ikon dinamis
 * src/icons). Komponen yang memakai `@/icons` wajib memakai pembungkus ini
 * di test. Diekspor agar test bisa membungkus UI kustom dengan provider sama.
 */
export function PembungkusTema({ children }: { children: ReactNode }) {
  return (
    <LembagaAktifProvider>
      <StandarTampilanProvider>
        <ThemeProvider>
          <GridPrefsProvider>{children}</GridPrefsProvider>
        </ThemeProvider>
      </StandarTampilanProvider>
    </LembagaAktifProvider>
  );
}

/** `render` RTL + PembungkusTema sebagai wrapper bawaan. */
export function renderDenganTema(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: PembungkusTema, ...options });
}
