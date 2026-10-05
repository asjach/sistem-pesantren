<?php

namespace Tests\Feature;

use App\Models\JenisTagihan;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\Pembayaran;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\TarifTagihan;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class KeuanganTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        Lembaga::create(['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2025/2026']);
    }

    protected function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    public function test_kandidat_urut_kelas_jk_lalu_nama(): void
    {
        $admin = $this->admin();
        $ia = Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1', 'nama_kelas' => 'IA']);
        $ib = Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1', 'nama_kelas' => 'IB']);

        $buat = function (string $nama, string $jk, ?int $kelasId) {
            $santri = Santri::create(['nama_lengkap' => $nama, 'jk' => $jk]);
            DB::table('riwayat_belajar')->insert([
                'santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI',
                'tingkat' => '1', 'kelas_id' => $kelasId, 'semester' => '1',
                'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
                'created_at' => now(), 'updated_at' => now(),
            ]);

            return $santri->id;
        };

        $zul = $buat('Zul', 'L', $ib->id);
        $ani = $buat('Ani', 'P', $ia->id);
        $budi = $buat('Budi', 'L', $ia->id);
        $candra = $buat('Candra', 'L', null);

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif')
            ->assertStatus(200)->json();

        $this->assertSame([$budi, $ani, $zul, $candra], array_column($res['data'], 'santri_id'));
    }

    public function test_kandidat_kelompok_santri_dan_generate_terpilih(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);

        $miSaja = Santri::create(['nama_lengkap' => 'Ahmad MI', 'jk' => 'L']);
        $mdSaja = Santri::create(['nama_lengkap' => 'Badri MD', 'jk' => 'L']);
        $miMd = Santri::create(['nama_lengkap' => 'Cahya MIMD', 'jk' => 'P']);
        $keluar = Santri::create(['nama_lengkap' => 'Dodi Keluar', 'jk' => 'L']);

        DB::table('riwayat_belajar')->insert([
            ['santri_id' => $miSaja->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '3', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
            ['santri_id' => $mdSaja->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MD', 'tingkat' => '4', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
            ['santri_id' => $miMd->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '6', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
            ['santri_id' => $miMd->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MD', 'tingkat' => '2', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
            ['santri_id' => $keluar->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '3', 'semester' => '1', 'status_akhir' => 'pindah_keluar', 'is_active_riwayat' => 'Tidak', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $ids = fn (array $json) => array_column($json['data'], 'santri_id');
        $kandidat = fn (string $kelompok) => $this->actingAs($admin)->getJson(
            "/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok={$kelompok}&per_page=50"
        )->assertStatus(200)->json();

        // Kriteria per kelompok; santri pindah_keluar selalu keluar.
        $this->assertSame([$miSaja->id], $ids($kandidat('mi_saja')));
        $this->assertSame([$mdSaja->id], $ids($kandidat('md_saja')));
        $this->assertSame([$miMd->id], $ids($kandidat('mi_md')));
        $this->assertEqualsCanonicalizing([$miSaja->id, $miMd->id], $ids($kandidat('mi')));
        $this->assertEqualsCanonicalizing([$mdSaja->id, $miMd->id], $ids($kandidat('md')));
        $this->assertEqualsCanonicalizing([$miSaja->id, $mdSaja->id, $miMd->id], $ids($kandidat('aktif')));
        $this->assertSame([$miMd->id], $ids($kandidat('kelas_akhir')));
        $this->assertEqualsCanonicalizing([$miSaja->id, $mdSaja->id], $ids($kandidat('selain_kelas_akhir')));

        // Pencarian NIS lokal + baris MI-MD menampilkan paket gabungan.
        DB::table('lembaga_santri')->insert([
            'santri_id' => $miMd->id, 'jenjang' => 'MI', 'nis_lokal' => '88001', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $cariNis = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif&q=88001')
            ->assertStatus(200)->json();
        $this->assertSame([$miMd->id], $ids($cariNis));
        $this->assertSame('MI-MD', $cariNis['data'][0]['paket']);

        // Generate hanya santri pada tabel terpilih, nominal default + override.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 75000,
            'santri' => [
                ['santri_id' => $miSaja->id],
                ['santri_id' => $miMd->id, 'nominal' => 50000],
            ],
        ])->assertStatus(200)->assertJson(['dibuat' => 2, 'dilewati' => 0]);

        $tagihanMi = Tagihan::where('santri_id', $miSaja->id)->firstOrFail();
        $this->assertSame(75000, $tagihanMi->nominal);
        $this->assertSame('MI', $tagihanMi->paket);
        $tagihanMimd = Tagihan::where('santri_id', $miMd->id)->firstOrFail();
        $this->assertSame(50000, $tagihanMimd->nominal);
        $this->assertSame('MI-MD', $tagihanMimd->paket);
        $this->assertSame('MI', $tagihanMimd->jenjang);
    }

    /**
     * Tes penjaga patokan keaktifan kandidat generate tagihan: yang diLUAR
     * hanya `pindah_keluar`. Status `lulus`/`naik`/`lanjut` (is_active_riwayat
     * = 'Tidak') tetap menjadi kandidat agar tunggakan TA sebelumnya bisa
     * ditagih. Jangan "diperbaiki" menjadi filter is_active_riwayat/pst.
     */
    public function test_kandidat_menyertakan_status_lulus_naik_lanjut(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);

        $aktif = Santri::create(['nama_lengkap' => 'Ani Aktif', 'jk' => 'P']);
        $lulus = Santri::create(['nama_lengkap' => 'Budi Lulus', 'jk' => 'L']);
        $naik = Santri::create(['nama_lengkap' => 'Citra Naik', 'jk' => 'P']);
        $lanjut = Santri::create(['nama_lengkap' => 'Dewi Lanjut', 'jk' => 'P']);
        $keluar = Santri::create(['nama_lengkap' => 'Eka Keluar', 'jk' => 'L']);

        $baris = fn ($santri, string $status, string $isAktif) => [
            'santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI',
            'tingkat' => '3', 'semester' => '1', 'status_akhir' => $status,
            'is_active_riwayat' => $isAktif, 'created_at' => now(), 'updated_at' => now(),
        ];
        DB::table('riwayat_belajar')->insert([
            $baris($aktif, 'aktif', 'Ya'),
            $baris($lulus, 'lulus', 'Tidak'),
            $baris($naik, 'naik', 'Tidak'),
            $baris($lanjut, 'lanjut', 'Tidak'),
            $baris($keluar, 'pindah_keluar', 'Tidak'),
        ]);

        $ids = fn (string $kelompok) => array_column($this->actingAs($admin)
            ->getJson("/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok={$kelompok}&per_page=50")
            ->assertStatus(200)->json('data'), 'santri_id');

        $harusMasuk = [$aktif->id, $lulus->id, $naik->id, $lanjut->id];

        // Kelompok MI: semua status selain pindah keluar tetap masuk.
        $this->assertEqualsCanonicalizing($harusMasuk, $ids('mi'));
        // Kelompok 'aktif' (semua) juga sama.
        $this->assertEqualsCanonicalizing($harusMasuk, $ids('aktif'));
        // Cuma pindah_keluar yang dibuang.
        $this->assertNotContains($keluar->id, $ids('aktif'));

        // Re-validasi POST generate memakai aturan sama → 'lulus' tidak 422.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 75000,
            'santri' => [['santri_id' => $lulus->id], ['santri_id' => $naik->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 2, 'dilewati' => 0]);

        // Santri pindah keluar tetap ditolak generate (422).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 75000, 'santri' => [['santri_id' => $keluar->id]],
        ])->assertStatus(422);
    }

    public function test_kandidat_sembunyikan_sudah_ada_dan_range_bulanan(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);

        $a = Santri::create(['nama_lengkap' => 'Ani', 'jk' => 'P']);
        $b = Santri::create(['nama_lengkap' => 'Budi', 'jk' => 'L']);
        DB::table('riwayat_belajar')->insert([
            ['santri_id' => $a->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '2', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
            ['santri_id' => $b->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '2', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // A sudah punya tagihan Juli → hilang dari kandidat periode itu.
        Tagihan::create(['santri_id' => $a->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 75000]);
        $this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif&jenis_id={$jenis->id}&periode=2025-07")
            ->assertStatus(200)->assertJsonCount(1, 'data')->assertJsonPath('data.0.santri_id', $b->id);

        // Juli–September untuk A baru 1 dari 3 → tetap muncul (belum lengkap).
        $urlRange = "/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif&jenis_id={$jenis->id}&periode=2025-07&periode_sampai=2025-09";
        $this->actingAs($admin)->getJson($urlRange)->assertStatus(200)->assertJsonCount(2, 'data');

        // Generate rentang 3 bulan untuk B → dibuat 3; diulang → dilewati 3.
        $payload = [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id,
            'periode' => '2025-07', 'periode_sampai' => '2025-09',
            'nominal' => 75000, 'santri' => [['santri_id' => $b->id]],
        ];
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 3, 'dilewati' => 0]);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 0, 'dilewati' => 3]);

        // B lengkap → kandidat rentang hanya menyisakan A yang masih bolong.
        $this->actingAs($admin)->getJson($urlRange)
            ->assertStatus(200)->assertJsonCount(1, 'data')->assertJsonPath('data.0.santri_id', $a->id);
    }

    public function test_generate_menolak_santri_tanpa_riwayat_ta(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Tanpa Riwayat', 'jk' => 'L']);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 10000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(422);
        $this->assertDatabaseCount('tagihan', 0);
    }

    public function test_generate_bulanan_validasi_dan_non_bulanan_periode_otomatis_ta(): void
    {
        $admin = $this->admin();
        $nonBulanan = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $bulanan = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Tipe', 'jk' => 'L']);
        DB::table('riwayat_belajar')->insert([
            ['santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '1', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Non-bulanan: periode otomatis kode TA (input bulan diabaikan).
        $payloadNon = [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $nonBulanan->id, 'periode' => '2025-07',
            'nominal' => 10000, 'santri' => [['santri_id' => $santri->id]],
        ];
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payloadNon)
            ->assertStatus(200)->assertJson(['dibuat' => 1, 'dilewati' => 0]);
        $this->assertSame('2025/2026', Tagihan::where('jenis_id', $nonBulanan->id)->value('periode'));

        // Generate ulang TA yang sama → dilewati (label periode sama).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payloadNon)
            ->assertStatus(200)->assertJson(['dibuat' => 0, 'dilewati' => 1]);

        // Kandidat non-bulanan menyembunyikan yang sudah punya tagihan TA itu.
        $this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif&jenis_id={$nonBulanan->id}")
            ->assertStatus(200)->assertJsonCount(0, 'data');

        // Bulanan tanpa periode → 422; sampai lebih awal dari mulai → 422.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $bulanan->id, 'nominal' => 10000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(422);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $bulanan->id,
            'periode' => '2025-09', 'periode_sampai' => '2025-07', 'nominal' => 10000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(422);

        // Bulanan valid satu bulan; Sampai kosong = satu bulan saja.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $bulanan->id,
            'periode' => '2025-08', 'nominal' => 10000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 1, 'dilewati' => 0]);
        $this->assertDatabaseHas('tagihan', ['santri_id' => $santri->id, 'jenis_id' => $bulanan->id, 'periode' => '2025-08']);
    }

    public function test_jenis_tagihan_scoping_lembaga(): void
    {
        $pusat = $this->admin();
        Lembaga::create(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true]);
        $adminMi = User::create(['name' => 'Admin MI', 'email' => 'adminmi@example.com', 'phone' => '081234567891', 'password' => 'password']);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert(['user_id' => $adminMi->id, 'jenjang' => 'MI', 'created_at' => now(), 'updated_at' => now()]);

        $global = $this->actingAs($pusat)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Infaq Bulanan', 'tipe' => 'bulanan',
        ])->assertStatus(201)->json('id');
        $this->actingAs($pusat)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Kas MI', 'tipe' => 'non_bulanan', 'jenjang' => 'MI',
        ])->assertStatus(201);

        // Filter lembaga: global selalu ikut.
        $this->actingAs($pusat)->getJson('/api/admin/keuangan/jenis?jenjang=MI')
            ->assertStatus(200)->assertJsonCount(2);
        $this->actingAs($pusat)->getJson('/api/admin/keuangan/jenis?jenjang=MTS')
            ->assertStatus(200)->assertJsonCount(1);

        // Admin lembaga: tak boleh membuat jenis global, boleh khusus lembaganya.
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Pungutan Umum', 'tipe' => 'non_bulanan',
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Pungutan Umum', 'tipe' => 'non_bulanan', 'jenjang' => 'MTS',
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Pungutan Umum', 'tipe' => 'non_bulanan', 'jenjang' => 'MI',
        ])->assertStatus(201);

        // Tanpa filter: admin hanya melihat global + miliknya.
        $this->actingAs($adminMi)->getJson('/api/admin/keuangan/jenis')
            ->assertStatus(200)->assertJsonCount(3);

        // Ubah cakupan ke global ditolak untuk admin lembaga.
        $this->actingAs($adminMi)->putJson("/api/admin/keuangan/jenis/{$global}", [
            'nama' => 'Infaq Bulanan', 'tipe' => 'bulanan',
        ])->assertStatus(403);
    }

    public function test_jenis_tagihan_act_as_tidak_bisa_ubah_global(): void
    {
        $pusat = $this->admin();
        $global = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $milikMi = JenisTagihan::create(['nama' => 'Kas MI', 'tipe' => 'non_bulanan', 'jenjang' => 'MI']);
        $hdr = ['X-Lembaga-Aktif' => 'MI'];

        // Bertindak sebagai MI: buat/ubah jenis global ditolak.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Pungutan Global', 'tipe' => 'non_bulanan',
        ])->assertStatus(403);
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->putJson("/api/admin/keuangan/jenis/{$global->id}", [
            'nama' => 'Infaq Bulanan', 'tipe' => 'bulanan', 'is_active' => false,
        ])->assertStatus(403);
        $this->assertTrue($global->fresh()->is_active);

        // Jenis milik lembaga yang diperankan tetap boleh diubah.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->putJson("/api/admin/keuangan/jenis/{$milikMi->id}", [
            'nama' => 'Kas MI', 'tipe' => 'non_bulanan', 'is_active' => false,
        ])->assertStatus(200);
        $this->assertFalse($milikMi->fresh()->is_active);

        // Kembali penuh (tanpa header): jenis global boleh diubah.
        $this->flushHeaders();
        $this->actingAs($pusat, 'sanctum')->putJson("/api/admin/keuangan/jenis/{$global->id}", [
            'nama' => 'Infaq Bulanan', 'tipe' => 'bulanan', 'is_active' => false,
        ])->assertStatus(200);
        $this->assertFalse($global->fresh()->is_active);
    }

    public function test_index_tarif_terfilter_lembaga_dan_tahun_ajaran(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        TarifTagihan::create(['jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 75000]);
        TarifTagihan::create(['jenjang' => 'MD', 'paket' => 'MD', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 60000]);
        TarifTagihan::create(['jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2024/2025', 'jenis_id' => $jenis->id, 'nominal' => 70000]);

        // Tanpa filter: semua tarif.
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tarif')
            ->assertStatus(200)->assertJsonCount(3);

        // Filter lembaga + TA (array) → hanya kombinasi yang cocok.
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tarif?jenjang[]=MI&tahun_ajaran[]=2025/2026')
            ->assertStatus(200)->assertJsonCount(1)
            ->assertJsonPath('0.jenjang', 'MI');
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tarif?jenjang[]=MI&jenjang[]=MD')
            ->assertStatus(200)->assertJsonCount(3);
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tarif?tahun_ajaran[]=2024/2025')
            ->assertStatus(200)->assertJsonCount(1);
    }

    public function test_hapus_tarif_ditolak_bila_sudah_dipakai(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $dipakai = TarifTagihan::create(['jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 75000]);
        $bebas = TarifTagihan::create(['jenjang' => 'MD', 'paket' => 'MD', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 60000]);

        $santri = Santri::create(['nama_lengkap' => 'Santri Tarif', 'jk' => 'L']);
        Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 75000]);

        // Sudah dipakai tagihan → 422, tarif tetap ada.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tarif/{$dipakai->id}")
            ->assertStatus(422);
        $this->assertDatabaseHas('tarif_tagihan', ['id' => $dipakai->id]);

        // Belum dipakai tagihan → boleh dihapus.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tarif/{$bebas->id}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('tarif_tagihan', ['id' => $bebas->id]);
    }

    public function test_index_tagihan_filter_belum_lunas_dan_cari_nis_lokal(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Kasir', 'jk' => 'L']);
        DB::table('lembaga_santri')->insert([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => '99001',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $lain = Santri::create(['nama_lengkap' => 'Santri Lain', 'jk' => 'P']);

        $belum = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 75000]);
        Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-08', 'nominal' => 75000, 'terbayar' => 75000, 'status' => 'lunas']);
        Tagihan::create(['santri_id' => $lain->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 75000]);

        // Cari NIS lokal + hanya belum lunas → hanya tagihan sasaran.
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan?belum_lunas=1&santri=99001')
            ->assertStatus(200)->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $belum->id);

        // Cari nama juga menemukan (semua status).
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan?santri=Santri Kasir')
            ->assertStatus(200)->assertJsonCount(2, 'data');

        // Filter santri_id langsung.
        $this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan?santri_id={$lain->id}&belum_lunas=1")
            ->assertStatus(200)->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.santri_id', $lain->id);
    }

    public function test_hapus_tagihan(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Hapus', 'jk' => 'L']);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 100000]);

        // Hapus tagihan tanpa pembayaran.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tagihan/{$tagihan->id}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('tagihan', ['id' => $tagihan->id]);

        // Tagihan ber-pembayaran aktif tak bisa dihapus langsung.
        $tagihan2 = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-01', 'nominal' => 100000]);
        $bayar = $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan2->id, 'jumlah' => 20000,
        ])->assertStatus(201)->json('id');
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tagihan/{$tagihan2->id}")
            ->assertStatus(422);

        // Batalkan dulu pembayarannya, baru tagihan bisa dihapus permanen.
        $this->actingAs($admin)->postJson("/api/admin/keuangan/pembayaran/{$bayar}/batal")
            ->assertStatus(200);
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tagihan/{$tagihan2->id}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('tagihan', ['id' => $tagihan2->id]);
        $this->assertDatabaseMissing('pembayaran', ['id' => $bayar]);
    }

    public function test_pembayaran_dan_sisa(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Ujian', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Ujian', 'jk' => 'L']);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 800000]);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan->id, 'jumlah' => 300000, 'metode' => 'tunai', 'kas' => 'tunai_tu',
        ])->assertStatus(201)->assertJsonStructure(['no_kwitansi']);
        $tagihan->refresh();
        $this->assertSame('sebagian', $tagihan->status);
        $this->assertSame(300000, $tagihan->terbayar);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan->id, 'jumlah' => 500000, 'metode' => 'transfer', 'kas' => 'bank_lembaga',
        ])->assertStatus(201);
        $tagihan->refresh();
        $this->assertSame('lunas', $tagihan->status);
        $this->assertSame(800000, $tagihan->terbayar);

        $p = Pembayaran::where('tagihan_id', $tagihan->id)->first();
        $this->actingAs($admin)->postJson("/api/admin/keuangan/pembayaran/{$p->id}/batal")->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(500000, $tagihan->terbayar);
        $this->assertSame('sebagian', $tagihan->status);

        $tunggakan = $this->actingAs($admin)->getJson('/api/admin/keuangan/tunggakan')->assertStatus(200)->json('per_santri');
        $this->assertNotEmpty($tunggakan);
    }

    public function test_hapus_pembayaran(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Hapus Bayar', 'jk' => 'L']);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 100000]);

        $bayar = $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan->id, 'jumlah' => 40000,
        ])->assertStatus(201)->json('id');

        $this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/{$tagihan->id}/pembayaran")
            ->assertStatus(200)->assertJsonCount(1);

        // Hapus permanen menyesuaikan total tagihan.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/pembayaran/{$bayar}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('pembayaran', ['id' => $bayar]);
        $tagihan->refresh();
        $this->assertSame(0, $tagihan->terbayar);
        $this->assertSame('belum', $tagihan->status);

        // Menghapus pembayaran yang sudah batal tidak mengubah total.
        $bayar2 = $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan->id, 'jumlah' => 30000,
        ])->assertStatus(201)->json('id');
        $this->actingAs($admin)->postJson("/api/admin/keuangan/pembayaran/{$bayar2}/batal")
            ->assertStatus(200);
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/pembayaran/{$bayar2}")
            ->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(0, $tagihan->terbayar);
    }
}
