<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PresetTabelAktifRequest;
use App\Http\Requests\Admin\PresetTabelIndexRequest;
use App\Http\Requests\Admin\PresetTabelStoreRequest;
use App\Http\Requests\Admin\PresetTabelUpdateRequest;
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
    public function index(PresetTabelIndexRequest $request): JsonResponse
    {
        $data = $request->validated();
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

    /** POST /api/admin/preset-tabel — simpan preset GLOBAL (satu baris per nama). */
    public function store(PresetTabelStoreRequest $request): JsonResponse
    {
        $this->pastikanSuperAdmin($request->user());
        $data = $request->validated();
        $this->pastikanNamaBukanLengkap($data['nama']);

        $kolom = array_values(array_unique($data['kolom']));
        $label = $this->bersihkanLabel($data['label'] ?? null, $kolom);
        $preset = PresetTabel::updateOrCreate(
            ['lembaga_id' => null, 'table_key' => $data['table_key'], 'nama' => $data['nama']],
            ['kolom' => $kolom, 'label' => $label, 'dibuat_oleh' => $request->user()->id],
        )->load('lembaga:id,nama,kode');

        return response()->json([
            'pesan' => 'Preset kolom disimpan.',
            'data' => [$preset],
        ], 201);
    }

    /** PUT /api/admin/preset-tabel/{preset} — ubah nama/kolom (super_admin; baris
     *  lama milik lembaga tetap bisa dirapikan). */
    public function update(PresetTabelUpdateRequest $request, PresetTabel $preset): JsonResponse
    {
        $this->pastikanSuperAdmin($request->user());

        $data = $request->validated();

        $nama = $data['nama'] ?? $preset->nama;
        $this->pastikanNamaBukanLengkap($nama);
        $this->pastikanNamaUnik($preset->table_key, $nama, $preset->lembaga_id, $preset->id);

        $kolom = array_values(array_unique($data['kolom'] ?? $preset->kolom));
        $preset->update([
            'nama' => $nama,
            'kolom' => $kolom,
            'label' => array_key_exists('label', $data)
                ? $this->bersihkanLabel($data['label'], $kolom)
                : $this->bersihkanLabel($preset->label, $kolom),
        ]);

        return response()->json([
            'pesan' => 'Preset kolom diubah.',
            'data' => [$preset->fresh('lembaga:id,nama,kode')],
        ]);
    }

    /** DELETE /api/admin/preset-tabel/{preset} */
    public function destroy(Request $request, PresetTabel $preset): JsonResponse
    {
        $this->pastikanSuperAdmin($request->user());
        $preset->delete();

        return response()->json(['pesan' => 'Preset kolom dihapus.']);
    }

    /** POST /api/admin/preset-tabel/aktif — simpan pilihan terakhir (null = Lengkap).
     *  Pilihan pribadi: semua role yang bisa melihat preset boleh memakai. */
    public function setAktif(PresetTabelAktifRequest $request): JsonResponse
    {
        $data = $request->validated();

        $presetId = $data['preset_id'] ?? null;
        if ($presetId !== null) {
            $preset = PresetTabel::findOrFail($presetId);
            if ($preset->table_key !== $data['table_key']) {
                throw ValidationException::withMessages(['preset_id' => 'Preset tidak cocok dengan tabel ini.']);
            }
            $terlihat = $this->queryEfektif($request->user(), $data['table_key'])->pluck('id');
            if (! $terlihat->contains($preset->id)) {
                abort(403, 'Preset tidak tersedia untuk Anda.');
            }
        }

        PresetTabelAktif::updateOrCreate(
            ['user_id' => $request->user()->id, 'table_key' => $data['table_key']],
            ['preset_id' => $presetId],
        );

        return response()->json(['pesan' => 'Preset aktif disimpan.']);
    }

    protected function pastikanSuperAdmin(mixed $user): void
    {
        if (! $user instanceof User || ! $user->hasRole('super_admin')) {
            abort(403, 'Preset kolom hanya dikelola super_admin.');
        }
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

    protected function isAdminPesantren(User $user): bool
    {
        return $user->bolehPesantren();
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

    /**
     * Bersihkan peta label kustom: hanya key yang ada di kolom, trim, buang
     * yang kosong. Mengembalikan null bila tak ada label kustom tersisa.
     *
     * @param  array<string, string|null>|null  $label
     * @param  string[]  $kolom
     */
    protected function bersihkanLabel(mixed $label, array $kolom): ?array
    {
        if (! is_array($label)) {
            return null;
        }
        $boleh = array_flip($kolom);
        $bersih = [];
        foreach ($label as $key => $nama) {
            if (! isset($boleh[$key])) {
                continue;
            }
            $nama = trim((string) $nama);
            if ($nama !== '') {
                $bersih[$key] = mb_substr($nama, 0, 60);
            }
        }

        return $bersih === [] ? null : $bersih;
    }
}
