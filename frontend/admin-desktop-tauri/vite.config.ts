import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

/** Bentuk anotasi yang ditulis lapisan anotasi mode dev. */
interface AnotasiTersimpan {
  id: string;
  dibuat: string;
  rute: string;
  selector: string;
  tag: string;
  teks: string;
  komponen: string[];
  sumber: string | null;
  instruksi: string;
}

const BATAS_BADAN = 64_000;

/** Potong teks agar berkas anotasi tetap ringkas. */
function teks(nilai: unknown, batas: number): string {
  return typeof nilai === 'string' ? nilai.slice(0, batas) : '';
}

/**
 * Simpan anotasi UI mode dev ke `.dev/anotasi.json` lewat dev server.
 * Hanya hidup saat `vite` (serve) berjalan; build produksi tidak memuatnya.
 */
function anotasiDev(): Plugin {
  const berkas = path.resolve(__dirname, '.dev', 'anotasi.json');

  const baca = (): AnotasiTersimpan[] => {
    try {
      const isi = JSON.parse(fs.readFileSync(berkas, 'utf8')) as { anotasi?: unknown };
      return Array.isArray(isi.anotasi) ? (isi.anotasi as AnotasiTersimpan[]) : [];
    } catch {
      return [];
    }
  };

  const tulis = (daftar: AnotasiTersimpan[]) => {
    fs.mkdirSync(path.dirname(berkas), { recursive: true });
    const sementara = `${berkas}.tmp`;
    fs.writeFileSync(
      sementara,
      `${JSON.stringify({ diperbarui: new Date().toISOString(), anotasi: daftar }, null, 2)}\n`,
    );
    fs.renameSync(sementara, berkas);
  };

  const kirim = (res: ServerResponse, status: number, data: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  };

  const bacaBadan = (req: IncomingMessage): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (potongan: Buffer) => {
        data += potongan.toString();
        if (data.length > BATAS_BADAN) {
          reject(new Error('Badan anotasi terlalu besar.'));
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          const isi = JSON.parse(data || '{}') as unknown;
          resolve(isi && typeof isi === 'object' ? (isi as Record<string, unknown>) : {});
        } catch {
          reject(new Error('Badan anotasi bukan JSON.'));
        }
      });
      req.on('error', reject);
    });

  return {
    name: 'simpes-anotasi-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__anotasi', (req, res) => {
        void (async () => {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1');

          try {
            if (req.method === 'GET') {
              kirim(res, 200, { anotasi: baca() });
              return;
            }

            if (req.method === 'POST') {
              const data = await bacaBadan(req);
              const instruksi = teks(data.instruksi, 4000).trim();

              if (instruksi === '') {
                kirim(res, 400, { pesan: 'Instruksi wajib diisi.' });
                return;
              }

              const baru: AnotasiTersimpan = {
                id: teks(data.id, 120) || `anotasi-${Date.now()}`,
                dibuat: teks(data.dibuat, 40) || new Date().toISOString(),
                rute: teks(data.rute, 600),
                selector: teks(data.selector, 4000),
                tag: teks(data.tag, 40),
                teks: teks(data.teks, 400),
                komponen: Array.isArray(data.komponen)
                  ? data.komponen.filter((k): k is string => typeof k === 'string').slice(0, 12).map((k) => k.slice(0, 120))
                  : [],
                sumber: typeof data.sumber === 'string' ? data.sumber.slice(0, 600) : null,
                instruksi,
              };

              const daftar = baca();
              daftar.push(baru);
              tulis(daftar);
              kirim(res, 201, baru);
              return;
            }

            if (req.method === 'DELETE') {
              const id = url.searchParams.get('id');

              if (!id) {
                kirim(res, 400, { pesan: 'Parameter id wajib.' });
                return;
              }

              const daftar = baca();
              const sisa = daftar.filter((a) => a.id !== id);

              if (sisa.length === daftar.length) {
                kirim(res, 404, { pesan: 'Anotasi tidak ditemukan.' });
                return;
              }

              tulis(sisa);
              res.statusCode = 204;
              res.end();
              return;
            }

            kirim(res, 405, { pesan: 'Metode tidak didukung.' });
          } catch (e) {
            kirim(res, 400, { pesan: e instanceof Error ? e.message : 'Permintaan anotasi gagal.' });
          }
        })();
      });
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
