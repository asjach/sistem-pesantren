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
        /* Pembuatan izin memakai jalur bersama dengan migrasi penyelaras
           (`SinkronIzin`) supaya keduanya tak bisa berbeda daftar. */
        SinkronIzin::buatIzinHilang();

        /* Seeder MENYETEL ULANG peran ke bawaan katalog (beda dari migrasi yang
           aditif): dipakai saat menyiapkan DB dari nol. */
        foreach (Role::where('guard_name', SinkronIzin::GUARD)->get() as $role) {
            $role->syncPermissions(IzinKatalog::untukRole($role->name));
        }
    }
}
