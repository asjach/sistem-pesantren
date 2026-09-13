<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\PresetTabel;
use App\Models\PresetTabelAktif;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PresetTabelController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/preset-tabel?table_key=psb */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['table_key' => ['required', 'string', 'max:60']]);
        $user = $request->user();

        $presets = $this->queryEfektif($user, $data['table_key'])
            ->with('lembaga:id,nama,kode')
            ->orderByRaw('lembaga_id is null desc')
            ->orderBy('lembaga_id')
            ->orderBy('nama')
            ->get();

        $aktif = PresetTabelAktif::where('user_id', $user->id)
            ->where('table_key', $data['table_key'])
            ->value('preset_id');

        return response()->json([
            'pesan' => 'Preset kolom dimuat.',
            'data' => [
                'presets' => $presets,
                'aktif_preset_id' => $aktif ? (int) $aktif : null,
            ],
        ]);
    }

    /** POST /api/admin/preset-tabel — generate ke lembaga yang dipilih (boleh lebih dari satu). */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'table_key' => ['required', 'string', 'max:60'],
            'nama' => ['required', 'string', 'max:50'],
            'lembaga_ids' => ['required', 'array', 'min:1', 'max:200'],
            'lembaga_ids.*' => ['integer', 'exists:lembaga,id'],
            'kolom' => ['required', 'array', 'min:1', 'max:60'],
            'kolom.*' => ['string', 'max:60'],
        ]);
        $this->pastikanNamaBukanLengkap($data['nama']);
        foreach (array_unique($data['lembaga_ids']) as $lembagaId) {
            $this->authorizePreset($request->user(), (int) $lembagaId);
        }

        $kolom = array_values(array_unique($data['kolom']));
        $presets = collect();
        foreach (array_unique($data['lembaga_ids']) as $lembagaId) {
            $presets->push(PresetTabel::updateOrCreate(
                ['lembaga_id' => (int) $lembagaId, 'table_key' => $data['table_key'], 'nama' => $data['nama']],
                ['kolom' => $kolom, 'dibuat_oleh' => $request->user()->id],
            )->load('lembaga:id,nama,kode'));
        }

        return response()->json([
            'pesan' => $presets->count() > 1
                ? "Preset digenerate ke {$presets->count()} lembaga."
                : 'Preset kolom disimpan.',
            'data' => $presets->values(),
        ], 201);
    }

    /** PUT /api/admin/preset-tabel/{preset} — ubah nama/kolom milik satu lembaga. */
    public function update(Request $request, PresetTabel $preset): JsonResponse
    {
        $this->authorizePreset($request->user(), $preset->lembaga_id);

        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:50'],
            'kolom' => ['sometimes', 'array', 'min:1', 'max:60'],
            'kolom.*' => ['string', 'max:60'],
        ]);

        $nama = $data['nama'] ?? $preset->nama;
        $this->pastikanNamaBukanLengkap($nama);
        $this->pastikanNamaUnik($preset->table_key, $nama, $preset->lembaga_id, $preset->id);

        $preset->update([
            'nama' => $nama,
            'kolom' => array_values(array_unique($data['kolom'] ?? $preset->kolom)),
        ]);

        return response()->json([
            'pesan' => 'Preset kolom diubah.',
            'data' => [$preset->fresh('lembaga:id,nama,kode')],
        ]);
    }

    /** DELETE /api/admin/preset-tabel/{preset} */
    public function destroy(Request $request, PresetTabel $preset): JsonResponse
    {
        $this->authorizePreset($request->user(), $preset->lembaga_id);
        $preset->delete();

        return response()->json(['pesan' => 'Preset kolom dihapus.']);
    }

    /** POST /api/admin/preset-tabel/aktif — simpan pilihan terakhir (null = Lengkap). */
    public function setAktif(Request $request): JsonResponse
    {
        $data = $request->validate([
            'table_key' => ['required', 'string', 'max:60'],
            'preset_id' => ['nullable', 'integer', 'exists:preset_tabel,id'],
        ]);

        $presetId = $data['preset_id'] ?? null;
        if ($presetId !== null) {
            $preset = PresetTabel::findOrFail($presetId);
            if ($preset->table_key !== $data['table_key']) {
                throw ValidationException::withMessages(['preset_id' => 'Preset tidak cocok dengan tabel ini.']);
            }
            $this->authorizePreset($request->user(), $preset->lembaga_id);
        }

        PresetTabelAktif::updateOrCreate(
            ['user_id' => $request->user()->id, 'table_key' => $data['table_key']],
            ['preset_id' => $presetId],
        );

        return response()->json(['pesan' => 'Preset aktif disimpan.']);
    }

    protected function queryEfektif(User $user, string $tableKey)
    {
        $q = PresetTabel::where('table_key', $tableKey);
        if ($this->isAdminPesantren($user)) {
            return $q;
        }
        $ids = $user->lembagaIds();

        return $q->where(function ($qq) use ($ids) {
            $qq->whereNull('lembaga_id');
            if (! empty($ids)) {
                $qq->orWhereIn('lembaga_id', $ids);
            }
        });
    }

    protected function authorizePreset(User $user, ?int $lembagaId): void
    {
        if ($lembagaId === null) {
            if (! $this->isAdminPesantren($user)) {
                abort(403, 'Preset global hanya dikelola admin pesantren.');
            }

            return;
        }
        $this->authorizeLembaga($user, $lembagaId);
    }

    protected function isAdminPesantren(User $user): bool
    {
        return $user->hasRole('super_admin') || $user->isAdminFull();
    }

    protected function pastikanNamaBukanLengkap(string $nama): void
    {
        if (mb_strtolower(trim($nama)) === 'lengkap') {
            throw ValidationException::withMessages(['nama' => 'Nama "lengkap" dipakai bawaan sistem; pilih nama lain.']);
        }
    }

    protected function pastikanNamaUnik(string $tableKey, string $nama, ?int $lembagaId, ?int $ignoreId = null): void
    {
        $q = PresetTabel::where('table_key', $tableKey)
            ->where('nama', $nama)
            ->when($lembagaId === null, fn ($qq) => $qq->whereNull('lembaga_id'))
            ->when($lembagaId !== null, fn ($qq) => $qq->where('lembaga_id', $lembagaId))
            ->when($ignoreId, fn ($qq) => $qq->where('id', '!=', $ignoreId));

        if ($q->exists()) {
            throw ValidationException::withMessages(['nama' => 'Nama preset sudah dipakai untuk tabel & lembaga ini.']);
        }
    }
}
