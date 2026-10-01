<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
