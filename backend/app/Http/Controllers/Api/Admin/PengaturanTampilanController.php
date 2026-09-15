<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Lembaga;
use App\Models\PengaturanTampilan;
use App\Models\PresetTabel;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Standar tampilan per lembaga: super_admin menyebar ke semua lembaga, admin
 * lembaga mengatur salinan lembaganya sendiri. Klien memadukannya sebagai
 * nilai bawaan (preferensi pribadi user tetap boleh menimpa).
 */
class PengaturanTampilanController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/pengaturan-tampilan[?lembaga_id=] — standar efektif. */
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'pesan' => 'Pengaturan tampilan dimuat.',
            'data' => $this->respon($this->lembagaEfektif($request)),
        ]);
    }

    /** GET /api/admin/pengaturan-tampilan/versi[?lembaga_id=] — ringan untuk pemantauan. */
    public function versi(Request $request): JsonResponse
    {
        $lembagaId = $this->lembagaEfektif($request);

        return response()->json([
            'pesan' => 'Versi pengaturan tampilan.',
            'data' => [
                'lembaga_id' => $lembagaId,
                'versi' => $this->versiUntuk($lembagaId),
            ],
        ]);
    }

    /** PUT /api/admin/pengaturan-tampilan — simpan/sebar standar ke lembaga terpilih. */
    public function upsert(Request $request): JsonResponse
    {
        $request->validate(['lembaga_ids' => ['required']]);

        $data = $request->validate([
            'data' => ['required', 'array'],
            'data.tema' => ['sometimes', 'array'],
            'data.tema.theme' => ['sometimes', 'nullable', 'string', 'max:40'],
            'data.tema.mode' => ['sometimes', 'nullable', Rule::in(['terang', 'gelap', 'sistem'])],
            'data.tema.warnaUI' => ['sometimes', 'nullable', Rule::in(['netral', 'aksen', 'kaya'])],
            'data.tema.iconSet' => ['sometimes', 'nullable', 'string', 'max:40'],
            'data.tema.density' => ['sometimes', 'nullable', Rule::in(['ramping', 'sedang', 'nyaman'])],
            'data.parts' => ['sometimes', 'array'],
            'data.parts.gaya' => ['sometimes', 'array'],
            'data.parts.terang' => ['sometimes', 'array'],
            'data.parts.gelap' => ['sometimes', 'array'],
            'data.grid' => ['sometimes', 'array'],
            'data.grid.rowH' => ['sometimes', 'nullable', 'integer', 'between:20,200'],
            'data.grid.headerH' => ['sometimes', 'nullable', 'integer', 'between:20,120'],
            'data.grid.align' => ['sometimes', 'array'],
            'data.grid.align.*' => [Rule::in(['left', 'center', 'right'])],
            'data.presetAktif' => ['sometimes', 'array'],
            'data.presetAktif.*' => ['nullable', 'string', 'max:50'],
            'data.lebar' => ['sometimes', 'array'],
            'data.lebar.*' => ['array'],
            'data.lebar.*.*' => ['integer', 'between:20,2000'],
            'data.beku' => ['sometimes', 'array'],
            'data.beku.*' => ['integer', 'between:0,20'],
            'sumber_lembaga_id' => ['sometimes', 'nullable', 'integer', 'exists:lembaga,id'],
        ]);

        $auth = $request->user();
        $ids = $this->resolveLembagaIds($request->input('lembaga_ids'), $auth);
        $sumber = isset($data['sumber_lembaga_id']) ? (int) $data['sumber_lembaga_id'] : null;

        DB::transaction(function () use ($ids, $data, $auth, $sumber) {
            foreach ($ids as $lembagaId) {
                $row = PengaturanTampilan::firstOrNew(['lembaga_id' => $lembagaId]);
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
                ->map(fn (int $id) => $this->respon($id))
                ->values()
                ->all(),
        ], 201);
    }

    /** DELETE /api/admin/pengaturan-tampilan[?lembaga_id=] — kembali ke bawaan aplikasi. */
    public function destroy(Request $request): JsonResponse
    {
        $lembagaId = $this->lembagaEfektif($request);
        if ($lembagaId === null) {
            abort(422, 'Lembaga tidak dapat ditentukan.');
        }
        $this->authorizeLembaga($request->user(), $lembagaId);
        PengaturanTampilan::where('lembaga_id', $lembagaId)->delete();

        return response()->json(['pesan' => 'Standar tampilan dikembalikan ke bawaan.']);
    }

    /** Standar satu lembaga (null bila belum diatur). */
    protected function respon(?int $lembagaId): array
    {
        if ($lembagaId === null) {
            return ['lembaga_id' => null, 'versi' => 0, 'tampilan' => null, 'diubah_oleh' => null, 'diperbarui' => null];
        }

        $row = PengaturanTampilan::with('pengubah:id,name')
            ->where('lembaga_id', $lembagaId)
            ->first();

        return [
            'lembaga_id' => $lembagaId,
            'versi' => $row?->versi ?? 0,
            'tampilan' => $row?->data,
            'diubah_oleh' => $row?->pengubah?->name,
            'diperbarui' => $row?->updated_at?->toIso8601String(),
        ];
    }

    protected function versiUntuk(?int $lembagaId): int
    {
        if ($lembagaId === null) {
            return 0;
        }

        return (int) (PengaturanTampilan::where('lembaga_id', $lembagaId)->value('versi') ?? 0);
    }

    /**
     * Lembaga siapa yang dimaksud: `?lembaga_id=` (terotorisasi) menang; bila
     * tidak ada, hanya user berpivot tunggal yang bisa dipastikan.
     */
    protected function lembagaEfektif(Request $request): ?int
    {
        $auth = $request->user();
        if ($request->filled('lembaga_id')) {
            $id = (int) $request->input('lembaga_id');
            $this->authorizeLembaga($auth, $id);

            return $id;
        }
        $ids = $auth->lembagaIds();

        return count($ids) === 1 ? (int) $ids[0] : null;
    }

    /** Normalisasi `lembaga_ids` (array atau "semua") + otorisasi tiap lembaga. */
    protected function resolveLembagaIds(mixed $isi, User $auth): array
    {
        if ($isi === 'semua') {
            $ids = Lembaga::orderBy('id')->pluck('id')->map(fn ($v) => (int) $v)->all();
        } else {
            $valid = validator(['lembaga_ids' => $isi], [
                'lembaga_ids' => ['required', 'array', 'min:1', 'max:200'],
                'lembaga_ids.*' => ['integer', 'exists:lembaga,id'],
            ])->validate();
            $ids = array_map('intval', array_unique($valid['lembaga_ids']));
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
    protected function salinPresetAktif(array $presetAktif, int $targetLembagaId, ?int $sumberLembagaId): void
    {
        foreach ($presetAktif as $tableKey => $nama) {
            if (! is_string($nama) || trim($nama) === '' || mb_strtolower(trim($nama)) === 'lengkap') {
                continue;
            }

            $sudahAda = PresetTabel::where('lembaga_id', $targetLembagaId)
                ->where('table_key', $tableKey)
                ->where('nama', $nama)
                ->exists();
            if ($sudahAda || $sumberLembagaId === null || $sumberLembagaId === $targetLembagaId) {
                continue;
            }

            $sumber = PresetTabel::where('lembaga_id', $sumberLembagaId)
                ->where('table_key', $tableKey)
                ->where('nama', $nama)
                ->first();
            if (! $sumber) {
                continue;
            }

            PresetTabel::create([
                'lembaga_id' => $targetLembagaId,
                'table_key' => $tableKey,
                'nama' => $nama,
                'kolom' => $sumber->kolom,
                'dibuat_oleh' => $sumber->dibuat_oleh,
            ]);
        }
    }
}
