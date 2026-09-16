<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\IzinKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class IzinController extends Controller
{
    /** GET /api/admin/izin — matriks role × izin untuk Kelola Izin. */
    public function index(): JsonResponse
    {
        $roles = Role::where('guard_name', 'sanctum')->orderBy('name')->get();

        return response()->json([
            'pesan' => 'Matriks izin dimuat.',
            'data' => [
                'katalog' => IzinKatalog::MODUL_AKSI,
                'roles' => $roles->map(fn (Role $r) => [
                    'name' => $r->name,
                    'terkunci' => $r->name === 'super_admin',
                    'permissions' => $r->permissions->pluck('name')->values()->all(),
                ])->values()->all(),
            ],
        ]);
    }

    /**
     * PUT /api/admin/izin — simpan centang satu role.
     * Anti-lockout: role `super_admin` selalu full (tak bisa diubah);
     * halaman ini hanya bisa dibuka pemilik `izin.ubah` (= super_admin).
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', 'string', 'exists:roles,name'],
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string'],
        ]);

        if ($data['role'] === 'super_admin') {
            return response()->json(['message' => 'Role super_admin selalu memiliki semua izin.'], 422);
        }

        $dikenal = array_values(array_filter(
            $data['permissions'],
            fn ($p) => is_string($p) && IzinKatalog::dikenal($p)
        ));
        sort($dikenal);

        $role = Role::where('name', $data['role'])->where('guard_name', 'sanctum')->firstOrFail();
        $role->syncPermissions($dikenal);

        return response()->json([
            'pesan' => "Izin role {$role->name} tersimpan.",
            'data' => ['role' => $role->name, 'permissions' => $dikenal],
        ]);
    }
}
