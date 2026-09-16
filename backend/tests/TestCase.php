<?php

namespace Tests;

use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Setiap test mendapat role + izin bawaan (matriks), sehingga
     * middleware `permission:` lolos untuk super_admin/admin seperti
     * di production. Idempoten; seed eksplisit per-test tetap boleh.
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Test non-DB (tanpa RefreshDatabase) dilewati: tabel belum ada.
        if (! \Illuminate\Support\Facades\Schema::hasTable('roles')) {
            return;
        }

        $this->seed([RoleSeeder::class, PermissionSeeder::class]);
    }
}
