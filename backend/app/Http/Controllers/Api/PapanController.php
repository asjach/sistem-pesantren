<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PapanService;
use App\Services\PapanTulisUlang;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use RuntimeException;

/**
 * API papan perkembangan proyek (FB-PAPAN-01).
 *
 * Papan bukan data pesantren — ia catatan kerja proyek yang hidup di koneksi
 * \`papan\` (SQLite terpisah). Karena itu endpoint di sini **tidak** memakai
 * \`lembaga_aktif\` maupun izin modul bisnis: pagarnya cukup satu izin
 * \`papan.lihat\` untuk membaca dan \`papan.ubah\` untuk mengubah.
 */
class PapanController extends Controller
{
    public function __construct(
        private readonly PapanService $papan,
        private readonly PapanTulisUlang $tulisUlang,
    ) {}

    /** Seluruh papan: aplikasi -> modul -> sub-modul -> butir + status workflow. */
    public function index(): JsonResponse
    {
        return response()->json([
            'aplikasi' => $this->papan->semuaAplikasi(),
            'workflow_master_aktif' => $this->papan->workflowMasterAktif(),
            'ringkasan' => $this->papan->ringkasan(),
            'status' => PapanService::STATUS,
        ]);
    }

    /** Aktifkan/nonaktifkan master workflow atau workflow satu aplikasi. */
    public function workflow(Request $request): JsonResponse
    {
        $valid = $request->validate([
            'aktif' => ['required', 'boolean'],
            'aplikasi' => ['nullable', 'string', 'in:'.implode(',', array_keys(PapanService::APLIKASI))],
        ]);

        try {
            if (($valid['aplikasi'] ?? null) !== null) {
                $this->papan->setWorkflowAplikasiAktif($valid['aplikasi'], (bool) $valid['aktif']);
            } else {
                $this->papan->setWorkflowMasterAktif((bool) $valid['aktif']);
            }
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($this->papan->statusWorkflow());
    }

    /** Riwayat perpindahan status, terbaru lebih dulu. */
    public function riwayat(Request $request): JsonResponse
    {
        $kode = $request->filled('kode') ? (string) $request->input('kode') : null;
        $batas = min(max((int) $request->integer('batas', 20), 1), 200);

        return response()->json(['riwayat' => $this->papan->riwayat($kode, $batas)]);
    }

    /** Satu sub-modul beserta poin-poinnya. */
    public function show(string $kode): JsonResponse
    {
        try {
            $item = $this->papan->item($kode)->load('butir');
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        $butir = $item->butir->map(fn ($b) => [
            'id' => $b->id,
            'status' => $b->status,
            'deskripsi' => $b->deskripsi,
            'subpoin' => $b->subpoin ?? [],
        ])->all();

        return response()->json([
            'kode' => $item->kode,
            'nama' => $item->nama,
            // Status sub-modul diturunkan, bukan dibaca dari kolom.
            'status' => PapanService::statusTurunan($butir),
            'butir' => $butir,
        ]);
    }

    /**
     * Pindahkan status sebuah POIN di dalam sub-modul.
     *
     * Status sub-modul ikut berubah sendiri karena diturunkan dari poinnya;
     * nilainya dikembalikan agar klien tidak perlu menghitung ulang.
     */
    public function pindah(Request $request, string $kode, int $butir): JsonResponse
    {
        $valid = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', PapanService::STATUS)],
            'catatan' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $poin = $this->papan->pindahButir(
                $kode,
                $butir,
                $valid['status'],
                'pengguna',
                $valid['catatan'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        $item = $this->papan->item($kode)->load('butir');

        $semua = $item->butir->map(fn ($b) => [
            'id' => $b->id,
            'status' => $b->status,
            'deskripsi' => $b->deskripsi,
        ])->all();

        return response()->json([
            'kode' => $item->kode,
            'id' => $poin->id,
            'status' => $poin->status,
            'status_sub_modul' => PapanService::statusTurunan($semua),
            ...$this->segarkanMarkdown(),
        ]);
    }

    /** Tambah butir beserta subpoin opsional di bawah sebuah sub-modul. */
    public function tambahButir(Request $request, string $kode): JsonResponse
    {
        $valid = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', PapanService::STATUS)],
            'deskripsi' => ['required', 'string', 'max:500'],
            'subpoin' => ['sometimes', 'array', 'max:30'],
            'subpoin.*' => ['array'],
            'subpoin.*.teks' => ['required', 'string', 'max:500'],
            'subpoin.*.selesai' => ['required', 'boolean'],
        ]);

        try {
            $butir = $this->papan->tambahButir($kode, $valid['status'], $valid['deskripsi'], $valid['subpoin'] ?? []);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        return response()->json([
            'id' => $butir->id,
            'status' => $butir->status,
            'deskripsi' => $butir->deskripsi,
            'subpoin' => $butir->subpoin ?? [],
            ...$this->segarkanMarkdown(),
        ], 201);
    }

    /** Hapus satu butir milik sebuah sub-modul. */
    public function hapusButir(string $kode, int $butir): JsonResponse
    {
        try {
            $terhapus = $this->papan->hapusButir($kode, $butir);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        if (! $terhapus) {
            return response()->json(['message' => "Butir #{$butir} tidak ditemukan di {$kode}."], 404);
        }

        return response()->json(['message' => 'Butir dihapus.', ...$this->segarkanMarkdown()]);
    }

    /**
     * Ubah isi sebuah poin: deskripsi, subpoin, dan/atau status.
     *
     * Keduanya opsional supaya klien bisa menyunting teks saja tanpa
     * menyentuh status (dan sebaliknya). Riwayat hanya dicatat bila
     * statusnya benar-benar berubah.
     */
    public function ubahButir(Request $request, string $kode, int $butir): JsonResponse
    {
        $valid = $request->validate([
            'deskripsi' => ['nullable', 'string', 'max:500'],
            'subpoin' => ['sometimes', 'array', 'max:30'],
            'subpoin.*' => ['array'],
            'subpoin.*.teks' => ['required', 'string', 'max:500'],
            'subpoin.*.selesai' => ['required', 'boolean'],
            'status' => ['nullable', 'string', 'in:'.implode(',', PapanService::STATUS)],
            'catatan' => ['nullable', 'string', 'max:255'],
        ]);

        if (($valid['deskripsi'] ?? null) === null && ($valid['status'] ?? null) === null && ! array_key_exists('subpoin', $valid)) {
            return response()->json(['message' => 'Tidak ada yang diubah: isi deskripsi, status, atau subpoin.'], 422);
        }

        try {
            $poin = $this->papan->ubahButir(
                $kode,
                $butir,
                $valid['deskripsi'] ?? null,
                $valid['status'] ?? null,
                'pengguna',
                $valid['catatan'] ?? null,
                $valid['subpoin'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        $item = $this->papan->item($kode)->load('butir');

        $semua = $item->butir->map(fn ($b) => [
            'id' => $b->id,
            'status' => $b->status,
            'deskripsi' => $b->deskripsi,
        ])->all();

        return response()->json([
            'id' => $poin->id,
            'status' => $poin->status,
            'deskripsi' => $poin->deskripsi,
            'subpoin' => $poin->subpoin ?? [],
            'status_sub_modul' => PapanService::statusTurunan($semua),
            ...$this->segarkanMarkdown(),
        ]);
    }

    /**
     * Geser satu poin naik/turun di dalam sub-modulnya.
     *
     * Mengembalikan 409 bila poin sudah di ujung, supaya klien bisa
     * memberi tahu pengguna alih-alih diam saja.
     */
    public function geserButir(Request $request, string $kode, int $butir): JsonResponse
    {
        $valid = $request->validate([
            'arah' => ['required', 'integer', 'in:-1,1'],
        ]);

        try {
            $bergeser = $this->papan->geserButir($kode, $butir, (int) $valid['arah']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        if (! $bergeser) {
            return response()->json(['message' => 'Poin sudah di ujung urutan.'], 409);
        }

        $item = $this->papan->item($kode)->load('butir');

        return response()->json([
            'butir' => $item->butir->map(fn ($b) => [
                'id' => $b->id,
                'status' => $b->status,
                'deskripsi' => $b->deskripsi,
                'subpoin' => $b->subpoin ?? [],
            ])->all(),
            ...$this->segarkanMarkdown(),
        ]);
    }

    /** Tambah modul baru; tab di UI dibangun dari data sehingga ikut muncul. */
    public function tambahModul(Request $request): JsonResponse
    {
        $valid = $request->validate([
            'aplikasi' => ['required', 'string', 'in:'.implode(',', array_keys(PapanService::APLIKASI))],
            'kode' => ['required', 'string', 'max:10', 'regex:/^[A-Za-z0-9]+$/'],
            'nama' => ['required', 'string', 'max:100'],
        ]);

        try {
            $modul = $this->papan->tambahModul($valid['aplikasi'], $valid['kode'], $valid['nama']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'aplikasi' => $modul->aplikasi,
            'kode' => $modul->kode,
            'nama' => $modul->nama,
            ...$this->segarkanMarkdown(),
        ], 201);
    }

    /** Tambah sub-modul baru di bawah sebuah modul. */
    public function tambahItem(Request $request, string $modul): JsonResponse
    {
        $valid = $request->validate([
            'kode' => ['required', 'string', 'max:20'],
            'nama' => ['required', 'string', 'max:255'],
        ]);

        try {
            $item = $this->papan->tambahItem($modul, $valid['kode'], $valid['nama']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'kode' => $item->kode,
            'nama' => $item->nama,
            ...$this->segarkanMarkdown(),
        ], 201);
    }

    /** Ubah nama dan/atau kode sebuah sub-modul (poinnya tidak disentuh). */
    public function ubahItem(Request $request, string $kode): JsonResponse
    {
        $valid = $request->validate([
            'kode_baru' => ['nullable', 'string', 'max:20'],
            'nama' => ['nullable', 'string', 'max:255'],
        ]);

        if (($valid['kode_baru'] ?? null) === null && ($valid['nama'] ?? null) === null) {
            return response()->json(['message' => 'Tidak ada yang diubah: isi nama atau kode_baru.'], 422);
        }

        try {
            $item = $this->papan->item($kode);
            $item = $this->papan->ubahItem(
                $item->modul->kode,
                $kode,
                $valid['kode_baru'] ?? null,
                $valid['nama'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'kode' => $item->kode,
            'nama' => $item->nama,
            ...$this->segarkanMarkdown(),
        ]);
    }

    /** Hapus sebuah sub-modul beserta seluruh poinnya. */
    public function hapusItem(string $kode): JsonResponse
    {
        try {
            $this->papan->hapusItem($kode);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        return response()->json(['message' => 'Sub-modul dihapus.', ...$this->segarkanMarkdown()]);
    }

    /**
     * Tulis ulang docs/PETA-MODUL.md dari papan setelah perubahan.
     *
     * Markdown hanya turunan, jadi kegagalan menulisnya **tidak** boleh
     * menggagalkan perubahan papan yang sudah tersimpan. Kegagalannya tetap
     * dilaporkan lewat kunci \`markdown\` supaya kelihatan dan bisa ditindak.
     *
     * @return array{markdown: array{berubah: bool, galat: string|null}}
     */
    private function segarkanMarkdown(): array
    {
        try {
            $hasil = $this->tulisUlang->jalankan();

            return ['markdown' => ['berubah' => $hasil['berubah'], 'galat' => null]];
        } catch (RuntimeException $e) {
            report($e);

            return ['markdown' => ['berubah' => false, 'galat' => $e->getMessage()]];
        }
    }
}
