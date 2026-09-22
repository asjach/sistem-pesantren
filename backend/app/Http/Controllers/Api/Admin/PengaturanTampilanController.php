<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PengaturanTampilanUpsertRequest;
use App\Models\Lembaga;
use App\Models\PengaturanTampilan;
use App\Models\PresetTabel;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Standar tampilan per lembaga: super_admin menyebar ke semua lembaga, admin
 * lembaga mengatur salinan lembaganya sendiri. Klien memadukannya sebagai
 * nilai bawaan (preferensi pribadi user tetap boleh menimpa).
 */
class PengaturanTampilanController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/pengaturan-tampilan[?jenjang=] — standar efektif. */
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'pesan' => 'Pengaturan tampilan dimuat.',
            'data' => $this->respon($this->lembagaEfektif($request)),
        ]);
    }

    /** GET /api/admin/pengaturan-tampilan/versi[?jenjang=] — ringan untuk pemantauan. */
    public function versi(Request $request): JsonResponse
    {
        $lembagaId = $this->lembagaEfektif($request);

        return response()->json([
            'pesan' => 'Versi pengaturan tampilan.',
            'data' => [
                'jenjang' => $lembagaId,
                'versi' => $this->versiUntuk($lembagaId),
            ],
        ]);
    }

    /** PUT /api/admin/pengaturan-tampilan — simpan/sebar standar ke lembaga terpilih. */
    public function upsert(PengaturanTampilanUpsertRequest $request): JsonResponse
    {
        $data = $request->validated();

        $auth = $request->user();
        $ids = $this->resolveLembagaIds($request->input('jenjangs'), $auth);
        $sumber = isset($data['sumber_jenjang']) ? $data['sumber_jenjang'] : null;

        DB::transaction(function () use ($ids, $data, $auth, $sumber) {
            foreach ($ids as $lembagaId) {
                $row = PengaturanTampilan::firstOrNew(['jenjang' => $lembagaId]);
                $row->data = $data['data'];
                $row->versi = ($row->exists ? (int) $row->versi : 0) + 1;
                $row->diubah_oleh = $auth->id;
                $row->save();

                $this->salinPresetAktif($data['data']['presetAktif'] ?? [], $lembagaId, $sumber);
            }
        });

        return response()->json([
            'pesan' => count($ids) > 1
                ? 'Standar tampilan disebar ke '.count($ids).' lembaga.'
                : 'Standar tampilan disimpan.',
            'data' => collect($ids)
                ->map(fn (string $id) => $this->respon($id))
                ->values()
                ->all(),
        ], 201);
    }

    /** DELETE /api/admin/pengaturan-tampilan[?jenjang=] — kembali ke bawaan aplikasi. */
    public function destroy(Request $request): JsonResponse
    {
        $lembagaId = $this->lembagaEfektif($request);
        if ($lembagaId === null) {
            abort(422, 'Lembaga tidak dapat ditentukan.');
        }
        $this->authorizeLembaga($request->user(), $lembagaId);
        PengaturanTampilan::where('jenjang', $lembagaId)->delete();

        return response()->json(['pesan' => 'Standar tampilan dikembalikan ke bawaan.']);
    }

    /** Standar satu lembaga (null bila belum diatur). */
    protected function respon(?string $lembagaId): array
    {
        if ($lembagaId === null) {
            return ['jenjang' => null, 'versi' => 0, 'tampilan' => null, 'diubah_oleh' => null, 'diperbarui' => null];
        }

        $row = PengaturanTampilan::with('pengubah:id,name')
            ->where('jenjang', $lembagaId)
            ->first();

        return [
            'jenjang' => $lembagaId,
            'versi' => $row?->versi ?? 0,
            'tampilan' => $row?->data,
            'diubah_oleh' => $row?->pengubah?->name,
            'diperbarui' => $row?->updated_at?->toIso8601String(),
        ];
    }

    protected function versiUntuk(?string $lembagaId): int
    {
        if ($lembagaId === null) {
            return 0;
        }

        return (int) (PengaturanTampilan::where('jenjang', $lembagaId)->value('versi') ?? 0);
    }

    /**
     * Lembaga siapa yang dimaksud: `?jenjang=` (terotorisasi) menang; bila
     * tidak ada, hanya user berpivot tunggal yang bisa dipastikan.
     */
    protected function lembagaEfektif(Request $request): ?string
    {
        $auth = $request->user();
        if ($request->filled('jenjang')) {
            $id = (string) $request->input('jenjang');
            $this->authorizeLembaga($auth, $id);

            return $id;
        }
        $ids = $auth->lembagaIds();

        return count($ids) === 1 ? $ids[0] : null;
    }

    /** Normalisasi `jenjangs` (array atau "semua") + otorisasi tiap lembaga. */
    protected function resolveLembagaIds(mixed $isi, User $auth): array
    {
        if ($isi === 'semua') {
            $ids = Lembaga::orderBy('jenjang')->pluck('jenjang')->all();
        } else {
            $valid = validator(['jenjangs' => $isi], [
                'jenjangs' => ['required', 'array', 'min:1', 'max:200'],
                'jenjangs.*' => ['string', 'exists:lembaga,jenjang'],
            ])->validate();
            $ids = array_values(array_unique($valid['jenjangs']));
        }

        foreach ($ids as $id) {
            $this->authorizeLembaga($auth, $id);
        }

        return $ids;
    }

    /**
     * Pastikan preset kolom yang dirujuk standar (`presetAktif`: table_key →
     * nama) ada di lembaga target; bila belum, salin definisinya dari lembaga
     * sumber (biasanya tempat standar disusun).
     */
    protected function salinPresetAktif(array $presetAktif, string $targetLembagaId, ?string $sumberLembagaId): void
    {
        foreach ($presetAktif as $tableKey => $nama) {
            if (! is_string($nama) || trim($nama) === '' || mb_strtolower(trim($nama)) === 'lengkap') {
                continue;
            }

            $sudahAda = PresetTabel::where('jenjang', $targetLembagaId)
                ->where('table_key', $tableKey)
                ->where('nama', $nama)
                ->exists();
            if ($sudahAda || $sumberLembagaId === null || $sumberLembagaId === $targetLembagaId) {
                continue;
            }

            $sumber = PresetTabel::where('jenjang', $sumberLembagaId)
                ->where('table_key', $tableKey)
                ->where('nama', $nama)
                ->first();
            if (! $sumber) {
                continue;
            }

            PresetTabel::create([
                'jenjang' => $targetLembagaId,
                'table_key' => $tableKey,
                'nama' => $nama,
                'kolom' => $sumber->kolom,
                'dibuat_oleh' => $sumber->dibuat_oleh,
            ]);
        }
    }
}
