<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\Concerns\VerifikasiSkemaDokumen;
use Tests\TestCase;

/**
 * Penjaga drift `docs/SCHEMA.md` vs skema nyata pada driver **SQLite
 * in-memory** (setup suite default). Aturan verifikasi hidup di trait
 * `VerifikasiSkemaDokumen` agar smoke test MySQL memakai penjaga yang sama.
 */
class SchemaDocTest extends TestCase
{
    use RefreshDatabase;
    use VerifikasiSkemaDokumen;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('database.connections.papan.database', ':memory:');
        DB::purge('papan');
        $this->artisan('migrate', [
            '--path' => 'database/migrations/papan',
            '--database' => 'papan',
            '--force' => true,
        ])->run();
    }

    protected function koneksiTabel(string $tabel): ?string
    {
        return str_starts_with($tabel, 'papan_') ? 'papan' : null;
    }

    protected function tabelTambahanDiDb(): array
    {
        return collect(Schema::connection('papan')->getTables())
            ->map(fn ($t) => is_array($t) ? (string) ($t['name'] ?? '') : (string) $t)
            ->filter(fn (string $t) => str_starts_with($t, 'papan_'))
            ->values()
            ->all();
    }
}
