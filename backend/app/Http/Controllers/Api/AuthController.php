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
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'user' => $user->load('roles'),
            'token' => $token,
        ]);
    }

    public function logout()
    {
        request()->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Berhasil logout.']);
    }

    public function me()
    {
        return response()->json(request()->user()->load(['roles', 'lembagas:id,nama,kode']));
    }
}
