<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PengaturanHalamanHapusRequest;
use App\Http\Requests\Admin\PengaturanHalamanIndexRequest;
use App\Http\Requests\Admin\PengaturanHalamanSimpanRequest;
use App\Models\PengaturanHalaman;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * Visibilitas filter topBar, GLOBAL per `page_key` (satu baris = peta
 * filter → boolean). Baca bebas (semua admin, agar semua peramban
 * merender sama); tulis khusus super_admin untuk seluruh lembaga.
 */
class PengaturanHalamanController extends Controller
{
    /** Kunci filter yang dikenal frontend (di luar ini ditolak). */
    public const KUNCI = ['lembaga', 'tahun_ajaran', 'semester', 'tingkat', 'kelas'];

    public const MODE_FILTER = ['single', 'multiple'];

    /** GET /api/admin/pengaturan-halaman?page_key=daftar_kelas */
    public function index(PengaturanHalamanIndexRequest $request): JsonResponse
    {
        $data = $request->validated();

        $row = PengaturanHalaman::where('page_key', $data['page_key'])->first();

        return response()->json([
            'pesan' => 'Pengaturan halaman dimuat.',
            'data' => [
                'page_key' => $data['page_key'],
                'filter' => $row?->filter ?? [],
                'filter_mode' => $this->normalisasiMode($row?->filter_mode),
            ],
        ]);
    }

    /** PUT /api/admin/pengaturan-halaman — upsert gabung: hanya kunci yang
     *  dikirim yang ditimpa, kunci lain dipertahankan. */
    public function simpan(PengaturanHalamanSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (! array_key_exists('filter', $data) && ! array_key_exists('filter_mode', $data)) {
            throw ValidationException::withMessages([
                'page_key' => 'Kirim minimal filter atau filter_mode.',
            ]);
        }

        $row = PengaturanHalaman::firstOrNew(['page_key' => $data['page_key']]);

        // Kolom filter NOT NULL: baris baru tanpa filter = ikut bawaan kode.
        if ($row->filter === null) {
            $row->filter = [];
        }

        if (array_key_exists('filter', $data)) {
            $normal = $row->filter;
            foreach ($data['filter'] as $kunci => $nilai) {
                if (! in_array($kunci, self::KUNCI, true)) {
                    throw ValidationException::withMessages([
                        'filter' => "Kunci filter \"{$kunci}\" tidak dikenal.",
                    ]);
                }
                $normal[$kunci] = (bool) $nilai;
            }
            $row->filter = $normal;
        }

        $row->filter_mode = array_replace(
            $this->normalisasiMode($row->filter_mode),
            $data['filter_mode'] ?? [],
        );

        $row->dibuat_oleh = $request->user()->id;
        $row->save();

        return response()->json(['pesan' => 'Pengaturan halaman disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/pengaturan-halaman?page_key=daftar_kelas — kembali ikut bawaan kode. */
    public function hapus(PengaturanHalamanHapusRequest $request): JsonResponse
    {
        $data = $request->validated();

        PengaturanHalaman::where('page_key', $data['page_key'])->delete();

        return response()->json(['pesan' => 'Pengaturan halaman dikembalikan ke bawaan (ikut bawaan kode).']);
    }

    private function normalisasiMode(?array $mode): array
    {
        $normal = array_fill_keys(self::KUNCI, 'single');

        foreach ($mode ?? [] as $kunci => $nilai) {
            if (in_array($kunci, self::KUNCI, true) && in_array($nilai, self::MODE_FILTER, true)) {
                $normal[$kunci] = $nilai;
            }
        }

        return $normal;
    }
}
