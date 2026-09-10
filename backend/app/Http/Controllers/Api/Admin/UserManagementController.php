<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AssignRoleRequest;
use App\Http\Requests\Admin\CreateUserRequest;
use App\Http\Requests\Admin\ImportUserRequest;
use App\Imports\UsersImport;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\ValidationException;

class UserManagementController extends Controller
{
    protected function assignableRolesFor(User $authUser): array
    {
        if ($authUser->hasRole('super_admin')) {
            return ['super_admin', 'admin', 'kasir', 'guru', 'orang_tua', 'santri'];
        }
        if ($authUser->hasRole('admin')) {
            return ['kasir', 'guru', 'orang_tua', 'santri'];
        }

        return [];
    }

    /**
     * Validasi lembaga_ids[]: tiap id wajib exists + boleh diakses actor.
     * Admin non-full tanpa lembaga_ids = fallback seluruh pivot sendiri (vault 003).
     */
    protected function resolveLembagaIds(User $authUser, ?array $inputIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $inputIds ?? [])));
        foreach ($ids as $lid) {
            if (! \App\Models\Lembaga::whereKey($lid)->exists()) abort(422, "Lembaga $lid tidak ditemukan.");
            if (! $authUser->canAccessLembaga($lid)) abort(403, 'Lembaga di luar kewenangan Anda.');
        }
        if (empty($ids) && ! $authUser->hasRole('super_admin') && ! $authUser->isAdminFull()) {
            $mine = $authUser->lembagaIds();
            if (empty($mine)) abort(422, 'lembaga_ids wajib untuk admin non-global.');
            return $mine;
        }
        return $ids;
    }

    protected function syncLembaga(User $user, array $ids): void
    {
        DB::table('user_lembaga')->where('user_id', $user->id)->delete();
        foreach ($ids as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $user->id, 'lembaga_id' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);
        $query = User::tenantScope()->with('roles');

        if ($request->filled('role')
            && ! in_array($request->input('role'), $this->assignableRolesFor(auth()->user()), true)) {
            return response()->json(['message' => 'Anda tidak berwenang memfilter role ini.'], 403);
        }
        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")
                ->orWhere('username', 'like', "%{$s}%"));
        }
        if ($request->filled('role')) {
            $query->role($request->input('role'));
        }

        $perPage = max(1, min((int) $request->input('per_page', 20), 100));

        return response()->json($query->latest('id')->paginate($perPage));
    }

    public function store(CreateUserRequest $request)
    {
        $authUser = auth()->user();
        $this->authorize('create', User::class);
        $allowedRoles = $this->assignableRolesFor($authUser);

        $disallowed = array_diff($request->input('roles', []), $allowedRoles);
        if (! empty($disallowed)) {
            return response()->json([
                'message' => 'Anda tidak berwenang memberikan role: ' . implode(', ', $disallowed),
            ], 403);
        }

        $lembagaIds = $this->resolveLembagaIds($authUser, $request->input('lembaga_ids'));

        $user = User::create([
            'name' => $request->input('name'),
            'email' => $request->input('email'),
            'phone' => $request->input('phone'),
            'username' => $request->input('username'),
            'password' => $request->input('password'),
            'email_verified_at' => now(),
        ]);
        $this->syncLembaga($user, $lembagaIds);
        $user->assignRole($request->input('roles'));

        return response()->json($user->load('roles'), 201);
    }

    public function update(Request $request, User $user)
    {
        $authUser = auth()->user();

        if (! $authUser->isSameTenant($user)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        if (! $authUser->hasRole('super_admin')) {
            $above = array_values(array_filter(array_diff(
                $user->roles->pluck('name')->all(),
                $this->assignableRolesFor($authUser),
                ['admin', 'super_admin']
            )));
            if (! empty($above)) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'unique:users,email,' . $user->id],
            'phone' => ['nullable', 'string', 'max:20', 'unique:users,phone,' . $user->id],
            'username' => ['nullable', 'string', 'max:50', 'unique:users,username,' . $user->id],
            'password' => ['nullable', 'string', 'min:8'],
            'lembaga_ids' => ['nullable', 'array'],
            'lembaga_ids.*' => ['integer', 'exists:lembaga,id'],
            'roles' => ['sometimes', 'array', 'min:1'],
            'roles.*' => ['string', 'exists:roles,name,guard_name,sanctum'],
        ]);

        if (array_key_exists('lembaga_ids', $data)) {
            $ids = $this->resolveLembagaIds($authUser, $data['lembaga_ids']);
            $this->syncLembaga($user, $ids);
            unset($data['lembaga_ids']);
        }

        if (array_key_exists('roles', $data)) {
            $disallowed = array_diff($data['roles'], $this->assignableRolesFor($authUser));
            if (! empty($disallowed)) {
                return response()->json([
                    'message' => 'Anda tidak berwenang memberikan role: ' . implode(', ', $disallowed),
                ], 403);
            }
        }

        if (empty($data['password'] ?? null)) {
            unset($data['password']);
        }

        $user->update($data);
        if (array_key_exists('roles', $data)) {
            $user->syncRoles($data['roles']);
            // 2b: peran berubah → cabut semua token target (paksa login ulang).
            $user->tokens()->delete();
        }

        return response()->json($user->load('roles'));
    }

    public function import(ImportUserRequest $request)
    {
        $authUser = auth()->user();
        $this->authorize('create', User::class);
        $allowedRoles = $this->assignableRolesFor($authUser);

        $isFull = $authUser->hasRole('super_admin') || $authUser->isAdminFull();
        $lembagaIds = $request->input('lembaga_ids');
        if (! $isFull && empty($lembagaIds)) {
            return response()->json(['message' => 'lembaga_ids wajib untuk admin non-global.'], 422);
        }
        $lembagaIds = $this->resolveLembagaIds($authUser, $lembagaIds);

        try {
            Excel::import(new UsersImport($lembagaIds, $allowedRoles), $request->file('file'));

            return response()->json(['message' => 'Data user berhasil diimport.']);
        } catch (ValidationException $e) {
            $errors = [];
            foreach ($e->failures() as $failure) {
                $errors[] = [
                    'row' => $failure->row(),
                    'attribute' => $failure->attribute(),
                    'errors' => $failure->errors(),
                ];
            }

            return response()->json(['message' => 'Gagal mengimport beberapa data.', 'errors' => $errors], 422);
        }
    }

    public function assignRole(AssignRoleRequest $request, User $user)
    {
        $authUser = auth()->user();

        if (! $authUser->isSameTenant($user)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }
        if (! in_array($request->input('role'), $this->assignableRolesFor($authUser), true)) {
            return response()->json(['message' => 'Anda tidak berwenang memberikan role ini.'], 403);
        }

        $user->assignRole($request->input('role'));
        // 2b: peran berubah → cabut semua token target (paksa login ulang).
        $user->tokens()->delete();

        return response()->json(['message' => 'Role berhasil ditambahkan.', 'user' => $user->load('roles')]);
    }

    public function removeRole(AssignRoleRequest $request, User $user)
    {
        $authUser = auth()->user();

        if ($authUser->id === $user->id) {
            return response()->json(['message' => 'Tidak boleh mencabut role diri sendiri.'], 403);
        }
        if (! $authUser->isSameTenant($user)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }
        if (! in_array($request->input('role'), $this->assignableRolesFor($authUser), true)) {
            return response()->json(['message' => 'Anda tidak berwenang mencabut role ini.'], 403);
        }

        $user->removeRole($request->input('role'));
        // 2b: peran berubah → cabut semua token target (paksa login ulang).
        $user->tokens()->delete();

        return response()->json(['message' => 'Role berhasil dihapus.', 'user' => $user->load('roles')]);
    }

    public function destroy(User $user)
    {
        $authUser = auth()->user();

        if ($authUser->id === $user->id) {
            return response()->json(['message' => 'Tidak boleh menghapus diri sendiri.'], 403);
        }
        if (! $authUser->isSameTenant($user)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }
        if (! $authUser->hasRole('super_admin')) {
            $above = array_values(array_filter(array_diff(
                $user->roles->pluck('name')->all(),
                $this->assignableRolesFor($authUser),
                ['admin', 'super_admin']
            )));
            if (! empty($above)) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
        }

        $user->tokens()->delete();
        $user->syncRoles([]);
        $user->delete();

        return response()->json(['message' => 'Pengguna dihapus permanen.']);
    }

    /** Tambah 1 lembaga ke user (multi-lembaga, vault 003 v5). */
    public function attachLembaga(Request $request, User $user)
    {
        $this->authorize('update', $user);
        $authUser = auth()->user();

        $data = $request->validate([
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
        ]);

        if (! $authUser->isSameTenant($user) && ! $authUser->hasRole('super_admin')) {
            // Target di luar tenant hanya boleh bila user baru tanpa pivot (attach pertama).
            if (! empty($user->lembagaIds())) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
        }
        if (! $authUser->canAccessLembaga((int) $data['lembaga_id'])) {
            return response()->json(['message' => 'Akses ditolak untuk lembaga ini.'], 403);
        }

        DB::table('user_lembaga')->updateOrInsert(
            ['user_id' => $user->id, 'lembaga_id' => (int) $data['lembaga_id']],
            ['created_at' => now(), 'updated_at' => now()]
        );

        return response()->json([
            'message' => 'Lembaga berhasil ditambahkan.',
            'user' => $user->load(['roles', 'lembagas']),
        ]);
    }

    /** Lepas 1 lembaga dari user (vault 003 v5). */
    public function detachLembaga(Request $request, User $user)
    {
        $this->authorize('update', $user);

        $data = $request->validate([
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
        ]);

        DB::table('user_lembaga')
            ->where('user_id', $user->id)
            ->where('lembaga_id', (int) $data['lembaga_id'])
            ->delete();

        return response()->json([
            'message' => 'Lembaga berhasil dilepas.',
            'user' => $user->load(['roles', 'lembagas']),
        ]);
    }
}
