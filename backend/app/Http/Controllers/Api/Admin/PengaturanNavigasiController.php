<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PengaturanNavigasi;
use App\Models\PengaturanNavigasiPengguna;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PengaturanNavigasiController extends Controller
{
    /** Setelan visibilitas navigasi efektif untuk pengguna saat ini. */
    public function setelan(Request $request): JsonResponse
    {
        $user = $request->user();
        $global = $this->global();
        $globalMode = $user->can('pengaturan_halaman.ubah');

        $pribadi = [];
        if (! $globalMode) {
            $row = PengaturanNavigasiPengguna::firstOrCreate(
                ['user_id' => $user->id],
                ['tersembunyi' => []],
            );
            $pribadi = array_values(array_diff($row->tersembunyi ?? [], $global));
        }

        return response()->json($this->bentuk($globalMode, $global, $pribadi));
    }

    public function simpan(Request $request): JsonResponse
    {
        $valid = $request->validate([
            'tersembunyi' => ['present', 'array', 'max:500'],
            'tersembunyi.*' => ['string', 'max:120'],
        ]);
        $diminta = array_values(array_unique($valid['tersembunyi']));
        $user = $request->user();

        if ($user->can('pengaturan_halaman.ubah')) {
            $row = $this->barisGlobal();
            $row->tersembunyi = $diminta;
            $row->diubah_oleh = $user->id;
            $row->save();

            return response()->json([
                'pesan' => 'Pengaturan navigasi global disimpan.',
                ...$this->bentuk(true, $diminta, []),
            ]);
        }

        abort_unless($user->can('navigasi.atur'), 403);

        $global = $this->global();
        // Admin hanya boleh menyembunyikan entri yang masih diaktifkan global.
        $pribadi = array_values(array_diff($diminta, $global));

        PengaturanNavigasiPengguna::updateOrCreate(
            ['user_id' => $user->id],
            ['tersembunyi' => $pribadi],
        );

        return response()->json([
            'pesan' => 'Pengaturan navigasi pribadi disimpan.',
            ...$this->bentuk(false, $global, $pribadi),
        ]);
    }

    private function barisGlobal(): PengaturanNavigasi
    {
        return PengaturanNavigasi::query()->firstOrCreate([], ['tersembunyi' => []]);
    }

    /** @return array<int, string> */
    private function global(): array
    {
        return $this->barisGlobal()->tersembunyi ?? [];
    }

    /** @param array<int, string> $global @param array<int, string> $pribadi */
    private function bentuk(bool $globalMode, array $global, array $pribadi): array
    {
        return [
            'mode' => $globalMode ? 'global' : 'pribadi',
            'global_tersembunyi' => array_values(array_unique($global)),
            'pribadi_tersembunyi' => array_values(array_unique($pribadi)),
            'tersembunyi' => array_values(array_unique([...$global, ...$pribadi])),
        ];
    }
}
