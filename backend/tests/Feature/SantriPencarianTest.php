<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pencarian daftar santri (`GET /api/admin/santri?q=`) — termasuk jalur FULLTEXT
 * ngram yang HANYA aktif di MySQL/MariaDB (driver lain memakai LIKE substring).
 *
 * Kelas ini sengaja memakai `DatabaseMigrations`, bukan `RefreshDatabase`:
 * index FULLTEXT InnoDB baru dapat melihat baris SETELAH di-commit, sedangkan
 * `RefreshDatabase` membungkus tiap tes dalam transaksi yang belum di-commit —
 * sehingga baris milik tes itu sendiri tak terlihat oleh `MATCH ... AGAINST`.
 * Tanpa transaksi pembungkus, data tes di-commit sebagaimana di produksi
 * (setiap request adalah transaksi yang sudah commit), jadi perilaku pencarian
 * nyata ikut teruji dan CI tidak perlu mengecualikan tes ini di jalur MySQL.
 *
 * Harga yang dibayar: migrasi dijalankan ulang per tes (kelas ini sengaja
 * dipertahankan kecil agar tetap murah).
 */
class SantriPencarianTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    // ---------- helpers (mengikuti pola kelas tes lain di folder ini) ----------

    protected function baseFixture(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'jenjang' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'nsm' => '123456789012',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD', 'nsm' => '123456789013',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);

        return compact('root', 'mi', 'md');
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->userSeq,
            'email' => "santri_pencarian_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9100000000 + $this->userSeq * 97 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
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

    protected int $santriSeq = 0;

    protected function makeSantri(string $nama, array $opt = []): Santri
    {
        $this->santriSeq++;

        return Santri::create(array_merge([
            'nama_lengkap' => $nama.' '.$this->santriSeq,
            'jk' => 'L',
        ], $opt));
    }

    /** Substring tengah nama (MySQL: FULLTEXT ngram; lain: LIKE), NIK, NISN, dan tak cocok. */
    public function test_pencarian_q_substring_nama_nik_dan_nisn(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);

        $this->makeSantri('ADINDA PUTRI', ['nik' => '3201010101010001', 'nisn' => '0099009901']);
        $this->makeSantri('BUDI SANTOSO');

        // Substring di tengah nama.
        $nama = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri?q=NDA')->assertStatus(200);
        $this->assertCount(1, $nama->json('data'));
        $this->assertStringContainsString('ADINDA', $nama->json('data.0.nama_lengkap'));

        // Lewat NIK (substring).
        $nik = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri?q=320101')->assertStatus(200);
        $this->assertCount(1, $nik->json('data'));

        // Lewat NISN.
        $nisn = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri?q=0099')->assertStatus(200);
        $this->assertCount(1, $nisn->json('data'));

        // Lewat NIS lokal (keanggotaan lembaga).
        $santriNis = $this->makeSantri('CITRA DEWI');
        LembagaSantri::create([
            'santri_id' => $santriNis->id, 'jenjang' => $f['mi']->jenjang,
            'nis_lokal' => 'NIS-778899', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2025-07-01',
        ]);
        $nisLokal = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri?q=778899')->assertStatus(200);
        $this->assertCount(1, $nisLokal->json('data'));
        $this->assertStringContainsString('CITRA', $nisLokal->json('data.0.nama_lengkap'));

        // Tak cocok.
        $kosong = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri?q=ZZZZ')->assertStatus(200);
        $this->assertCount(0, $kosong->json('data'));
    }
}
