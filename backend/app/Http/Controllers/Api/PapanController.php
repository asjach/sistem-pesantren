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

    /** Seluruh papan: modul, sub-modul, butir, plus ringkasan per status. */
    public function index(): JsonResponse
    {
        return response()->json([
            'modul' => $this->papan->semua(),
            'ringkasan' => $this->papan->ringkasan(),
            'status' => PapanService::STATUS,
        ]);
    }

    /** Riwayat perpindahan status, terbaru lebih dulu. */
    public function riwayat(Request $request): JsonResponse
    {
        $kode = $request->filled('kode') ? (string) $request->input('kode') : null;
        $batas = min(max((int) $request->integer('batas', 20), 1), 200);

        return response()->json(['riwayat' => $this->papan->riwayat($kode, $batas)]);
    }

    /** Satu sub-modul beserta butirnya. */
    public function show(string $kode): JsonResponse
    {
        try {
            $item = $this->papan->item($kode)->load('butir');
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        return response()->json([
            'kode' => $item->kode,
            'nama' => $item->nama,
            'status' => $item->status,
            'butir' => $item->butir->map(fn ($b) => [
                'id' => $b->id,
                'status' => $b->status,
                'deskripsi' => $b->deskripsi,
            ])->all(),
        ]);
    }

    /** Pindahkan status sebuah sub-modul. */
    public function pindah(Request $request, string $kode): JsonResponse
    {
        $valid = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', PapanService::STATUS)],
            'catatan' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $item = $this->papan->pindah(
                $kode,
                $valid['status'],
                'pengguna',
                $valid['catatan'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        return response()->json([
            'kode' => $item->kode,
            'nama' => $item->nama,
            'status' => $item->status,
            ...$this->segarkanMarkdown(),
        ]);
    }

    /** Tambah butir di bawah sebuah sub-modul. */
    public function tambahButir(Request $request, string $kode): JsonResponse
    {
        $valid = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', PapanService::STATUS)],
            'deskripsi' => ['required', 'string', 'max:500'],
        ]);

        try {
            $butir = $this->papan->tambahButir($kode, $valid['status'], $valid['deskripsi']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }

        return response()->json([
            'id' => $butir->id,
            'status' => $butir->status,
            'deskripsi' => $butir->deskripsi,
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
