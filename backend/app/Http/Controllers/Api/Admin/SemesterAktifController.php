<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Lembaga;
use App\Models\SemesterAktif;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Semester aktif per lembaga operasional ('1' = Ganjil, '2' = Genap).
 * Baca: semua peran berizin; tulis: super_admin semua, admin lembaganya
 * (cakupan via canAccessLembaga). Disetel lewat dropdown Semester topbar.
 */
class SemesterAktifController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/semester-aktif — lembaga operasional + semester aktifnya. */
    public function index(Request $request): JsonResponse
    {
        $auth = $request->user();
        $lembagas = Lembaga::orderBy('jenjang')->get(['jenjang', 'nama']);
        $aktif = SemesterAktif::whereIn('jenjang', $lembagas->pluck('jenjang'))
            ->pluck('semester', 'jenjang');

        $data = $lembagas
            ->filter(fn ($l) => $auth->canAccessLembaga($l->jenjang))
            ->map(fn ($l) => [
                'jenjang' => $l->jenjang,
                'kode' => $l->jenjang,
                'nama' => $l->nama,
                'semester' => $aktif->get($l->jenjang),
                'label' => $aktif->has($l->jenjang) ? SemesterAktif::label((string) $aktif->get($l->jenjang)) : null,
            ])->values()->all();

        return response()->json(['data' => $data]);
    }

    /** PUT /api/admin/semester-aktif — tetapkan semester aktif satu lembaga. */
    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'semester' => ['required', Rule::in(['1', '2'])],
        ]);

        $auth = $request->user();
        $this->authorizeLembaga($auth, $data['jenjang']);

        $row = SemesterAktif::updateOrCreate(
            ['jenjang' => $data['jenjang']],
            ['semester' => $data['semester'], 'diubah_oleh' => $auth->id],
        );

        return response()->json([
            'pesan' => 'Semester aktif ditetapkan.',
            'data' => [
                'jenjang' => $row->jenjang,
                'semester' => $row->semester,
                'label' => SemesterAktif::label($row->semester),
            ],
        ]);
    }
}
