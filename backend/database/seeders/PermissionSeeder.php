<?php

namespace Database\Seeders;

use App\Services\IzinKatalog;
use App\Services\SinkronIzin;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {

        SinkronIzin::buatIzinHilang();

        foreach (Role::where('guard_name', SinkronIzin::GUARD)->get() as $role) {
            $role->syncPermissions(IzinKatalog::untukRole($role->name));
        }
    }
}
