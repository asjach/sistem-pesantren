<?php

namespace Tests\Feature;

use App\Models\Dispensasi;
use App\Models\JenisTagihan;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DispensasiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        DB::table('lembaga')->insert(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        TahunAjaran::create(['nama' => '2025/2026']);
    }

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    private function santriDenganRiwayat(string $nama, string $jenjang = 'MI'): Santri
    {
        $santri = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        DB::table('riwayat_belajar')->insert([
            'santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => $jenjang,
            'tingkat' => '1', 'kelas_id' => null, 'semester' => '1',
            'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $santri;
    }

    public function test_crud_paket_multi_aturan_dan_guard_hapus(): void
    {
        $admin = $this->admin();
        $asas = JenisTagihan::create(['nama' => 'ASAS', 'tipe' => 'non_bulanan']);
        $hipa = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = $this->santriDenganRiwayat('Santri A');

        $id = $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Anak Pegawai', 'tahun_ajaran' => '2025/2026',
            'aturan' => [
                ['jenis_id' => $asas->id, 'tipe' => 'persen', 'nilai' => 50],
                ['jenis_id' => $hipa->id, 'tipe' => 'nominal', 'nilai' => 50000],
            ],
            'santri_ids' => [$santri->id],
        ])->assertStatus(201)
            ->assertJsonPath('nama', 'Anak Pegawai')
            ->assertJsonPath('santri_ids', [$santri->id])
            ->assertJsonPath('santri_tambahan.0.nama_lengkap', 'Santri A')
            ->json('id');

        $this->assertDatabaseCount('dispensasi_aturan', 2);
        $this->assertDatabaseHas('santri_dispensasi', ['dispensasi_id' => $id, 'santri_id' => $santri->id]);

        // Daftar memuat aturan + santri.
        $this->actingAs($admin)->getJson('/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026')
            ->assertStatus(200)->assertJsonCount(1)
            ->assertJsonPath('0.aturan.0.jenis_id', $asas->id)
            ->assertJsonPath('0.aturan.0.tipe', 'persen')
            ->assertJsonPath('0.santri_tambahan.0.nama_lengkap', 'Santri A');

        // Persen > 100 ditolak; campur semua-jenis + spesifik ditolak.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Salah', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $asas->id, 'tipe' => 'persen', 'nilai' => 150]],
        ])->assertStatus(422);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Salah', 'tahun_ajaran' => '2025/2026',
            'aturan' => [
                ['jenis_id' => null, 'tipe' => 'bebas', 'nilai' => 0],
                ['jenis_id' => $asas->id, 'tipe' => 'persen', 'nilai' => 10],
            ],
        ])->assertStatus(422);

        // Update mengganti aturan + mengosongkan santri (sync).
        $this->actingAs($admin)->putJson("/api/admin/keuangan/dispensasi/{$id}", [
            'nama' => 'Anak Pegawai', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $asas->id, 'tipe' => 'bebas', 'nilai' => 0]],
        ])->assertStatus(200)->assertJsonPath('santri_ids', null);
        $this->assertDatabaseCount('dispensasi_aturan', 1);
        $this->assertDatabaseMissing('santri_dispensasi', ['dispensasi_id' => $id]);

        // Sudah dipakai tagihan → tidak bisa dihapus (nonaktifkan saja).
        Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $asas->id, 'periode' => '2025/2026', 'nominal' => 0,
            'potongan' => 50000, 'dispensasi_ids' => [$id],
        ]);
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/dispensasi/{$id}")->assertStatus(422);

        // Belum dipakai → boleh hapus, aturan ikut terhapus (cascade).
        $id2 = $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Bebas Uji', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $hipa->id, 'tipe' => 'bebas', 'nilai' => 0]],
        ])->assertStatus(201)->json('id');
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/dispensasi/{$id2}")->assertStatus(200);
        $this->assertDatabaseMissing('dispensasi_aturan', ['dispensasi_id' => $id2]);
    }

    public function test_batas_lembaga_mengikuti_jenjang_jenis(): void
    {
        $adminMi = User::create(['name' => 'Admin MI', 'email' => 'adminmi@example.com', 'phone' => '081234567891', 'password' => 'password']);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert(['user_id' => $adminMi->id, 'jenjang' => 'MI', 'created_at' => now(), 'updated_at' => now()]);

        $jenisMi = JenisTagihan::create(['nama' => 'Infaq MI', 'tipe' => 'bulanan', 'jenjang' => 'MI']);
        $jenisMts = JenisTagihan::create(['nama' => 'Infaq MTS', 'tipe' => 'bulanan', 'jenjang' => 'MTS']);
        $jenisGlobal = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);

        // Jenis MI boleh; jenis MTS/global/semua-jenis ditolak untuk admin MI.
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Khusus MI', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $jenisMi->id, 'tipe' => 'nominal', 'nilai' => 1000]],
        ])->assertStatus(201);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Salah Lembaga', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $jenisMts->id, 'tipe' => 'nominal', 'nilai' => 1000]],
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Global', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $jenisGlobal->id, 'tipe' => 'nominal', 'nilai' => 1000]],
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Semua Jenis', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => null, 'tipe' => 'nominal', 'nilai' => 1000]],
        ])->assertStatus(403);
    }

    public function test_generate_menerapkan_multi_aturan_akumulatif_dan_manual_menang(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Dispen');
        $lain = $this->santriDenganRiwayat('Santri Biasa');

        // Dua paket untuk santri yang sama: persen 50 (id kecil dulu) lalu nominal 10.000.
        $d1 = Dispensasi::create(['nama' => 'Setengah', 'tahun_ajaran' => '2025/2026']);
        $d1->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => 'persen', 'nilai' => 50]);
        $d1->santriTambahan()->sync([$santri->id, $lain->id]);
        $d2 = Dispensasi::create(['nama' => 'Potongan', 'tahun_ajaran' => '2025/2026']);
        $d2->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => 'nominal', 'nilai' => 10000]);
        $d2->santriTambahan()->sync([$santri->id]);

        // Default 100.000 → 50% = 50.000 → −10.000 = 40.000 (potongan 60.000).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id], ['santri_id' => $lain->id, 'nominal' => 20000]],
        ])->assertStatus(200)->assertJson(['dibuat' => 2, 'dilewati' => 0]);

        $otomatis = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame(40000, $otomatis->nominal);
        $this->assertSame(60000, $otomatis->potongan);
        $this->assertCount(2, $otomatis->dispensasi_ids);

        // Manual menang: nominal apa adanya, potongan 0, tanpa jejak dispensasi.
        $manual = Tagihan::where('santri_id', $lain->id)->firstOrFail();
        $this->assertSame(20000, $manual->nominal);
        $this->assertSame(0, $manual->potongan);
        $this->assertNull($manual->dispensasi_ids);
    }

    public function test_generate_menerapkan_otomatis_hanya_penerima(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Prestasi');
        $biasa = $this->santriDenganRiwayat('Santri Biasa');

        $tetap = $this->paket($jenis, 'Anak Pegawai', 'persen', 50, $santri);
        $kuota = $this->paket($jenis, 'Prestasi', 'bebas', 0, $santri);
        $kuota->update(['kuota_bulan' => 6]);

        // Semua paket aktif selalu otomatis — hanya untuk penerima.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id], ['santri_id' => $biasa->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 2]);
        $tagihan = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        // 50% → 50.000 lalu bebas → 0 (tetap + kuota, keduanya otomatis).
        $this->assertSame(0, $tagihan->nominal);
        $this->assertSame([$tetap->id, $kuota->id], $tagihan->dispensasi_ids);
        $biasaTagihan = Tagihan::where('santri_id', $biasa->id)->firstOrFail();
        $this->assertSame(100000, $biasaTagihan->nominal);
        $this->assertNull($biasaTagihan->dispensasi_ids);
    }

    /** Lingkup jenjang paket ikut menyaring GENERATE: paket MI tak memotong
     *  tagihan santri MD dan sebaliknya. Penerimanya sengaja disilang supaya
     *  yang diuji benar-benar lingkupnya, bukan daftar penerima. */
    public function test_generate_menghormati_lingkup_jenjang_paket(): void
    {
        $admin = $this->admin();
        DB::table('lembaga')->insert(['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santriMi = $this->santriDenganRiwayat('Santri MI', 'MI');
        $santriMd = $this->santriDenganRiwayat('Santri MD', 'MD');

        $paketMi = $this->paket($jenis, 'Khusus MI', 'bebas', 0, $santriMi, $santriMd);
        $paketMi->update(['jenjang' => 'MI']);
        $paketMd = $this->paket($jenis, 'Khusus MD', 'bebas', 0, $santriMd, $santriMi);
        $paketMd->update(['jenjang' => 'MD']);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 100000,
            'santri' => [['santri_id' => $santriMi->id], ['santri_id' => $santriMd->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 2]);

        // Tiap santri hanya kena paket sejenjang dirinya.
        $tagihanMi = Tagihan::where('santri_id', $santriMi->id)->firstOrFail();
        $this->assertSame([$paketMi->id], $tagihanMi->dispensasi_ids);
        $this->assertSame(0, $tagihanMi->nominal);

        $tagihanMd = Tagihan::where('santri_id', $santriMd->id)->firstOrFail();
        $this->assertSame([$paketMd->id], $tagihanMd->dispensasi_ids);
        $this->assertSame(0, $tagihanMd->nominal);

        // Paket tanpa lingkup tetap berlaku untuk siapa pun penerimanya.
        $paketMi->update(['jenjang' => null]);
        $paketMd->update(['jenjang' => null]);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-08',
            'nominal' => 100000,
            'santri' => [['santri_id' => $santriMi->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 1]);
        $agustus = Tagihan::where('santri_id', $santriMi->id)->where('periode', '2025-08')->firstOrFail();
        $this->assertSame([$paketMi->id, $paketMd->id], $agustus->dispensasi_ids);
    }

    public function test_generate_kuota_membatasi_n_bulan_pertama(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Kuota');
        $d = $this->paket($jenis, 'Prestasi', 'bebas', 0, $santri);
        $d->update(['kuota_bulan' => 2]);

        $payload = [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id,
            'periode' => '2025-07', 'periode_sampai' => '2025-09', 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ];
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 3]);

        $per = fn (string $p) => Tagihan::where('santri_id', $santri->id)->where('periode', $p)->firstOrFail();
        $this->assertSame(0, $per('2025-07')->nominal);
        $this->assertSame([$d->id], $per('2025-07')->dispensasi_ids);
        $this->assertSame(0, $per('2025-08')->nominal);
        $this->assertSame([$d->id], $per('2025-08')->dispensasi_ids);
        $this->assertSame(100000, $per('2025-09')->nominal);
        $this->assertNull($per('2025-09')->dispensasi_ids);

        // Generate ulang idempoten: yang menempel bertahan, yang penuh tetap penuh.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 0, 'diperbarui' => 0, 'tetap' => 3, 'dilewati' => 0]);
        $this->assertSame(0, $per('2025-07')->nominal);
        $this->assertSame([$d->id], $per('2025-08')->dispensasi_ids);
        $this->assertSame(100000, $per('2025-09')->nominal);
    }

    public function test_ubah_menolak_pasang_baru_bila_kuota_habis(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Kuota Ubah');
        $d = $this->paket($jenis, 'Prestasi', 'persen', 50, $santri);
        $d->update(['kuota_bulan' => 1]);

        $t1 = $this->tagihanManual($santri, $jenis);
        $t1->update(['nominal' => 50000, 'potongan' => 50000, 'dispensasi_ids' => [$d->id]]);
        $t2 = Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $jenis->id, 'periode' => '2025-08', 'nominal' => 100000,
        ]);

        // Kuota 1 sudah dipakai bulan pertama → pasang di bulan kedua ditolak.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t2->id}", [
            'nominal' => 100000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [$d->id],
        ])->assertStatus(422)->assertSee('Kuota 1 bulan');

        // Lepas dari bulan pertama membebaskan kuota → bulan kedua bisa dipasang.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t1->id}", [
            'nominal' => 100000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [],
        ])->assertStatus(200);
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t2->id}", [
            'nominal' => 100000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [$d->id],
        ])->assertStatus(200);
        $this->assertSame(50000, $t2->fresh()->nominal);
    }

    public function test_kuota_pakai_menghitung_tagihan_bulanan(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Hitung');
        $d = $this->paket($jenis, 'Prestasi', 'bebas', 0, $santri);
        $d->update(['kuota_bulan' => 6]);

        $t1 = $this->tagihanManual($santri, $jenis);
        $t1->update(['nominal' => 0, 'potongan' => 100000, 'dispensasi_ids' => [$d->id]]);

        $this->actingAs($admin)
            ->getJson("/api/admin/keuangan/dispensasi/kuota-pakai?santri_ids[]={$santri->id}")
            ->assertStatus(200)->assertJsonPath("{$santri->id}.{$d->id}", 1);
        $this->actingAs($admin)->getJson('/api/admin/keuangan/dispensasi/kuota-pakai')
            ->assertStatus(200)->assertExactJson([]);
    }

    public function test_generate_segrup_tidak_menumpuk_meneruskan_yang_menempel(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Grup');
        $ganjil = $this->paket($jenis, 'Prestasi Ganjil', 'bebas', 0, $santri);
        $ganjil->update(['grup' => 'prestasi']);
        $genap = $this->paket($jenis, 'Prestasi Genap', 'bebas', 0, $santri);
        $genap->update(['grup' => 'prestasi']);

        $payload = [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id,
            'periode' => '2025-07', 'periode_sampai' => '2025-08', 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ];
        // Baris baru: ganjil (id lebih kecil) menang, genap dicoret.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 2]);
        $jul = Tagihan::where('santri_id', $santri->id)->where('periode', '2025-07')->firstOrFail();
        $this->assertSame([$ganjil->id], $jul->dispensasi_ids);

        // Genap ditempel manual di Agustus, generate ulang: ganjil tidak
        // menimpa (meneruskan), genap bertahan.
        $agu = Tagihan::where('santri_id', $santri->id)->where('periode', '2025-08')->firstOrFail();
        $agu->update(['dispensasi_ids' => [$genap->id]]);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)->assertStatus(200);
        $this->assertSame([$ganjil->id], $jul->fresh()->dispensasi_ids);
        $this->assertSame([$genap->id], $agu->fresh()->dispensasi_ids);
    }

    public function test_ubah_menggantikan_yang_segrup_mempertahankan_lain(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Ganti');
        $anak = $this->paket($jenis, 'Anak Pegawai', 'persen', 50, $santri);
        $ganjil = $this->paket($jenis, 'Ganjil', 'bebas', 0, $santri);
        $ganjil->update(['grup' => 'prestasi']);
        $genap = $this->paket($jenis, 'Genap', 'bebas', 0, $santri);
        $genap->update(['grup' => 'prestasi']);

        $t = $this->tagihanManual($santri, $jenis);
        // Pasang anak + ganjil: beda grup → digabung (50% → 50rb lalu bebas → 0).
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t->id}", [
            'nominal' => 100000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [$anak->id, $ganjil->id],
        ])->assertStatus(200);
        $t->refresh();
        $this->assertSame(0, $t->nominal);
        $this->assertSame([$anak->id, $ganjil->id], $t->dispensasi_ids);

        // Pilih genap: menggantikan ganjil se-grup, anak dipertahankan.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$t->id}", [
            'nominal' => 0, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [$genap->id],
        ])->assertStatus(200);
        $t->refresh();
        $this->assertSame(0, $t->nominal);
        $this->assertSame([$anak->id, $genap->id], $t->dispensasi_ids);
    }

    public function test_generate_menormalkan_ganda_segrup_legacy(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Legacy');
        $ganjil = $this->paket($jenis, 'Ganjil', 'bebas', 0, $santri);
        $ganjil->update(['grup' => 'prestasi']);
        $genap = $this->paket($jenis, 'Genap', 'bebas', 0, $santri);
        $genap->update(['grup' => 'prestasi']);

        // Jejak legacy: dua se-grup menempel sebelum flag grup ada.
        $t = $this->tagihanManual($santri, $jenis);
        $t->update(['nominal' => 0, 'potongan' => 100000, 'dispensasi_ids' => [$ganjil->id, $genap->id]]);

        // Generate ulang menormalkan: daftar pertama menang (ganjil).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 100000, 'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);
        $t->refresh();
        $this->assertSame(0, $t->nominal);
        $this->assertSame([$ganjil->id], $t->dispensasi_ids);
    }

    public function test_generate_failover_segrup_kuota_habis(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Failover');
        $ganjil = $this->paket($jenis, 'Ganjil', 'bebas', 0, $santri);
        $ganjil->update(['grup' => 'prestasi', 'kuota_bulan' => 1]);
        $genap = $this->paket($jenis, 'Genap', 'bebas', 0, $santri);
        $genap->update(['grup' => 'prestasi', 'kuota_bulan' => 6]);

        // Ganjil habis di Juli (1/1); Agustus failover ke Genap (tak menumpuk).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id,
            'periode' => '2025-07', 'periode_sampai' => '2025-08', 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 2]);
        $jul = Tagihan::where('santri_id', $santri->id)->where('periode', '2025-07')->firstOrFail();
        $agu = Tagihan::where('santri_id', $santri->id)->where('periode', '2025-08')->firstOrFail();
        $this->assertSame([$ganjil->id], $jul->dispensasi_ids);
        $this->assertSame([$genap->id], $agu->dispensasi_ids);
        $this->assertSame(0, $jul->nominal);
        $this->assertSame(0, $agu->nominal);
    }

    public function test_dispensasi_tidak_terikat_tahun_ajaran(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Lintas TA');

        // Paket ber-TA lain tetap berlaku lintas tahun ajaran.
        TahunAjaran::create(['nama' => '2024/2025']);
        $d = Dispensasi::create(['nama' => 'Lintas', 'tahun_ajaran' => '2024/2025']);
        $d->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => 'persen', 'nilai' => 50]);
        $d->santriTambahan()->sync([$santri->id]);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 100000, 'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 1]);
        $tagihan = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame(50000, $tagihan->nominal);
        $this->assertSame([$d->id], $tagihan->dispensasi_ids);
    }

    public function test_aturan_hanya_berlaku_untuk_jenisnya_dan_bebas_menihilkan(): void
    {
        $admin = $this->admin();
        $asas = JenisTagihan::create(['nama' => 'ASAS', 'tipe' => 'non_bulanan']);
        $hipa = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Bebas');

        $d = Dispensasi::create(['nama' => 'Campur', 'tahun_ajaran' => '2025/2026']);
        $d->aturan()->create(['jenis_id' => $asas->id, 'tipe' => 'persen', 'nilai' => 50]);
        $d->aturan()->create(['jenis_id' => $hipa->id, 'tipe' => 'bebas', 'nilai' => 0]);
        $d->santriTambahan()->sync([$santri->id]);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $asas->id, 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $hipa->id, 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);

        // ASAS: 50% → 50.000. HIPA: bebas → tagihan tetap dibuat bernominal 0.
        $this->assertSame(50000, Tagihan::where('santri_id', $santri->id)->where('jenis_id', $asas->id)->firstOrFail()->nominal);
        $tagihanHipa = Tagihan::where('santri_id', $santri->id)->where('jenis_id', $hipa->id)->firstOrFail();
        $this->assertSame(0, $tagihanHipa->nominal);
        $this->assertSame('2025/2026', $tagihanHipa->periode);

        // Aturan semua-jenis berlaku ke jenis mana pun.
        $d2 = Dispensasi::create(['nama' => 'Semua', 'tahun_ajaran' => '2025/2026']);
        $d2->aturan()->create(['jenis_id' => null, 'tipe' => 'nominal', 'nilai' => 5000]);
        $lain = $this->santriDenganRiwayat('Santri Semua');
        $d2->santriTambahan()->sync([$lain->id]);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $asas->id, 'nominal' => 100000,
            'santri' => [['santri_id' => $lain->id]],
        ])->assertStatus(200);
        $this->assertSame(95000, Tagihan::where('santri_id', $lain->id)->firstOrFail()->nominal);
    }

    public function test_index_hanya_menampilkan_penerima_santri(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Kelas');
        $lain = $this->santriDenganRiwayat('Santri Lain');

        $d = Dispensasi::create(['nama' => 'Khusus', 'tahun_ajaran' => '2025/2026']);
        $d->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => 'nominal', 'nilai' => 5000]);
        $d->santriTambahan()->sync([$santri->id]);

        $this->actingAs($admin)->getJson("/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026&santri_id={$santri->id}")
            ->assertStatus(200)->assertJsonCount(1)->assertJsonPath('0.nama', 'Khusus');
        $this->actingAs($admin)->getJson("/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026&santri_id={$lain->id}")
            ->assertStatus(200)->assertJsonCount(0);

        // Filter jenis: hanya dispensasi yang aturannya mencakup jenis itu.
        $this->actingAs($admin)->getJson("/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026&jenis_id={$jenis->id}")
            ->assertStatus(200)->assertJsonCount(1);
    }

    public function test_pratinjau_sama_dengan_generate_dan_tak_menulis(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Pratinjau');
        $ganjil = $this->paket($jenis, 'Ganjil', 'bebas', 0, $santri);
        $ganjil->update(['grup' => 'prestasi', 'kuota_bulan' => 1]);
        $genap = $this->paket($jenis, 'Genap', 'persen', 50, $santri);
        $genap->update(['grup' => 'prestasi']);

        $payload = [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id,
            'periode' => '2025-07', 'periode_sampai' => '2025-08', 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ];

        $pratinjau = $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/pratinjau', $payload)
            ->assertStatus(200)->json();
        // Pratinjau tak menulis apa pun.
        $this->assertDatabaseCount('tagihan', 0);
        // Juli: ganjil (bebas) menang; Agustus: kuotanya habis → failover ke genap.
        $this->assertSame(0, $pratinjau[0]['nominal']);
        $this->assertSame([$ganjil->id], $pratinjau[0]['dispensasi_ids']);
        $this->assertSame(['Ganjil'], $pratinjau[0]['dispensasi_nama']);
        $this->assertFalse($pratinjau[0]['seragam']);
        $this->assertSame(50000, $pratinjau[0]['periode'][1]['nominal']);
        $this->assertSame([$genap->id], $pratinjau[0]['periode'][1]['dispensasi_ids']);
        $this->assertSame([], $pratinjau[0]['tak_kebagian']);
        // Sumbangan tiap paket per baris ikut dikirim (dasar kartu hover UI).
        $this->assertSame([
            ['id' => $ganjil->id, 'nama' => 'Ganjil', 'tipe' => 'bebas', 'nilai' => 0,
                'sebelum' => 100000, 'sesudah' => 0, 'potongan' => 100000],
        ], $pratinjau[0]['periode'][0]['langkah']);
        $this->assertSame($genap->id, $pratinjau[0]['periode'][1]['langkah'][0]['id']);
        $this->assertSame(50000, $pratinjau[0]['periode'][1]['langkah'][0]['potongan']);

        // Generate dengan payload sama menulis nilai yang dijanjikan pratinjau.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 2]);
        $jul = Tagihan::where('santri_id', $santri->id)->where('periode', '2025-07')->firstOrFail();
        $agu = Tagihan::where('santri_id', $santri->id)->where('periode', '2025-08')->firstOrFail();
        $this->assertSame($pratinjau[0]['periode'][0]['nominal'], (int) $jul->nominal);
        $this->assertSame($pratinjau[0]['periode'][0]['dispensasi_ids'], $jul->dispensasi_ids);
        $this->assertSame($pratinjau[0]['periode'][1]['nominal'], (int) $agu->nominal);
        $this->assertSame($pratinjau[0]['periode'][1]['dispensasi_ids'], $agu->dispensasi_ids);
    }

    public function test_pratinjau_sebut_penerima_yang_tak_kebagian_kuota(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Kuota Habis');
        $habis = $this->paket($jenis, 'Kuota Habis', 'persen', 50, $santri);
        $habis->update(['kuota_bulan' => 1]);
        // Kuotanya sudah terpakai habis di tagihan bulan sebelumnya.
        $lampau = $this->tagihanManual($santri, $jenis);
        $lampau->update(['dispensasi_ids' => [$habis->id]]);

        $pratinjau = $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/pratinjau', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-08',
            'nominal' => 100000, 'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200)->json();

        $this->assertSame(100000, $pratinjau[0]['nominal']);
        $this->assertNull($pratinjau[0]['dispensasi_ids']);
        $this->assertSame(['Kuota Habis'], $pratinjau[0]['tak_kebagian']);
        $this->assertTrue($pratinjau[0]['seragam']);
    }

    public function test_pratinjau_tandai_baris_yang_dilewati_generate(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Sudah Bayar');
        $this->paket($jenis, 'Prestasi', 'bebas', 0, $santri);

        $tagihan = $this->tagihanManual($santri, $jenis);
        $tagihan->update(['terbayar' => 50000, 'status' => 'sebagian']);

        $payload = [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 100000, 'santri' => [['santri_id' => $santri->id]],
        ];
        $pratinjau = $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/pratinjau', $payload)
            ->assertStatus(200)->json();
        // Baris dibiarkan apa adanya generate → ditampilkan nilai sekarang,
        // dengan sebabnya supaya user tahu bukan kegagalan diam-diam.
        $this->assertSame('sudah ada pembayaran', $pratinjau[0]['periode'][0]['sebab']);
        $this->assertSame(100000, $pratinjau[0]['nominal']);
        $this->assertNull($pratinjau[0]['dispensasi_ids']);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 0, 'diperbarui' => 0, 'dilewati' => 1]);
        $this->assertNull($tagihan->fresh()->dispensasi_ids);
        $this->assertSame(50000, (int) $tagihan->fresh()->terbayar);
    }

    private function tagihanManual(Santri $santri, JenisTagihan $jenis, int $nominal = 100000): Tagihan
    {
        return Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => $nominal,
        ]);
    }

    private function paket(JenisTagihan $jenis, string $nama, string $tipe, int $nilai, Santri ...$penerima): Dispensasi
    {
        $d = Dispensasi::create(['nama' => $nama, 'tahun_ajaran' => '2025/2026']);
        $d->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => $tipe, 'nilai' => $nilai]);
        if ($penerima !== []) {
            $d->santriTambahan()->sync(array_map(fn ($s) => $s->id, $penerima));
        }

        return $d;
    }

    public function test_ubah_menerapkan_dan_melepas_dispensasi(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Ubah');
        $tagihan = $this->tagihanManual($santri, $jenis);
        $d = $this->paket($jenis, 'Prestasi', 'persen', 50, $santri);

        // Terapkan: kotor 100.000 → 50.000 + jejak.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}", [
            'nominal' => 50000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [$d->id],
        ])->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(50000, $tagihan->nominal);
        $this->assertSame(50000, $tagihan->potongan);
        $this->assertSame([$d->id], $tagihan->dispensasi_ids);

        // Lepas ([]) + ketik kotor: kembali 100.000, jejak bersih.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}", [
            'nominal' => 100000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [],
        ])->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(100000, $tagihan->nominal);
        $this->assertSame(0, $tagihan->potongan);
        $this->assertNull($tagihan->dispensasi_ids);

        // Lepas ([]) + koreksi manual: pakai ketikan, jejak bersih.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}", [
            'nominal' => 90000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [],
        ])->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(90000, $tagihan->nominal);
        $this->assertSame(0, $tagihan->potongan);
        $this->assertNull($tagihan->dispensasi_ids);
    }

    public function test_ubah_mendaftarkan_penerima_otomatis(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Baru');
        $asing = $this->santriDenganRiwayat('Santri Asing');
        $tagihan = $this->tagihanManual($santri, $jenis);
        $d = $this->paket($jenis, 'Khusus', 'persen', 50, $asing);

        // Belum penerima → 200 + otomatis terdaftar + 50% dari 100.000.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}", [
            'nominal' => 100000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [$d->id],
        ])->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(50000, $tagihan->nominal);
        $this->assertSame(50000, $tagihan->potongan);
        $this->assertSame([$d->id], $tagihan->dispensasi_ids);
        $this->assertDatabaseHas('santri_dispensasi', ['dispensasi_id' => $d->id, 'santri_id' => $santri->id]);
        // Penerima lama tidak terusik.
        $this->assertDatabaseHas('santri_dispensasi', ['dispensasi_id' => $d->id, 'santri_id' => $asing->id]);
    }

    public function test_ubah_menolak_dispensasi_tak_berlaku(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $lainJenis = JenisTagihan::create(['nama' => 'ASAS', 'tipe' => 'non_bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Tolak');
        $tagihan = $this->tagihanManual($santri, $jenis);

        $payload = ['nominal' => 100000, 'tahun_ajaran' => '2025/2026'];

        // Tanpa aturan untuk jenis ini.
        $d2 = $this->paket($lainJenis, 'ASAS Saja', 'persen', 50, $santri);
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}",
            $payload + ['dispensasi_ids' => [$d2->id]])->assertStatus(422);

        // Nonaktif.
        $d3 = $this->paket($jenis, 'Mati', 'persen', 50, $santri);
        $d3->update(['is_active' => false]);
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}",
            $payload + ['dispensasi_ids' => [$d3->id]])->assertStatus(422);

        // Id tak dikenal.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}",
            $payload + ['dispensasi_ids' => [999999]])->assertStatus(422);

        $this->assertSame(100000, $tagihan->refresh()->nominal);
        $this->assertSame(0, $tagihan->potongan);
    }

    public function test_ubah_menolak_diskon_di_bawah_terbayar_dan_membersihkan_jejak_manual(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Bayar');
        $tagihan = $this->tagihanManual($santri, $jenis);
        $tagihan->update(['terbayar' => 60000, 'status' => 'sebagian']);
        $d = $this->paket($jenis, 'Setengah', 'persen', 50, $santri);

        // 50% dari 100.000 = 50.000 < terbayar 60.000 → tolak.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}", [
            'nominal' => 100000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [$d->id],
        ])->assertStatus(422);

        // Koreksi manual tanpa kunci dispensasi membersihkan jejak lama.
        $tagihan->update(['nominal' => 100000, 'potongan' => 20000, 'dispensasi_ids' => [$d->id]]);
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}", [
            'nominal' => 90000, 'tahun_ajaran' => '2025/2026',
        ])->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(90000, $tagihan->nominal);
        $this->assertSame(0, $tagihan->potongan);
        $this->assertNull($tagihan->dispensasi_ids);

        // Nilai sama tanpa kunci: jejak dipertahankan.
        $tagihan->update(['nominal' => 90000, 'potongan' => 10000, 'dispensasi_ids' => [$d->id]]);
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}", [
            'nominal' => 90000, 'tahun_ajaran' => '2025/2026',
        ])->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(10000, $tagihan->potongan);
        $this->assertSame([$d->id], $tagihan->dispensasi_ids);
    }

    /** Lingkup lembaga paket (`dispensasi.jenjang`): null = semua lembaga,
     *  jenjang tak dikenal ditolak validasi, dan aturan paket berlingkup wajib
     *  memakai jenis lembaga itu (atau jenis global). */
    public function test_lingkup_jenjang_paket_dan_keselarasan_aturan(): void
    {
        $admin = $this->admin();
        DB::table('lembaga')->insert(['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        $jenisMi = JenisTagihan::create(['nama' => 'SPP MI', 'tipe' => 'bulanan', 'jenjang' => 'MI']);
        $jenisMd = JenisTagihan::create(['nama' => 'SPP MD', 'tipe' => 'bulanan', 'jenjang' => 'MD']);
        $jenisGlobal = JenisTagihan::create(['nama' => 'Daftar', 'tipe' => 'non_bulanan', 'jenjang' => null]);

        // Tanpa jenjang (bawaan) = berlaku semua lembaga.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Semua Lembaga', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $jenisGlobal->id, 'tipe' => 'persen', 'nilai' => 10]],
        ])->assertStatus(201)->assertJsonPath('jenjang', null);

        // Berlingkup MI + jenis MI/global: boleh, jenjangnya tersimpan.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Khusus MI', 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI',
            'aturan' => [
                ['jenis_id' => $jenisMi->id, 'tipe' => 'persen', 'nilai' => 50],
                ['jenis_id' => $jenisGlobal->id, 'tipe' => 'nominal', 'nilai' => 5000],
            ],
        ])->assertStatus(201)->assertJsonPath('jenjang', 'MI');
        $this->assertDatabaseHas('dispensasi', ['nama' => 'Khusus MI', 'jenjang' => 'MI']);

        // Jenis MD pada paket MI ditolak (aturan harus selaras lingkupnya).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Campur', 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI',
            'aturan' => [['jenis_id' => $jenisMd->id, 'tipe' => 'persen', 'nilai' => 50]],
        ])->assertStatus(422);

        // Jenjang yang tak ada di tabel lembaga ditolak validasi.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Salah Jenjang', 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MTS',
            'aturan' => [['jenis_id' => $jenisGlobal->id, 'tipe' => 'persen', 'nilai' => 10]],
        ])->assertStatus(422);

        // Ubah paket: lingkup bisa dikosongkan lagi (kembali semua lembaga).
        $id = Dispensasi::where('nama', 'Khusus MI')->value('id');
        $this->actingAs($admin)->putJson("/api/admin/keuangan/dispensasi/{$id}", [
            'nama' => 'Khusus MI', 'tahun_ajaran' => '2025/2026', 'jenjang' => null,
            'aturan' => [['jenis_id' => $jenisMi->id, 'tipe' => 'persen', 'nilai' => 50]],
        ])->assertStatus(200)->assertJsonPath('jenjang', null);
    }

    /** Jalur Ubah manual (pilih paket di popover) juga menghormati lingkup:
     *  paket berlingkup lembaga lain ditolak 422 dan jejak tagihan tak berubah
     *  — cermin penjaga `DispensasiService::lingkupCocok`, supaya hasilnya sama
     *  dengan generate yang menyaring lewat `saring()`. */
    public function test_ubah_menolak_paket_berlingkup_lembaga_lain(): void
    {
        $admin = $this->admin();
        DB::table('lembaga')->insert(['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        // Jenis global supaya tak ada aturan yang menghalangi lebih dulu
        // (lingkup paket vs jenis sudah dijaga `pastikanAturanSelarasJenjang`).
        $jenis = JenisTagihan::create(['nama' => 'Daftar', 'tipe' => 'non_bulanan', 'jenjang' => null]);
        $santri = $this->santriDenganRiwayat('Santri Ubah Lingkup');
        $tagihan = $this->tagihanManual($santri, $jenis);
        $tagihan->update(['jenjang' => 'MI']);

        $paketMd = $this->paket($jenis, 'Khusus MD', 'persen', 50, $santri);
        $paketMd->update(['jenjang' => 'MD']);
        $paketMi = $this->paket($jenis, 'Khusus MI', 'persen', 50, $santri);
        $paketMi->update(['jenjang' => 'MI']);

        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}", [
            'nominal' => 50000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [$paketMd->id],
        ])->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Khusus MD'));
        $tagihan->refresh();
        $this->assertSame(100000, $tagihan->nominal);
        $this->assertNull($tagihan->dispensasi_ids);

        // Paket selembaga tetap bisa; santri otomatis terdaftar penerima.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}", [
            'nominal' => 50000, 'tahun_ajaran' => '2025/2026', 'dispensasi_ids' => [$paketMi->id],
        ])->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(50000, $tagihan->nominal);
        $this->assertSame([$paketMi->id], $tagihan->dispensasi_ids);
    }

    /** Popover tab Ubah memilih paket dari crosstab, jadi sel tagihan wajib
     *  membawa `jenjang` (lembaga penagih) — dasar penyaringan paket di klien. */
    public function test_crosstab_sel_membawa_jenjang_tagihan(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Sel');
        Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 100000,
        ]);

        $res = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?tahun_ajaran=2025/2026')
            ->assertStatus(200);
        $sel = $res->json('baris.0.sel');
        $pertama = reset($sel);
        $this->assertSame('MI', $pertama['jenjang']);
    }

    /** Lingkup jenjang ikut dijaga izin lembaga: admin MTS tak boleh membuat
     *  paket berlingkup MI. Dipakai MTS (bukan MD) karena pasangan MI↔MD
     *  sengaja saling boleh (lihat `User::canAccessLembaga`). */
    public function test_lingkup_jenjang_paket_dijaga_izin_lembaga(): void
    {
        DB::table('lembaga')->insert(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        $jenisMts = JenisTagihan::create(['nama' => 'SPP MTS', 'tipe' => 'bulanan', 'jenjang' => 'MTS']);
        $jenisMi = JenisTagihan::create(['nama' => 'SPP MI', 'tipe' => 'bulanan', 'jenjang' => 'MI']);
        $adminMts = User::create(['name' => 'Admin MTS', 'email' => 'admin_mts@example.com', 'phone' => '081234567891', 'password' => 'password']);
        $adminMts->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMts->id, 'jenjang' => 'MTS', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($adminMts)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Paket MTS', 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MTS',
            'aturan' => [['jenis_id' => $jenisMts->id, 'tipe' => 'persen', 'nilai' => 10]],
        ])->assertStatus(201);

        // Jenis MI dipakai supaya aturan tetap SELARAS dengan lingkup paketnya
        // — yang menolak benar-benar gerbang lembaga (403), bukan 422 aturan.
        $this->actingAs($adminMts)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Paket MI', 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI',
            'aturan' => [['jenis_id' => $jenisMi->id, 'tipe' => 'persen', 'nilai' => 10]],
        ])->assertStatus(403);
    }
}
