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
        $jalur = 'dokumen/lembaga/'.$row->nama_file;
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
        Storage::disk('local')->assertExists('dokumen/santri/'.$dok->nama_file);

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
        Storage::disk('local')->assertExists('dokumen/pegawai/'.$namaGuru);

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
        Storage::disk('local')->assertExists(['dokumen/santri/'.$namas[0], 'dokumen/santri/'.$namas[1]]);
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
        Storage::disk('local')->assertMissing('dokumen/santri/'.$dok->nama_file);
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

    public function test_ubah_tanpa_selaraskan_nama_tidak_mengubah_nama_berkas(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->post('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'file' => UploadedFile::fake()->image('kk-ahmad.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(201);
        $dok = DokumenSantri::first();
        $namaAwal = (string) $dok->nama_file;

        $this->actingAs($auth, 'sanctum')->patchJson("/api/admin/dokumen/santri/{$dok->id}", [
            'jenis_dokumen' => 'Akta Kelahiran',
        ])->assertOk();

        $this->assertSame($namaAwal, DokumenSantri::find($dok->id)->nama_file);
        Storage::disk('local')->assertExists('dokumen/santri/'.$namaAwal);
    }

    public function test_ubah_selaraskan_nama_menyusun_ulang_nama_dan_memindah_fisik(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')->post('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'file' => UploadedFile::fake()->image('kk-ahmad.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(201);
        $dok = DokumenSantri::first();
        $namaAwal = (string) $dok->nama_file;

        $this->actingAs($auth, 'sanctum')->patchJson("/api/admin/dokumen/santri/{$dok->id}", [
            'jenis_dokumen' => 'Akta Kelahiran',
            'selaraskan_nama' => true,
        ])->assertOk();

        $namaBaru = (string) DokumenSantri::find($dok->id)->nama_file;
        $this->assertNotSame($namaAwal, $namaBaru);
        $this->assertMatchesRegularExpression('{^ahmad_santri_akta_kelahiran_\d{8}_\d{6}\.jpg$}', $namaBaru);
        Storage::disk('local')->assertMissing('dokumen/santri/'.$namaAwal);
        Storage::disk('local')->assertExists('dokumen/santri/'.$namaBaru);
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
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Akta Kelahiran', 'nama_file' => 'akta.jpg', 'penyimpanan' => 'Server'],
                ['nis_lokal' => '99999', 'jenis_dokumen' => 'Tidak Ada'],
            ],
        ])->assertOk();
        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame(1, DokumenSantri::count());
    }

    public function test_data_existing_dokumen_kolom_identik_template_per_tipe(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        DokumenSantri::create([
            'santri_id' => $f['santri']->id,
            'jenis_dokumen_santri' => 'Kartu Keluarga',
            'catatan' => 'Arsip',
        ]);
        DB::table('dokumen_pegawai')->insert([
            'pegawai_id' => $f['guru']->id,
            'jenis_dokumen_pegawai' => 'Ijazah S1',
            'status_verifikasi' => 'menunggu',
            'catatan' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DokumenLembaga::create([
            'jenjang' => 'MI',
            'jenis_dokumen' => 'Akreditasi',
            'status_verifikasi' => 'ditolak',
            'catatan' => 'Revisi',
        ]);

        $santri = $this->actingAs($auth, 'sanctum')->getJson('/api/admin/dokumen/santri/data-existing')->assertOk();
        $this->assertSame(['nis_lokal', 'jenis_dokumen', 'lembaga', 'nama_file', 'penyimpanan', 'catatan', 'nama_lengkap', 'is_active'], $santri->json('kolom'));
        $this->assertSame([['26001', 'Kartu Keluarga', '', '', 'server', 'Arsip', 'Ahmad Santri', 'Ya']], $santri->json('baris'));

        $guru = $this->actingAs($auth, 'sanctum')->getJson('/api/admin/dokumen/pegawai/data-existing')->assertOk();
        $this->assertSame(['pegawai_id', 'nipp', 'nama_lengkap', 'jenjang', 'jenis_dokumen', 'status_verifikasi', 'catatan'], $guru->json('kolom'));
        $barisGuru = $guru->json('baris');
        $this->assertCount(1, $barisGuru);
        $this->assertSame('PST-001', $barisGuru[0][1]);
        $this->assertSame('Ustadz Guru', $barisGuru[0][2]);
        $this->assertSame(['MI', 'Ijazah S1', 'Menunggu', ''], array_slice($barisGuru[0], 3));

        $madrasah = $this->actingAs($auth, 'sanctum')->getJson('/api/admin/dokumen/lembaga/data-existing')->assertOk();
        $this->assertSame(['jenjang', 'jenis_dokumen', 'status_verifikasi', 'catatan'], $madrasah->json('kolom'));
        $this->assertSame([['MI', 'Akreditasi', 'Ditolak', 'Revisi']], $madrasah->json('baris'));

        // Baris existing bisa diimport kembali (round-trip periksa).
        $ulang = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri/import-potong', [
            'mode' => 'periksa',
            'total' => 1,
            'terakhir' => true,
            'baris' => [
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Kartu Keluarga', 'nama_file' => 'kk.jpg', 'penyimpanan' => 'Lokal', 'catatan' => 'Arsip', 'nama_lengkap' => 'Abaikan'],
            ],
        ])->assertOk();
        $this->assertSame(0, $ulang->json('ringkasan.baris_gagal'));
    }

    public function test_dokumen_santri_menolak_status_verifikasi(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        // Kolom status sudah dicabut dari tabel santri: simpan menolaknya.
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri', [
            'santri_id' => $f['santri']->id,
            'jenis_dokumen' => 'Kartu Keluarga',
            'status_verifikasi' => 'valid',
        ])->assertStatus(422);
        $this->assertSame(0, DokumenSantri::count());

        $dok = DokumenSantri::create([
            'santri_id' => $f['santri']->id,
            'jenis_dokumen_santri' => 'Kartu Keluarga',
        ]);

        // Ubah pun menolaknya; tipe pegawai tetap boleh.
        $this->actingAs($auth, 'sanctum')->patchJson("/api/admin/dokumen/santri/{$dok->id}", [
            'status_verifikasi' => 'valid',
        ])->assertStatus(422);
    }

    public function test_import_santri_menyimpan_nama_file_dan_penyimpanan(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri/import-potong', [
            'mode' => 'eksekusi',
            'total' => 4,
            'terakhir' => true,
            'baris' => [
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Kartu Keluarga', 'nama_file' => 'kk.jpg', 'penyimpanan' => 'Lokal'],
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Akta Kelahiran', 'penyimpanan' => 'Awan'],
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Ijazah', 'penyimpanan' => 'Server'],
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Rapor', 'nama_file' => 'rapor.jpg'],
            ],
        ])->assertOk();
        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(3, $res->json('ringkasan.baris_gagal'));

        $kk = DokumenSantri::where('jenis_dokumen_santri', 'Kartu Keluarga')->firstOrFail();
        $this->assertSame('kk.jpg', $kk->nama_file);
        $this->assertSame('lokal', $kk->penyimpanan);
    }

    public function test_import_santri_membersihkan_nbsp_dari_excel(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();
        $nbsp = "\u{00a0}";

        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Kartu Keluarga', 'nama_file' => "kk{$nbsp}(1).jpg", 'penyimpanan' => 'Lokal'],
            ],
        ])->assertOk();

        // NBSP menjadi spasi biasa agar cocok dengan nama file asli di arsip.
        $this->assertSame('kk (1).jpg', DokumenSantri::firstOrFail()->nama_file);
    }

    public function test_import_santri_menolak_nis_ganda(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();
        $kembar = Santri::create(['nama_lengkap' => 'Kembar Nis', 'jk' => 'L', 'is_active_pst' => 'Ya']);
        LembagaSantri::create(['santri_id' => $kembar->id, 'jenjang' => 'MTS', 'nis_lokal' => '26001', 'is_active_lembaga' => 'Ya']);

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Kartu Keluarga', 'nama_file' => 'kk.jpg', 'penyimpanan' => 'Server'],
            ],
        ])->assertOk();
        $this->assertSame(0, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame(0, DokumenSantri::count());
    }

    public function test_import_santri_rangkap_beda_lembaga_dan_satu_aktif(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        // Duplikat warisan se-kunci: yang disentuh import jadi aktif,
        // sisanya dinonaktifkan.
        DokumenSantri::create([
            'santri_id' => $f['santri']->id, 'jenis_dokumen_santri' => 'Pas Foto', 'lembaga' => null,
            'nama_file' => 'lama.jpg', 'is_active' => true,
        ]);
        DokumenSantri::create([
            'santri_id' => $f['santri']->id, 'jenis_dokumen_santri' => 'Pas Foto', 'lembaga' => null,
            'nama_file' => 'kuno.jpg', 'is_active' => true,
        ]);

        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri/import-potong', [
            'mode' => 'eksekusi',
            'total' => 3,
            'terakhir' => true,
            'baris' => [
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Pas Foto', 'lembaga' => 'MI', 'nama_file' => 'foto-mi.jpg', 'penyimpanan' => 'Server'],
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Pas Foto', 'lembaga' => 'MTS', 'nama_file' => 'foto-mts.jpg', 'penyimpanan' => 'Server'],
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Pas Foto', 'nama_file' => 'foto-baru.jpg', 'penyimpanan' => 'Server'],
            ],
        ])->assertOk();
        $this->assertSame(3, $res->json('ringkasan.dibuat'));
        $this->assertSame(0, $res->json('ringkasan.diperbarui'));

        // Lima baris (2 warisan + 3 baru); kunci tanpa lembaga menunjuk
        // berkas terbaru yang aktif, warisannya nonaktif.
        $this->assertSame(5, DokumenSantri::where('santri_id', $f['santri']->id)->count());
        $polos = DokumenSantri::where('santri_id', $f['santri']->id)->whereNull('lembaga')->orderBy('id')->get();
        $this->assertSame('foto-baru.jpg', $polos[2]->nama_file);
        $this->assertTrue((bool) $polos[2]->is_active);
        $this->assertFalse((bool) $polos[0]->is_active);
        $this->assertFalse((bool) $polos[1]->is_active);
        $this->assertTrue((bool) DokumenSantri::where('santri_id', $f['santri']->id)->where('lembaga', 'MI')->firstOrFail()->is_active);
        $this->assertTrue((bool) DokumenSantri::where('santri_id', $f['santri']->id)->where('lembaga', 'MTS')->firstOrFail()->is_active);

        // Import ulang berkas yang sama memperbarui, bukan menambah.
        $ulang = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Pas Foto', 'lembaga' => 'MI', 'nama_file' => 'foto-mi.jpg', 'penyimpanan' => 'Server', 'catatan' => 'Baru'],
            ],
        ])->assertOk();
        $this->assertSame(0, $ulang->json('ringkasan.dibuat'));
        $this->assertSame(1, $ulang->json('ringkasan.diperbarui'));
        $this->assertSame(5, DokumenSantri::where('santri_id', $f['santri']->id)->count());
        $this->assertSame('Baru', DokumenSantri::where('santri_id', $f['santri']->id)->where('nama_file', 'foto-mi.jpg')->firstOrFail()->catatan);

        // Lembaga tak terdaftar menggagalkan baris.
        $salah = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/dokumen/santri/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [
                ['nis_lokal' => '26001', 'jenis_dokumen' => 'Pas Foto', 'lembaga' => 'ZZZ', 'nama_file' => 'x.jpg', 'penyimpanan' => 'Server'],
            ],
        ])->assertOk();
        $this->assertSame(1, $salah->json('ringkasan.baris_gagal'));
    }

    public function test_ubah_aktif_menonaktifkan_saudara_sekunci(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $lama = DokumenSantri::create([
            'santri_id' => $f['santri']->id, 'jenis_dokumen_santri' => 'Pas Foto', 'lembaga' => 'MI',
            'nama_file' => 'lama.jpg', 'is_active' => true,
        ]);
        $baru = DokumenSantri::create([
            'santri_id' => $f['santri']->id, 'jenis_dokumen_santri' => 'Pas Foto', 'lembaga' => 'MI',
            'nama_file' => 'baru.jpg', 'is_active' => false,
        ]);

        $this->actingAs($auth, 'sanctum')->patchJson("/api/admin/dokumen/santri/{$baru->id}", [
            'is_active' => true,
        ])->assertOk();

        $this->assertTrue((bool) DokumenSantri::find($baru->id)->is_active);
        $this->assertFalse((bool) DokumenSantri::find($lama->id)->is_active);
    }

    public function test_ubah_nama_file_hanya_basename_untuk_semua_tipe(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();

        $dok = DokumenSantri::create([
            'santri_id' => $f['santri']->id, 'jenis_dokumen_santri' => 'Pas Foto', 'nama_file' => 'lama.jpg',
        ]);

        $this->actingAs($auth, 'sanctum')->patchJson("/api/admin/dokumen/santri/{$dok->id}", [
            'nama_file' => '../jahat.png',
        ])->assertOk();
        $this->assertSame('jahat.png', DokumenSantri::find($dok->id)->nama_file);

        $guru = DB::table('dokumen_pegawai')->insertGetId([
            'pegawai_id' => $f['guru']->id, 'jenis_dokumen_pegawai' => 'Ijazah S1',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($auth, 'sanctum')->patchJson("/api/admin/dokumen/pegawai/{$guru}", [
            'nama_file' => 'ijazah-baru.pdf',
        ])->assertOk();
        $this->assertSame('ijazah-baru.pdf', DB::table('dokumen_pegawai')->find($guru)->nama_file);
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

    public function test_status_berkas_batch_ada_dan_hilang(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();
        Storage::disk('local')->put('dokumen/santri/ada.pdf', 'isi-ada');

        $res = $this->actingAs($auth, 'sanctum')
            ->getJson('/api/admin/dokumen/santri/status-berkas?nama[]=ada.pdf&nama[]=hilang.pdf')
            ->assertOk()->json('data');
        $this->assertTrue($res['ada.pdf']['ada']);
        $this->assertSame(7, $res['ada.pdf']['ukuran']);
        $this->assertSame(md5('isi-ada'), $res['ada.pdf']['md5']);
        $this->assertSame(hash('sha256', 'isi-ada'), $res['ada.pdf']['sha256']);
        $this->assertIsInt($res['ada.pdf']['mtime']);
        $this->assertFalse($res['hilang.pdf']['ada']);

        // Lebih dari 100 nama ditolak.
        $banyak = implode('&', array_map(fn ($i) => "nama[]=f{$i}.pdf", range(1, 101)));
        $this->actingAs($auth, 'sanctum')
            ->getJson("/api/admin/dokumen/santri/status-berkas?{$banyak}")
            ->assertStatus(422);
    }

    public function test_sinkron_unggah_tanpa_ganti_nama(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();
        $dok = DokumenSantri::create([
            'santri_id' => $f['santri']->id,
            'jenis_dokumen_santri' => 'Kartu Keluarga',
            'nama_file' => 'ahmad_kartu_keluarga.pdf',
            'penyimpanan' => 'lokal',
        ]);

        $this->actingAs($auth, 'sanctum')->post("/api/admin/dokumen/santri/{$dok->id}/sinkron-unggah", [
            'file' => UploadedFile::fake()->createWithContent('ahmad_kartu_keluarga.pdf', 'isi-lokal', 'application/pdf'),
            'hash' => md5('isi-lokal'),
            'mtime' => time(),
        ], ['Accept' => 'application/json'])->assertOk();

        $segar = $dok->fresh();
        $this->assertSame('ahmad_kartu_keluarga.pdf', $segar->nama_file);
        $this->assertSame('cermin', $segar->penyimpanan);
        $this->assertSame(hash('sha256', 'isi-lokal'), $segar->sinkron_hash);
        $this->assertNotNull($segar->tersinkron_pada);
        $this->assertSame('isi-lokal', Storage::disk('local')->get('dokumen/santri/ahmad_kartu_keluarga.pdf'));
    }

    public function test_sinkron_unggah_klaim_sha256_jalur_klien(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();
        $dok = DokumenSantri::create([
            'santri_id' => $f['santri']->id,
            'jenis_dokumen_santri' => 'Kartu Keluarga',
            'nama_file' => 'klaim-sha.pdf',
            'penyimpanan' => 'lokal',
        ]);

        // Klien Web Crypto hanya punya SHA-256 (64 hex) — verifikasi backend
        // wajib memakai algoritma yang sama (regresi: dulu md5 vs sha256).
        $this->actingAs($auth, 'sanctum')->post("/api/admin/dokumen/santri/{$dok->id}/sinkron-unggah", [
            'file' => UploadedFile::fake()->createWithContent('klaim-sha.pdf', 'isi-lokal', 'application/pdf'),
            'hash' => hash('sha256', 'isi-lokal'),
            'mtime' => time(),
        ], ['Accept' => 'application/json'])->assertOk();

        $segar = $dok->fresh();
        $this->assertSame('cermin', $segar->penyimpanan);
        $this->assertSame(hash('sha256', 'isi-lokal'), $segar->sinkron_hash);
    }

    public function test_sinkron_unggah_hash_beda_ditolak_dan_dibersihkan(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();
        $dok = DokumenSantri::create([
            'santri_id' => $f['santri']->id,
            'jenis_dokumen_santri' => 'Kartu Keluarga',
            'nama_file' => 'rusak.pdf',
            'penyimpanan' => 'lokal',
        ]);

        $this->actingAs($auth, 'sanctum')->post("/api/admin/dokumen/santri/{$dok->id}/sinkron-unggah", [
            'file' => UploadedFile::fake()->createWithContent('rusak.pdf', 'isi-asli', 'application/pdf'),
            'hash' => md5('isi-lain'),
            'mtime' => time(),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->assertFalse(Storage::disk('local')->exists('dokumen/santri/rusak.pdf'));
        $this->assertSame('lokal', $dok->fresh()->penyimpanan);
    }

    public function test_tandai_sinkron_mencatat_cermin(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();
        $dok = DokumenSantri::create([
            'santri_id' => $f['santri']->id,
            'jenis_dokumen_santri' => 'Akta Kelahiran',
            'nama_file' => 'akta.pdf',
            'penyimpanan' => 'server',
        ]);
        Storage::disk('local')->put('dokumen/santri/akta.pdf', 'isi-server');

        $this->actingAs($auth, 'sanctum')->patchJson(
            "/api/admin/dokumen/santri/{$dok->id}/tandai-sinkron",
            ['hash' => md5('isi-server')]
        )->assertOk();

        $segar = $dok->fresh();
        $this->assertSame('cermin', $segar->penyimpanan);
        $this->assertSame(md5('isi-server'), $segar->sinkron_hash);
        $this->assertNotNull($segar->tersinkron_pada);
    }

    public function test_unduh_dan_rename_baris_cermin(): void
    {
        $f = $this->fixture();
        $auth = $this->superAdmin();
        $dok = DokumenSantri::create([
            'santri_id' => $f['santri']->id,
            'jenis_dokumen_santri' => 'Kartu Keluarga',
            'nama_file' => 'lama.pdf',
            'penyimpanan' => 'cermin',
        ]);
        Storage::disk('local')->put('dokumen/santri/lama.pdf', 'isi');

        // Unduh baris cermin = berkas server.
        $this->actingAs($auth, 'sanctum')->get("/api/admin/dokumen/santri/{$dok->id}/unduh")->assertOk();

        // Rename template memindah sisi server + mengembalikan nama baru.
        $res = $this->actingAs($auth, 'sanctum')->patchJson("/api/admin/dokumen/santri/{$dok->id}", [
            'jenis_dokumen' => 'Akta Kelahiran',
            'selaraskan_nama' => true,
        ])->assertOk()->json('data');
        $this->assertStringStartsWith('ahmad_santri_akta_kelahiran_', $res['nama_file']);
        $this->assertFalse(Storage::disk('local')->exists('dokumen/santri/lama.pdf'));
        $this->assertTrue(Storage::disk('local')->exists('dokumen/santri/'.$res['nama_file']));
    }
}
