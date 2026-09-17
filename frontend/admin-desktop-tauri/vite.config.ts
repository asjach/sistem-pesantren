import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import path from 'path';

// Tauri 2: devUrl http://127.0.0.1:1420, dist ../dist.
// API base via VITE_API_BASE_URL, fallback http://127.0.0.1:8000/api (AGENTS A7).
export default defineConfig({
  // Ikon: `~icons/<koleksi>/<nama>` (9 set, lihat src/icons/ hasil
  // scripts/icons-gen.mjs). Offline: paket @iconify-json lokal.
  plugins: [tailwindcss(), react(), Icons({ compiler: 'jsx', jsx: 'react', autoInstall: false })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2021',
  },
});
