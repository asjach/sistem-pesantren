<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\PerPageLimit;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AssignRoleRequest;
use App\Http\Requests\Admin\AttachLembagaRequest;
use App\Http\Requests\Admin\CreateUserRequest;
use App\Http\Requests\Admin\DetachLembagaRequest;
use App\Http\Requests\Admin\ImportUserRequest;
use App\Http\Requests\Admin\PenggunaPotongRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Imports\UsersImport;
use App\Models\ImportSesi;
use App\Models\Lembaga;
use App\Models\User;
use App\Services\PenggunaImporService;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\ValidationException;

class UserManagementController extends Controller
{
    use ImporBertahap;
    use PerPageLimit;
    use UrutDaftar;

    private const SORT_NULLABLE = ['users.phone', 'users.username'];

    protected function assignableRolesFor(User $authUser): array
    {
        return $authUser->assignableRoles();
    }

    /** Role yang boleh diberikan saat MEMBUAT user (khusus create). */
    protected function creatableRolesFor(User $authUser): array
    {
        return $authUser->creatableRoles();
    }

    /**
     * Target privileged = pemegang role admin/super_admin. Hanya super_admin
     * yang boleh memutasinya; admin lain ditolak meski setenant.
     * Akun sendiri dikecualikan (diatur aturan kunci-diri masing-masing aksi).
     */
    protected function blocksPrivilegedTarget(User $authUser, User $target): bool
    {
        return ! $target->bolehDimutasiOleh($authUser);
    }

    /**
     * Validasi jenjangs[]: tiap id wajib exists + boleh diakses actor.
     * Admin non-full tanpa jenjangs = fallback seluruh pivot sendiri (vault 003).
     */
    protected function resolveLembagaIds(User $authUser, ?array $inputIds): array
    {
        $ids = array_values(array_unique(array_map('strval', $inputIds ?? [])));
        foreach ($ids as $lid) {
            if (! Lembaga::whereKey($lid)->exists()) {
                abort(422, "Lembaga $lid tidak ditemukan.");
            }
            if (! $authUser->canAccessLembaga($lid)) {
                abort(403, 'Lembaga di luar kewenangan Anda.');
            }
        }
        if (empty($ids) && ! $authUser->bolehPesantren()) {
            $mine = $authUser->lembagaIds();
            if (empty($mine)) {
                abort(422, 'jenjangs wajib untuk admin non-global.');
            }

            return $mine;
        }

        return $ids;
    }

