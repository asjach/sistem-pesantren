<?php

namespace Tests\Feature;

use App\Models\KomponenCustom;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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

    public function test_simpan_ukuran_komponen_dan_nilai_awal(): void
    {
        $user = $this->makeUser('admin');

        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'table_key' => 'santri',
            'komponen' => 'sel_status',
            'setelan' => [
                'tinggi' => 34,
                'lebar' => 320,
                'lebarLabel' => 60,
                'lebarKontrol' => 150,
                'expandLabel' => true,
                'labelTransparan' => false,
                'nilaiDefault' => 'Aktif',
                'tipeKontrol' => 'nominal',
            ],
        ])->assertStatus(200)->assertJsonPath('data.setelan.lebarLabel', 60)
            ->assertJsonPath('data.setelan.expandLabel', true)
            ->assertJsonPath('data.setelan.labelTransparan', false);

        // Simpan ulang menyalin HANYA kunci yang dikirim (server menimpa utuh).
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'table_key' => 'santri',
            'komponen' => 'sel_status',
            'setelan' => ['tinggi' => 30],
        ])->assertStatus(200);

        $setelan = KomponenCustom::where('komponen', 'sel_status')->firstOrFail()->setelan;
        $this->assertSame(['tinggi' => 30], $setelan);
    }

    public function test_simpan_setelan_per_tipe(): void
    {
        $user = $this->makeUser('admin');

        // Setelan khusus tipe aktif (mis. preset nominal cepat pada tipe
        // `nominal`) — bentuk nilainya bebas per tipe, jadi server hanya
        // membatasi bentuk & ukurannya.
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'table_key' => 'keuangan_tagihan',
            'komponen' => 'inp_bayar_jumlah',
            'setelan' => [
                'tipeKontrol' => 'nominal',
                'tipe' => ['preset' => [1000, 2500]],
            ],
        ])->assertStatus(200)
            ->assertJsonPath('data.setelan.tipe.preset.0', 1000)
            ->assertJsonPath('data.setelan.tipe.preset.1', 2500);

        // Peta, bukan daftar.
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_x', 'setelan' => ['tipe' => [1, 2]],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan.tipe');

        // Larik harus sedalam satu tingkat (skalar saja).
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_x', 'setelan' => ['tipe' => ['preset' => [['dalam']]]],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan.tipe.preset');
    }

    public function test_tolak_ukuran_di_luar_rentang(): void
    {
        $user = $this->makeUser('admin');

        // Tinggi di bawah batas bawah (20px) dan lebar total di bawah 80px.
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_a', 'setelan' => ['tinggi' => 5],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan.tinggi');

        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_a', 'setelan' => ['lebar' => 40],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan.lebar');

        // Lebar label melebihi batas atas 400px.
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_a', 'setelan' => ['lebarLabel' => 900],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan.lebarLabel');

        // Penanda harus boolean.
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_a', 'setelan' => ['expandLabel' => 1],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan.expandLabel');

        // Nilai awal kosong tidak menghasilkan setelan yang bisa disimpan.
        $this->actingAs($user, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_a', 'setelan' => ['nilaiDefault' => '   '],
        ])->assertStatus(422)->assertJsonValidationErrors('setelan');
    }

    public function test_migrasi_data_memindahkan_setelan_komponen_dari_toolbar_preset(): void
    {
        $user = $this->makeUser('admin');

        // Data lama: peta komponen (bersufiks) bercampur dengan kunci tabel.
        DB::table('toolbar_preset')->insert([
            'table_key' => 'santri',
            'visibilitas' => json_encode([]),
            'lebar' => json_encode([
                'filter.sel_a' => 300,
                'filter.sel_a.label' => 60,
                'filter.sel_a.kontrol' => 150,
                'filter.sel_a.expand' => 1,
                'filter.sel_a.labeltransparan' => 0,
                'urut' => 150,
                'kolom' => 150,
            ]),
            'tinggi' => json_encode(['filter.sel_a' => 34]),
            'nilai_default' => json_encode(['filter.sel_a' => 'Kelas']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migrasi = require database_path('migrations/2026_10_12_100000_pindahkan_setelan_komponen_dari_toolbar_preset.php');
        $migrasi->up();

        // Satu baris per komponen, kunci camelCase seperti frontend.
        $baris = KomponenCustom::where('table_key', 'santri')->where('komponen', 'sel_a')->firstOrFail();
        $this->assertSame([
            'lebar' => 300,
            'lebarLabel' => 60,
            'lebarKontrol' => 150,
            'expandLabel' => true,
            'labelTransparan' => false,
            'tinggi' => 34,
            'nilaiDefault' => 'Kelas',
        ], $baris->setelan);

        // Peta lama dibersihkan dari komponen; kunci tabel tetap utuh.
        $toolbar = DB::table('toolbar_preset')->where('table_key', 'santri')->first();
        $this->assertSame(['urut' => 150, 'kolom' => 150], json_decode((string) $toolbar->lebar, true));
        $this->assertNull($toolbar->tinggi);
        $this->assertNull($toolbar->nilai_default);

        // Endpoint membaca hasil migrasi.
        $this->actingAs($user, 'sanctum')->getJson('/api/admin/komponen-custom')
            ->assertJsonPath('data.peta.santri|sel_a.lebar', 300);
    }
}
