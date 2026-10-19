<?php

namespace Tests;

use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;

abstract class TestCase extends BaseTestCase
{
    /** Matikan seed izin bawaan. Dipakai tes yang justru memeriksa hasil
     *  MIGRASI saja (mis. `IzinKatalogTest`) — kalau seeder ikut jalan, izin
     *  selalu lengkap dan penyimpangan di jalur migrasi tak akan terlihat. */
    protected bool $seedIzinBawaan = true;

    /**
     * Setiap test mendapat role + izin bawaan (matriks), sehingga
     * middleware `permission:` lolos untuk super_admin/admin seperti
     * di production. Idempoten; seed eksplisit per-test tetap boleh.
     */
    protected function setUp(): void
    {
        parent::setUp();

        if (! $this->seedIzinBawaan) {
            return;
        }

        if (! Schema::hasTable('roles')) {
            return;
        }

        $this->seed([RoleSeeder::class, PermissionSeeder::class]);
    }
}
