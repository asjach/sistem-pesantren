import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import Icons from 'unplugin-icons/vite';

/**
 * Konfigurasi Vitest terpisah dari vite.config.ts (yang dipakai build Tauri):
 * environment jsdom (tanpa shell Tauri), alias `@` sama dengan app, dan
 * plugin ikon yang sama agar impor `~icons/...` di src/icons tetap jalan.
 * Test hanya menyentuh localStorage (kvGet/kvSet fallback non-Tauri),
 * jadi tidak perlu mock @tauri-apps.
 */
export default defineConfig({
  plugins: [
    Icons({ compiler: 'jsx', jsx: 'react', autoInstall: false }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
