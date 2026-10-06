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
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2021',
    rollupOptions: {
      output: {
        /* Pisahkan vendor besar dari kode aplikasi supaya chunk utama tidak
           menanggung semuanya (peringatan >500 kB). Lib berat yang memang
           dinamis (xlsx-js-style, pdfjs, heic2any) tetap punya chunk sendiri. */
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/(@radix-ui|radix-ui)\//.test(id)) return 'vendor-radix';
          // Sisanya biarkan Rollup: lib yang diimpor dinamis (xlsx-js-style,
          // pdfjs, heic2any, DataExistingCard) tetap punya chunk sendiri dan
          // tidak ikut terunduh saat aplikasi start.
        },
      },
    },
  },
});
