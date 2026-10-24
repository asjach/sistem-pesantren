<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class HapusTahunAjaranTest extends TestCase
{
    use RefreshDatabase;

    private User $super;

    private TahunAjaran $tahunAjaran;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->super = User::create(['name' => 'Super', 'email' => 'hapus-ta@example.com', 'password' => 'password']);
        $this->super->assignRole('super_admin');
        $this->tahunAjaran = TahunAjaran::create(['nama' => '2025/2026', 'is_aktif' => false]);
        $this->lembaga('MI');
    }

    public function test_tahun_ajaran_aktif_tetap_ditolak_tanpa_mutasi(): void
    {
        $this->tahunAjaran->update(['is_aktif' => true]);
        $sebelum = $this->snapshotData();

        $response = $this->actingAs($this->super, 'sanctum')
            ->deleteJson('/api/admin/tahun-ajaran', ['nama' => $this->tahunAjaran->nama]);

        $response->assertStatus(422);
        $this->assertStringContainsString('aktif', strtolower($response->json('message')));
        $this->assertSame($sebelum, $this->snapshotData());
    }

    public function test_tahun_ajaran_kosong_boleh_dihapus_dan_pivot_visibilitas_ikut_dibersihkan(): void
    {
        $lain = TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);
        $this->pivotVisibilitas($this->tahunAjaran->nama);
        $this->pivotVisibilitas($lain->nama);
        $pivotLain = DB::table('lembaga_tahun_ajaran')->where('tahun_ajaran', $lain->nama)->first();

        $this->actingAs($this->super, 'sanctum')
            ->deleteJson('/api/admin/tahun-ajaran', ['nama' => $this->tahunAjaran->nama])
            ->assertOk();

        $this->assertDatabaseMissing('tahun_ajaran', ['nama' => $this->tahunAjaran->nama]);
        $this->assertDatabaseMissing('lembaga_tahun_ajaran', ['tahun_ajaran' => $this->tahunAjaran->nama]);
        $this->assertDatabaseHas('tahun_ajaran', ['nama' => $lain->nama, 'is_aktif' => true]);
        $this->assertEquals($pivotLain, DB::table('lembaga_tahun_ajaran')->where('tahun_ajaran', $lain->nama)->first());
        $this->assertDatabaseHas('lembaga', ['jenjang' => 'MI']);
    }

    public function test_kelas_menghalangi_hapus_meski_belum_memiliki_riwayat_belajar(): void
    {
        $this->kelas('MI');

        $this->assertDitolakTanpaMutasi('kelas');
    }

    public function test_riwayat_belajar_dan_identitas_santri_tetap_utuh_setelah_hapus_ditolak(): void
    {
        $santri = $this->santri();
        DB::table('riwayat_belajar')->insert([
            'santri_id' => $santri->id,
            'tahun_ajaran' => $this->tahunAjaran->nama,
            'jenjang' => 'MI',
            'semester' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertDitolakTanpaMutasi('riwayat belajar');
    }

    public function test_dependensi_lembaga_lain_tetap_menghalangi_hapus_meski_filter_memilih_mi(): void
    {
        $this->lembaga('MD');
        $this->kelas('MD');

        $this->assertDitolakTanpaMutasi('kelas', ['jenjang' => 'MI']);
    }

    #[DataProvider('referensiTanpaForeignKey')]
    public function test_referensi_tanpa_foreign_key_tahun_ajaran_juga_menghalangi_hapus(string $tabel, string $kategori): void
    {
        $waktu = now();
        if ($tabel === 'grup_santri_custom') {
            DB::table($tabel)->insert([
                'nama' => 'Peserta kegiatan lama',
                'jenjang' => 'MI',
                'tahun_ajaran' => $this->tahunAjaran->nama,
                'created_at' => $waktu,
                'updated_at' => $waktu,
            ]);
        } else {
            $jenisId = $this->jenisTagihan();
            $data = [
                'jenjang' => 'MI',
                'tahun_ajaran' => $this->tahunAjaran->nama,
                'jenis_id' => $jenisId,
                'nominal' => 100000,
                'created_at' => $waktu,
                'updated_at' => $waktu,
            ];
            if ($tabel === 'tagihan') {
                $data['santri_id'] = $this->santri()->id;
                $data['periode'] = '2025-07';
                $data['terbayar'] = 25000;
                $data['status'] = 'sebagian';
            }
            DB::table($tabel)->insert($data);
        }

        $this->assertDitolakTanpaMutasi($kategori);
    }

    public static function referensiTanpaForeignKey(): array
    {
        return [
            'tarif' => ['tarif_tagihan', 'tarif'],
            'tagihan' => ['tagihan', 'tagihan'],
            'grup santri custom' => ['grup_santri_custom', 'grup santri'],
        ];
    }

    public function test_tahun_penerimaan_keanggotaan_tetap_dilindungi_meski_tanpa_riwayat_akademik(): void
    {
        DB::table('lembaga_santri')->insert([
            'santri_id' => $this->santri()->id,
            'jenjang' => 'MI',
            'tahaj_masuk' => $this->tahunAjaran->nama,
            'is_active_lembaga' => 'Tidak',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertDitolakTanpaMutasi('keanggotaan');
    }

    public function test_periode_tagihan_non_bulanan_masih_menjadi_referensi_tahun_lama(): void
    {
        DB::table('tagihan')->insert([
            'santri_id' => $this->santri()->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
            'jenis_id' => $this->jenisTagihan(), 'periode' => $this->tahunAjaran->nama, 'nominal' => 100000,
        ]);
        $this->assertDitolakTanpaMutasi('tagihan');
    }

    public function test_reference_teks_yang_masuk_setelah_precheck_membatalkan_delete(): void
    {
        $sisip = false;
        DB::connection()->beforeExecuting(function (string $query) use (&$sisip): void {
            if (! $sisip && str_starts_with(strtolower($query), 'delete from "tahun_ajaran"')) {
                $sisip = true;
                DB::table('grup_santri_custom')->insert(['nama' => 'Reference baru', 'tahun_ajaran' => $this->tahunAjaran->nama]);
            }
        });
        $this->assertDitolakTanpaMutasi('grup santri');
        $this->assertTrue($sisip);
    }

    public function test_referensi_tahun_ajaran_lain_dan_jenis_tagihan_tidak_menghalangi_tahun_kosong(): void
    {
        $lain = TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => false]);
        DB::table('tarif_tagihan')->insert([
            'jenjang' => 'MI',
            'tahun_ajaran' => $lain->nama,
            'jenis_id' => $this->jenisTagihan(),
            'nominal' => 100000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $sebelum = $this->snapshotData();

        $this->actingAs($this->super, 'sanctum')
            ->deleteJson('/api/admin/tahun-ajaran', ['nama' => $this->tahunAjaran->nama])
            ->assertOk();

        $sesudah = $this->snapshotData();
        $sebelum['tahun_ajaran'] = array_values(array_filter(
            $sebelum['tahun_ajaran'],
            fn (array $row): bool => $row['nama'] !== $this->tahunAjaran->nama,
        ));
        $this->assertSame($sebelum, $sesudah);
    }

    public function test_admin_lembaga_tidak_boleh_menghapus_tahun_ajaran_global(): void
    {
        $admin = User::create(['name' => 'Admin', 'email' => 'admin-hapus-ta@example.com', 'password' => 'password']);
        $admin->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $admin->id,
            'jenjang' => 'MI',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $sebelum = $this->snapshotData();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson('/api/admin/tahun-ajaran', ['nama' => $this->tahunAjaran->nama])
            ->assertForbidden();

        $this->assertSame($sebelum, $this->snapshotData());
    }

    private function assertDitolakTanpaMutasi(string $kategori, array $filter = []): void
    {
        $sebelum = $this->snapshotData();
        $response = $this->actingAs($this->super, 'sanctum')
            ->deleteJson('/api/admin/tahun-ajaran', ['nama' => $this->tahunAjaran->nama, ...$filter]);

        $response->assertStatus(422);
        $this->assertStringContainsString($kategori, strtolower($response->json('message')));
        $this->assertSame($sebelum, $this->snapshotData());
    }

    private function lembaga(string $jenjang): Lembaga
    {
        return Lembaga::create(['nama' => 'Lembaga '.$jenjang, 'jenjang' => $jenjang, 'is_active' => true]);
    }

    private function kelas(string $jenjang): int
    {
        return DB::table('kelas')->insertGetId([
            'jenjang' => $jenjang,
            'tahun_ajaran' => $this->tahunAjaran->nama,
            'nama_kelas' => '1A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function santri(): Santri
    {
        return Santri::create(['nama_lengkap' => 'Santri Riwayat', 'jk' => 'L']);
    }

    private function jenisTagihan(): int
    {
        return DB::table('jenis_tagihan')->insertGetId([
            'nama' => 'SPP', 'jenjang' => 'MI', 'tipe' => 'bulanan',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function pivotVisibilitas(string $nama): void
    {
        DB::table('lembaga_tahun_ajaran')->insert([
            'jenjang' => 'MI', 'tahun_ajaran' => $nama, 'is_active' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function snapshotData(): array
    {
        $snapshot = [];
        foreach ([
            'tahun_ajaran', 'lembaga_tahun_ajaran', 'kelas', 'riwayat_belajar',
            'santri', 'lembaga_santri', 'tarif_tagihan', 'tagihan', 'jenis_tagihan', 'grup_santri_custom',
        ] as $tabel) {
            $snapshot[$tabel] = DB::table($tabel)->orderBy($tabel === 'tahun_ajaran' ? 'nama' : 'id')
                ->get()->map(fn (object $row): array => (array) $row)->all();
        }

        return $snapshot;
    }
}
