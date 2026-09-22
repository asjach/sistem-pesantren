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
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PresetTabelController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/preset-tabel?table_key=psb */
    public function index(PresetTabelIndexRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = $request->user();

        $presets = $this->queryEfektif($data['table_key'])
            ->with('lembaga:jenjang,nama')
            ->orderBy('nama')
            ->get();

        $aktif = PresetTabelAktif::where('user_id', $user->id)
            ->where('table_key', $data['table_key'])
            ->value('preset_id');

        $bawaan = PresetTabel::where('table_key', $data['table_key'])
            ->where('is_default', true)
            ->value('id');

        return response()->json([
            'pesan' => 'Preset kolom dimuat.',
            'data' => [
                'presets' => $presets,
                'aktif_preset_id' => $aktif ? (int) $aktif : null,
                'default_preset_id' => $bawaan ? (int) $bawaan : null,
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
            ['jenjang' => null, 'table_key' => $data['table_key'], 'nama' => $data['nama']],
            ['kolom' => $kolom, 'label' => $label, 'dibuat_oleh' => $request->user()->id],
        )->load('lembaga:jenjang,nama');

        return response()->json([
            'pesan' => 'Preset kolom disimpan.',
            'data' => [$preset],
        ], 201);
    }

    /** PUT /api/admin/preset-tabel/{preset} — ubah nama/kolom global
     *  (super_admin). Baris lama per-lembaga tidak dikelola lagi: hapus
     *  lalu buat baru sebagai global. */
    public function update(PresetTabelUpdateRequest $request, PresetTabel $preset): JsonResponse
    {
        $this->pastikanSuperAdmin($request->user());

        if ($preset->jenjang !== null) {
            throw ValidationException::withMessages([
                'preset' => 'Preset lama per-lembaga tidak dikelola lagi; hapus lalu buat baru sebagai global.',
            ]);
        }

        $data = $request->validated();

        $nama = $data['nama'] ?? $preset->nama;
        $this->pastikanNamaBukanLengkap($nama);
        $this->pastikanNamaUnik($preset->table_key, $nama, $preset->id);

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
            'data' => [$preset->fresh('lembaga:jenjang,nama')],
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
            $terlihat = $this->queryEfektif($data['table_key'])->pluck('id');
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

    /** POST /api/admin/preset-tabel/{preset}/bawaan — jadikan/cabut preset
     *  bawaan tabel (super_admin; hanya preset global; satu per table_key). */
    public function setBawaan(Request $request, PresetTabel $preset): JsonResponse
    {
        $this->pastikanSuperAdmin($request->user());

        $bawaan = (bool) $request->boolean('bawaan', true);
        if ($preset->jenjang !== null) {
            throw ValidationException::withMessages(['preset' => 'Hanya preset global yang bisa jadi bawaan.']);
        }

        DB::transaction(function () use ($preset, $bawaan) {
            PresetTabel::where('table_key', $preset->table_key)
                ->where('id', '!=', $preset->id)
                ->update(['is_default' => false]);
            $preset->update(['is_default' => $bawaan]);
        });

        return response()->json([
            'pesan' => $bawaan ? 'Preset bawaan ditetapkan.' : 'Preset bawaan dicabut.',
        ]);
    }

    protected function pastikanSuperAdmin(mixed $user): void
    {
        if (! $user instanceof User || ! $user->bolehSuperAdmin()) {
            abort(403, 'Preset kolom hanya dikelola super_admin.');
        }
    }

    /** Preset kolom GLOBAL: semua role melihat baris global yang sama. */
    protected function queryEfektif(string $tableKey)
    {
        return PresetTabel::where('table_key', $tableKey)->whereNull('jenjang');
    }

    protected function pastikanNamaBukanLengkap(string $nama): void
    {
        if (mb_strtolower(trim($nama)) === 'lengkap') {
            throw ValidationException::withMessages(['nama' => 'Nama "lengkap" dipakai bawaan sistem; pilih nama lain.']);
        }
    }

    protected function pastikanNamaUnik(string $tableKey, string $nama, ?int $ignoreId = null): void
    {
        $q = PresetTabel::where('table_key', $tableKey)
            ->where('nama', $nama)
            ->whereNull('jenjang')
            ->when($ignoreId, fn ($qq) => $qq->where('id', '!=', $ignoreId));

        if ($q->exists()) {
            throw ValidationException::withMessages(['nama' => 'Nama preset sudah dipakai untuk tabel ini.']);
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
