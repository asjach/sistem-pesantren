<?php

namespace Tests\Feature;

use App\Models\DokumenLembaga;
use App\Models\DokumenSantri;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\LembagaSantri;
use App\Models\Pegawai;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

// Tiga halaman dokumen (santri/guru/lembaga): daftar, simpan, unggah+unduh
// berkas, hapus, import bertahap, dan izin per modul.
class DokumenHalamanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
        Storage::fake('local');
    }

    private function superAdmin(): User
    {
        $u = User::create(['name' => 'Super', 'email' => 'super-'.uniqid().'@example.com', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    private function fixture(): array
    {
        $mi = Lembaga::create(['nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'is_active' => true]);
        Lembaga::create(['nama' => 'Tsanawiyah', 'jenjang' => 'MTS', 'is_active' => true]);
        $ta = TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);
        $santri = Santri::create(['nama_lengkap' => 'Ahmad Santri', 'jk' => 'L', 'is_active_pst' => 'Ya']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => '26001', 'is_active_lembaga' => 'Ya']);
        $guru = Pegawai::create(['nama_lengkap' => 'Ustadz Guru', 'jenis_kelamin' => 'L', 'nipp' => 'PST-001']);
        LembagaPegawai::create(['pegawai_id' => $guru->id, 'jenjang' => 'MI']);

        return compact('mi', 'ta', 'santri', 'guru');
    }

    public function test_daftar_simpan_unduh_hapus_dokumen_lembaga(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        // Simpan tanpa berkas.
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/lembaga', [
            'jenjang' => 'MI', 'jenis_dokumen' => 'Izin Operasional', 'catatan' => 'SK Kemenag',
        ])->assertStatus(201);
        $id = DokumenLembaga::first()->id;

        // Daftar tampil.
        $list = $this->actingAs($auth, 'sanctum')->getJson('/api/admin/dokumen/lembaga?jenjang[]=MI')
            ->assertOk()->json('data');
        $this->assertSame('Izin Operasional', $list[0]['jenis_dokumen']);
        $this->assertSame('Madrasah Ibtidaiyah', $list[0]['pemilik']);

        // Unggah berkas → nama_file asli + path tersimpan.
        $this->actingAs($auth, 'sanctum')->post("/api/admin/dokumen/lembaga/{$id}/unggah", [
            'file' => UploadedFile::fake()->create('izin-2026.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertOk();
        $row = DokumenLembaga::find($id);
        $this->assertMatchesRegularExpression(
            '{^madrasah_ibtidaiyah_izin_operasional_sk_kemenag_\d{8}_\d{6}\.pdf$}',
            (string) $row->nama_file,
        );
        $jalur = 'lembaga/dokumen/'.$row->nama_file;
        Storage::disk('local')->assertExists($jalur);

        // Unduh berkas: nama template sebagai nama unduhan.
        $unduh = $this->actingAs($auth, 'sanctum')->get("/api/admin/dokumen/lembaga/{$id}/unduh");
        $unduh->assertOk();
        $this->assertStringContainsString((string) $row->nama_file, (string) $unduh->headers->get('content-disposition'));

        // Ubah status.
        $this->actingAs($auth, 'sanctum')->patchJson("/api/admin/dokumen/lembaga/{$id}", [
            'status_verifikasi' => 'valid',
        ])->assertOk();
        $this->assertSame('valid', DokumenLembaga::find($id)->status_verifikasi);

        // Hapus → berkas fisik ikut hilang.
        $this->actingAs($auth, 'sanctum')->deleteJson("/api/admin/dokumen/lembaga/{$id}")->assertOk();
        $this->assertNull(DokumenLembaga::find($id));
        Storage::disk('local')->assertMissing($jalur);
    }

    public function test_dokumen_santri_dan_guru_simpan_dengan_berkas(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->post('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'file' => UploadedFile::fake()->image('kk-ahmad.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(201);
        $dok = DokumenSantri::first();
        $this->assertMatchesRegularExpression(
            '{^ahmad_santri_kartu_keluarga_\d{8}_\d{6}\.jpg$}',
            (string) $dok->nama_file,
        );
        Storage::disk('local')->assertExists('santri/dokumen/'.$dok->nama_file);

        $this->actingAs($auth, 'sanctum')->post('/api/admin/dokumen/pegawai', [
            'pegawai_id' => $f['guru']->id,
            'jenjang' => 'MI',
            'jenis_dokumen' => 'Ijazah S1',
            'file' => UploadedFile::fake()->create('ijazah.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(201);
        $namaGuru = (string) DB::table('dokumen_pegawai')->where('pegawai_id', $f['guru']->id)->value('nama_file');
        $this->assertMatchesRegularExpression(
            '{^ustadz_guru_ijazah_s1_\d{8}_\d{6}\.pdf$}',
            $namaGuru,
        );
        Storage::disk('local')->assertExists('pegawai/dokumen/'.$namaGuru);

        // Daftar kedua halaman.
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/dokumen/santri?jenjang[]=MI')
            ->assertOk()->assertJsonFragment(['pemilik' => 'Ahmad Santri']);
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/dokumen/pegawai?jenjang[]=MI')
            ->assertOk()->assertJsonFragment(['pemilik' => 'Ustadz Guru']);
    }

    public function test_nama_berkas_template_dan_unik_akhiran(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        // Unggah dua kali data sama → nama kedua berakhiran penomoran.
        for ($i = 0; $i < 2; $i++) {
            $this->actingAs($auth, 'sanctum')->post('/api/admin/dokumen/santri', [
                'santri_id' => $f['santri']->id,
                'jenis_dokumen' => 'Kartu Keluarga',
                'file' => UploadedFile::fake()->image('kk.jpg'),
            ], ['Accept' => 'application/json'])->assertStatus(201);
        }

        $namas = DokumenSantri::orderBy('id')->pluck('nama_file')->all();
        $this->assertMatchesRegularExpression(
            '{^ahmad_santri_kartu_keluarga_\d{8}_\d{6}\.jpg$}',
            $namas[0],
        );
        $this->assertNotSame($namas[0], $namas[1]);
        $this->assertMatchesRegularExpression(
            '{^ahmad_santri_kartu_keluarga_\d{8}_\d{6}(-\d+)?\.jpg$}',
            $namas[1],
        );
        Storage::disk('local')->assertExists(['santri/dokumen/'.$namas[0], 'santri/dokumen/'.$namas[1]]);
    }

    public function test_daftar_dokumen_santri_filter_santri_id(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();
        $lain = Santri::create(['nama_lengkap' => 'Santri Lain', 'jk' => 'L', 'is_active_pst' => 'Ya']);
        LembagaSantri::create(['santri_id' => $lain->id, 'jenjang' => 'MI', 'nis_lokal' => '26002', 'is_active_lembaga' => 'Ya']);

        foreach ([$f['santri']->id, $lain->id] as $sid) {
            $this->actingAs($auth, 'sanctum')->post('/api/admin/dokumen/santri', [
                'santri_id' => $sid, 'jenis_dokumen' => 'Kartu Keluarga',
            ], ['Accept' => 'application/json'])->assertStatus(201);
        }

        $data = $this->actingAs($auth, 'sanctum')
            ->getJson("/api/admin/dokumen/santri?santri_id={$f['santri']->id}")
            ->assertOk()->json('data');
        $this->assertCount(1, $data);
        $this->assertSame('Ahmad Santri', $data[0]['pemilik']);
    }

    public function test_simpan_lokal_tanpa_berkas_cadangkan_nama(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'tujuan' => 'lokal',
            'ekstensi' => 'jpg',
        ])->assertStatus(201);

        $dok = DokumenSantri::first();
        $this->assertSame('lokal', $dok->penyimpanan);
        $this->assertMatchesRegularExpression(
            '{^ahmad_santri_kartu_keluarga_\d{8}_\d{6}\.jpg$}',
            (string) $dok->nama_file,
        );
        Storage::disk('local')->assertMissing('santri/dokumen/'.$dok->nama_file);
    }

    public function test_simpan_test_mencatat_penyimpanan_test(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'tujuan' => 'test',
            'ekstensi' => 'jpg',
        ])->assertStatus(201);

        $this->assertSame('test', DokumenSantri::first()->penyimpanan);
    }

    public function test_mode_server_menolak_simpanan_test(): void
    {
        config()->set('dokumen.mode', 'server');
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'tujuan' => 'test',
            'ekstensi' => 'jpg',
        ])->assertStatus(422);
        $this->assertSame(0, DokumenSantri::count());
    }

    public function test_unggah_memindahkan_penyimpanan_ke_server(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'tujuan' => 'lokal',
            'ekstensi' => 'jpg',
        ])->assertStatus(201);
        $id = DokumenSantri::first()->id;

        $this->actingAs($auth, 'sanctum')->post("/api/admin/dokumen/santri/{$id}/unggah", [
            'file' => UploadedFile::fake()->image('kk.jpg'),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame('server', DokumenSantri::find($id)->penyimpanan);
    }

    public function test_unduh_baris_lokal_pesan_arsip_perangkat(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'tujuan' => 'lokal',
            'ekstensi' => 'jpg',
        ])->assertStatus(201);
        $id = DokumenSantri::first()->id;

        $this->actingAs($auth, 'sanctum')->getJson("/api/admin/dokumen/santri/{$id}/unduh")
            ->assertStatus(404)
            ->assertJsonPath('message', 'Berkas tersimpan di arsip perangkat, bukan di server.');
    }

    public function test_mode_server_menolak_simpanan_lokal(): void
    {
        config()->set('dokumen.mode', 'server');
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'tujuan' => 'lokal',
            'ekstensi' => 'jpg',
        ])->assertStatus(422);
        $this->assertSame(0, DokumenSantri::count());
    }

    public function test_tujuan_lokal_dengan_berkas_ditolak(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->post('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'tujuan' => 'lokal',
            'ekstensi' => 'jpg',
            'file' => UploadedFile::fake()->image('kk.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(422);
        $this->assertSame(0, DokumenSantri::count());
    }

    public function test_import_bertahap_lembaga_periksa_dan_eksekusi(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        // Template bisa diunduh per tipe.
        $this->actingAs($auth, 'sanctum')->get('/api/admin/dokumen/lembaga/import-template')->assertOk();

        // Periksa (kering) tanpa menulis.
        $periksa = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/lembaga/import-potong', [
            'mode' => 'periksa',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                ['jenjang' => 'MI', 'jenis_dokumen' => 'Akreditasi', 'status_verifikasi' => 'Valid'],
                ['jenjang' => 'ZZZ', 'jenis_dokumen' => 'Salah'],
            ],
        ])->assertOk();
        $this->assertSame(1, $periksa->json('ringkasan.dibuat'));
        $this->assertSame(1, $periksa->json('ringkasan.baris_gagal'));
        $this->assertSame(0, DokumenLembaga::count());

        // Eksekusi.
        $eksekusi = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/lembaga/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [
                ['jenjang' => 'MI', 'jenis_dokumen' => 'Akreditasi', 'status_verifikasi' => 'Valid', 'catatan' => 'A'],
            ],
        ])->assertOk();
        $this->assertSame(1, $eksekusi->json('ringkasan.dibuat'));
        $this->assertSame('valid', DokumenLembaga::first()->status_verifikasi);
    }

    public function test_import_bertahap_santri_gagal_tanpa_nis_dan_izin(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri/import-potong', [
            'mode' => 'eksekusi',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                ['nis_lokal' => '26001', 'jenjang' => 'MI', 'jenis_dokumen' => 'Akta Kelahiran'],
                ['nis_lokal' => '99999', 'jenjang' => 'MI', 'jenis_dokumen' => 'Tidak Ada'],
            ],
        ])->assertOk();
        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame(1, DokumenSantri::count());
    }

    public function test_izin_dokumen_lembaga_tidak_diakses_admin_lain(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $lain = User::create(['name' => 'Admin MTS', 'email' => 'mts-'.uniqid().'@example.com', 'password' => 'password']);
        $lain->assignRole('admin');
        DB::table('user_lembaga')->insert(['user_id' => $lain->id, 'jenjang' => 'MTS', 'created_at' => now(), 'updated_at' => now()]);

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/lembaga', [
            'jenjang' => 'MI', 'jenis_dokumen' => 'Izin',
        ])->assertStatus(201);

        // Admin MTS tidak boleh lihat dokumen lembaga MI (lingkup lembaga).
        $list = $this->actingAs($lain, 'sanctum')->getJson('/api/admin/dokumen/lembaga')->assertOk();
        $this->assertCount(0, $list->json('data'));

        // Dan tidak boleh menghapus.
        $id = DokumenLembaga::first()->id;
        $this->actingAs($lain, 'sanctum')->deleteJson("/api/admin/dokumen/lembaga/{$id}")->assertStatus(403);
    }
}
