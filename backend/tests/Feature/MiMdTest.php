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
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Tsanawiyah', 'kode' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $taMi = TahunAjaran::create([
            'lembaga_id' => $mi->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMd = TahunAjaran::create([
            'lembaga_id' => $md->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        return compact('root', 'mi', 'md', 'mts', 'taMi', 'taMd');
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $u = User::create([
            'name' => ucfirst($role).' '.uniqid(),
            'email' => 'mimd_'.uniqid().'@example.com',
            'phone' => '08'.str_pad((string) random_int(9000000000, 9299999999), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'lembaga_id' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function santriDengan(array $f, string $nama, ?int $lembagaMiMd, ?string $kelasNama = null, ?int $taId = null): Santri
    {
        $s = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        if ($lembagaMiMd !== null) {
            LembagaSantri::create(['santri_id' => $s->id, 'lembaga_id' => $lembagaMiMd, 'is_active' => true]);
        }

        return $s;
    }

    protected function tempatkan(Santri $s, int $lembagaId, int $taId, ?string $kelasNama): void
    {
        $kelasId = null;
        if ($kelasNama !== null) {
            $kelasId = Kelas::firstOrCreate(
                ['lembaga_id' => $lembagaId, 'tahun_ajaran_id' => $taId, 'nama_kelas' => $kelasNama],
                ['tingkat' => '1'],
            )->id;
        }
        RiwayatBelajar::create([
            'santri_id' => $s->id, 'lembaga_id' => $lembagaId, 'tahun_ajaran_id' => $taId,
            'kelas_id' => $kelasId, 'semester' => '1', 'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif', 'is_aktif' => true,
        ]);
    }

    public function test_komposisi_tiga_tabel(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id, $f['md']->id]);

        // MI saja.
        $miSaja = $this->santriDengan($f, 'MI Saja', $f['mi']->id);
        $this->tempatkan($miSaja, $f['mi']->id, $f['taMi']->id, '1A');
        // MD saja (sekolah formal luar pesantren).
        $mdSaja = $this->santriDengan($f, 'MD Saja', $f['md']->id);
        $this->tempatkan($mdSaja, $f['md']->id, $f['taMd']->id, '1A');
        // Ganda selaras (id beda, nama sama → TIDAK terdaftar beda).
        $selaras = Santri::create(['nama_lengkap' => 'Selaras', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $selaras->id, 'lembaga_id' => $f['mi']->id, 'is_active' => true]);
        LembagaSantri::create(['santri_id' => $selaras->id, 'lembaga_id' => $f['md']->id, 'is_active' => true]);
        $this->tempatkan($selaras, $f['mi']->id, $f['taMi']->id, '1A');
        $this->tempatkan($selaras, $f['md']->id, $f['taMd']->id, '1a'); // case-insensitive sama
        // Ganda beda.
        $beda = Santri::create(['nama_lengkap' => 'Beda Kelas', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $beda->id, 'lembaga_id' => $f['mi']->id, 'is_active' => true]);
        LembagaSantri::create(['santri_id' => $beda->id, 'lembaga_id' => $f['md']->id, 'is_active' => true]);
        $this->tempatkan($beda, $f['mi']->id, $f['taMi']->id, '1A');
        $this->tempatkan($beda, $f['md']->id, $f['taMd']->id, '1B');

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/mi-md')->assertStatus(200);

        $this->assertSame(['MI Saja'], array_column($res->json('mi_only'), 'nama'));
        $namaMd = array_column($res->json('md_semua'), 'nama');
        sort($namaMd);
        $this->assertSame(['Beda Kelas', 'MD Saja', 'Selaras'], $namaMd);
        // Flag juga_mi: hanya MD Saja yang false.
        $flags = collect($res->json('md_semua'))->pluck('juga_mi', 'nama')->all();
        $this->assertFalse($flags['MD Saja']);
        $this->assertTrue($flags['Selaras']);
        $this->assertSame(['Beda Kelas'], array_column($res->json('beda_kelas'), 'nama'));
        $baris = $res->json('beda_kelas')[0];
        $this->assertSame('1A', $baris['kelas_mi']);
        $this->assertSame('1B', $baris['kelas_md']);
    }

    public function test_pengecualian_pasangan_vs_mts(): void
    {
        $f = $this->baseFixture();
        $s = Santri::create(['nama_lengkap' => 'Ganda', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'lembaga_id' => $f['mi']->id, 'is_active' => true]);
        LembagaSantri::create(['santri_id' => $s->id, 'lembaga_id' => $f['md']->id, 'is_active' => true]);

        // Admin MI saja melihat kedua sisi.
        $resMi = $this->actingAs($this->makeUser('admin', [$f['mi']->id]), 'sanctum')
            ->getJson('/api/admin/mi-md')->assertStatus(200);
        $this->assertCount(1, $resMi->json('md_semua'));

        // Admin MTS saja: ketiga tabel kosong.
        $resMts = $this->actingAs($this->makeUser('admin', [$f['mts']->id]), 'sanctum')
            ->getJson('/api/admin/mi-md')->assertStatus(200);
        $this->assertSame([], $resMts->json('mi_only'));
        $this->assertSame([], $resMts->json('md_semua'));
        $this->assertSame([], $resMts->json('beda_kelas'));
    }

    public function test_samakan_dua_arah_dan_gagal_jelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id, $f['md']->id]);

        $s = Santri::create(['nama_lengkap' => 'Beda', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'lembaga_id' => $f['mi']->id, 'is_active' => true]);
        LembagaSantri::create(['santri_id' => $s->id, 'lembaga_id' => $f['md']->id, 'is_active' => true]);
        $this->tempatkan($s, $f['mi']->id, $f['taMi']->id, '1A');
        $this->tempatkan($s, $f['md']->id, $f['taMd']->id, '1B');
        // Kelas senama tersedia di MD.
        Kelas::create(['lembaga_id' => $f['md']->id, 'tahun_ajaran_id' => $f['taMd']->id, 'nama_kelas' => '1A', 'tingkat' => '1']);

        // Samakan dengan MI: MD 1B → 1A.
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $s->id, 'arah' => 'ke_md']],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res->json('berhasil'));
        $this->assertSame('1A', RiwayatBelajar::where('santri_id', $s->id)->where('lembaga_id', $f['md']->id)->firstOrFail()->kelas->nama_kelas);

        // Arah sebaliknya tanpa kelas senama di MI → gagal jelas.
        $mdBaru = Kelas::create(['lembaga_id' => $f['md']->id, 'tahun_ajaran_id' => $f['taMd']->id, 'nama_kelas' => '1C', 'tingkat' => '1']);
        RiwayatBelajar::where('santri_id', $s->id)->where('lembaga_id', $f['md']->id)->update(['kelas_id' => $mdBaru->id]);
        $res3 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $s->id, 'arah' => 'ke_mi']],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $res3->json('berhasil'));
        $this->assertCount(1, $res3->json('gagal'));
    }
}
