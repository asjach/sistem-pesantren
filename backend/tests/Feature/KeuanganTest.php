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
use App\Services\UrutKatalog;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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

        // Pencarian NIS lokal menemukan Santri yang punya dua riwayat (MI-MD).
        DB::table('lembaga_santri')->insert([
            'santri_id' => $miMd->id, 'jenjang' => 'MI', 'nis_lokal' => '88001', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $cariNis = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif&q=88001')
            ->assertStatus(200)->json();
        $this->assertSame([$miMd->id], $ids($cariNis));
        // Jenjang utama = MI (lembaga penagih), mengikuti jenjang pertama.
        $this->assertSame('MI', $cariNis['data'][0]['jenjang']);
        $this->assertArrayNotHasKey('paket', $cariNis['data'][0]);

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
        $this->assertSame('MI', $tagihanMi->jenjang);
        $tagihanMimd = Tagihan::where('santri_id', $miMd->id)->firstOrFail();
        $this->assertSame(50000, $tagihanMimd->nominal);
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

    public function test_kandidat_menandai_sudah_ada_dan_generate_ulang_memperbarui(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);

        $a = Santri::create(['nama_lengkap' => 'Ani', 'jk' => 'P']);
        $b = Santri::create(['nama_lengkap' => 'Budi', 'jk' => 'L']);
        DB::table('riwayat_belajar')->insert([
            ['santri_id' => $a->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '2', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
            ['santri_id' => $b->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '2', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
        ]);

        /* A sudah punya tagihan Juli → TETAP muncul sebagai kandidat (dipakai
           alur generate 2: perbarui sebagian Santri), tapi ditandai lewat
           rekap `tagihan_*`, bukan disembunyikan. */
        Tagihan::create(['santri_id' => $a->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 75000, 'terbayar' => 25000, 'status' => 'sebagian']);
        // `sort[]=nama` dipakai supaya urutan baris pasti (default-nya kelas → JK → nama).
        $periodeJuli = "/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif&jenis_id={$jenis->id}&periode=2025-07&sort[]=nama";
        $this->actingAs($admin)->getJson($periodeJuli)
            ->assertStatus(200)->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.santri_id', $a->id)
            ->assertJsonPath('data.0.tagihan_periode', 1)
            ->assertJsonPath('data.0.tagihan_nominal', 75000)
            ->assertJsonPath('data.0.tagihan_terbayar', 25000)
            ->assertJsonPath('data.1.santri_id', $b->id)
            ->assertJsonPath('data.1.tagihan_periode', 0);

        // Juli–September: A terisi 1 dari 3 bulan → rekap-nya 1.
        $urlRange = "/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif&jenis_id={$jenis->id}&periode=2025-07&periode_sampai=2025-09&sort[]=nama";
        $this->actingAs($admin)->getJson($urlRange)->assertStatus(200)->assertJsonCount(2, 'data');

        /* Generate rentang 3 bulan untuk B → dibuat 3. Diulang dengan nominal
           sama → diperbarui 3 (bukan "dilewati"), lalu nominal diubah →
           tagihannya ikut berubah. */
        $payload = [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id,
            'periode' => '2025-07', 'periode_sampai' => '2025-09',
            'nominal' => 75000, 'santri' => [['santri_id' => $b->id]],
        ];
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 3, 'diperbarui' => 0, 'dilewati' => 0]);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 0, 'diperbarui' => 3, 'dilewati' => 0]);

        $payload['nominal'] = 90000;
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 0, 'diperbarui' => 3]);
        $this->assertSame(90000, Tagihan::where('santri_id', $b->id)->where('periode', '2025-08')->firstOrFail()->nominal);

        // B sekarang lengkap 3/3 bulan → rekap ikut menyesuaikan.
        $this->actingAs($admin)->getJson($urlRange)
            ->assertStatus(200)->assertJsonCount(2, 'data')
            ->assertJsonPath('data.1.tagihan_periode', 3);
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

    public function test_generate_rollback_semua_bila_santri_kedua_gagal(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);

        $aktif = Santri::create(['nama_lengkap' => 'Aktif', 'jk' => 'L']);
        DB::table('riwayat_belajar')->insert([
            'santri_id' => $aktif->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '1',
            'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $tanpaRiwayat = Santri::create(['nama_lengkap' => 'Tanpa Riwayat', 'jk' => 'P']);

        // Santri kedua tidak punya riwayat TA → abort di tengah loop. Tanpa
        // transaksi, tagihan Santri pertama sudah terlanjur tersimpan.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 10000,
            'santri' => [
                ['santri_id' => $aktif->id],
                ['santri_id' => $tanpaRiwayat->id],
            ],
        ])->assertStatus(422);
        $this->assertDatabaseCount('tagihan', 0);
    }

    public function test_generate_ulang_tidak_merusak_pembayaran(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Sudah Bayar', 'jk' => 'L']);
        DB::table('riwayat_belajar')->insert([
            'santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '1',
            'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $generate = fn (int $nominal) => $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => $nominal, 'santri' => [['santri_id' => $santri->id]],
        ]);
        $generate(75000)->assertStatus(200)->assertJson(['dibuat' => 1]);

        $tagihan = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        $tagihan->update(['terbayar' => 30000, 'status' => 'sebagian']);

        // Nominal dinaikkan → tagihan diperbarui, pembayaran & status ikut dihitung ulang.
        $generate(100000)->assertStatus(200)->assertJson(['dibuat' => 0, 'diperbarui' => 1, 'dilewati' => 0]);
        $tagihan->refresh();
        $this->assertSame(100000, $tagihan->nominal);
        $this->assertSame(30000, $tagihan->terbayar);
        $this->assertSame('sebagian', $tagihan->status);

        // Nominal diturunkan ke Rp 20.000 (di bawah Rp 30.000 yang dibayar) → dilewati.
        $generate(20000)->assertStatus(200)
            ->assertJson(['dibuat' => 0, 'diperbarui' => 0, 'dilewati' => 1])
            ->assertJsonPath('alasan.0.terbayar', 30000)
            ->assertJsonPath('alasan.0.nominal_sekarang', 100000);
        $tagihan->refresh();
        $this->assertSame(100000, $tagihan->nominal);

        // Diturunkan tapi masih di atas pembayaran → tetap diperbarui.
        $generate(80000)->assertStatus(200)->assertJson(['diperbarui' => 1]);
        $this->assertSame(80000, $tagihan->fresh()->nominal);
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

        // Generate ulang TA yang sama → diperbarui (label periode sama), bukan dilewati.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payloadNon)
            ->assertStatus(200)->assertJson(['dibuat' => 0, 'diperbarui' => 1, 'dilewati' => 0]);

        // Kandidat non-bulanan tetap menandai yang sudah punya tagihan TA itu.
        $this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif&jenis_id={$nonBulanan->id}")
            ->assertStatus(200)->assertJsonCount(1, 'data')->assertJsonPath('data.0.tagihan_periode', 1);

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

        // Jatuh tempo bulanan = tanggal 10 BULAN BERJALAN; input manual diabaikan.
        $this->assertSame(
            '2025-08-10',
            Tagihan::where('jenis_id', $bulanan->id)->where('periode', '2025-08')->firstOrFail()->jatuh_tempo->format('Y-m-d')
        );
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $bulanan->id,
            'periode' => '2025-07', 'periode_sampai' => '2025-09', 'nominal' => 10000,
            'jatuh_tempo' => '2025-12-31',
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 2, 'diperbarui' => 1, 'dilewati' => 0]);
        // Tiap bulan dapat tanggalnya sendiri, semuanya tanggal 10 bulan itu.
        foreach (['2025-07' => '2025-07-10', '2025-08' => '2025-08-10', '2025-09' => '2025-09-10'] as $periode => $harus) {
            $this->assertSame($harus, Tagihan::where('jenis_id', $bulanan->id)->where('periode', $periode)->firstOrFail()->jatuh_tempo->format('Y-m-d'));
        }

        // Non-bulanan: jatuh tempo manual tetap dipakai.
        $nonBulanan2 = JenisTagihan::create(['nama' => 'Ujian', 'tipe' => 'non_bulanan']);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $nonBulanan2->id, 'jatuh_tempo' => '2025-08-15',
            'nominal' => 10000, 'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);
        $this->assertSame(
            '2025-08-15',
            Tagihan::where('jenis_id', $nonBulanan2->id)->where('periode', '2025/2026')->firstOrFail()->jatuh_tempo->format('Y-m-d')
        );
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
        TarifTagihan::create(['jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 75000]);
        TarifTagihan::create(['jenjang' => 'MD', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 60000]);
        TarifTagihan::create(['jenjang' => 'MI', 'tahun_ajaran' => '2024/2025', 'jenis_id' => $jenis->id, 'nominal' => 70000]);

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
        $dipakai = TarifTagihan::create(['jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 75000]);
        $bebas = TarifTagihan::create(['jenjang' => 'MD', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 60000]);

        $santri = Santri::create(['nama_lengkap' => 'Santri Tarif', 'jk' => 'L']);
        Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 75000]);

        // Sudah dipakai tagihan → 422, tarif tetap ada.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tarif/{$dipakai->id}")
            ->assertStatus(422);
        $this->assertDatabaseHas('tarif_tagihan', ['id' => $dipakai->id]);

        // Belum dipakai tagihan → boleh dihapus.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tarif/{$bebas->id}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('tarif_tagihan', ['id' => $bebas->id]);
    }

    public function test_paket_dihapus_dari_skema_tarif_dan_tagihan(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Tanpa Paket', 'jk' => 'L']);
        $tarif = TarifTagihan::create(['jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 75000]);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 50000]);

        // Kolom dihapus dari skema, bukan sekadar disembunyikan dari UI.
        $this->assertFalse(Schema::hasColumn('tarif_tagihan', 'paket'));
        $this->assertFalse(Schema::hasColumn('tagihan', 'paket'));
        $this->assertArrayNotHasKey('paket', $tarif->fresh()->getAttributes());
        $this->assertArrayNotHasKey('paket', $tagihan->fresh()->getAttributes());

        // Respons API tidak lagi mengirim paket.
        $res = $this->actingAs($admin)->getJson('/api/admin/keuangan/tarif')->assertStatus(200)->json();
        $this->assertNotEmpty($res);
        $this->assertArrayNotHasKey('paket', $res[0]);

        // Store tarif tanpa paket tetap diterima (validasi tidak mewajibkannya).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tarif', [
            'jenjang' => 'MD', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 60000,
        ])->assertStatus(201);
    }

    public function test_urut_paket_ditolak_setelah_dihapus_dari_katalog(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        TarifTagihan::create(['jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 75000]);

        // Kode "paket" dicabut dari UrutKatalog → sort=paket 422, bukan diam-diam
        // lolos lalu membandingkan null (urutan tidak berubah tanpa tanda).
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tarif?sort=paket')
            ->assertStatus(422);
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2025/2026&kelompok=aktif&sort=paket')
            ->assertStatus(422);

        // Kode yang sah tetap jalan.
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tarif?sort=nominal&arah=turun')
            ->assertStatus(200);
        $this->assertArrayNotHasKey('paket', array_keys(UrutKatalog::peta('keuangan_tarif')));
        $this->assertArrayNotHasKey('paket', array_keys(UrutKatalog::peta('keuangan_gen_kandidat')));
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

        $belum = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 75000]);
        Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-08', 'nominal' => 75000, 'terbayar' => 75000, 'status' => 'lunas']);
        Tagihan::create(['santri_id' => $lain->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 75000]);

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

    public function test_crosstab_baris_santri_ada_kelas_dan_status_keaktifan(): void
    {
        $admin = $this->admin();
        $infaq = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);

        $buat = function (string $nama, string $status = 'aktif') {
            return Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        };
        $riwayat = function (int $santriId, string $jenjang, string $semester, string $tingkat, ?string $kelas, string $status = 'aktif') {
            $k = $kelas === null ? null : Kelas::create(['jenjang' => $jenjang, 'tahun_ajaran' => '2025/2026', 'tingkat' => $tingkat, 'nama_kelas' => $kelas]);
            DB::table('riwayat_belajar')->insert([
                'santri_id' => $santriId, 'tahun_ajaran' => '2025/2026', 'jenjang' => $jenjang,
                'tingkat' => $tingkat, 'kelas_id' => $k?->id, 'semester' => $semester,
                'status_akhir' => $status, 'is_active_riwayat' => 'Ya',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        };

        // Genap menang; MI-MD memakai kelas MI; pindah_keluar tetap tampil.
        $genap = $buat('Genap Menang');
        $riwayat($genap->id, 'MI', '1', '4', '4A');
        $riwayat($genap->id, 'MI', '2', '4', '4B');

        $mimd = $buat('MI-MD');
        $riwayat($mimd->id, 'MD', '2', '5', '5MD');
        $riwayat($mimd->id, 'MI', '2', '5', '5MI');

        $pindah = $buat('Sudah Pindah');
        $riwayat($pindah->id, 'MI', '2', '6', '6A', 'pindah_keluar');

        foreach ([$genap, $mimd, $pindah] as $s) {
            Tagihan::create(['santri_id' => $s->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-07', 'nominal' => 50000]);
        }

        $baris = collect($this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?tahun_ajaran=2025/2026')
            ->assertStatus(200)->assertJsonCount(3, 'baris')->json('baris'))
            ->keyBy('nama');

        // Semester genap menang atas ganjil.
        $this->assertSame('4', $baris['Genap Menang']['tingkat']);
        $this->assertSame('4B', $baris['Genap Menang']['kelas']);

        // MI-MD: jenjang utama MI, jadi kelasnya dari MI.
        $this->assertSame('5MI', $baris['MI-MD']['kelas']);

        // Pindah/Keluar tetap ditampilkan (tidak disaring), ditandai tidak aktif.
        $this->assertSame('pindah_keluar', $baris['Sudah Pindah']['status_akhir']);
        $this->assertFalse($baris['Sudah Pindah']['aktif']);

        /* Keaktifan MI-MD (aturan user): tidak aktif HANYA kalau MI **dan** MD
           sama-sama `pindah_keluar`. Kalau hanya salah satu → masih aktif.
           Status dibaca dari `per_jenjang`, bukan dari jenjang yang sedang
           difilter crosstab. */
        // Baris kelas dibuat sekali lalu dipakai ulang (unik per jenjang+TA+nama).
        $kelasMi = Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'tingkat' => '3', 'nama_kelas' => '3A']);
        $kelasMd = Kelas::create(['jenjang' => 'MD', 'tahun_ajaran' => '2025/2026', 'tingkat' => '3', 'nama_kelas' => '3B']);
        $riwayatDenganKelas = function (int $santriId, string $jenjang, int $kelasId, string $status) {
            DB::table('riwayat_belajar')->insert([
                'santri_id' => $santriId, 'tahun_ajaran' => '2025/2026', 'jenjang' => $jenjang,
                'tingkat' => '3', 'kelas_id' => $kelasId, 'semester' => '2',
                'status_akhir' => $status, 'is_active_riwayat' => 'Ya',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        };
        /* Jenjang unik tagihan = (santri, jenis, periode) tanpa jenjang, jadi
           satu Santri hanya punya satu tagihan per bulan. Supaya aturan keaktifan
           terbukti TAK bergantung pada jenjang yang sedang difilter crosstab,
           tiap kombinasi dibuat dua kali: sekali bertagihan MI, sekali MD. */
        $pasangan = function (string $nama, string $statusMi, string $statusMd, string $jenjangTagihan) use ($buat, $riwayatDenganKelas, $kelasMi, $kelasMd, $infaq) {
            $s = $buat($nama);
            $riwayatDenganKelas($s->id, 'MI', $kelasMi->id, $statusMi);
            $riwayatDenganKelas($s->id, 'MD', $kelasMd->id, $statusMd);
            Tagihan::create(['santri_id' => $s->id, 'jenjang' => $jenjangTagihan, 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-07', 'nominal' => 50000]);

            return $s;
        };
        $namaPindah = 'MI Pindah, MD Aktif';
        $namaAktif = 'MI MD Sama-sama Aktif';
        $namaDuaPindah = 'MI MD Dua-dua Pindah';
        foreach (['MI', 'MD'] as $j) {
            $pasangan("{$namaPindah} ({$j})", 'pindah_keluar', 'aktif', $j);
            $pasangan("{$namaAktif} ({$j})", 'aktif', 'aktif', $j);
            $pasangan("{$namaDuaPindah} ({$j})", 'pindah_keluar', 'pindah_keluar', $j);
        }

        $ambil = function (string $jenjang) use ($admin) {
            return collect($this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/crosstab?tahun_ajaran=2025/2026&jenjang[]={$jenjang}")
                ->assertStatus(200)->json('baris'))->keyBy('nama');
        };
        foreach (['MI', 'MD'] as $jenjang) {
            $b = $ambil($jenjang);
            // Hanya salah satu yang pindah → masih aktif.
            $this->assertTrue($b["{$namaPindah} ({$jenjang})"]['aktif'], "satu jenjang pindah → aktif ($jenjang)");
            $this->assertTrue($b["{$namaAktif} ({$jenjang})"]['aktif'], "keduanya aktif → aktif ($jenjang)");
            // Keduanya pindah → tidak aktif.
            $this->assertFalse($b["{$namaDuaPindah} ({$jenjang})"]['aktif'], "keduanya pindah → tidak aktif ($jenjang)");
            $this->assertSame('pindah_keluar', $b["{$namaDuaPindah} ({$jenjang})"]['status_akhir']);
            // Kelas SELALU dari MI walau tagihan/barisnya MD.
            $this->assertSame('3A', $b["{$namaPindah} ({$jenjang})"]['kelas'], "kelas dari MI ($jenjang)");
        }
        $this->assertTrue($baris['Genap Menang']['aktif']);
        $this->assertSame('aktif', $baris['Genap Menang']['status_akhir']);

        // Tanpa filter TA tak ada patokan kelas → kolom kosong, bukan error.
        $tanpaTa = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab')->assertStatus(200)->json('baris');
        $this->assertNull($tanpaTa[0]['kelas']);
        $this->assertFalse($tanpaTa[0]['aktif']);
    }

    public function test_crosstab_tagihan_kolom_per_jenis_dan_bulan(): void
    {
        $admin = $this->admin();
        $infaq = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $hipa = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Crosstab', 'jk' => 'L', 'ayah_nama' => 'Ayah Crosstab', 'ibu_nama' => 'Ibu Crosstab']);
        $lain = Santri::create(['nama_lengkap' => 'Santri Kosong', 'jk' => 'P', 'ayah_nama' => 'Ayah Kosong', 'ibu_nama' => null]);

        $juli = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-07', 'nominal' => 50000, 'jatuh_tempo' => now()->subDays(40)->toDateString()]);
        Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-08', 'nominal' => 50000, 'terbayar' => 20000, 'status' => 'sebagian', 'jatuh_tempo' => now()->subDays(10)->toDateString()]);
        Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $hipa->id, 'periode' => '2025/2026', 'nominal' => 300000, 'terbayar' => 300000, 'status' => 'lunas']);
        Tagihan::create(['santri_id' => $lain->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-08', 'nominal' => 50000]);

        $res = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?tahun_ajaran=2025/2026')
            ->assertStatus(200)
            ->assertJsonCount(2, 'baris');

        // Bulanan dipecah per bulan, non-bulanan satu kolom.
        $this->assertSame(
            ["{$infaq->id}-2025-07", "{$infaq->id}-2025-08", 'jenis-'.$hipa->id],
            array_column($res->json('kolom'), 'key')
        );
        $this->assertSame(['bulanan', 'bulanan', 'non_bulanan'], array_column($res->json('kolom'), 'tipe'));

        $baris = collect($res->json('baris'))->keyBy('nama');
        $santriBaris = $baris['Santri Crosstab'];
        $this->assertSame($juli->id, $santriBaris['sel']["{$infaq->id}-2025-07"]['id']);
        $this->assertSame('belum', $santriBaris['sel']["{$infaq->id}-2025-07"]['status']);
        $this->assertSame(30000, $santriBaris['sel']["{$infaq->id}-2025-08"]['sisa']);
        $this->assertTrue($santriBaris['sel']["{$infaq->id}-2025-08"]['terlambat']);
        $this->assertSame('lunas', $santriBaris['sel']['jenis-'.$hipa->id]['status']);
        $this->assertSame(400000, $santriBaris['total_tagihan']);
        $this->assertSame(80000, $santriBaris['tunggakan']);
        // Santri tanpa tagihan Juli → sel kosong (tidak ada key).
        $this->assertArrayNotHasKey("{$infaq->id}-2025-07", $baris['Santri Kosong']['sel']);
        // Orang tua ikut dibawa untuk popover aksi sel (ayah & ibu).
        $this->assertSame('Ayah Crosstab', $santriBaris['ayah_nama']);
        $this->assertSame('Ibu Crosstab', $santriBaris['ibu_nama']);
        $this->assertSame('Ayah Kosong', $baris['Santri Kosong']['ayah_nama']);
        $this->assertNull($baris['Santri Kosong']['ibu_nama']);

        // Filter jenis_id hanya menyisakan kolom jenis itu.
        $this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/crosstab?tahun_ajaran=2025/2026&jenis_id={$hipa->id}")
            ->assertStatus(200)
            ->assertJsonCount(1, 'kolom')
            ->assertJsonPath('kolom.0.key', 'jenis-'.$hipa->id);

        // Sort koleksi: nama naik, dan nilai liar ditolak.
        $this->assertSame(
            ['Santri Crosstab', 'Santri Kosong'],
            array_column($this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?sort=nama&arah=naik')->json('baris'), 'nama')
        );
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?sort=nominal')
            ->assertStatus(422);
    }

    public function test_tunggakan_hanya_yang_sudah_lewat_jatuh_tempo(): void
    {
        $admin = $this->admin();
        $infaq = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Telat', 'jk' => 'P']);

        // Lewat jatuh tempo & belum lunas → tunggakan.
        $lewat = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-07', 'nominal' => 50000, 'jatuh_tempo' => now()->subDays(5)->toDateString()]);
        // Lewat jatuh tempo tapi lunas → bukan tunggakan.
        Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-08', 'nominal' => 50000, 'terbayar' => 50000, 'status' => 'lunas', 'jatuh_tempo' => now()->subDays(3)->toDateString()]);
        // Jatuh tempo tepat hari ini → belum terlambat.
        Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-09', 'nominal' => 50000, 'jatuh_tempo' => now()->toDateString()]);
        // Bulan depan → belum jatuh tempo.
        Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-10', 'nominal' => 50000, 'jatuh_tempo' => now()->addMonth()->toDateString()]);

        $baris = collect($this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab')->assertStatus(200)->json('baris'))->first();

        // Sel menandai terlambat; kolom Tunggakan hanya menghitung yang lewat.
        $this->assertTrue($baris['sel']["{$infaq->id}-2025-07"]['terlambat']);
        $this->assertFalse($baris['sel']["{$infaq->id}-2025-08"]['terlambat'], 'lunas bukan tunggakan');
        $this->assertFalse($baris['sel']["{$infaq->id}-2025-09"]['terlambat'], 'jatuh tempo hari ini belum terlambat');
        $this->assertFalse($baris['sel']["{$infaq->id}-2025-10"]['terlambat'], 'bulan depan belum jatuh tempo');
        $this->assertSame(200000, $baris['total_tagihan'], 'total tagihan tetap semua bulan');
        $this->assertSame(50000, $baris['tunggakan'], 'hanya sisa yang lewat jatuh tempo');

        // Filter terlambat=1 menyembunyikan bulan yang belum jatuh tempo.
        $tersaring = collect($this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?terlambat=1')->assertStatus(200)->json('baris'))->first();
        $this->assertSame([$lewat->id], array_column($tersaring['sel'], 'id'));
        $this->assertSame(50000, $tersaring['tunggakan']);

        // Endpoint tunggakan: hanya tagihan terlambat.
        $tunggakan = $this->actingAs($admin)->getJson('/api/admin/keuangan/tunggakan')->assertStatus(200)->json('data');
        $this->assertCount(1, $tunggakan);
        $this->assertSame('Santri Telat', $tunggakan[0]['nama']);
        $this->assertSame(50000, $tunggakan[0]['tunggakan']);
        $this->assertSame(1, $tunggakan[0]['jumlah_tagihan']);
        $this->assertSame(now()->subDays(5)->toDateString(), $tunggakan[0]['terlambat_terlama']);

        // Tidak ada satu pun yang lewat → kosong.
        Tagihan::query()->update(['jatuh_tempo' => now()->addMonth()->toDateString()]);
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tunggakan')
            ->assertStatus(200)->assertJsonCount(0, 'data');
    }

    public function test_tagihan_tanpa_jatuh_tempo_langsung_terlambat(): void
    {
        $admin = $this->admin();
        $hipa = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Tanpa Tempo', 'jk' => 'L']);
        $t = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $hipa->id, 'nominal' => 300000]);

        // Tanpa batas waktu = langsung tunggakan, walau baru dibuat.
        $this->assertTrue($t->terlambat());
        $this->assertSame(300000, $t->sisaTerlambat());

        // Endpoint tunggakan memuatnya; tandai "tanpa batas".
        $tunggakan = $this->actingAs($admin)->getJson('/api/admin/keuangan/tunggakan')
            ->assertStatus(200)->json('data');
        $this->assertCount(1, $tunggakan);
        $this->assertSame(300000, $tunggakan[0]['tunggakan']);
        $this->assertNull($tunggakan[0]['terlambat_terlama']);
        $this->assertTrue($tunggakan[0]['tanpa_jatuh_tempo']);

        // Filter crosstab terlambat=1 ikut menyertakannya.
        $baris = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?terlambat=1')
            ->assertStatus(200)->json('baris.0');
        $this->assertTrue(array_values($baris['sel'])[0]['terlambat']);
        $this->assertSame(300000, $baris['tunggakan']);
        $this->assertSame(300000, $baris['total_tagihan']);
    }

    public function test_tagihan_lunas_tanpa_jatuh_tempo_bukan_tunggakan(): void
    {
        $admin = $this->admin();
        $hipa = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Lunas', 'jk' => 'P']);
        $t = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $hipa->id, 'nominal' => 300000, 'terbayar' => 300000, 'status' => 'lunas']);

        $this->assertFalse($t->terlambat());
        $this->assertSame(0, $t->sisaTerlambat());
        $this->actingAs($admin)->getJson('/api/admin/keuangan/tunggakan')
            ->assertStatus(200)->assertJsonCount(0, 'data');
    }

    public function test_ubah_tagihan_nominal_tempo_tahun_ajaran(): void
    {
        $admin = $this->admin();
        $hipa = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Ubah', 'jk' => 'L']);
        $t = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $hipa->id, 'nominal' => 100000]);

        // Non-bulanan: nominal, TA, dan jatuh tempo manual ketiganya bisa diubah.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t->id}", [
            'nominal' => 125000, 'tahun_ajaran' => '2026/2027', 'jatuh_tempo' => '2026-08-15',
        ])->assertStatus(200)->assertJson([
            'nominal' => 125000, 'tahun_ajaran' => '2026/2027', 'status' => 'belum',
        ]);
        $this->assertSame('2026-08-15', $t->fresh()->jatuh_tempo->format('Y-m-d'));

        // Nominal turun di bawah yang dibayar ditolak (sisa jadi negatif).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $t->id, 'jumlah' => 120000,
        ])->assertStatus(201);
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t->id}", [
            'nominal' => 100000, 'tahun_ajaran' => '2026/2027',
        ])->assertStatus(422);

        // Nominal tepat sama dengan terbayar → lunas.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t->id}", [
            'nominal' => 120000, 'tahun_ajaran' => '2026/2027', 'jatuh_tempo' => null,
        ])->assertStatus(200)->assertJson(['status' => 'lunas']);
        $this->assertNull($t->fresh()->jatuh_tempo);

        // Jenis & periode diabaikan (bukan bagian kontrak ubah).
        $periodeAwal = $t->fresh()->periode;
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t->id}", [
            'nominal' => 120000, 'tahun_ajaran' => '2026/2027', 'periode' => '2099-01', 'jenis_id' => 999,
        ])->assertStatus(200);
        $this->assertSame($periodeAwal, $t->fresh()->periode);
        $this->assertSame($hipa->id, $t->fresh()->jenis_id);

        // Validasi: nominal wajib, tahun ajaran wajib.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t->id}", ['tahun_ajaran' => '2026/2027'])
            ->assertStatus(422);
    }

    public function test_ubah_tagihan_bulanan_jatuh_tempo_ikuti_aturan_tanggal_10(): void
    {
        $admin = $this->admin();
        $infaq = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Ubah Bulanan', 'jk' => 'P']);
        $t = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $infaq->id, 'periode' => '2025-07', 'nominal' => 50000]);

        // Input jatuh tempo manual diabaikan untuk bulanan: aturan tanggal 10
        // bulan berjalan tetap berlaku agar tunggakan tak bisa dikecualikan.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t->id}", [
            'nominal' => 60000, 'tahun_ajaran' => '2025/2026', 'jatuh_tempo' => '2099-12-31',
        ])->assertStatus(200);
        $this->assertSame('2025-07-10', $t->fresh()->jatuh_tempo->format('Y-m-d'));
        $this->assertSame(60000, $t->fresh()->nominal);
    }

    public function test_ubah_tagihan_ditolak_bila_tidak_bisa_lembaga(): void
    {
        $pusat = $this->admin();
        $hipa = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Scope', 'jk' => 'L']);
        $t = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $hipa->id, 'nominal' => 100000]);
        $this->actingAs($pusat)->putJson("/api/admin/keuangan/tagihan/{$t->id}", [
            'nominal' => 90000, 'tahun_ajaran' => '2025/2026',
        ])->assertStatus(200);

        // Admin lembaga lain (MTS; bukan pasangan MI↔MD) tidak boleh mengubah (403).
        Lembaga::create(['nama' => 'Tsanawiyah', 'jenjang' => 'MTS', 'is_active' => true]);
        $lain = User::create(['name' => 'Admin MTS', 'email' => 'adminmts@example.com', 'phone' => '081234567899', 'password' => 'password']);
        $lain->assignRole('admin');
        DB::table('user_lembaga')->insert(['user_id' => $lain->id, 'jenjang' => 'MTS', 'created_at' => now(), 'updated_at' => now()]);
        $this->actingAs($lain)->putJson("/api/admin/keuangan/tagihan/{$t->id}", [
            'nominal' => 1, 'tahun_ajaran' => '2025/2026',
        ])->assertStatus(403);
        $this->assertSame(90000, $t->fresh()->nominal);
    }

    public function test_hapus_tagihan(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Hapus', 'jk' => 'L']);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 100000]);

        // Hapus tagihan tanpa pembayaran.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tagihan/{$tagihan->id}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('tagihan', ['id' => $tagihan->id]);

        // Tagihan ber-pembayaran aktif tak bisa dihapus langsung.
        $tagihan2 = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-01', 'nominal' => 100000]);
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
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 800000, 'jatuh_tempo' => now()->subDays(10)->toDateString()]);

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

        $tunggakan = $this->actingAs($admin)->getJson('/api/admin/keuangan/tunggakan')->assertStatus(200)->json('data');
        $this->assertNotEmpty($tunggakan);
    }

    public function test_hapus_pembayaran(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Hapus Bayar', 'jk' => 'L']);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 100000]);

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
