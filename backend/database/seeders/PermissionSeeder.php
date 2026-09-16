<?php

namespace Database\Seeders;

use App\Services\IzinKatalog;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach (IzinKatalog::semua() as $nama) {
            Permission::firstOrCreate(['name' => $nama, 'guard_name' => 'sanctum']);
        }

        foreach (Role::where('guard_name', 'sanctum')->get() as $role) {
            $role->syncPermissions(IzinKatalog::untukRole($role->name));
        }
    }
}
