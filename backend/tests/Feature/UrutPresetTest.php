<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\UrutPreset;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Preset urut global per table_key: baca bebas, tulis admin pesantren,
 * validasi kode terhadap UrutKatalog, dan normalisasi penanda bawaan.
 */
class UrutPresetTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->seq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->seq,
            'email' => "urut_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0815'.str_pad((string) (40000000 + $this->seq), 8, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    public function test_preset_seed_dimuat_dengan_tersedia(): void
    {
        $pusat = $this->makeUser('super_admin');

        $res = $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/urut-preset?table_key=santri');
        $res->assertStatus(200);

        $opsi = $res->json('data.opsi');
        $this->assertNotEmpty($opsi);
        // Opsi bawaan hasil seed = "JK-Nama".
        $this->assertTrue($opsi[0]['bawaan']);
        $this->assertSame(['jk', 'nama'], $opsi[0]['kode']);

        $kode = array_column($res->json('data.tersedia'), 'kode');
        $this->assertContains('nama', $kode);
        $this->assertContains('jk', $kode);
    }

    public function test_simpan_preset_dan_tolak_kode_liar(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/urut-preset', [
            'table_key' => 'santri',
            'opsi' => [
                ['kode' => ['nama'], 'label' => 'Nama A-Z', 'arah' => 'naik', 'bawaan' => true],
                ['kode' => ['jk', 'nama'], 'label' => 'JK-Nama'],
            ],
        ])->assertStatus(200);

        $simpan = UrutPreset::where('table_key', 'santri')->first();
        $this->assertCount(2, $simpan->opsi);
        $this->assertTrue($simpan->opsi[0]['bawaan']);
        $this->assertSame('Nama A-Z', $simpan->opsi[0]['label']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/urut-preset', [
            'table_key' => 'santri',
            'opsi' => [['kode' => ['kolom_karangan'], 'label' => 'X']],
        ])->assertStatus(422)->assertJsonValidationErrors(['opsi']);
    }

    public function test_bawaan_dinormalisasi_maks_satu(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/urut-preset', [
            'table_key' => 'psb',
            'opsi' => [
                ['kode' => ['nama'], 'label' => 'Nama', 'bawaan' => true],
                ['kode' => ['nik'], 'label' => 'NIK', 'bawaan' => true],
            ],
        ])->assertStatus(200);

        $opsi = UrutPreset::where('table_key', 'psb')->first()->opsi;
        $this->assertTrue($opsi[0]['bawaan']);
        $this->assertFalse($opsi[1]['bawaan']);
    }

    public function test_table_key_tak_dikenal_ditolak(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/urut-preset?table_key=tidak_ada')
            ->assertStatus(422)->assertJsonValidationErrors(['table_key']);

        $this->actingAs($pusat, 'sanctum')
            ->putJson('/api/admin/urut-preset', [
                'table_key' => 'tidak_ada', 'opsi' => [['kode' => ['x'], 'label' => 'X']],
            ])
            ->assertStatus(422)->assertJsonValidationErrors(['table_key']);
    }

    public function test_hapus_preset_mengosongkan(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')
            ->deleteJson('/api/admin/urut-preset?table_key=santri')
            ->assertStatus(200);

        $this->assertSame(0, UrutPreset::where('table_key', 'santri')->count());
    }

    public function test_admin_scoped_hanya_boleh_membaca(): void
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren', 'jenjang' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $scoped = $this->makeUser('admin', [$mi->jenjang]);

        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/urut-preset?table_key=santri')
            ->assertStatus(200);

        $lama = UrutPreset::where('table_key', 'santri')->value('opsi');
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/urut-preset', [
            'table_key' => 'santri',
            'opsi' => [['kode' => ['nama'], 'label' => 'Nama']],
        ])->assertStatus(403);
        $this->assertSame($lama, UrutPreset::where('table_key', 'santri')->value('opsi'));
    }
}
