<?php

use App\Services\SinkronIzin;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const IZIN = ['papan.lihat', 'papan.ubah'];

    public function up(): void
    {
        $admin = Role::where('name', 'admin')
            ->where('guard_name', SinkronIzin::GUARD)
            ->first();

        $admin?->revokePermissionTo(self::IZIN);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $admin = Role::where('name', 'admin')
            ->where('guard_name', SinkronIzin::GUARD)
            ->first();

        $admin?->givePermissionTo(self::IZIN);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
