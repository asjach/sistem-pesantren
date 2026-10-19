<?php

namespace Tests\Feature;

use App\Models\Santri;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

class PsbCekNikTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    public function test_cek_nik_hanya_membalas_boolean_tanpa_data_santri(): void
    {
        Santri::create([
            'nama_lengkap' => 'Santri Aktif', 'jk' => 'L',
            'nik' => '1100000000000099', 'is_active_pst' => Santri::YA,
        ]);

        $this->postJson('/api/psb/cek-nik', ['nik' => '1100000000000099'])
            ->assertOk()
            ->assertExactJson(['terdaftar' => true]);
    }

    public function test_cek_nik_santri_nonaktif_dan_tidak_ada_bernilai_false(): void
    {
        Santri::create([
            'nama_lengkap' => 'Santri Nonaktif', 'jk' => 'P',
            'nik' => '1100000000000098', 'is_active_pst' => Santri::TIDAK,
        ]);

        $this->postJson('/api/psb/cek-nik', ['nik' => '1100000000000098'])
            ->assertOk()
            ->assertExactJson(['terdaftar' => false]);

        $this->postJson('/api/psb/cek-nik', ['nik' => '1100000000000097'])
            ->assertOk()
            ->assertExactJson(['terdaftar' => false]);
    }

    public function test_cek_nik_menolak_format_bukan_16_digit(): void
    {
        $this->postJson('/api/psb/cek-nik', ['nik' => '123'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nik']);
    }
}
