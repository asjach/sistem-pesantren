import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Tauri 2: devUrl http://127.0.0.1:1420, dist ../dist.
// API base via VITE_API_BASE_URL, fallback http://127.0.0.1:8000/api (AGENTS A7).
export default defineConfig({
  plugins: [tailwindcss(), react()],
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
