<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class HapusLembagaTest extends TestCase
{
    use RefreshDatabase;

    private User $super;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->super = User::create(['name' => 'Super', 'email' => 'hapus-lembaga@example.com', 'password' => 'password']);
        $this->super->assignRole('super_admin');
        Lembaga::create(['jenjang' => 'MI', 'nama' => 'Madrasah Ibtidaiyah', 'is_active' => true]);
        Lembaga::create(['jenjang' => 'MD', 'nama' => 'Madrasah Diniyah', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2025/2026', 'is_aktif' => true]);
    }

    public function test_lembaga_kosong_boleh_dihapus_tanpa_mengubah_data_lembaga_lain_dan_referensi_global(): void
    {
        DB::table('ref_agama')->insert([
            ['jenjang' => 'MD', 'nama' => 'Islam', 'is_active' => true],
            ['jenjang' => null, 'nama' => 'Referensi global', 'is_active' => false],
        ]);
        $sebelum = $this->snapshotData();

        $this->actingAs($this->super, 'sanctum')->deleteJson('/api/admin/lembaga/MI')->assertOk();

        $sebelum['lembaga'] = array_values(array_filter(
            $sebelum['lembaga'],
            fn (array $row): bool => $row['jenjang'] !== 'MI',
        ));
        $this->assertSame($sebelum, $this->snapshotData());
        $this->assertDatabaseMissing('lembaga', ['jenjang' => 'MI']);
    }

    public function test_kamus_referensi_nullable_tetap_menghalangi_hapus_dan_tidak_dijadikan_global(): void
    {
        DB::table('ref_agama')->insert(['jenjang' => 'MI', 'nama' => 'Referensi khusus', 'is_active' => false]);

        $this->assertDitolakTanpaMutasi('MI', 'kamus referensi');
        $this->assertDatabaseHas('ref_agama', ['jenjang' => 'MI', 'nama' => 'Referensi khusus', 'is_active' => false]);
        $this->assertDatabaseMissing('ref_agama', ['jenjang' => null, 'nama' => 'Referensi khusus']);
    }

    public function test_lembaga_baru_dengan_kamus_bawaan_juga_tidak_boleh_dihapus(): void
    {
        DB::table('ref_agama')->insert(['jenjang' => 'MI', 'nama' => 'Islam', 'is_active' => true]);
        $this->actingAs($this->super, 'sanctum')->postJson('/api/admin/lembaga', [
            'jenjang' => 'MTS', 'nama' => 'Madrasah Tsanawiyah',
        ])->assertCreated();
        $this->assertGreaterThan(0, DB::table('ref_agama')->where('jenjang', 'MTS')->count());

        $this->assertDitolakTanpaMutasi('MTS', 'kamus referensi');
    }

    public function test_pivot_akses_pengguna_menghalangi_hapus_tanpa_mencabut_akses(): void
    {
        $admin = $this->adminMi();

        $this->assertDitolakTanpaMutasi('MI', 'akses pengguna');
        $this->assertDatabaseHas('user_lembaga', ['user_id' => $admin->id, 'jenjang' => 'MI']);
    }

    public function test_kelas_dan_riwayat_belajar_tidak_terhapus_secara_cascade(): void
    {
        $kelasId = DB::table('kelas')->insertGetId([
            'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'nama_kelas' => '1A',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('riwayat_belajar')->insert([
            'santri_id' => $this->santri()->id,
            'kelas_id' => $kelasId,
            'jenjang' => 'MI',
            'tahun_ajaran' => '2025/2026',
            'semester' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->assertDitolakTanpaMutasi('MI', 'kelas');
    }

    #[DataProvider('dependensiKeuangan')]
    public function test_data_keuangan_menghalangi_hapus_tanpa_mengubah_nominal_dan_pembayaran(string $tabel): void
    {
        $jenisId = DB::table('jenis_tagihan')->insertGetId([
            'jenjang' => $tabel === 'jenis_tagihan' ? 'MI' : null,
            'nama' => 'SPP', 'tipe' => 'bulanan', 'is_active' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        if ($tabel !== 'jenis_tagihan') {
            $data = [
                'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenisId,
                'nominal' => 100000, 'created_at' => now(), 'updated_at' => now(),
            ];
            if ($tabel === 'tagihan') {
                $data += [
                    'santri_id' => $this->santri()->id, 'periode' => '2025-07',
                    'terbayar' => 25000, 'potongan' => 10000, 'status' => 'sebagian',
                ];
            }
            $id = DB::table($tabel)->insertGetId($data);
            if ($tabel === 'tagihan') {
                $transaksiId = DB::table('transaksi_pembayaran')->insertGetId([
                    'no_kwitansi' => 'KW-LEMBAGA-001', 'total' => 25000,
                    'diterima_oleh' => $this->super->id,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('pembayaran')->insert([
                    'tagihan_id' => $id, 'transaksi_id' => $transaksiId, 'jumlah' => 25000,
                    'status' => 'aktif', 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }

        $this->assertDitolakTanpaMutasi('MI', 'tagihan');
    }

    public static function dependensiKeuangan(): array
    {
        return [
            'jenis nonaktif' => ['jenis_tagihan'],
            'tarif dengan jenis global' => ['tarif_tagihan'],
            'tagihan dengan pembayaran' => ['tagihan'],
        ];
    }

    public function test_grup_santri_custom_non_fk_tetap_menghalangi_hapus(): void
    {
        DB::table('grup_santri_custom')->insert([
            'nama' => 'Kelompok santri lama', 'jenjang' => 'MI', 'is_active' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->assertDitolakTanpaMutasi('MI', 'grup santri');
    }

    public function test_metadata_dokumen_nullable_tidak_kehilangan_konteks_lembaga(): void
    {
        DB::table('dokumen_santri')->insert([
            'santri_id' => $this->santri()->id, 'lembaga' => 'MI',
            'nama_file' => 'dokumen-santri.pdf', 'penyimpanan' => 'server', 'is_active' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->assertDitolakTanpaMutasi('MI', 'dokumen santri');
        $this->assertDatabaseMissing('dokumen_santri', ['lembaga' => null, 'nama_file' => 'dokumen-santri.pdf']);
    }

    public function test_riwayat_alumni_dengan_kolom_lembaga_lulus_juga_dilindungi(): void
    {
        DB::table('alumni')->insert([
            'santri_id' => $this->santri()->id, 'lembaga_lulus' => 'MI', 'tahun_ajaran_lulus' => '2025/2026',
            'nomor_ijazah' => 'IJAZAH-001', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->assertDitolakTanpaMutasi('MI', 'alumni');
    }

    public function test_admin_mi_tidak_boleh_menghapus_lembaga_di_luar_pasangan(): void
    {
        Lembaga::create(['jenjang' => 'MTS', 'nama' => 'Madrasah Tsanawiyah', 'is_active' => true]);
        $admin = $this->adminMi();
        $admin->givePermissionTo('lembaga.hapus');
        $sebelum = $this->snapshotData();

        $this->actingAs($admin, 'sanctum')->deleteJson('/api/admin/lembaga/MTS')->assertForbidden();

        $this->assertSame($sebelum, $this->snapshotData());
    }

    public function test_reference_teks_yang_masuk_setelah_precheck_membatalkan_delete(): void
    {
        $sisip = false;
        DB::connection()->beforeExecuting(function (string $query) use (&$sisip): void {
            if (! $sisip && str_starts_with(strtolower($query), 'delete from "lembaga"')) {
                $sisip = true;
                DB::table('grup_santri_custom')->insert(['nama' => 'Reference baru', 'jenjang' => 'MI']);
            }
        });
        $this->assertDitolakTanpaMutasi('MI', 'grup santri');
        $this->assertTrue($sisip);
    }

    private function assertDitolakTanpaMutasi(string $jenjang, string $kategori): void
    {
        $sebelum = $this->snapshotData();
        $response = $this->actingAs($this->super, 'sanctum')->deleteJson('/api/admin/lembaga/'.$jenjang);

        $response->assertStatus(422);
        $this->assertStringContainsString($kategori, strtolower($response->json('message')));
        $this->assertSame($sebelum, $this->snapshotData());
    }

    private function adminMi(): User
    {
        $admin = User::create(['name' => 'Admin MI', 'email' => 'admin-hapus-lembaga@example.com', 'password' => 'password']);
        $admin->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $admin->id, 'jenjang' => 'MI', 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $admin;
    }

    private function santri(): Santri
    {
        return Santri::create(['nama_lengkap' => 'Santri Riwayat Lembaga', 'jk' => 'L']);
    }

    private function snapshotData(): array
    {
        $tabel = [
            'lembaga', 'tahun_ajaran', 'user_lembaga', 'kelas', 'riwayat_belajar', 'santri',
            'jenis_tagihan', 'tarif_tagihan', 'tagihan', 'transaksi_pembayaran', 'pembayaran',
            'grup_santri_custom', 'dokumen_santri', 'alumni',
        ];
        foreach (Schema::getTables() as $skema) {
            if (str_starts_with($skema['name'], 'ref_')) {
                $tabel[] = $skema['name'];
            }
        }
        $snapshot = [];
        foreach ($tabel as $nama) {
            $kunci = match ($nama) {
                'lembaga' => 'jenjang',
                'tahun_ajaran' => 'nama',
                default => 'id',
            };
            $snapshot[$nama] = DB::table($nama)->orderBy($kunci)->get()
                ->map(fn (object $row): array => (array) $row)->all();
        }

        return $snapshot;
    }
}
