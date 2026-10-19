<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\LoginAudit;
use App\Models\User;
use App\Support\Telepon;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(LoginRequest $request)
    {
        $identifier = trim($request->input('identifier'));

        $telepon = Telepon::normalisasi($identifier);

        $user = User::where('email', $identifier)
            ->orWhere('phone', $identifier)
            ->when($telepon !== null && $telepon !== $identifier, fn ($q) => $q->orWhere('phone', $telepon))
            ->orWhere('username', $identifier)
            ->first();

        $valid = $user && $user->password && Hash::check($request->input('password'), $user->password);

        LoginAudit::create([
            'user_id' => $user?->id,
            'identifier' => $identifier,
            'sukses' => (bool) $valid,
            'ip' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1024),
        ]);

        if (! $valid) {
            return response()->json(['message' => 'Kredensial tidak valid.'], 401);
        }

        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        $device = substr(trim((string) $request->input('device', 'api-token')), 0, 100) ?: 'api-token';

        if (str_starts_with($device, 'admin-desktop-tauri') && ! $user->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json([
                'message' => 'Aplikasi desktop hanya untuk peran super_admin/admin.',
            ], 403);
        }

        $staff = $user->hasAnyRole(['super_admin', 'admin', 'guru']);
        $token = $user->createToken($device, ['*'], now()->addDays($staff ? 30 : 365))->plainTextToken;

        return response()->json([
            'user' => $user->load(['roles', 'pegawai:id,user_id,nama_lengkap']),
            'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
            'token' => $token,
        ]);
    }

    public function logout()
    {
        request()->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Berhasil logout.']);
    }

    /** 2c: cabut SEMUA token milik sendiri (mis. HP hilang). */
    public function logoutAll()
    {
        request()->user()->tokens()->delete();

        return response()->json(['message' => 'Semua sesi perangkat telah diakhiri.']);
    }

    public function me()
    {
        $user = request()->user();
        $jenjang = request()->input('jenjang');

        return response()->json(array_merge(
            $user->load(['roles', 'lembagas:jenjang,nama', 'pegawai:id,user_id,nama_lengkap'])->toArray(),

            ['permissions' => $user->izinEfektif(is_string($jenjang) && $jenjang !== '' ? $jenjang : null)],
        ));
    }
}
