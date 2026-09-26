<?php

namespace Tests\Feature;

use App\Models\KeaktifanPegawai;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PegawaiModulTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    private function superAdmin(): User
    {
        $user = User::create([
            'name' => 'Super',
            'email' => 'super-'.uniqid().'@example.com',
            'password' => 'password',
        ]);
        $user->assignRole('super_admin');

        return $user;
    }

    private function fixture(): array
    {
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);

        return [];
    }

    public function test_crud_buku_induk(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai', [
            'nama_lengkap' => 'Siti Rahayu',
            'jenis_kelamin' => 'P',
            'nip' => '198501012010012001',
        ])->assertCreated();
        $id = $res->json('data.id');

        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai?q=Siti')
            ->assertOk()->assertJsonFragment(['nama_lengkap' => 'Siti Rahayu']);

        $this->actingAs($auth, 'sanctum')->patchJson("/api/admin/pegawai/{$id}", [
            'gelar_belakang' => 'S.Pd.',
        ])->assertOk()->assertJsonFragment(['gelar_belakang' => 'S.Pd.']);

        // NIP ganda ditolak 422.
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai', [
            'nama_lengkap' => 'Ganda',
            'jenis_kelamin' => 'L',
            'nip' => '198501012010012001',
        ])->assertStatus(422);
    }

    public function test_penempatan_satu_baris_dan_nipp_unik(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create(['nama_lengkap' => 'Ahmad', 'jenis_kelamin' => 'L']);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
            'nipp' => 'PST-001',
        ])->assertCreated();

        // Tempatkan lagi = aktifkan ulang, tetap 1 baris.
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
            'nipp' => 'PST-001',
        ])->assertCreated();
        $this->assertSame(1, LembagaPegawai::where('pegawai_id', $guru->id)->where('jenjang', 'MI')->count());

        $guru2 = Pegawai::create(['nama_lengkap' => 'Budi', 'jenis_kelamin' => 'L']);
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru2->id}/tempatkan", [
            'jenjang' => 'MI',
            'nipp' => 'PST-001',
        ])->assertStatus(422);
    }

    public function test_keaktifan_butuh_penempatan_dan_walas_butuh_keduanya(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create(['nama_lengkap' => 'Walas', 'jenis_kelamin' => 'P']);

        // Tanpa penempatan → 422.
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai-keaktifan', [
            'pegawai_id' => $guru->id,
            'jenjang' => 'MI',
            'tahun_ajaran' => '2026/2027',
        ])->assertStatus(422);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai-keaktifan', [
            'pegawai_id' => $guru->id,
            'jenjang' => 'MI',
            'tahun_ajaran' => '2026/2027',
        ])->assertCreated();

        // Dropdown walas kini memuat guru (butuh izin kelas.ubah — super_admin punya).
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai/aktif?jenjang=MI&tahun_ajaran=2026/2027')
            ->assertOk()->assertJsonFragment(['nama_lengkap' => 'Walas']);

        // Nonaktifkan penempatan → keaktifan berjalan ikut inaktif → hilang dari dropdown.
        $tempat = LembagaPegawai::untuk($guru->id, 'MI');
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai-lembaga/{$tempat->id}/nonaktifkan")
            ->assertOk();
        $this->assertSame('inaktif', KeaktifanPegawai::first()->status_keaktifan);
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai/aktif?jenjang=MI&tahun_ajaran=2026/2027')
            ->assertOk()->assertJsonMissing(['nama_lengkap' => 'Walas']);
    }

    public function test_import_potong_kering_dan_eksekusi(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $payload = fn (?int $sesi) => array_filter([
            'sesi_id' => $sesi,
            'mode' => 'eksekusi',
            'total' => 2,
            'baris' => [
                ['nama_lengkap' => 'Guru Satu', 'jenis_kelamin' => 'L', 'nip' => 'NIP-1'],
                ['nama_lengkap' => '', 'jenis_kelamin' => ''],
            ],
            'terakhir' => true,
        ]);

        // Mode periksa dulu (kering, tak menulis).
        $cek = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/import-potong', [
            'mode' => 'periksa', 'total' => 1,
            'baris' => [['nama_lengkap' => 'Guru Satu', 'jenis_kelamin' => 'L', 'nip' => 'NIP-1']],
            'terakhir' => true,
        ])->assertOk();
        $this->assertSame(0, Pegawai::count());

        $sesi = $cek->json('sesi_id');
        DB::table('import_sesi')->whereKey($sesi)->update(['status' => 'selesai']);

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/import-potong', $payload(null))
            ->assertOk()->assertJsonPath('ringkasan.dibuat', 1);
        $this->assertSame(1, Pegawai::count());
    }
}
