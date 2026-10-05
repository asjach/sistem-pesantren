<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PengaturanTabelHapusRequest;
use App\Http\Requests\Admin\PengaturanTabelIndexRequest;
use App\Http\Requests\Admin\PengaturanTabelSimpanRequest;
use App\Models\PengaturanTabel;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * Visibilitas filter topBar, GLOBAL per `table_key` (satu baris = peta
 * filter → boolean). Baca bebas (semua admin, agar semua peramban
 * merender sama); tulis khusus super_admin untuk seluruh lembaga.
 * Halaman tanpa tabel memakai page_key sebagai nilai `table_key`.
 */
class PengaturanTabelController extends Controller
{
    /** Kunci filter yang dikenal frontend (di luar ini ditolak). */
    public const KUNCI = ['lembaga', 'tahun_ajaran', 'semester', 'tingkat', 'kelas'];

    public const MODE_FILTER = ['single', 'multiple'];

    /** GET /api/admin/pengaturan-tabel?keys[]=psb&keys[]=pegawai_lembaga */
    public function index(PengaturanTabelIndexRequest $request): JsonResponse
    {
        $data = $request->validated();
        $keys = array_values(array_unique($data['keys']));

        $rows = PengaturanTabel::whereIn('table_key', $keys)->get()->keyBy('table_key');

        $hasil = [];
        foreach ($keys as $key) {
            $row = $rows->get($key);
            $hasil[$key] = [
                'table_key' => $key,
                'filter' => $row?->filter ?? [],
                'filter_mode' => $this->normalisasiMode($row?->filter_mode),
                'ada' => $row !== null,
            ];
        }

        return response()->json([
            'pesan' => 'Pengaturan tabel dimuat.',
            'data' => $hasil,
        ]);
    }

    /** PUT /api/admin/pengaturan-tabel — upsert gabung: hanya kunci yang
     *  dikirim yang ditimpa, kunci lain dipertahankan. */
    public function simpan(PengaturanTabelSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (! array_key_exists('filter', $data) && ! array_key_exists('filter_mode', $data)) {
            throw ValidationException::withMessages([
                'table_key' => 'Kirim minimal filter atau filter_mode.',
            ]);
        }

        $row = PengaturanTabel::firstOrNew(['table_key' => $data['table_key']]);

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

        return response()->json(['pesan' => 'Pengaturan tabel disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/pengaturan-tabel?table_key=psb — kembali ikut bawaan kode. */
    public function hapus(PengaturanTabelHapusRequest $request): JsonResponse
    {
        $data = $request->validated();

        PengaturanTabel::where('table_key', $data['table_key'])->delete();

        return response()->json(['pesan' => 'Pengaturan tabel dikembalikan ke bawaan (ikut bawaan kode).']);
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
