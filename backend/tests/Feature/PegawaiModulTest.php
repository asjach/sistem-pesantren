<?php

namespace Tests\Feature;

use App\Exports\PegawaiTemplateExport;
use App\Models\KeaktifanPegawai;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Services\PegawaiImporService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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

    public function test_template_kolom_selaras_import_dan_data_existing(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $kolom = PegawaiTemplateExport::kolom();
        $aturan = PegawaiImporService::rules();

        // Tiap kolom template (kecuali kunci import) punya aturan validasi import.
        foreach ($kolom as $nama) {
            if ($nama === 'pegawai_id') {
                continue;
            }
            $this->assertArrayHasKey($nama, $aturan, "Kolom template {$nama} tanpa aturan import.");
        }

        Pegawai::create([
            'nama_lengkap' => 'Lengkap', 'jenis_kelamin' => 'P', 'nip' => 'NIP-L',
            'npwp' => 'NPWP-1', 'no_kk' => 'KK-1', 'no_bpjs' => 'BPJS-1',
            'provinsi' => 'Jawa Timur', 'rt' => '001', 'alamat' => 'Jl. Raya No. 1',
            'sertifikasi' => 'belum',
        ]);

        // Kunci baris data-existing sama persis dengan kolom template.
        $res = $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai/data-existing')->assertOk();
        $this->assertSame($kolom, $res->json('kolom'));
        $this->assertSame($kolom, array_keys($res->json('baris.0')));
        $this->assertSame('NPWP-1', $res->json('baris.0.npwp'));
    }

    public function test_upload_foto_pegawai(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        Storage::fake('local');

        $pegawai = Pegawai::create(['nama_lengkap' => 'Berfoto', 'jenis_kelamin' => 'L']);

        $this->actingAs($auth, 'sanctum')->post('/api/admin/pegawai/'.$pegawai->id.'/foto', [
            'foto' => UploadedFile::fake()->image('wajah.jpg', 100, 100),
        ])->assertCreated()->assertJsonFragment(['pesan' => 'Foto pegawai diupload.']);

        $segar = $pegawai->fresh();
        $this->assertNotNull($segar->foto_url);
        Storage::disk('local')->assertExists($segar->foto_url);

        // Upload kedua mengganti file lama (tak menumpuk).
        $lama = $segar->foto_url;
        $this->actingAs($auth, 'sanctum')->post('/api/admin/pegawai/'.$pegawai->id.'/foto', [
            'foto' => UploadedFile::fake()->image('baru.png', 100, 100),
        ])->assertCreated();
        Storage::disk('local')->assertMissing($lama);
        Storage::disk('local')->assertExists($pegawai->fresh()->foto_url);
    }

    public function test_buatkan_akun_guru_dari_email_pribadi(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $pegawai = Pegawai::create([
            'nama_lengkap' => 'Guru Baru', 'jenis_kelamin' => 'L',
            'email_pribadi' => 'guru.baru@example.com', 'no_hp' => '081234567890',
        ]);
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$pegawai->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();

        $res = $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$pegawai->id}/buatkan-akun")
            ->assertCreated()
            ->assertJsonFragment(['email' => 'guru.baru@example.com']);

        $user = User::where('email', 'guru.baru@example.com')->firstOrFail();
        $this->assertTrue($user->hasRole('guru'));
        $this->assertSame('081234567890', $user->phone);
        $this->assertSame($user->id, $pegawai->fresh()->user_id);
        $this->assertTrue(
            DB::table('user_lembaga')->where('user_id', $user->id)->where('jenjang', 'MI')->exists()
        );
        $this->assertSame([], $res->json('data.catatan'));

        // Kedua kali ditolak (sudah tertaut).
        $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$pegawai->id}/buatkan-akun")
            ->assertStatus(422);
    }

    public function test_buatkan_akun_tolak_tanpa_email_dan_email_bentrok(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $tanpaEmail = Pegawai::create(['nama_lengkap' => 'Tanpa Email', 'jenis_kelamin' => 'P']);
        $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$tanpaEmail->id}/buatkan-akun")
            ->assertStatus(422);

        User::create([
            'name' => 'Pemakai Email', 'email' => 'dipakai@example.com', 'password' => 'password',
        ]);
        $bentrok = Pegawai::create([
            'nama_lengkap' => 'Bentrok', 'jenis_kelamin' => 'L', 'email_pribadi' => 'dipakai@example.com',
        ]);
        $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$bentrok->id}/buatkan-akun")
            ->assertStatus(422);
        $this->assertNull($bentrok->fresh()->user_id);
    }

    public function test_buatkan_akun_hp_bentrok_dikosongkan_dengan_catatan(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        User::create([
            'name' => 'Pemakai HP', 'email' => 'hp@example.com', 'phone' => '081111111111', 'password' => 'password',
        ]);
        $pegawai = Pegawai::create([
            'nama_lengkap' => 'HP Bentrok', 'jenis_kelamin' => 'L',
            'email_pribadi' => 'hp.bentrok@example.com', 'no_hp' => '081111111111',
        ]);

        $res = $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$pegawai->id}/buatkan-akun")
            ->assertCreated();

        $user = User::where('email', 'hp.bentrok@example.com')->firstOrFail();
        $this->assertNull($user->phone);
        $this->assertNotEmpty($res->json('data.catatan'));
    }
}
