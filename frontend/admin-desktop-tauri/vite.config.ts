import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import path from 'path';
import { buatHandlerAnotasi } from './src/dev/anotasiServer';

/**
 * Simpan anotasi UI mode dev ke `.dev/anotasi.json` lewat dev server.
 * Hanya hidup saat `vite` (serve) berjalan; build produksi tidak memuatnya.
 */
function anotasiDev(): Plugin {
  return {
    name: 'simpes-anotasi-dev',
    apply: 'serve',
    configureServer(server) {
      const handler = buatHandlerAnotasi(path.resolve(__dirname, '.dev'));
      server.middlewares.use('/__anotasi', (req, res) => { void handler(req, res); });
    },
  };
}

export default defineConfig({

  plugins: [tailwindcss(), react(), Icons({ compiler: 'jsx', jsx: 'react', autoInstall: false }), anotasiDev()],
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
    // Lampiran dev hanya boleh dibaca melalui endpoint anotasi, bukan static file.
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.dev/**'] },
  },
  build: {
    outDir: 'dist',
    target: 'es2021',
    rollupOptions: {
      output: {

        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/(@radix-ui|radix-ui)\//.test(id)) return 'vendor-radix';

        },
      },
    },
  },
});
