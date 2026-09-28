<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UrutPresetHapusRequest;
use App\Http\Requests\Admin\UrutPresetIndexRequest;
use App\Http\Requests\Admin\UrutPresetSimpanRequest;
use App\Models\UrutPreset;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * Preset urut GLOBAL per `table_key` (satu baris = daftar opsi urut).
 * Menggantikan hardcode `opsiUrut` di frontend; kode urut divalidasi terhadap
 * `UrutKatalog` sehingga preset tersimpan dijamin dikenali endpoint daftar.
 * Baca bebas (semua admin); tulis khusus super_admin.
 */
class UrutPresetController extends Controller
{
    /** GET /api/admin/urut-preset?table_key=santri */
    public function index(UrutPresetIndexRequest $request): JsonResponse
    {
        $data = $request->validated();
        $this->pastikanTableKeyDikenal($data['table_key']);

        $row = UrutPreset::where('table_key', $data['table_key'])->first();

        return response()->json([
            'pesan' => 'Preset urut dimuat.',
            'data' => [
                'table_key' => $data['table_key'],
                'opsi' => $row?->opsi ?? [],
                'tersedia' => UrutKatalog::tersedia($data['table_key']),
            ],
        ]);
    }

    /** PUT /api/admin/urut-preset — upsert daftar opsi satu tabel. */
    public function simpan(UrutPresetSimpanRequest $request): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validated();
        $this->pastikanTableKeyDikenal($data['table_key']);

        $sah = array_keys(UrutKatalog::peta($data['table_key']));
        $normal = [];
        $adaBawaan = false;
        foreach ($data['opsi'] as $opsi) {
            $kode = array_values(array_unique(array_map(fn ($k) => trim((string) $k), $opsi['kode'])));
            foreach ($kode as $k) {
                if (! in_array($k, $sah, true)) {
                    throw ValidationException::withMessages([
                        'opsi' => "Kode urut \"{$k}\" tidak dikenal untuk tabel ini.",
                    ]);
                }
            }
            $bawaan = (bool) ($opsi['bawaan'] ?? false) && ! $adaBawaan;
            $adaBawaan = $adaBawaan || $bawaan;
            $normal[] = [
                'kode' => $kode,
                'label' => trim((string) $opsi['label']),
                'arah' => $opsi['arah'] ?? null,
                'arah_kolom' => $this->normalArahKolom($opsi['arah_kolom'] ?? null, $kode),
                'bawaan' => $bawaan,
            ];
        }

        $row = UrutPreset::updateOrCreate(
            ['table_key' => $data['table_key']],
            ['opsi' => $normal, 'dibuat_oleh' => $request->user()->id],
        );

        return response()->json(['pesan' => 'Preset urut disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/urut-preset?table_key=santri — kosongkan preset. */
    public function hapus(UrutPresetHapusRequest $request): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validated();
        $this->pastikanTableKeyDikenal($data['table_key']);

        UrutPreset::where('table_key', $data['table_key'])->delete();

        return response()->json(['pesan' => 'Preset urut dikosongkan.']);
    }

    protected function pastikanTableKeyDikenal(string $tableKey): void
    {
        if (! UrutKatalog::kenal($tableKey)) {
            throw ValidationException::withMessages(['table_key' => 'Tabel ini tidak punya opsi urut.']);
        }
    }

    /**
     * Normalisasi `arah_kolom` (peta kode → naik/turun): buang kunci tak dikenal,
    *  nilai tak valid dianggap tidak disetel (ikut global).
     *
     * @param  array<string, mixed>|null  $mentah
     * @param  list<string>  $kode
     * @return array<string, 'naik'|'turun'>|null
     */
    protected function normalArahKolom($mentah, array $kode): ?array
    {
        if (! is_array($mentah) || $mentah === []) {
            return null;
        }
        $bersih = [];
        foreach ($mentah as $k => $v) {
            $kunci = trim((string) $k);
            $nilai = is_string($v) ? strtolower(trim($v)) : '';
            if (in_array($kunci, $kode, true) && in_array($nilai, ['naik', 'turun'], true)) {
                $bersih[$kunci] = $nilai;
            }
        }

        return $bersih === [] ? null : $bersih;
    }

    protected function pastikanAdminPesantren(): void
    {
        if (! auth()->user()?->bolehSuperAdmin()) {
            abort(403, 'Preset urut hanya dikelola super_admin.');
        }
    }
}
