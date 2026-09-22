<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\LoginAudit;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(LoginRequest $request)
    {
        $identifier = trim($request->input('identifier'));

        $user = User::where('email', $identifier)
            ->orWhere('phone', $identifier)
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

        // 2a: nama token per perangkat (cabut-per-device). 2d: expiry per peran —
        // staf 30 hari, murni orang_tua/santri 365 hari (root PRD OFF-06/v1.8).
        $device = substr(trim((string) $request->input('device', 'api-token')), 0, 100) ?: 'api-token';

        // Aplikasi desktop admin hanya untuk super_admin/admin; peran portal
        // (orang_tua/santri dsb.) ditolak agar tidak mendapat token desktop.
        if (str_starts_with($device, 'admin-desktop-tauri') && ! $user->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json([
                'message' => 'Aplikasi desktop hanya untuk peran super_admin/admin.',
            ], 403);
        }

        $staff = $user->hasAnyRole(['super_admin', 'admin', 'guru']);
        $token = $user->createToken($device, ['*'], now()->addDays($staff ? 30 : 365))->plainTextToken;

        return response()->json([
            'user' => $user->load('roles'),
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

        return response()->json(array_merge(
            $user->load(['roles', 'lembagas:jenjang,nama'])->toArray(),
            // Saat bertindak sebagai lembaga: izin efektif setara admin.
            ['permissions' => $user->izinEfektif()],
        ));
    }
}