    protected function syncLembaga(User $user, array $ids): void
    {
        // Ganti hanya baris cakupan warisan (role null); baris berperang
        // (mis. guru otomatis, admin per lembaga) dipertahankan.
        DB::table('user_lembaga')->where('user_id', $user->id)->whereNull('role')->delete();
        foreach ($ids as $lid) {
            DB::table('user_lembaga')->updateOrInsert(
                ['user_id' => $user->id, 'jenjang' => $lid, 'role' => null],
                ['created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);
        $urut = $this->parseUrut($request, UrutKatalog::peta('users'));
        $query = User::tenantScope()->with(['roles', 'lembagas:jenjang,nama']);

        if ($request->filled('role')
            && ! in_array($request->input('role'), $this->assignableRolesFor(auth()->user()), true)) {
            return response()->json(['message' => 'Anda tidak berwenang memfilter role ini.'], 403);
        }
        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")
                ->orWhere('username', 'like', "%{$s}%")
                ->orWhereHas('roles', fn ($r) => $r->where('name', 'like', "%{$s}%")));
        }
        if ($request->filled('role')) {
            $query->role($request->input('role'));
        }

        $this->terapkanUrut($query, $urut, [['users.id', 'turun']], self::SORT_NULLABLE);

        return response()->json($query->paginate($this->perPage($request)));
    }

    public function store(CreateUserRequest $request)
    {
        $authUser = auth()->user();
        $this->authorize('create', User::class);
        $allowedRoles = $this->creatableRolesFor($authUser);

        $disallowed = array_diff($request->input('roles', []), $allowedRoles);
        if (! empty($disallowed)) {
            return response()->json([
                'message' => 'Anda tidak berwenang memberikan role: '.implode(', ', $disallowed),
            ], 403);
        }

        $lembagaIds = $this->resolveLembagaIds($authUser, $request->input('jenjangs'));

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

    public function update(UpdateUserRequest $request, User $user)
    {
        $authUser = auth()->user();

        $data = $request->validated();

        if (array_key_exists('jenjangs', $data)) {
            $ids = $this->resolveLembagaIds($authUser, $data['jenjangs']);
            $this->syncLembaga($user, $ids);
            unset($data['jenjangs']);
        }

        if (array_key_exists('roles', $data)) {
            $disallowed = array_diff($data['roles'], $this->assignableRolesFor($authUser));
            if (! empty($disallowed)) {
                return response()->json([
                    'message' => 'Anda tidak berwenang memberikan role: '.implode(', ', $disallowed),
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

        $lembagaIds = $this->lembagaIdsUntukImpor($authUser, $request->input('jenjangs'));
        if ($lembagaIds === null) {
            return response()->json(['message' => 'jenjangs wajib untuk admin non-global.'], 422);
        }

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

    /**
     * POST /api/admin/pengguna/import-potong — import bertahap (potongan JSON
     *  1000 baris/panggilan). Tenant (`jenjangs`) dan peran yang boleh
     *  ditetapkan dihitung dari akun yang menulis, bukan dari baris, jadi
     *  file tak bisa menaruh akun di luar kewenangan.
     */
    public function potongImport(PenggunaPotongRequest $request): JsonResponse
    {
        $authUser = auth()->user();
        $this->authorize('create', User::class);
        $allowedRoles = $this->assignableRolesFor($authUser);

        $lembagaIds = $this->lembagaIdsUntukImpor($authUser, $request->input('jenjangs'));
        if ($lembagaIds === null) {
            return response()->json(['message' => 'jenjangs wajib untuk admin non-global.'], 422);
        }

        return $this->jalankanImporSesi(
            $request,
            'pengguna',
            new PenggunaImporService($lembagaIds, $allowedRoles)
        );
    }

    /** POST /api/admin/pengguna/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/pengguna/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-pengguna.csv');
    }

    /**
     * Resolusi tenant import dari akun. null = admin non-global tanpa
     * `jenjangs` (pesan 422, bukan exception).
     *
     * @param  array<int, string>|null  $inputIds
     * @return array<int, string>|null
     */
    private function lembagaIdsUntukImpor(User $authUser, ?array $inputIds): ?array
    {
        if (empty($inputIds) && ! $authUser->bolehPesantren()) {
            return null;
        }

        return $this->resolveLembagaIds($authUser, $inputIds);
    }

    public function assignRole(AssignRoleRequest $request, User $user)
    {
        $authUser = auth()->user();

        // Kunci role diri: siapapun (termasuk super_admin) tidak boleh
        // menambah role ke akunnya sendiri (Lampiran E v1.9.1).
        if ($authUser->id === $user->id) {
            return response()->json(['message' => 'Tidak boleh mengubah role diri sendiri.'], 403);
        }
        // Target privileged (admin/super_admin) hanya boleh dimutasi super_admin.
        if ($this->blocksPrivilegedTarget($authUser, $user)) {
            return response()->json(['message' => 'Hanya super_admin yang dapat mengelola admin.'], 403);
        }
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
        // Target privileged (admin/super_admin) hanya boleh dimutasi super_admin.
        if ($this->blocksPrivilegedTarget($authUser, $user)) {
            return response()->json(['message' => 'Hanya super_admin yang dapat mengelola admin.'], 403);
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
        // Target privileged (admin/super_admin) hanya boleh dihapus super_admin.
        if ($this->blocksPrivilegedTarget($authUser, $user)) {
            return response()->json(['message' => 'Hanya super_admin yang dapat menghapus admin.'], 403);
        }
        if (! $authUser->isSameTenant($user)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }
        if (! $authUser->bolehSuperAdmin()) {
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

    /** Tambah 1 lembaga ke user, opsional dengan peran tercatat (vault 003 v5). */
    public function attachLembaga(AttachLembagaRequest $request, User $user)
    {
        $authUser = auth()->user();

        $data = $request->validated();

        if (! $authUser->isSameTenant($user) && ! $authUser->bolehPesantren()) {
            // Target di luar tenant hanya boleh bila user baru tanpa pivot (attach pertama).
            if (! empty($user->lembagaIds())) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
        }
        if (! $authUser->canAccessLembaga($data['jenjang'])) {
            return response()->json(['message' => 'Akses ditolak untuk lembaga ini.'], 403);
        }
        $role = $data['role'] ?? null;
        if ($role !== null && ! in_array($role, $this->assignableRolesFor($authUser), true)) {
            return response()->json(['message' => 'Anda tidak berwenang memberikan peran ini.'], 403);
        }

        DB::table('user_lembaga')->updateOrInsert(
            ['user_id' => $user->id, 'jenjang' => $data['jenjang'], 'role' => $role],
            ['created_at' => now(), 'updated_at' => now()]
        );

        return response()->json([
            'message' => 'Lembaga berhasil ditambahkan.',
            'user' => $user->load(['roles', 'lembagas']),
        ]);
    }

    /** Lepas 1 lembaga dari user (tanpa role = semua baris jenjang itu). */
    public function detachLembaga(DetachLembagaRequest $request, User $user)
    {
        $data = $request->validated();

        if (! auth()->user()->canAccessLembaga($data['jenjang'])) {
            return response()->json(['message' => 'Akses ditolak untuk lembaga ini.'], 403);
        }

        $query = DB::table('user_lembaga')
            ->where('user_id', $user->id)
            ->where('jenjang', $data['jenjang']);
        if (array_key_exists('role', $data)) {
            $data['role'] === null
                ? $query->whereNull('role')
                : $query->where('role', $data['role']);
        }
        $query->delete();

        return response()->json([
            'message' => 'Lembaga berhasil dilepas.',
            'user' => $user->load(['roles', 'lembagas']),
        ]);
    }
}
