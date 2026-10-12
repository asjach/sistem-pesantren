<?php

namespace Tests\Feature;

use App\Models\KomponenCustom;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Setelan komponen custom: satu baris per komponen, kunci `table_key` +
 * `komponen` (htmlFor). Baca & tulis terbuka untuk semua pengguna
 * terautentikasi; kunci setelan & nilai tak dikenal ditolak.
 */
class KomponenCustomTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    protected function makeUser(string $role): User
    {
        $this->seq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->seq,
            'email' => "komponen_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0815'.str_pad((string) (40000000 + $this->seq), 8, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);

        return $u;
    }

    public function test_tolak_tanpa_auth(): void
    {
        $this->getJson('/api/admin/komponen-custom')->assertStatus(401);
        $this->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_nominal', 'setelan' => ['tipeKontrol' => 'nominal'],
        ])->assertStatus(401);
    }

    public function test_simpan_dan_baca_setelan_tipe_input(): void
    {
        $user = $this->makeUser('admin');

        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'table_key' => 'keuangan_tagihan',
            'komponen' => 'sel_status',
            'setelan' => ['tipeKontrol' => 'nominal'],
        ])->assertStatus(200)->assertJsonPath('data.setelan.tipeKontrol', 'nominal');

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/komponen-custom')
            ->assertStatus(200)
            ->assertJsonPath('data.peta.keuangan_tagihan|sel_status.tipeKontrol', 'nominal');
    }

    public function test_komponen_di_luar_tabel_pakai_table_key_kosong(): void
    {
        $user = $this->makeUser('admin');

        // Tanpa `table_key` → komponen global (dialog/form).
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_gen_nominal',
            'setelan' => ['tipeKontrol' => 'nominal'],
        ])->assertStatus(200);

        $this->assertDatabaseHas('komponen_custom', [
            'table_key' => '', 'komponen' => 'inp_gen_nominal',
        ]);

        // Komponen yang sama di dalam tabel = baris terpisah.
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'table_key' => 'keuangan_tagihan',
            'komponen' => 'inp_gen_nominal',
            'setelan' => ['tipeKontrol' => 'tanggal'],
        ])->assertStatus(200);

        $this->actingAs($user, 'sanctum')->getJson('/api/admin/komponen-custom')
            ->assertStatus(200)
            ->assertJsonPath('data.peta.|inp_gen_nominal.tipeKontrol', 'nominal')
            ->assertJsonPath('data.peta.keuangan_tagihan|inp_gen_nominal.tipeKontrol', 'tanggal');
    }

    public function test_simpan_ulang_menimpa_tanpa_menambah_baris(): void
    {
        $user = $this->makeUser('admin');
        $body = ['table_key' => 'santri', 'komponen' => 'sel_kelas', 'setelan' => ['tipeKontrol' => 'teks']];

        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', $body)->assertStatus(200);
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            ...$body, 'setelan' => ['tipeKontrol' => 'angka'],
        ])->assertStatus(200);

        $this->assertSame(1, KomponenCustom::where('komponen', 'sel_kelas')->count());
        $this->actingAs($user, 'sanctum')->getJson('/api/admin/komponen-custom')
            ->assertJsonPath('data.peta.santri|sel_kelas.tipeKontrol', 'angka');
    }

    public function test_tolak_kunci_setelan_dan_tipe_tak_dikenal(): void
    {
        $user = $this->makeUser('admin');

        // Kunci setelan tak dikenal.
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_x', 'setelan' => ['warna' => 'merah'],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan');

        // Nilai tipe di luar registry tipe input.
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_x', 'setelan' => ['tipeKontrol' => 'kredit'],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan.tipeKontrol');

        // Setelan kosong tak diterima (hapus baris lewat DELETE).
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_x', 'setelan' => [],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan');
    }

    public function test_tolak_komponen_bukan_snake_case(): void
    {
        $user = $this->makeUser('admin');
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'Inp-Nominal', 'setelan' => ['tipeKontrol' => 'nominal'],
        ])->assertStatus(422)->assertJsonValidationErrors('komponen');
    }

    public function test_index_bisa_dibatasi_satu_tabel(): void
    {
        $user = $this->makeUser('admin');
        foreach ([['santri', 'sel_a'], ['psb', 'sel_b']] as [$tk, $k]) {
            $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
                'table_key' => $tk, 'komponen' => $k, 'setelan' => ['tipeKontrol' => 'teks'],
            ])->assertStatus(200);
        }

        $this->actingAs($user, 'sanctum')->getJson('/api/admin/komponen-custom?table_key=santri')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.peta')
            ->assertJsonPath('data.peta.santri|sel_a.tipeKontrol', 'teks');
    }

    public function test_hapus_mengembalikan_ke_bawaan(): void
    {
        $user = $this->makeUser('admin');
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'table_key' => 'santri', 'komponen' => 'sel_a', 'setelan' => ['tipeKontrol' => 'nominal'],
        ])->assertStatus(200);

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/admin/komponen-custom?table_key=santri&komponen=sel_a')
            ->assertStatus(200);

        $this->assertDatabaseMissing('komponen_custom', ['komponen' => 'sel_a']);
    }
}