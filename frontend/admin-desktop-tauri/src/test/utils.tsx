import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

import { LembagaAktifProvider } from '@/lembagaAktif';
import { StandarTampilanProvider } from '@/standarTampilan';
import { ThemeProvider } from '@/theme';

/**
 * Bungkus `render` RTL dengan provider yang dibutuhkan komponen UI app:
 * StandarTampilanProvider (dibaca ThemeProvider) dan ThemeProvider sendiri
 * (dibaca ikon dinamis src/icons). Komponen yang memakai `@/icons` wajib
 * memakai pembungkus ini di test.
 */
export function renderDenganTema(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  function Pembungkus({ children }: { children: ReactNode }) {
    return (
      <LembagaAktifProvider>
        <StandarTampilanProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </StandarTampilanProvider>
      </LembagaAktifProvider>
    );
  }
  return render(ui, { wrapper: Pembungkus, ...options });
}
