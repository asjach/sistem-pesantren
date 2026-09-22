<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Aturan TA global (kunci `nama`): berlaku semua lembaga, dikelola super_admin;
// admin lembaga hanya menyembunyikan/menampilkan via pivot `lembaga_tahun_ajaran`.
// TA aktif satu (global) dan tidak bisa disembunyikan/dihapus. Kegiatan PSB
// menaut TA eksplisit.
class TahunAjaranGuardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function baseFixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $super = User::create([
            'name' => 'Super', 'email' => 'super-ta@example.com',
            'phone' => '081000000002', 'password' => 'password',
        ]);
        $super->assignRole('super_admin');

        return compact('mi', 'ta', 'super');
    }

    /** Admin lembaga MI (pivot user_lembaga). */
    protected function adminMi(Lembaga $mi): User
    {
        $admin = User::create([
            'name' => 'Admin MI', 'email' => 'admin-mi-ta@example.com',
            'phone' => '081000000003', 'password' => 'password',
        ]);
        $admin->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $admin->id, 'jenjang' => $mi->jenjang,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $admin;
    }

    public function test_01_super_admin_membuat_ta_global_dan_nama_unik(): void
    {
        $f = $this->baseFixture();

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/tahun-ajaran', [
            'nama' => '2027/2028', 'tanggal_mulai' => '2027-07-01', 'tanggal_selesai' => '2028-06-30',
        ])->assertStatus(201);
        $this->assertDatabaseHas('tahun_ajaran', ['nama' => '2027/2028']);

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/tahun-ajaran', [
            'nama' => '2026/2027',
        ])->assertStatus(422)->assertJsonValidationErrors(['nama']);

        // Pola nama wajib YYYY/YYYY.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/tahun-ajaran', [
            'nama' => '2028-2029',
        ])->assertStatus(422)->assertJsonValidationErrors(['nama']);

        $admin = $this->adminMi($f['mi']);
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/tahun-ajaran', [
            'nama' => '2028/2029',
        ])->assertStatus(403);
        $this->assertSame(0, TahunAjaran::where('nama', '2028/2029')->count());
    }

    public function test_02_kegiatan_se_pesantren_unik_per_ta_dan_terlihat_admin_lembaga(): void
    {
        $f = $this->baseFixture();
        $admin = $this->adminMi($f['mi']);

        // Hanya admin pesantren yang boleh mengelola kegiatan PSB.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/psb/kegiatan', [
            'tahun_ajaran' => $f['ta']->nama, 'nama' => 'PSB MI',
        ])->assertStatus(403);

        // Kegiatan se-pesantren: tanpa lembaga_id, TA cukup ada.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/psb/kegiatan', [
            'tahun_ajaran' => $f['ta']->nama, 'nama' => 'PSB 2026/2027', 'is_aktif' => true,
        ])->assertStatus(201);
        $this->assertDatabaseHas('psb_kegiatan', ['tahun_ajaran' => $f['ta']->nama, 'nama' => 'PSB 2026/2027']);

        // Satu kegiatan per tahun ajaran: duplikat ditolak.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/psb/kegiatan', [
            'tahun_ajaran' => $f['ta']->nama, 'nama' => 'PSB Duplikat',
        ])->assertStatus(422)->assertJsonValidationErrors(['tahun_ajaran']);

        // TA berbeda → boleh (mis. menyiapkan tahun berikutnya).
        $taBerikut = TahunAjaran::create([
            'nama' => '2027/2028',
            'tanggal_mulai' => '2027-07-01', 'tanggal_selesai' => '2028-06-30',
        ]);
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/psb/kegiatan', [
            'tahun_ajaran' => $taBerikut->nama, 'nama' => 'PSB 2027/2028',
        ])->assertStatus(201);

        // Kegiatan terlihat oleh admin lembaga (halaman Dokumen Wajib/Kegiatan PSB).
        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/psb/kegiatan')->assertStatus(200);
        $this->assertCount(2, $res->json('data'));
    }

    public function test_03_aksi_siklus_menolak_target_tak_dikenal(): void
    {
        $f = $this->baseFixture();
        $santri = Santri::create([
            'jenjang' => $f['mi']->jenjang, 'nama_lengkap' => 'Anak Root', 'jk' => 'L', 'is_active_pst' => 'Tidak',
        ]);

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/santri/'.$santri->id.'/berhenti-jenjang', [
            'jenjang' => 'ZZ',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['jenjang']);
    }

    public function test_04_ta_global_berlaku_untuk_semua_lembaga(): void
    {
        $f = $this->baseFixture();
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);

        // Daftar efektif memuat TA global untuk kedua lembaga.
        foreach ([$f['mi']->jenjang, $md->jenjang] as $lembagaId) {
            $res = $this->actingAs($f['super'], 'sanctum')
                ->getJson('/api/admin/tahun-ajaran?jenjang='.$lembagaId)
                ->assertStatus(200);
            $this->assertSame([$f['ta']->nama], array_column($res->json('data'), 'nama'));
        }

        // Kelas di lembaga mana pun boleh memakai TA global itu.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $md->jenjang, 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '1A',
        ])->assertStatus(201);
        $this->assertSame(1, Kelas::where('jenjang', $md->jenjang)->count());
    }

    public function test_05_admin_lembaga_menyembunyikan_dan_menampilkan_kembali(): void
    {
        $f = $this->baseFixture();
        $admin = $this->adminMi($f['mi']);
        $taLama = TahunAjaran::create([
            'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30',
        ]);

        // Admin lembaga tidak boleh mengubah/menghapus TA global.
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/tahun-ajaran', [
            'nama' => $taLama->nama, 'nama_baru' => '2028/2029',
        ])->assertStatus(403);
        $this->actingAs($admin, 'sanctum')->deleteJson('/api/admin/tahun-ajaran', [
            'nama' => $taLama->nama,
        ])->assertStatus(403);

        // TA aktif tidak bisa disembunyikan.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/tahun-ajaran/sembunyikan', [
            'nama' => $f['ta']->nama,
        ])->assertStatus(422);

        // Sembunyikan TA non-aktif → hilang dari daftar efektif lembaga itu.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/tahun-ajaran/sembunyikan', [
            'nama' => $taLama->nama,
        ])->assertStatus(200);
        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/tahun-ajaran?jenjang='.$f['mi']->jenjang);
        $this->assertSame([$f['ta']->nama], array_column($res->json('data'), 'nama'));

        // `termasuk_nonaktif` menampilkan TA tersembunyi (untuk tombol pulihkan).
        $res = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/tahun-ajaran?jenjang='.$f['mi']->jenjang.'&termasuk_nonaktif=1');
        $bayangan = collect($res->json('data'))->firstWhere('nama', '2025/2026');
        $this->assertNotNull($bayangan);
        $this->assertFalse((bool) $bayangan['tampil']);

        // Tampilkan kembali: hapus baris pivot → TA global berlaku lagi.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/tahun-ajaran/tampilkan', [
            'nama' => '2025/2026',
        ])->assertStatus(200);
        $this->assertDatabaseMissing('lembaga_tahun_ajaran', [
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => '2025/2026',
        ]);
        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/tahun-ajaran?jenjang='.$f['mi']->jenjang);
        $this->assertCount(2, $res->json('data'));

        // Set aktif hanya super_admin.
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/tahun-ajaran/set-aktif', ['nama' => $taLama->nama])->assertStatus(403);
        $this->actingAs($f['super'], 'sanctum')
            ->postJson('/api/admin/tahun-ajaran/set-aktif', ['nama' => $taLama->nama])->assertStatus(200);
        $this->assertTrue((bool) $taLama->fresh()->is_aktif);
        $this->assertFalse((bool) $f['ta']->fresh()->is_aktif);
    }
}
