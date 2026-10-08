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
            ->assertJsonPath('sifat', 'tetap')
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

    public function test_generate_sementara_hanya_bila_dicentang_dan_hanya_penerima(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Prestasi');
        $biasa = $this->santriDenganRiwayat('Santri Biasa');

        $tetap = $this->paket($jenis, 'Anak Pegawai', 'persen', 50, 'tetap', $santri);
        $sementara = $this->paket($jenis, 'Prestasi', 'bebas', 0, 'sementara', $santri);

        $payload = [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id], ['santri_id' => $biasa->id]],
        ];

        // Tanpa centang: penerima tetap dapat 50% → 50.000; bukan penerima utuh.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', $payload)
            ->assertStatus(200)->assertJson(['dibuat' => 2]);
        $tagihan = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame(50000, $tagihan->nominal);
        $this->assertSame([$tetap->id], $tagihan->dispensasi_ids);
        $this->assertSame(100000, Tagihan::where('santri_id', $biasa->id)->firstOrFail()->nominal);

        // Centang sementara: penerima bebas → 0; bukan penerima TETAP utuh
        // (generate tak mendaftarkan penerima baru).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate',
            $payload + ['dispensasi_sementara_ids' => [$sementara->id]])->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(0, $tagihan->nominal);
        $this->assertSame(100000, $tagihan->potongan);
        $this->assertSame([$tetap->id, $sementara->id], $tagihan->dispensasi_ids);
        $biasaTagihan = Tagihan::where('santri_id', $biasa->id)->firstOrFail();
        $this->assertSame(100000, $biasaTagihan->nominal);
        $this->assertNull($biasaTagihan->dispensasi_ids);
        $this->assertDatabaseMissing('santri_dispensasi', ['dispensasi_id' => $sementara->id, 'santri_id' => $biasa->id]);

        // Paket tetap yang dicentang sebagai sementara → 422.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate',
            $payload + ['dispensasi_sementara_ids' => [$tetap->id]])->assertStatus(422);
    }

    public function test_generate_kuota_membatasi_n_bulan_pertama(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Kuota');
        $d = $this->paket($jenis, 'Prestasi', 'bebas', 0, 'sementara', $santri);
        $d->update(['kuota_bulan' => 2]);

        $payload = [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id,
            'periode' => '2025-07', 'periode_sampai' => '2025-09', 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ];
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate',
            $payload + ['dispensasi_sementara_ids' => [$d->id]])
            ->assertStatus(200)->assertJson(['dibuat' => 3]);

        $per = fn (string $p) => Tagihan::where('santri_id', $santri->id)->where('periode', $p)->firstOrFail();
        $this->assertSame(0, $per('2025-07')->nominal);
        $this->assertSame([$d->id], $per('2025-07')->dispensasi_ids);
        $this->assertSame(0, $per('2025-08')->nominal);
        $this->assertSame([$d->id], $per('2025-08')->dispensasi_ids);
        $this->assertSame(100000, $per('2025-09')->nominal);
        $this->assertNull($per('2025-09')->dispensasi_ids);

        // Generate ulang idempoten: yang menempel bertahan, yang penuh tetap penuh.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate',
            $payload + ['dispensasi_sementara_ids' => [$d->id]])
            ->assertStatus(200)->assertJson(['dibuat' => 0, 'diperbarui' => 3, 'dilewati' => 0]);
        $this->assertSame(0, $per('2025-07')->nominal);
        $this->assertSame([$d->id], $per('2025-08')->dispensasi_ids);
        $this->assertSame(100000, $per('2025-09')->nominal);
    }

    public function test_ubah_menolak_pasang_baru_bila_kuota_habis(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Kuota Ubah');
        $d = $this->paket($jenis, 'Prestasi', 'persen', 50, 'sementara', $santri);
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
        $d = $this->paket($jenis, 'Prestasi', 'bebas', 0, 'sementara', $santri);
        $d->update(['kuota_bulan' => 6]);

        $t1 = $this->tagihanManual($santri, $jenis);
        $t1->update(['nominal' => 0, 'potongan' => 100000, 'dispensasi_ids' => [$d->id]]);

        $this->actingAs($admin)
            ->getJson("/api/admin/keuangan/dispensasi/kuota-pakai?santri_ids[]={$santri->id}")
            ->assertStatus(200)->assertJsonPath("{$santri->id}.{$d->id}", 1);
        $this->actingAs($admin)->getJson('/api/admin/keuangan/dispensasi/kuota-pakai')
            ->assertStatus(200)->assertExactJson([]);
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

    private function tagihanManual(Santri $santri, JenisTagihan $jenis, int $nominal = 100000): Tagihan
    {
        return Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => $nominal,
        ]);
    }

    private function paket(JenisTagihan $jenis, string $nama, string $tipe, int $nilai, string $sifat, Santri ...$penerima): Dispensasi
    {
        $d = Dispensasi::create(['nama' => $nama, 'tahun_ajaran' => '2025/2026', 'sifat' => $sifat]);
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
        $d = $this->paket($jenis, 'Prestasi', 'persen', 50, 'tetap', $santri);

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
        $d = $this->paket($jenis, 'Khusus', 'persen', 50, 'tetap', $asing);

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
        $d2 = $this->paket($lainJenis, 'ASAS Saja', 'persen', 50, 'tetap', $santri);
        $this->actingAs($admin)->putJson("/api/admin/keuangan/tagihan/{$tagihan->id}",
            $payload + ['dispensasi_ids' => [$d2->id]])->assertStatus(422);

        // Nonaktif.
        $d3 = $this->paket($jenis, 'Mati', 'persen', 50, 'tetap', $santri);
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
        $d = $this->paket($jenis, 'Setengah', 'persen', 50, 'tetap', $santri);

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
}
