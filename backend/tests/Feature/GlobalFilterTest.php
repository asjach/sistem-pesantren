<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\DokumenWajibLembaga;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\LembagaTahunAjaran;
use App\Models\MutasiKeluar;
use App\Models\PsbCalonLembaga;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKegiatan;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Services\RefService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class GlobalFilterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function fixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'MI',
            'jenjang' => 'MI',
            'is_seleksi' => false,
            'kelompok_psb' => 'combo_mi_md',
            'is_active' => true,
        ]);
        $md = Lembaga::create([
            'nama' => 'MD',
            'jenjang' => 'MD',
            'is_seleksi' => false,
            'kelompok_psb' => 'combo_mi_md',
            'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'nama' => 'MTS',
            'jenjang' => 'MTS',
            'is_seleksi' => false,
            'kelompok_psb' => 'eksklusif',
            'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01',
            'tanggal_selesai' => '2027-06-30',
            'is_aktif' => true,
        ]);
        $taLama = TahunAjaran::create([
            'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01',
            'tanggal_selesai' => '2026-06-30',
            'is_aktif' => false,
        ]);

        return compact('mi', 'md', 'mts', 'ta', 'taLama');
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $user = User::create([
            'name' => $role.' '.uniqid(),
            'email' => uniqid().'@example.com',
            'phone' => '08'.random_int(1000000000, 9999999999),
            'password' => 'password',
        ]);
        $user->assignRole($role);
        foreach ($lembagaIds as $lembagaId) {
            DB::table('user_lembaga')->insert([
                'user_id' => $user->id,
                'jenjang' => $lembagaId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $user;
    }

    protected function makeKelas(Lembaga $lembaga, string $tahunAjaran, string $nama, string $tingkat = '1'): Kelas
    {
        return Kelas::create([
            'jenjang' => $lembaga->jenjang,
            'tahun_ajaran' => $tahunAjaran,
            'nama_kelas' => $nama,
            'tingkat' => $tingkat,
        ]);
    }

    protected function makeSantri(
        string $nama,
        Lembaga $lembaga,
        string $tahunAjaran,
        string $semester,
        ?Kelas $kelas = null,
    ): Santri {
        $santri = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id,
            'jenjang' => $lembaga->jenjang,
            'is_active_lembaga' => 'Ya',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id,
            'jenjang' => $lembaga->jenjang,
            'tahun_ajaran' => $tahunAjaran,
            'semester' => $semester,
            'kelas_id' => $kelas?->id,
            'tingkat' => $kelas?->tingkat,
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya',
        ]);

        return $santri;
    }

    public function test_multi_value_or_and_cross_filter_and(): void
    {
        $f = $this->fixture();
        $miA = $this->makeKelas($f['mi'], $f['ta']->nama, 'MI-1A');
        $miB = $this->makeKelas($f['mi'], $f['ta']->nama, 'MI-1B');
        $mdA = $this->makeKelas($f['md'], $f['ta']->nama, 'MD-1A');
        $a = $this->makeSantri('A', $f['mi'], $f['ta']->nama, '1', $miA);
        $b = $this->makeSantri('B', $f['md'], $f['ta']->nama, '2', $mdA);
        $this->makeSantri('C', $f['mi'], $f['taLama']->nama, '1', $miA);
        $this->makeSantri('D', $f['mi'], $f['ta']->nama, '2', $miB);

        $query = http_build_query([
            'jenjang' => [$f['mi']->jenjang, $f['md']->jenjang],
            'tahun_ajaran' => [$f['ta']->nama],
            'semester' => ['1', '2'],
            'tingkat' => ['1'],
            'kelas_id' => [$miA->id, $mdA->id],
        ], '', '&', PHP_QUERY_RFC3986);

        $response = $this->actingAs($this->makeUser('super_admin'), 'sanctum')
            ->getJson('/api/admin/riwayat-belajar?'.$query)
            ->assertOk();

        $this->assertEqualsCanonicalizing(
            [$a->id, $b->id],
            collect($response->json('data'))->pluck('santri_id')->all()
        );

        $user = $this->makeUser('super_admin');
        $query = http_build_query([
            'jenjang' => ['MI', 'MD'],
        ], '', '&', PHP_QUERY_RFC3986);
        $santriResponse = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/santri?'.$query)
            ->assertOk();
        $this->assertCount(4, $santriResponse->json('data'));

        $kelasResponse = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/kelas?'.http_build_query([
                'jenjang' => ['MI', 'MD'],
                'tahun_ajaran' => [$f['ta']->nama],
                'tingkat' => ['1'],
            ], '', '&', PHP_QUERY_RFC3986))
            ->assertOk();
        $this->assertEqualsCanonicalizing(
            [$miA->id, $miB->id, $mdA->id],
            collect($kelasResponse->json('data'))->pluck('id')->all()
        );
    }

    public function test_legacy_scalar_and_daftar_kelas_response_shape(): void
    {
        $f = $this->fixture();
        $miA = $this->makeKelas($f['mi'], $f['ta']->nama, 'MI-1A');
        $a = $this->makeSantri('A', $f['mi'], $f['ta']->nama, '1', $miA);
        $res = $this->actingAs(
            $this->makeUser('super_admin'),
            'sanctum'
        )->getJson('/api/admin/riwayat-belajar?jenjang=MI&tahun_ajaran='.urlencode($f['ta']->nama).'&semester=1&tingkat=1&kelas_id='.$miA->id)
            ->assertOk();
        $this->assertSame([$a->id], collect($res->json('data'))->pluck('santri_id')->all());

        $res = $this->actingAs(
            $this->makeUser('super_admin'),
            'sanctum'
        )->getJson('/api/admin/akademik/daftar-kelas?jenjang=MI&tahun_ajaran='.urlencode($f['ta']->nama).'&semester=1&lintas_periode=1')
            ->assertOk();
        $this->assertSame('MI', $res->json('jenjang'));

        $res = $this->actingAs(
            $this->makeUser('super_admin'),
            'sanctum'
        )->getJson('/api/admin/akademik/daftar-kelas?'.http_build_query([
            'jenjang' => ['MI', 'MD'],
            'lintas_periode' => '1',
        ], '', '&', PHP_QUERY_RFC3986))->assertOk();
        $this->assertSame(['MI', 'MD'], $res->json('jenjang'));
    }

    public function test_referensi_multi_lembaga_dan_legacy_scalar(): void
    {
        $f = $this->fixture();
        DB::table('ref_hobi')->insert([
            ['jenjang' => 'MI', 'nama' => 'Hobi MI', 'urutan' => 1, 'is_active' => true],
            ['jenjang' => 'MD', 'nama' => 'Hobi MD', 'urutan' => 1, 'is_active' => true],
        ]);
        RefService::forget();
        $user = $this->makeUser('super_admin');

        $res = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/referensi/hobi?jenjang=MI')
            ->assertOk();
        $this->assertSame(['Hobi MI'], array_column($res->json(), 'nama'));

        $res = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/referensi/hobi?'.http_build_query([
                'jenjang' => ['MI', 'MD'],
            ], '', '&', PHP_QUERY_RFC3986))
            ->assertOk();
        $this->assertEqualsCanonicalizing(
            ['Hobi MI', 'Hobi MD'],
            array_column($res->json(), 'nama')
        );
    }

    public function test_filter_lembaga_luar_akses_ditolak(): void
    {
        $f = $this->fixture();
        $user = $this->makeUser('admin', [$f['mi']->jenjang]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/kelas?'.http_build_query([
                'jenjang' => ['MI', 'MTS'],
            ], '', '&', PHP_QUERY_RFC3986))
            ->assertForbidden();
    }

    public function test_tahun_ajaran_multi_lembaga_menjunionkan_efektif(): void
    {
        $f = $this->fixture();
        LembagaTahunAjaran::create([
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taLama']->nama,
            'is_active' => false,
        ]);
        $user = $this->makeUser('super_admin');

        $res = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/tahun-ajaran?'.http_build_query([
                'jenjang' => ['MI', 'MD'],
            ], '', '&', PHP_QUERY_RFC3986))
            ->assertOk();
        $this->assertEqualsCanonicalizing(
            [$f['ta']->nama, $f['taLama']->nama],
            array_column($res->json('data'), 'nama')
        );

        $res = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/tahun-ajaran?jenjang=MI')
            ->assertOk();
        $this->assertSame([$f['ta']->nama], array_column($res->json('data'), 'nama'));
    }

    public function test_siklus_rekap_mutasi_alumni_dan_mi_md_menerima_array(): void
    {
        $f = $this->fixture();
        $miClass = $this->makeKelas($f['mi'], $f['ta']->nama, 'MI-1A');
        $mdClass = $this->makeKelas($f['md'], $f['ta']->nama, 'MD-1A');
        $mi = $this->makeSantri('MI', $f['mi'], $f['ta']->nama, '1', $miClass);
        $md = $this->makeSantri('MD', $f['md'], $f['ta']->nama, '2', $mdClass);
        MutasiKeluar::create([
            'santri_id' => $mi->id,
            'jenjang' => $f['mi']->jenjang,
            'kelas_terakhir_id' => $miClass->id,
            'tanggal_mutasi' => '2026-07-01',
        ]);
        MutasiKeluar::create([
            'santri_id' => $md->id,
            'jenjang' => $f['md']->jenjang,
            'kelas_terakhir_id' => $mdClass->id,
            'tanggal_mutasi' => '2026-07-01',
        ]);
        Alumni::create([
            'santri_id' => $mi->id,
            'lembaga_lulus' => $f['mi']->jenjang,
            'tahun_ajaran_lulus' => $f['ta']->nama,
            'kelas_lulus_id' => $miClass->id,
            'tanggal_lulus' => '2027-06-30',
        ]);
        Alumni::create([
            'santri_id' => $md->id,
            'lembaga_lulus' => $f['md']->jenjang,
            'tahun_ajaran_lulus' => $f['ta']->nama,
            'kelas_lulus_id' => $mdClass->id,
            'tanggal_lulus' => '2027-06-30',
        ]);
        $user = $this->makeUser('super_admin');
        $query = http_build_query([
            'jenjang' => ['MI', 'MD'],
            'tahun_ajaran' => [$f['ta']->nama],
            'semester' => ['1', '2'],
            'tingkat' => ['1'],
            'kelas_id' => [$miClass->id, $mdClass->id],
        ], '', '&', PHP_QUERY_RFC3986);

        $rekap = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/akademik/rekap-santri?'.$query)
            ->assertOk();
        $this->assertSame(2, $rekap->json('total_aktif'));
        $this->assertCount(2, $rekap->json('per_kelas'));

        $mutasiQuery = http_build_query([
            'jenjang' => ['MI', 'MD'],
            'tahun_ajaran' => [$f['ta']->nama],
            'tingkat' => ['1'],
            'kelas_id' => [$miClass->id, $mdClass->id],
        ], '', '&', PHP_QUERY_RFC3986);
        $mutasi = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/mutasi-keluar?'.$mutasiQuery)
            ->assertOk();
        $this->assertCount(2, $mutasi->json('data'));

        $alumniQuery = http_build_query([
            'jenjang' => ['MI', 'MD'],
            'tahun_ajaran' => [$f['ta']->nama],
            'tahun_ajaran_lulus' => [$f['ta']->nama],
            'tingkat' => ['1'],
            'kelas_id' => [$miClass->id, $mdClass->id],
        ], '', '&', PHP_QUERY_RFC3986);
        $alumni = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/alumni?'.$alumniQuery)
            ->assertOk();
        $this->assertCount(2, $alumni->json('data'));

        $miMd = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/mi-md?'.http_build_query([
                'jenjang' => ['MI', 'MD'],
                'tahun_ajaran' => [$f['ta']->nama],
                'semester' => ['1', '2'],
            ], '', '&', PHP_QUERY_RFC3986))
            ->assertOk();
        $this->assertCount(1, $miMd->json('mi_only'));
        $this->assertCount(1, $miMd->json('md_semua'));
    }

    public function test_belum_genap_menerima_array_global(): void
    {
        $f = $this->fixture();
        $kelas = $this->makeKelas($f['mi'], $f['ta']->nama, 'MI-1A');
        $santri = $this->makeSantri('Belum Genap', $f['mi'], $f['ta']->nama, '1', $kelas);
        $user = $this->makeUser('super_admin');
        $query = http_build_query([
            'jenjang' => ['MI'],
            'tahun_ajaran' => [$f['ta']->nama],
            'tingkat' => ['1'],
            'kelas_id' => [$kelas->id],
        ], '', '&', PHP_QUERY_RFC3986);

        $res = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/riwayat-belajar/belum-genap?'.$query)
            ->assertOk();
        $this->assertSame([$santri->id], collect($res->json('data'))->pluck('santri_id')->all());
    }

    public function test_psb_antrean_dan_dokumen_wajib_menerima_multi_lembaga(): void
    {
        $f = $this->fixture();
        $kegiatan = PsbKegiatan::create([
            'tahun_ajaran' => $f['ta']->nama,
            'nama' => 'PSB',
            'is_aktif' => true,
        ]);
        $gelombang = PsbGelombang::create([
            'psb_kegiatan_id' => $kegiatan->id,
            'nomor' => 1,
            'nama' => 'Gelombang 1',
            'tgl_buka' => now()->subDay(),
            'tgl_tutup' => now()->addDay(),
        ]);
        $calonMi = PsbCalonSantri::create([
            'jenjang' => $f['mi']->jenjang,
            'gelombang_id' => $gelombang->id,
            'tahun_ajaran' => $f['ta']->nama,
            'no_pendaftaran' => 'PSB-MI',
            'nik' => '1100000000000001',
            'nama_lengkap' => 'Calon MI',
            'jk' => 'L',
            'tipe_santri' => 'non_asrama',
            'status_pendaftaran' => 'ajukan_daftar_ulang',
        ]);
        $calonMd = PsbCalonSantri::create([
            'jenjang' => $f['md']->jenjang,
            'gelombang_id' => $gelombang->id,
            'tahun_ajaran' => $f['ta']->nama,
            'no_pendaftaran' => 'PSB-MD',
            'nik' => '1100000000000002',
            'nama_lengkap' => 'Calon MD',
            'jk' => 'P',
            'tipe_santri' => 'non_asrama',
            'status_pendaftaran' => 'ajukan_daftar_ulang',
        ]);
        PsbCalonLembaga::create([
            'psb_calon_santri_id' => $calonMi->id,
            'jenjang' => $f['mi']->jenjang,
            'peran' => 'primer',
        ]);
        PsbCalonLembaga::create([
            'psb_calon_santri_id' => $calonMd->id,
            'jenjang' => $f['md']->jenjang,
            'peran' => 'primer',
        ]);
        DokumenWajibLembaga::create([
            'psb_kegiatan_id' => $kegiatan->id,
            'jenjang' => $f['mi']->jenjang,
            'jenis_dokumen_santri' => 'kk',
            'is_wajib' => true,
        ]);
        DokumenWajibLembaga::create([
            'psb_kegiatan_id' => $kegiatan->id,
            'jenjang' => $f['md']->jenjang,
            'jenis_dokumen_santri' => 'kk',
            'is_wajib' => true,
        ]);
        $user = $this->makeUser('super_admin');
        $query = http_build_query([
            'jenjang' => ['MI', 'MD'],
        ], '', '&', PHP_QUERY_RFC3986);

        $res = $this->actingAs($user, 'sanctum')
            ->getJson('/api/psb/antrean-daftar-ulang?status=ajukan_daftar_ulang&'.$query)
            ->assertOk();
        $this->assertEqualsCanonicalizing(
            [$calonMi->id, $calonMd->id],
            collect($res->json('data.data'))->pluck('id')->all()
        );

        $res = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/dokumen-wajib?psb_kegiatan_id='.$kegiatan->id.'&'.$query)
            ->assertOk();
        $this->assertCount(2, $res->json('data'));
    }

    public function test_status_awal_array_dan_status_awal_bukan(): void
    {
        $f = $this->fixture();
        $kelas = $this->makeKelas($f['mi'], $f['ta']->nama, 'MI-1A');
        $buat = function (string $nama, string $statusAwal) use ($f, $kelas): Santri {
            $santri = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
            LembagaSantri::create([
                'santri_id' => $santri->id,
                'jenjang' => $f['mi']->jenjang,
                'is_active_lembaga' => 'Ya',
            ]);
            RiwayatBelajar::create([
                'santri_id' => $santri->id,
                'jenjang' => $f['mi']->jenjang,
                'tahun_ajaran' => $f['ta']->nama,
                'semester' => '1',
                'kelas_id' => $kelas->id,
                'tingkat' => '1',
                'status_awal' => $statusAwal,
                'status_akhir' => 'aktif',
                'is_active_riwayat' => 'Ya',
            ]);

            return $santri;
        };
        $naik = $buat('Naik', 'kenaikan');
        $pindah = $buat('Pindah', 'pindahan');
        $ulang = $buat('Ulang', 'mengulang');
        $baru = $buat('Baru', 'santri_baru');
        $user = $this->makeUser('super_admin');

        $ids = fn ($res) => collect($res->json('data'))->pluck('santri_id')->all();

        // Array `status_awal[]` (daftar hasil kenaikan, halaman Kenaikan).
        $res = $this->actingAs($user, 'sanctum')->getJson('/api/admin/riwayat-belajar?'.http_build_query([
            'jenjang' => [$f['mi']->jenjang],
            'tahun_ajaran' => [$f['ta']->nama],
            'status_awal' => ['kenaikan', 'pindahan'],
        ], '', '&', PHP_QUERY_RFC3986))->assertOk();
        $this->assertEqualsCanonicalizing([$naik->id, $pindah->id], $ids($res));

        // Scalar lama tetap berlaku.
        $res = $this->actingAs($user, 'sanctum')->getJson('/api/admin/riwayat-belajar?'.http_build_query([
            'jenjang' => [$f['mi']->jenjang],
            'tahun_ajaran' => [$f['ta']->nama],
            'status_awal' => 'mengulang',
        ], '', '&', PHP_QUERY_RFC3986))->assertOk();
        $this->assertSame([$ulang->id], $ids($res));

        // `status_awal_bukan[]` = semua hasil kenaikan kecualiForamFmCkZuCkZu.
        $res = $this->actingAs($user, 'sanctum')->getJson('/api/admin/riwayat-belajar?'.http_build_query([
            'jenjang' => [$f['mi']->jenjang],
            'tahun_ajaran' => [$f['ta']->nama],
            'status_awal_bukan' => ['santri_baru'],
        ], '', '&', PHP_QUERY_RFC3986))->assertOk();
        $this->assertEqualsCanonicalizing([$naik->id, $pindah->id, $ulang->id], $ids($res));
    }
}
