<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Halaman MI-MD: MI saja, MD semua, beda kelas by-nama + samakan dua arah.
 */
class MiMdTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function baseFixture(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'jenjang' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);

        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMi = $taMd = $ta;

        return compact('root', 'mi', 'md', 'mts', 'taMi', 'taMd');
    }

    protected function makeUser(string $role, array $jenjangs = []): User
    {
        $u = User::create([
            'name' => ucfirst($role).' '.uniqid(),
            'email' => 'mimd_'.uniqid().'@example.com',
            'phone' => '08'.str_pad((string) random_int(9000000000, 9299999999), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($jenjangs as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function santriDengan(array $f, string $nama, ?string $lembagaMiMd, ?string $kelasNama = null, ?int $taId = null): Santri
    {
        $s = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        if ($lembagaMiMd !== null) {
            LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $lembagaMiMd, 'is_active_lembaga' => 'Ya']);
        }

        return $s;
    }

    protected function tempatkan(Santri $s, string $jenjang, string $ta, ?string $kelasNama): void
    {
        $kelasId = null;
        if ($kelasNama !== null) {
            $kelasId = Kelas::firstOrCreate(
                ['jenjang' => $jenjang, 'tahun_ajaran' => $ta, 'nama_kelas' => $kelasNama],
                ['tingkat' => '1'],
            )->id;
        }
        RiwayatBelajar::create([
            'santri_id' => $s->id, 'jenjang' => $jenjang, 'tahun_ajaran' => $ta,
            'kelas_id' => $kelasId, 'semester' => '1', 'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);
    }

    public function test_komposisi_tiga_tabel(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);

        $miSaja = $this->santriDengan($f, 'MI Saja', $f['mi']->jenjang);
        $this->tempatkan($miSaja, $f['mi']->jenjang, $f['taMi']->nama, '1A');

        $mdSaja = $this->santriDengan($f, 'MD Saja', $f['md']->jenjang);
        $this->tempatkan($mdSaja, $f['md']->jenjang, $f['taMd']->nama, '1A');

        $selaras = Santri::create(['nama_lengkap' => 'Selaras', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $selaras->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $selaras->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($selaras, $f['mi']->jenjang, $f['taMi']->nama, '1A');
        $this->tempatkan($selaras, $f['md']->jenjang, $f['taMd']->nama, '1a');

        $beda = Santri::create(['nama_lengkap' => 'Beda Kelas', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $beda->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $beda->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($beda, $f['mi']->jenjang, $f['taMi']->nama, '1A');
        $this->tempatkan($beda, $f['md']->jenjang, $f['taMd']->nama, '1B');

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/mi-md')->assertStatus(200);

        $this->assertSame(['MI Saja'], array_column($res->json('mi_only'), 'nama'));
        $namaMd = array_column($res->json('md_semua'), 'nama');
        sort($namaMd);
        $this->assertSame(['Beda Kelas', 'MD Saja', 'Selaras'], $namaMd);

        $flags = collect($res->json('md_semua'))->pluck('juga_mi', 'nama')->all();
        $this->assertFalse($flags['MD Saja']);
        $this->assertTrue($flags['Selaras']);
        $this->assertSame(['Beda Kelas'], array_column($res->json('beda_kelas'), 'nama'));
        $baris = $res->json('beda_kelas')[0];
        $this->assertSame('1A', $baris['kelas_mi']);
        $this->assertSame('1B', $baris['kelas_md']);
        $this->assertSame('L', $res->json('mi_only.0.jk'));
        $this->assertSame('L', $res->json('beda_kelas.0.jk'));
    }

    public function test_perbandingan_membutuhkan_kelas_aktif_di_kedua_jenjang(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);
        $santri = Santri::create(['nama_lengkap' => 'Tanpa Kelas MD', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($santri, $f['mi']->jenjang, $f['taMi']->nama, '1A');

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/mi-md')->assertStatus(200);

        $this->assertNotContains('Tanpa Kelas MD', array_column($res->json('beda_kelas'), 'nama'));
    }

    public function test_pengecualian_pasangan_vs_mts(): void
    {
        $f = $this->baseFixture();
        $s = Santri::create(['nama_lengkap' => 'Ganda', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya', 'tahaj_masuk' => $f['taMi']->nama]);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya', 'tahaj_masuk' => $f['taMd']->nama]);

        $resMi = $this->actingAs($this->makeUser('admin', [$f['mi']->jenjang]), 'sanctum')
            ->getJson('/api/admin/mi-md')->assertStatus(200);
        $this->assertCount(1, $resMi->json('md_semua'));

        $resMts = $this->actingAs($this->makeUser('admin', [$f['mts']->jenjang]), 'sanctum')
            ->getJson('/api/admin/mi-md')->assertStatus(200);
        $this->assertSame([], $resMts->json('mi_only'));
        $this->assertSame([], $resMts->json('md_semua'));
        $this->assertSame([], $resMts->json('beda_kelas'));
    }

    public function test_pengecualian_pasangan_global_timbal_balik(): void
    {
        $f = $this->baseFixture();
        $s = Santri::create(['nama_lengkap' => 'Global Ganda', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '40001', 'is_active_lembaga' => 'Ya']);
        $mdRow = LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['md']->jenjang, 'nis_lokal' => '40002', 'is_active_lembaga' => 'Ya']);

        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);
        $adminMd = $this->makeUser('admin', [$f['md']->jenjang]);
        $adminMts = $this->makeUser('admin', [$f['mts']->jenjang]);

        $res = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/lembaga-santri?per_page=50')->assertStatus(200);
        $this->assertSame(2, $res->json('total'));

        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$mdRow->id}", [
            'nis_lokal' => '40009',
        ])->assertStatus(200);
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$mdRow->id}", [
            'is_active_lembaga' => 'Tidak',
        ])->assertStatus(200);
        $this->assertSame('Tidak', $mdRow->fresh()->is_active_lembaga);

        $resMd = $this->actingAs($adminMd, 'sanctum')->getJson('/api/admin/lembaga-santri?per_page=50')->assertStatus(200);
        $this->assertSame(2, $resMd->json('total'));

        $resMts = $this->actingAs($adminMts, 'sanctum')->getJson('/api/admin/lembaga-santri?per_page=50')->assertStatus(200);
        $this->assertSame(0, $resMts->json('total'));
        $this->actingAs($adminMts, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$mdRow->id}", [
            'nis_lokal' => '40099',
        ])->assertStatus(403);
    }

    public function test_hapus_md_fisik_tanpa_arsip(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);

        $s = Santri::create(['nama_lengkap' => 'Hapus MD', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '29501', 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['md']->jenjang, 'nis_lokal' => '29501', 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($s, $f['md']->jenjang, $f['taMd']->nama, '1A');

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/hapus-md', [
            'items' => [['santri_id' => $s->id]],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res->json('berhasil'));

        $this->assertSame(0, LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->count());
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->count());
        $this->assertSame(1, LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['mi']->jenjang)->count());

        $murni = Santri::create(['nama_lengkap' => 'Murni MD', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $murni->id, 'jenjang' => $f['md']->jenjang, 'nis_lokal' => '29502', 'is_active_lembaga' => 'Ya']);
        $res2 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/hapus-md', [
            'items' => [['santri_id' => $murni->id]],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $res2->json('berhasil'));
        $this->assertCount(1, $res2->json('gagal'));
    }

    public function test_x_lalu_daftar_lagi_mereaktivasi_arsip(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);

        $s = Santri::create(['nama_lengkap' => 'Keluar Masuk', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '29001', 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['md']->jenjang, 'nis_lokal' => '29001', 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($s, $f['md']->jenjang, $f['taMd']->nama, '1A');

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$s->id}/berhenti-jenjang", [
            'jenjang' => $f['md']->jenjang,
        ])->assertStatus(200);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/daftarkan-md', [
            'items' => [['santri_id' => $s->id]],
        ])->assertStatus(200);
        $baris = LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->get();
        $this->assertCount(1, $baris);
        $this->assertSame('Ya', $baris->first()->is_active_lembaga);
        $this->assertSame('29001', $baris->first()->nis_lokal);
    }

    public function test_daftarkan_md_warisi_nis(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);
        $s = Santri::create(['nama_lengkap' => 'MI Saja', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '28001', 'is_active_lembaga' => 'Ya']);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/daftarkan-md', [
            'items' => [['santri_id' => $s->id]],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res->json('berhasil'));

        $md = LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->firstOrFail();
        $this->assertSame('28001', $md->nis_lokal);
        $this->assertSame('Ya', $md->is_active_lembaga);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/daftarkan-md', [
            'items' => [['santri_id' => $s->id]],
        ])->assertStatus(200);
        $this->assertSame(1, LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->count());

        $luar = Santri::create(['nama_lengkap' => 'Luar', 'jk' => 'L']);
        $res2 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/daftarkan-md', [
            'items' => [['santri_id' => $luar->id]],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $res2->json('berhasil'));
        $this->assertCount(1, $res2->json('gagal'));
    }

    public function test_samakan_dua_arah_dan_gagal_jelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);

        $s = Santri::create(['nama_lengkap' => 'Beda', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($s, $f['mi']->jenjang, $f['taMi']->nama, '1A');
        $this->tempatkan($s, $f['md']->jenjang, $f['taMd']->nama, '1B');

        Kelas::create(['jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '1A', 'tingkat' => '1']);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $s->id, 'arah' => 'ke_md']],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res->json('berhasil'));
        $this->assertSame('1A', RiwayatBelajar::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->firstOrFail()->kelas->nama_kelas);

        $mdBaru = Kelas::create(['jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '1C', 'tingkat' => '1']);
        RiwayatBelajar::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->update(['kelas_id' => $mdBaru->id]);
        $res3 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $s->id, 'arah' => 'ke_mi']],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $res3->json('berhasil'));
        $this->assertCount(1, $res3->json('gagal'));
    }

    public function test_samakan_hanya_anggota_aktif_kedua_jenjang(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);

        $miSaja = Santri::create(['nama_lengkap' => 'MI Saja', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $miSaja->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($miSaja, $f['mi']->jenjang, $f['taMi']->nama, '1A');
        Kelas::firstOrCreate(
            ['jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '1A'],
            ['tingkat' => '1'],
        );

        $resMi = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $miSaja->id, 'arah' => 'ke_md']],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $resMi->json('berhasil'));
        $this->assertSame('Santri harus aktif di MI dan MD.', $resMi->json('gagal.0.pesan'));
        $this->assertSame(0, LembagaSantri::where('santri_id', $miSaja->id)->where('jenjang', $f['md']->jenjang)->count());
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $miSaja->id)->where('jenjang', $f['md']->jenjang)->count());

        $mdSaja = Santri::create(['nama_lengkap' => 'MD Saja', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $mdSaja->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($mdSaja, $f['md']->jenjang, $f['taMd']->nama, '1B');
        Kelas::firstOrCreate(
            ['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama, 'nama_kelas' => '1B'],
            ['tingkat' => '1'],
        );

        $resMd = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $mdSaja->id, 'arah' => 'ke_mi']],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $resMd->json('berhasil'));
        $this->assertSame('Santri harus aktif di MI dan MD.', $resMd->json('gagal.0.pesan'));
        $this->assertSame(0, LembagaSantri::where('santri_id', $mdSaja->id)->where('jenjang', $f['mi']->jenjang)->count());
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $mdSaja->id)->where('jenjang', $f['mi']->jenjang)->count());
    }

    public function test_daftarkan_md_sepihak_mi_saja(): void
    {
        $f = $this->baseFixture();

        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);

        $s = Santri::create(['nama_lengkap' => 'MI Saja', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '28701', 'is_active_lembaga' => 'Ya']);

        $res = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/mi-md/daftarkan-md', [
            'items' => [['santri_id' => $s->id]],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res->json('berhasil'));

        $md = LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->firstOrFail();
        $this->assertSame('28701', $md->nis_lokal);

        $adminMts = $this->makeUser('admin', [$f['mts']->jenjang]);
        $s2 = Santri::create(['nama_lengkap' => 'MI Saja 2', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s2->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);
        $res2 = $this->actingAs($adminMts, 'sanctum')->postJson('/api/admin/mi-md/daftarkan-md', [
            'items' => [['santri_id' => $s2->id]],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $res2->json('berhasil'));
        $this->assertCount(1, $res2->json('gagal'));

        $res3 = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/mi-md/hapus-md', [
            'items' => [['santri_id' => $s->id]],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res3->json('berhasil'));
        $this->assertSame(0, LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->count());
    }

    public function test_samakan_membuatkan_riwayat_sisi_tujuan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);

        $s = Santri::create(['nama_lengkap' => 'Tanpa MD', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '28801', 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['md']->jenjang, 'nis_lokal' => '28801', 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($s, $f['mi']->jenjang, $f['taMi']->nama, '1A');
        Kelas::firstOrCreate(
            ['jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '1A'],
            ['tingkat' => '1'],
        );

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $s->id, 'arah' => 'ke_md']],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res->json('berhasil'));

        $md = RiwayatBelajar::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->firstOrFail();
        $this->assertSame('1A', $md->kelas->nama_kelas);
        $this->assertSame('1', $md->tingkat);

        $this->assertSame($f['taMd']->id, $md->tahun_ajaran_id);

        $s2 = Santri::create(['nama_lengkap' => 'Tanpa Kelas Senama', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s2->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $s2->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($s2, $f['md']->jenjang, $f['taMd']->nama, '9Z');
        $res2 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $s2->id, 'arah' => 'ke_mi']],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $res2->json('berhasil'));
        $this->assertCount(1, $res2->json('gagal'));
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $s2->id)->where('jenjang', $f['mi']->jenjang)->count());
    }

    public function test_filter_tahun_ajaran_sesuai_pilihan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);
        $lama = TahunAjaran::create([
            'nama' => '2005/2006',
            'tanggal_mulai' => '2005-07-01', 'tanggal_selesai' => '2006-06-30', 'is_aktif' => false,
        ]);

        $alumni = $this->santriDengan($f, 'Alumni Lama', $f['mi']->jenjang);
        $this->tempatkan($alumni, $f['mi']->jenjang, $lama->nama, '6A');

        $aktif = $this->santriDengan($f, 'Berjalan Kini', $f['mi']->jenjang);
        $this->tempatkan($aktif, $f['mi']->jenjang, $f['taMi']->nama, '1A');

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/mi-md')->assertStatus(200);
        $this->assertSame($f['taMi']->nama, $res->json('tahun_ajaran'));
        $this->assertSame(['Berjalan Kini'], array_column($res->json('mi_only'), 'nama'));

        $resLama = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/mi-md?tahun_ajaran='.$lama->nama)->assertStatus(200);
        $this->assertSame($lama->nama, $resLama->json('tahun_ajaran'));
        $this->assertSame(['Alumni Lama'], array_column($resLama->json('mi_only'), 'nama'));
    }
}
