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
        $lembagas = Lembaga::whereNotNull('parent_id')->orderBy('id')->get(['id', 'kode', 'nama']);
        $aktif = SemesterAktif::whereIn('lembaga_id', $lembagas->pluck('id'))
            ->pluck('semester', 'lembaga_id');

        $data = $lembagas
            ->filter(fn ($l) => $auth->canAccessLembaga($l->id))
            ->map(fn ($l) => [
                'lembaga_id' => $l->id,
                'kode' => $l->kode,
                'nama' => $l->nama,
                'semester' => $aktif->get($l->id),
                'label' => $aktif->has($l->id) ? SemesterAktif::label((string) $aktif->get($l->id)) : null,
            ])->values()->all();

        return response()->json(['data' => $data]);
    }

    /** PUT /api/admin/semester-aktif — tetapkan semester aktif satu lembaga. */
    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'semester' => ['required', Rule::in(['1', '2'])],
        ]);

        $auth = $request->user();
        $this->tolakLembagaRoot((int) $data['lembaga_id']);
        $this->authorizeLembaga($auth, (int) $data['lembaga_id']);

        $row = SemesterAktif::updateOrCreate(
            ['lembaga_id' => (int) $data['lembaga_id']],
            ['semester' => $data['semester'], 'diubah_oleh' => $auth->id],
        );

        return response()->json([
            'pesan' => 'Semester aktif ditetapkan.',
            'data' => [
                'lembaga_id' => $row->lembaga_id,
                'semester' => $row->semester,
                'label' => SemesterAktif::label($row->semester),
            ],
        ]);
    }
}
