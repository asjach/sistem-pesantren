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
        // TA global (berlaku semua lembaga).
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

        // MI saja.
        $miSaja = $this->santriDengan($f, 'MI Saja', $f['mi']->jenjang);
        $this->tempatkan($miSaja, $f['mi']->jenjang, $f['taMi']->nama, '1A');
        // MD saja (sekolah formal luar pesantren).
        $mdSaja = $this->santriDengan($f, 'MD Saja', $f['md']->jenjang);
        $this->tempatkan($mdSaja, $f['md']->jenjang, $f['taMd']->nama, '1A');
        // Ganda selaras (id beda, nama sama → TIDAK terdaftar beda).
        $selaras = Santri::create(['nama_lengkap' => 'Selaras', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $selaras->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $selaras->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($selaras, $f['mi']->jenjang, $f['taMi']->nama, '1A');
        $this->tempatkan($selaras, $f['md']->jenjang, $f['taMd']->nama, '1a'); // case-insensitive sama
        // Ganda beda.
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
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya', 'tahaj_masuk' => $f['taMi']->nama]);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya', 'tahaj_masuk' => $f['taMd']->nama]);

        // Admin MI saja melihat kedua sisi.
        $resMi = $this->actingAs($this->makeUser('admin', [$f['mi']->jenjang]), 'sanctum')
            ->getJson('/api/admin/mi-md')->assertStatus(200);
        $this->assertCount(1, $resMi->json('md_semua'));

        // Admin MTS saja: ketiga tabel kosong.
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

        // Admin MI: daftar keanggotaan global memuat baris MD.
        $res = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/lembaga-santri?per_page=50')->assertStatus(200);
        $this->assertSame(2, $res->json('total'));

        // Admin MI: ubah + nonaktifkan baris MD.
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$mdRow->id}", [
            'nis_lokal' => '40009',
        ])->assertStatus(200);
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$mdRow->id}", [
            'is_active_lembaga' => 'Tidak',
        ])->assertStatus(200);
        $this->assertSame('Tidak', $mdRow->fresh()->is_active_lembaga);

        // Sebaliknya: admin MD membaca baris MI.
        $resMd = $this->actingAs($adminMd, 'sanctum')->getJson('/api/admin/lembaga-santri?per_page=50')->assertStatus(200);
        $this->assertSame(2, $resMd->json('total'));

        // Admin MTS: tetap buta + ditolak tulis.
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

        // Fisik hilang: anggota + riwayat MD lenyap, MI utuh.
        $this->assertSame(0, LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->count());
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->count());
        $this->assertSame(1, LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['mi']->jenjang)->count());

        // Murni MD (tanpa MI aktif) ditolak.
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

        // X: tutup jenjang MD (arsip nonaktif bernomor sama tetap ada).
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$s->id}/berhenti-jenjang", [
            'jenjang' => $f['md']->jenjang,
        ])->assertStatus(200);

        // Panah lagi: reaktivasi, bukan 422; tetap 1 baris MD.
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

        // Idempoten: daftar ulang tetap 1 baris MD.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/daftarkan-md', [
            'items' => [['santri_id' => $s->id]],
        ])->assertStatus(200);
        $this->assertSame(1, LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->count());

        // Bukan anggota MI → gagal jelas.
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
        // Kelas senama tersedia di MD.
        Kelas::create(['jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '1A', 'tingkat' => '1']);

        // Samakan dengan MI: MD 1B → 1A.
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $s->id, 'arah' => 'ke_md']],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res->json('berhasil'));
        $this->assertSame('1A', RiwayatBelajar::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->firstOrFail()->kelas->nama_kelas);

        // Arah sebaliknya tanpa kelas senama di MI → gagal jelas.
        $mdBaru = Kelas::create(['jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '1C', 'tingkat' => '1']);
        RiwayatBelajar::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->update(['kelas_id' => $mdBaru->id]);
        $res3 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $s->id, 'arah' => 'ke_mi']],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $res3->json('berhasil'));
        $this->assertCount(1, $res3->json('gagal'));
    }

    public function test_daftarkan_md_sepihak_mi_saja(): void
    {
        $f = $this->baseFixture();
        // Hanya pegang MI: boleh mendaftarkan ke MD (pengecualian pasangan).
        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);

        $s = Santri::create(['nama_lengkap' => 'MI Saja', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '28701', 'is_active_lembaga' => 'Ya']);

        $res = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/mi-md/daftarkan-md', [
            'items' => [['santri_id' => $s->id]],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res->json('berhasil'));

        $md = LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->firstOrFail();
        $this->assertSame('28701', $md->nis_lokal);

        // MTS (di luar pasangan) tetap ditolak.
        $adminMts = $this->makeUser('admin', [$f['mts']->jenjang]);
        $s2 = Santri::create(['nama_lengkap' => 'MI Saja 2', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s2->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);
        $res2 = $this->actingAs($adminMts, 'sanctum')->postJson('/api/admin/mi-md/daftarkan-md', [
            'items' => [['santri_id' => $s2->id]],
        ])->assertStatus(200);
        $this->assertSame(0, (int) $res2->json('berhasil'));
        $this->assertCount(1, $res2->json('gagal'));

        // Hapus jejak MD sepihak MI saja (X) → kembali MI Only.
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

        // Anggota kedua sisi; riwayat + kelas hanya di MI.
        $s = Santri::create(['nama_lengkap' => 'Tanpa MD', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '28801', 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $s->id, 'jenjang' => $f['md']->jenjang, 'nis_lokal' => '28801', 'is_active_lembaga' => 'Ya']);
        $this->tempatkan($s, $f['mi']->jenjang, $f['taMi']->nama, '1A');
        Kelas::firstOrCreate(
            ['jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '1A'],
            ['tingkat' => '1'],
        );

        // Samakan dengan MI: MD dibuatkan riwayat kelas 1A (TA mengikuti MI).
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/mi-md/samakan-kelas', [
            'items' => [['santri_id' => $s->id, 'arah' => 'ke_md']],
        ])->assertStatus(200);
        $this->assertSame(1, (int) $res->json('berhasil'));

        $md = RiwayatBelajar::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->firstOrFail();
        $this->assertSame('1A', $md->kelas->nama_kelas);
        $this->assertSame('1', $md->tingkat);
        // TA acuan (MI) tak berlaku di MD → TA aktif MD.
        $this->assertSame($f['taMd']->id, $md->tahun_ajaran_id);

        // Kelas senama tak ada di sisi tujuan → gagal jelas.
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

    // ---------- Filter tahun ajaran: alumni TA lama tidak muncul ----------

    public function test_filter_tahun_ajaran_sesuai_pilihan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);
        $lama = TahunAjaran::create([
            'nama' => '2005/2006',
            'tanggal_mulai' => '2005-07-01', 'tanggal_selesai' => '2006-06-30', 'is_aktif' => false,
        ]);

        // Alumni: keanggotaan MI aktif + riwayat HANYA di TA lama.
        $alumni = $this->santriDengan($f, 'Alumni Lama', $f['mi']->jenjang);
        $this->tempatkan($alumni, $f['mi']->jenjang, $lama->nama, '6A');
        // Berjalan: riwayat di TA aktif.
        $aktif = $this->santriDengan($f, 'Berjalan Kini', $f['mi']->jenjang);
        $this->tempatkan($aktif, $f['mi']->jenjang, $f['taMi']->nama, '1A');

        // Default (TA aktif) → hanya yang berjalan; alumni tidak muncul.
        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/mi-md')->assertStatus(200);
        $this->assertSame($f['taMi']->nama, $res->json('tahun_ajaran'));
        $this->assertSame(['Berjalan Kini'], array_column($res->json('mi_only'), 'nama'));

        // Pilih TA lama → hanya alumni.
        $resLama = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/mi-md?tahun_ajaran='.$lama->nama)->assertStatus(200);
        $this->assertSame($lama->nama, $resLama->json('tahun_ajaran'));
        $this->assertSame(['Alumni Lama'], array_column($resLama->json('mi_only'), 'nama'));
    }
}
