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
use Database\Seeders\TemplateDokumenSeeder;
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

    public function test_penempatan_satu_baris_tanpa_nipp(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create(['nama_lengkap' => 'Ahmad', 'jenis_kelamin' => 'L', 'nipp' => 'PST-001']);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();

        // Tempatkan lagi = aktifkan ulang, tetap 1 baris.
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();
        $this->assertSame(1, LembagaPegawai::where('pegawai_id', $guru->id)->where('jenjang', 'MI')->count());

        // NIPP kini milik Buku Induk: penempatan tak lagi menerima field nipp.
        $this->actingAs($auth, 'sanctum')->patchJson(
            '/api/admin/pegawai-lembaga/'.LembagaPegawai::untuk($guru->id, 'MI')->id,
            ['tugas_utama' => 'Guru Kelas']
        )->assertOk();
        $this->assertNull(LembagaPegawai::untuk($guru->id, 'MI')->fresh()->getAttributes()['nipp'] ?? null);
    }

    public function test_hapus_penempatan_beserta_keaktifan(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create(['nama_lengkap' => 'Hapus', 'jenis_kelamin' => 'L']);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai-keaktifan', [
            'pegawai_id' => $guru->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
        ])->assertCreated();

        $tempatId = LembagaPegawai::untuk($guru->id, 'MI')->id;
        $this->actingAs($auth, 'sanctum')->deleteJson("/api/admin/pegawai-lembaga/{$tempatId}")
            ->assertOk()->assertJsonFragment(['pesan' => 'Penempatan dihapus.']);

        $this->assertSame(0, LembagaPegawai::where('pegawai_id', $guru->id)->count());
        $this->assertSame(0, KeaktifanPegawai::where('pegawai_id', $guru->id)->count());
        $this->assertNotNull($guru->fresh());
    }

    public function test_tempatkan_menautkan_otomatis_lalu_menulis_akses(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $user = User::create(['name' => 'Calon Tertaut', 'email' => 'calon.tertaut@example.com', 'password' => 'password']);
        $guru = Pegawai::create([
            'nama_lengkap' => 'Calon Tertaut', 'jenis_kelamin' => 'L', 'email_pribadi' => 'calon.tertaut@example.com',
        ]);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();

        // Tautan tertulis + relasi lembaga ikut tertulis dalam satu aksi.
        $this->assertSame($user->id, $guru->fresh()->user_id);
        $this->assertTrue(DB::table('user_lembaga')
            ->where('user_id', $user->id)->where('jenjang', 'MI')->exists());
    }

    public function test_taut_otomatis_tolak_akun_milik_baris_lain(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $user = User::create(['name' => 'Milik Orang', 'email' => 'milik.orang@example.com', 'password' => 'password']);
        $punya = Pegawai::create([
            'nama_lengkap' => 'Pemilik Sah', 'jenis_kelamin' => 'P', 'email_pribadi' => 'milik.orang@example.com',
            'user_id' => $user->id,
        ]);
        $guru = Pegawai::create([
            'nama_lengkap' => 'Penumpang', 'jenis_kelamin' => 'L', 'email_pribadi' => 'milik.orang@example.com',
        ]);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();

        // Akun sudah dipakai baris lain → tautan + akses tidak ditulis.
        $this->assertNull($guru->fresh()->user_id);
        $this->assertSame($user->id, $punya->fresh()->user_id);
        $this->assertFalse(DB::table('user_lembaga')
            ->where('user_id', $user->id)->where('jenjang', 'MI')->exists());
    }

    public function test_tempatkan_menautkan_akses_lembaga_akun(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create([
            'nama_lengkap' => 'Akses', 'jenis_kelamin' => 'L', 'email_pribadi' => 'akses@example.com',
        ]);
        $user = User::create(['name' => 'Akses', 'email' => 'akses@example.com', 'password' => 'password']);
        $user->assignRole('guru');
        $guru->update(['user_id' => $user->id]);
        $pivot = fn () => DB::table('user_lembaga')->where('user_id', $user->id)->where('jenjang', 'MI')->count();

        // Tempatkan → pivot terbuat; tempatkan ulang tetap 1 baris.
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();
        $this->assertSame(1, $pivot());

        // Nonaktifkan → pivot dicabut; aktifkan → pivot kembali.
        $tempatId = LembagaPegawai::untuk($guru->id, 'MI')->id;
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai-lembaga/{$tempatId}/nonaktifkan")->assertOk();
        $this->assertSame(0, $pivot());
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai-lembaga/{$tempatId}/aktifkan")->assertOk();
        $this->assertSame(1, $pivot());

        // Hapus permanen → pivot dicabut.
        $this->actingAs($auth, 'sanctum')->deleteJson("/api/admin/pegawai-lembaga/{$tempatId}")->assertOk();
        $this->assertSame(0, $pivot());
    }

    public function test_tempatkan_tanpa_akun_tak_menyentuh_pivot(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create(['nama_lengkap' => 'Tanpa Akun', 'jenis_kelamin' => 'P']);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();

        $this->assertSame(1, LembagaPegawai::where('pegawai_id', $guru->id)->count());
        $this->assertSame(0, DB::table('user_lembaga')->count());
    }

    public function test_nipp_unik_global_di_buku_induk(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai', [
            'nama_lengkap' => 'Satu', 'jenis_kelamin' => 'L', 'nipp' => 'PST-001',
        ])->assertCreated();

        // NIPP sama di pegawai lain (beda/tanpa lembaga) ditolak.
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai', [
            'nama_lengkap' => 'Dua', 'jenis_kelamin' => 'P', 'nipp' => 'PST-001',
        ])->assertStatus(422);
    }

    public function test_import_cocok_via_nipp_bukan_nip(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        Pegawai::create([
            'nama_lengkap' => 'Lama', 'jenis_kelamin' => 'L', 'nip' => 'NIP-LAMA', 'nipp' => 'PST-100',
        ]);

        // nipp cocok → update baris lama (nip ikut diperbarui).
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/import-potong', [
            'mode' => 'eksekusi', 'total' => 1,
            'baris' => [['nama_lengkap' => 'Lama Baru', 'jenis_kelamin' => 'L', 'nip' => 'NIP-BARU', 'nipp' => 'PST-100']],
            'terakhir' => true,
        ])->assertOk()->assertJsonPath('ringkasan.diperbarui', 1);
        $this->assertSame(1, Pegawai::count());
        $this->assertSame('NIP-BARU', Pegawai::where('nipp', 'PST-100')->first()->nip);

        // nip saja tanpa nipp/pegawai_id TIDAK mencocokkan → jatuh ke buat baru → galat NIP ganda.
        $galat = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/import-potong', [
            'mode' => 'eksekusi', 'total' => 1,
            'baris' => [['nama_lengkap' => 'Orang Lain', 'jenis_kelamin' => 'P', 'nip' => 'NIP-BARU']],
            'terakhir' => true,
        ])->assertOk();
        $this->assertSame(1, $galat->json('ringkasan.baris_gagal'));
        $this->assertSame(1, Pegawai::count());
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

    public function test_parse_urut_dukung_sufiks_arah_per_token(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create(['nama_lengkap' => 'Urut Arah', 'jenis_kelamin' => 'L', 'nipp' => 'UR-1']);
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();

        // Token `aktif:turun` menimpa arah global `naik`; token polos ikut global.
        $this->actingAs($auth, 'sanctum')
            ->getJson('/api/admin/pegawai-lembaga?sort=aktif:turun,nama&arah=naik')
            ->assertOk();

        // Sufiks DESC (alias) juga dikenali.
        $this->actingAs($auth, 'sanctum')
            ->getJson('/api/admin/pegawai-lembaga?sort=aktif:DESC')
            ->assertOk();

        // Token tak dikenal tetap ditolak.
        $this->actingAs($auth, 'sanctum')
            ->getJson('/api/admin/pegawai-lembaga?sort=kolom_hantu:turun')
            ->assertStatus(422);
    }

    public function test_hapus_keaktifan_permen_dan_butuh_izin(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create(['nama_lengkap' => 'Hapus Riwayat', 'jenis_kelamin' => 'L']);
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai-keaktifan', [
            'pegawai_id' => $guru->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
        ])->assertCreated();
        $id = KeaktifanPegawai::first()->id;

        // Hapus permanen: baris riwayat hilang, penempatan tetap ada.
        $this->actingAs($auth, 'sanctum')->deleteJson("/api/admin/pegawai-keaktifan/{$id}")
            ->assertOk()->assertJsonFragment(['pesan' => 'Keaktifan dihapus.']);
        $this->assertSame(0, KeaktifanPegawai::count());
        $this->assertSame(1, LembagaPegawai::where('pegawai_id', $guru->id)->count());

        // ID yang sudah hilang → 404.
        $this->actingAs($auth, 'sanctum')->deleteJson("/api/admin/pegawai-keaktifan/{$id}")
            ->assertNotFound();
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

        // Kunci baris data-existing sama persis dengan kolom template DAN
        // posisional (list sejajar kolom) karena perakit Excel browser
        // membaca per indeks.
        $res = $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai/data-existing')->assertOk();
        $this->assertSame($kolom, $res->json('kolom'));
        $baris = $res->json('baris.0');
        $this->assertTrue(array_is_list($baris));
        $this->assertCount(count($kolom), $baris);
        $this->assertSame('NPWP-1', $baris[array_search('npwp', $kolom, true)]);
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
        $this->assertSame('6281234567890', $user->phone);
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

    public function test_buatkan_akun_tolak_tanpa_kontak_dan_email_bentrok(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $tanpaKontak = Pegawai::create(['nama_lengkap' => 'Tanpa Kontak', 'jenis_kelamin' => 'P']);
        $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$tanpaKontak->id}/buatkan-akun")
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Tidak ada email/no. HP yang dapat dipakai untuk akun.']);

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

    public function test_buatkan_akun_tanpa_email_tapi_ada_hp(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $pegawai = Pegawai::create([
            'nama_lengkap' => 'Guru HP', 'jenis_kelamin' => 'P', 'no_hp' => '083311111111',
        ]);
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$pegawai->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();

        $res = $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$pegawai->id}/buatkan-akun")
            ->assertCreated()
            ->assertJsonPath('data.email', null)
            ->assertJsonPath('data.telepon', '6283311111111');

        $user = User::where('phone', '6283311111111')->firstOrFail();
        $this->assertNull($user->email);
        $this->assertTrue($user->hasRole('guru'));
        $this->assertSame($user->id, $pegawai->fresh()->user_id);
        $this->assertTrue(
            DB::table('user_lembaga')->where('user_id', $user->id)->where('jenjang', 'MI')->exists()
        );
        $this->assertContains('Akun dibuat tanpa email; login memakai no. HP.', $res->json('data.catatan'));
    }

    public function test_buatkan_akun_tolak_hp_bentrok_tanpa_email(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        User::create([
            'name' => 'Pemakai HP', 'email' => 'pemakai.hp@example.com', 'phone' => '083322222222', 'password' => 'password',
        ]);
        $pegawai = Pegawai::create([
            'nama_lengkap' => 'HP Bentrok', 'jenis_kelamin' => 'L', 'no_hp' => '083322222222',
        ]);

        $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$pegawai->id}/buatkan-akun")
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'No. HP sudah dipakai akun lain; tautkan manual lewat dialog akun.']);
        $this->assertNull($pegawai->fresh()->user_id);
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

    public function test_import_otomatis_buatkan_akun(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/import-potong', [
            'mode' => 'eksekusi', 'total' => 3,
            'baris' => [
                ['nama_lengkap' => 'Guru Mail', 'jenis_kelamin' => 'L', 'nipp' => 'AK-1', 'email_pribadi' => 'guru.mail@example.com', 'no_hp' => '082200000001'],
                ['nama_lengkap' => 'Guru Mail Dua', 'jenis_kelamin' => 'P', 'nipp' => 'AK-2', 'email_pribadi' => 'guru.mail.dua@example.com'],
                ['nama_lengkap' => 'Tanpa Mail', 'jenis_kelamin' => 'L', 'nipp' => 'AK-3'],
            ],
            'terakhir' => true,
        ])->assertOk();

        $this->assertSame(2, $res->json('ringkasan.akun_dibuat'));
        $this->assertSame(1, $res->json('ringkasan.akun_dilewati'));

        $satu = User::where('email', 'guru.mail@example.com')->firstOrFail();
        $this->assertTrue($satu->hasRole('guru'));
        $this->assertSame('6282200000001', $satu->phone);
        $this->assertSame($satu->id, Pegawai::where('nipp', 'AK-1')->first()->user_id);
        $this->assertNull(Pegawai::where('nipp', 'AK-3')->first()->user_id);
    }

    public function test_import_tautkan_akun_pegawai_lama_dan_sinkron_tertatau(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $lama = Pegawai::create([
            'nama_lengkap' => 'Lama', 'jenis_kelamin' => 'L', 'nipp' => 'AK-10',
            'email_pribadi' => 'lama@example.com',
        ]);
        $tertAut = Pegawai::create([
            'nama_lengkap' => 'Lama Nama', 'jenis_kelamin' => 'P', 'nipp' => 'AK-11',
            'email_pribadi' => 'tertatau@example.com',
        ]);
        $userLama = User::create([
            'name' => 'Akun Lama', 'email' => 'tertatau@example.com', 'password' => 'password',
        ]);
        $tertAut->update(['user_id' => $userLama->id]);

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/import-potong', [
            'mode' => 'eksekusi', 'total' => 2,
            'baris' => [
                ['pegawai_id' => $lama->id, 'nama_lengkap' => 'Lama', 'jenis_kelamin' => 'L', 'email_pribadi' => 'lama@example.com'],
                ['pegawai_id' => $tertAut->id, 'nama_lengkap' => 'Nama Baru', 'jenis_kelamin' => 'P', 'email_pribadi' => 'tertatau@example.com'],
            ],
            'terakhir' => true,
        ])->assertOk();

        // Baris update menautkan akun + baris tertaut disinkron namanya.
        $this->assertSame(2, $res->json('ringkasan.akun_dibuat'));
        $this->assertSame(0, $res->json('ringkasan.akun_dilewati'));
        $this->assertNotNull($lama->fresh()->user_id);
        $this->assertTrue(User::find($lama->fresh()->user_id)->hasRole('guru'));
        $this->assertSame('Nama Baru', $userLama->fresh()->name);
    }

    public function test_import_email_bentrok_pegawai_tersimpan_akun_dilewati(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        User::create(['name' => 'Pemilik', 'email' => 'milik@example.com', 'password' => 'password']);

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/import-potong', [
            'mode' => 'eksekusi', 'total' => 1,
            'baris' => [['nama_lengkap' => 'Bentrok', 'jenis_kelamin' => 'L', 'nipp' => 'AK-20', 'email_pribadi' => 'milik@example.com']],
            'terakhir' => true,
        ])->assertOk();

        $this->assertSame(0, $res->json('ringkasan.akun_dibuat'));
        $this->assertSame(1, $res->json('ringkasan.akun_dilewati'));
        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertNull(Pegawai::where('nipp', 'AK-20')->first()->user_id);
    }

    public function test_import_periksa_tak_menulis_akun(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/import-potong', [
            'mode' => 'periksa', 'total' => 1,
            'baris' => [['nama_lengkap' => 'Calon', 'jenis_kelamin' => 'L', 'nipp' => 'AK-30', 'email_pribadi' => 'calon@example.com']],
            'terakhir' => true,
        ])->assertOk();

        $this->assertSame(0, Pegawai::count());
        $this->assertSame(0, User::where('email', 'calon@example.com')->count());
        $this->assertSame(1, $res->json('ringkasan.akun_dibuat'));
    }

    public function test_generate_akun_bulk_buat_selaras_lewati(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        // Layak dibuat.
        $baru = Pegawai::create([
            'nama_lengkap' => 'Gen Baru', 'jenis_kelamin' => 'L', 'email_pribadi' => 'gen.baru@example.com', 'no_hp' => '083300000001',
        ]);
        // Tertaut: email + nama berubah → diselaraskan.
        $taut = Pegawai::create([
            'nama_lengkap' => 'Nama Lama', 'jenis_kelamin' => 'P', 'email_pribadi' => 'gen.lama@example.com',
        ]);
        $userTaut = User::create(['name' => 'Nama Lama', 'email' => 'lama.login@example.com', 'password' => 'password']);
        $taut->update(['user_id' => $userTaut->id]);
        // Email bentrok → ditautkan otomatis + peran guru ditambahkan ke akun pemakai.
        $pemilik = User::create(['name' => 'Pemilik', 'email' => 'milik.gen@example.com', 'password' => 'password']);
        $bentrok = Pegawai::create([
            'nama_lengkap' => 'Bentrok', 'jenis_kelamin' => 'L', 'email_pribadi' => 'milik.gen@example.com',
        ]);
        // Tanpa email → dilewati.
        Pegawai::create(['nama_lengkap' => 'Bisukan', 'jenis_kelamin' => 'L']);

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/generate-akun')
            ->assertOk();

        $this->assertSame(1, $res->json('data.dibuat'));
        $this->assertSame(2, $res->json('data.diperbarui'));
        $this->assertSame(1, $res->json('data.dilewati'));

        $this->assertSame($baru->fresh()->user_id, User::where('email', 'gen.baru@example.com')->first()->id);
        $this->assertSame('gen.lama@example.com', $userTaut->fresh()->email);
        $this->assertTrue($pemilik->fresh()->hasRole('guru'));
        $this->assertSame($pemilik->id, $bentrok->fresh()->user_id);
        $alasan = collect($res->json('data.gagal'))->pluck('alasan')->all();
        $this->assertContains('tanpa email/no. HP layak', $alasan);
    }

    public function test_generate_akun_bentrok_yang_sudah_berperan_tetap_ditautkan(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $pemilik = User::create(['name' => 'Guru Lama', 'email' => 'guru.lama@example.com', 'password' => 'password']);
        $pemilik->assignRole('guru');
        $guru = Pegawai::create([
            'nama_lengkap' => 'Bentrok Lagi', 'jenis_kelamin' => 'P', 'email_pribadi' => 'guru.lama@example.com',
        ]);

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/generate-akun')
            ->assertOk();

        // Peran sudah ada (tak ditambah ulang) tapi tautan + sinkron nama tetap jalan.
        $this->assertSame(0, $res->json('data.dibuat'));
        $this->assertSame(1, $res->json('data.diperbarui'));
        $this->assertSame(0, $res->json('data.dilewati'));
        $this->assertSame([], $res->json('data.gagal'));
        $this->assertSame($pemilik->id, $guru->fresh()->user_id);
        $this->assertSame('Bentrok Lagi', $pemilik->fresh()->name);
        $this->assertTrue($pemilik->fresh()->hasRole('guru'));
    }

    public function test_generate_akun_bentrok_akun_sendiri_ditambah_peran(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $tokenId = $auth->createToken('uji')->accessToken->id;
        Pegawai::create([
            'nama_lengkap' => 'Diri Sendiri', 'jenis_kelamin' => 'L', 'email_pribadi' => $auth->email,
        ]);

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/generate-akun')
            ->assertOk();

        // Pengecualian aditif: peran guru menempel ke akun sendiri + token tetap hidup.
        $this->assertSame(1, $res->json('data.diperbarui'));
        $this->assertSame(0, $res->json('data.dilewati'));
        $this->assertTrue($auth->fresh()->hasRole('guru'));
        $this->assertTrue($auth->fresh()->hasRole('super_admin'));
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $tokenId]);
    }

    public function test_generate_akun_menghormati_filter(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        Pegawai::create([
            'nama_lengkap' => 'Saring Aku', 'jenis_kelamin' => 'L', 'email_pribadi' => 'saring@example.com',
        ]);
        Pegawai::create([
            'nama_lengkap' => 'Jangan Aku', 'jenis_kelamin' => 'P', 'email_pribadi' => 'jangan@example.com',
        ]);

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/generate-akun?q=Saring')
            ->assertOk()->assertJsonPath('data.dibuat', 1);

        $this->assertSame(1, User::where('email', 'saring@example.com')->count());
        $this->assertSame(0, User::where('email', 'jangan@example.com')->count());
    }

    public function test_generate_akun_buat_dari_no_hp_tanpa_email(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create([
            'nama_lengkap' => 'Siswa HP', 'jenis_kelamin' => 'L', 'no_hp' => '083344444444',
        ]);
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/generate-akun')
            ->assertOk();

        $this->assertSame(1, $res->json('data.dibuat'));
        $user = User::where('phone', '6283344444444')->firstOrFail();
        $this->assertNull($user->email);
        $this->assertSame($user->id, $guru->fresh()->user_id);
        $this->assertTrue(DB::table('user_lembaga')
            ->where('user_id', $user->id)->where('jenjang', 'MI')->exists());
    }

    public function test_generate_akun_menambah_akses_lembaga_yang_kurang(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $guru = Pegawai::create([
            'nama_lengkap' => 'Pulih', 'jenis_kelamin' => 'L', 'email_pribadi' => 'pulih@example.com',
        ]);
        $user = User::create(['name' => 'Pulih', 'email' => 'pulih@example.com', 'password' => 'password']);
        $user->assignRole('guru');
        $guru->update(['user_id' => $user->id]);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();
        // Simulasi data lama: penempatan ada tapi pivot akses hilang.
        DB::table('user_lembaga')->where('user_id', $user->id)->delete();

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai/generate-akun')
            ->assertOk();

        $this->assertSame(1, $res->json('data.diperbarui'));
        $this->assertTrue(DB::table('user_lembaga')
            ->where('user_id', $user->id)->where('jenjang', 'MI')->exists());
    }

    public function test_no_hp_varian_format_dianggap_sama(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        // Format +62 ber-spasi/strip → tersimpan kanonik.
        $satu = Pegawai::create([
            'nama_lengkap' => 'Varian Satu', 'jenis_kelamin' => 'L', 'no_hp' => '+62 812-3456-7890',
        ]);
        $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$satu->id}/buatkan-akun")
            ->assertCreated();
        $this->assertSame('6281234567890', User::find($satu->fresh()->user_id)->phone);

        // Penulisan 08... atas nomor sama → bentrok (tanpa email).
        $dua = Pegawai::create([
            'nama_lengkap' => 'Varian Dua', 'jenis_kelamin' => 'P', 'no_hp' => '0812 3456 7890',
        ]);
        $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$dua->id}/buatkan-akun")
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'No. HP sudah dipakai akun lain; tautkan manual lewat dialog akun.']);
        $this->assertNull($dua->fresh()->user_id);

        // Login bisa memakai format 08... walau tersimpan kanonik.
        $this->postJson('/api/auth/login', [
            'identifier' => '0812-3456-7890',
            'password' => 'rahayu45',
        ])->assertOk()->assertJsonPath('user.id', $satu->fresh()->user_id);
    }

    public function test_no_hp_tak_wajar_dianggap_kosong(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $pegawai = Pegawai::create([
            'nama_lengkap' => 'Sampah', 'jenis_kelamin' => 'L', 'no_hp' => 'hubungi saya',
        ]);
        $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$pegawai->id}/buatkan-akun")
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Tidak ada email/no. HP yang dapat dipakai untuk akun.']);
    }

    public function test_akun_index_hanya_guru_berakun_dengan_info_akun(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        Pegawai::create(['nama_lengkap' => 'Tanpa Akun', 'jenis_kelamin' => 'L']);
        $user = User::create([
            'name' => 'Berakun', 'email' => 'berakun@example.com', 'phone' => '628990000001', 'password' => 'password',
        ]);
        $user->assignRole('guru');
        DB::table('user_lembaga')->insert([
            'user_id' => $user->id, 'jenjang' => 'MI', 'role' => 'guru',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $guru = Pegawai::create([
            'nama_lengkap' => 'Berakun', 'jenis_kelamin' => 'P', 'email_pribadi' => 'berakun@example.com',
            'user_id' => $user->id,
        ]);

        $res = $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai-akun')->assertOk();
        $this->assertSame(1, $res->json('total'));

        $baris = $res->json('data.0');
        $this->assertSame($guru->id, $baris['id']);
        $this->assertSame('berakun@example.com', $baris['akun']['email']);
        $this->assertSame('628990000001', $baris['akun']['phone']);
        $this->assertSame(['guru'], collect($baris['akun']['roles'])->pluck('name')->all());
        $this->assertSame('MI', $baris['akun']['lembagas'][0]['jenjang']);
        $this->assertSame('guru', $baris['akun']['lembagas'][0]['pivot']['role']);

        // Cari via login akun + hanya yang berakun yang cocok.
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai-akun?q=berakun@example.com')
            ->assertOk()->assertJsonPath('total', 1);
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai-akun?q=Tanpa')
            ->assertOk()->assertJsonPath('total', 0);

        // Filter lembaga = cakupan akses akun.
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai-akun?jenjang=MI')
            ->assertOk()->assertJsonPath('total', 1);
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai-akun?jenjang=MLN')
            ->assertOk()->assertJsonPath('total', 0);
    }

    public function test_profil_pegawai_lengkap_dan_butuh_izin(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $user = User::create([
            'name' => 'Profil Akun', 'email' => 'profil.akun@example.com', 'password' => 'password',
        ]);
        $user->assignRole('guru');
        DB::table('user_lembaga')->insert([
            'user_id' => $user->id, 'jenjang' => 'MI', 'role' => 'guru',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $guru = Pegawai::create([
            'nama_lengkap' => 'Profil Guru', 'jenis_kelamin' => 'L',
            'tempat_lahir' => 'Jombang', 'user_id' => $user->id,
        ]);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI', 'tugas_utama' => 'Guru Kelas',
        ])->assertCreated();
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai-keaktifan', [
            'pegawai_id' => $guru->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
            'no_sk' => 'SK/77/2026',
        ])->assertCreated();

        $res = $this->actingAs($auth, 'sanctum')->getJson("/api/admin/pegawai/{$guru->id}/profil")->assertOk();

        // Identitas Buku Induk apa adanya.
        $this->assertSame('Profil Guru', $res->json('pegawai.nama_lengkap'));
        $this->assertSame('Jombang', $res->json('pegawai.tempat_lahir'));

        // Penempatan + keaktifan per TA, keduanya berlabel lembaga.
        $this->assertSame('MI', $res->json('penempatan.0.jenjang'));
        $this->assertSame('Guru Kelas', $res->json('penempatan.0.tugas_utama'));
        $this->assertSame(LembagaPegawai::YA, $res->json('penempatan.0.is_active_lembaga'));
        $this->assertSame('MI', $res->json('keaktifan.0.lembaga.nama'));
        $this->assertSame('2026/2027', $res->json('keaktifan.0.tahun_ajaran'));
        $this->assertSame(KeaktifanPegawai::AKTIF, $res->json('keaktifan.0.status_keaktifan'));
        $this->assertSame('SK/77/2026', $res->json('keaktifan.0.no_sk'));

        // Akun tertaut + peran & akses lembaganya.
        $this->assertSame('profil.akun@example.com', $res->json('akun.email'));
        $this->assertSame(['guru'], collect($res->json('akun.roles'))->pluck('name')->all());
        $this->assertSame('guru', $res->json('akun.lembagas.0.pivot.role'));

        // Pegawai tanpa penempatan/akun tetap 200 dengan seksi kosong.
        $polos = Pegawai::create(['nama_lengkap' => 'Tanpa Jejak', 'jenis_kelamin' => 'P']);
        $this->actingAs($auth, 'sanctum')->getJson("/api/admin/pegawai/{$polos->id}/profil")
            ->assertOk()
            ->assertJsonPath('penempatan', [])
            ->assertJsonPath('keaktifan', [])
            ->assertJsonPath('akun', null);

        // Tanpa izin pegawai.lihat → 403; id tak ada → 404.
        $tanpaIzin = User::create([
            'name' => 'Tanpa Izin', 'email' => 'tanpa-izin-'.uniqid().'@example.com', 'password' => 'password',
        ]);
        $this->actingAs($tanpaIzin, 'sanctum')->getJson("/api/admin/pegawai/{$guru->id}/profil")
            ->assertForbidden();
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai/999999/profil')->assertNotFound();
    }

    public function test_profil_pdf_tercetak_dengan_kop_dan_butuh_izin(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        Lembaga::where('jenjang', 'MI')->update([
            'nama' => 'Madrasah Ibtidaiyah', 'alamat' => 'Jl. Pesantren 1',
            'telepon' => '0321-123456', 'nsm' => '111234567890',
        ]);
        $scoped = User::create([
            'name' => 'Scoped PDF', 'email' => 'scoped-pdf-'.uniqid().'@example.com', 'password' => 'password',
        ]);
        $scoped->givePermissionTo('pegawai.lihat');
        DB::table('user_lembaga')->insert([
            'user_id' => $scoped->id, 'jenjang' => 'MI',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $guru = Pegawai::create([
            'nama_lengkap' => 'Ahmad Fauzi', 'jenis_kelamin' => 'L',
            'tempat_lahir' => 'Jombang', 'gelar_belakang' => 'S.Pd.',
            'status_aktif' => Pegawai::AKTIF, 'user_id' => $scoped->id,
        ]);
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI', 'tugas_utama' => 'Guru Kelas',
        ])->assertCreated();
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai-keaktifan', [
            'pegawai_id' => $guru->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
        ])->assertCreated();

        // Template profilAbsent dulu, supaya endpoint menjawab dengan pesan jelas
        // alih-alih mengunduh PDF kosong.
        $belum = $this->actingAs($auth, 'sanctum')->get("/api/admin/pegawai/{$guru->id}/profil-pdf");
        $belum->assertStatus(422);
        $this->assertStringContainsString('TemplateDokumenSeeder', (string) $belum->json('pesan'));

        $this->seed(TemplateDokumenSeeder::class);

        // Kop otomatis dari penempatan aktif; berkas benar-benar berisi byte PDF.
        $res = $this->actingAs($auth, 'sanctum')->get("/api/admin/pegawai/{$guru->id}/profil-pdf");
        $res->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $res->headers->get('content-type'));
        $this->assertStringContainsString('profil-pegawai-ahmad-fauzi.pdf', (string) $res->headers->get('content-disposition'));

        $isi = $res->getContent();
        $this->assertStringStartsWith('%PDF-', $isi);
        $this->assertGreaterThan(2000, strlen($isi));

        // Renderer html me-embed font ter-subset, jadi isi PDF tidak bisa
        // dicari sebagai ASCII mentah; yang diuji di sini bentuk berkasnya.
        // Isi datanya dijamin tes DefinisiProfilPegawaiTest & PengisiNilaiTest.
        $this->assertSame(2, substr_count($isi, '/Type /Page') - substr_count($isi, '/Type /Pages'), 'harus dua halaman');

        // Param jenjang: boleh untuk lembaga sendiri, 403 di luar kewenangan.
        $this->actingAs($scoped, 'sanctum')->get("/api/admin/pegawai/{$guru->id}/profil-pdf?jenjang=MI")
            ->assertOk();
        $this->actingAs($scoped, 'sanctum')->get("/api/admin/pegawai/{$guru->id}/profil-pdf?jenjang=MD")
            ->assertForbidden();

        // Tanpa izin pegawai.lihat → 403.
        $tanpaIzin = User::create([
            'name' => 'Tanpa Izin PDF', 'email' => 'tanpa-izin-pdf-'.uniqid().'@example.com', 'password' => 'password',
        ]);
        $this->actingAs($tanpaIzin, 'sanctum')->get("/api/admin/pegawai/{$guru->id}/profil-pdf")
            ->assertForbidden();
    }
}
