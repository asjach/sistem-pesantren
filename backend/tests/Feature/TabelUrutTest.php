<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MutasiKeluar;
use App\Models\PengajuanBiodataSantri;
use App\Models\PsbCalonSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

/**
 * Urut header semua tabel daftar: param sort+arah + allowlist per endpoint.
 * Tanpa sort = urutan bawaan lama; nilai liar = 422.
 */
class TabelUrutTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function super(): User
    {
        $this->seq++;
        $u = User::create([
            'name' => 'Super',
            'email' => "super_urut_semua_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0812'.str_pad((string) (10000000 + $this->seq), 8, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole('super_admin');

        return $u;
    }

    protected function dasar(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'lembaga_id' => null, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30',
            'is_aktif' => true, 'is_active' => true,
        ]);

        return compact('root', 'mi', 'ta');
    }

    protected function santriTiga(): array
    {
        $ahmad = Santri::create(['nama_lengkap' => 'Ahmad', 'jk' => 'P']);
        $budi = Santri::create(['nama_lengkap' => 'Budi', 'jk' => 'L']);
        $candra = Santri::create(['nama_lengkap' => 'Candra', 'jk' => 'L']);

        return [$ahmad, $budi, $candra];
    }

    /** Kolom dari data[] respons paginasi, mendukung path relasi 'santri.nama_lengkap'. */
    protected function kolom(User $super, string $url, string $path, string $akar = 'data'): array
    {
        $res = $this->actingAs($super, 'sanctum')->getJson($url)->assertStatus(200);
        $out = [];
        foreach ($res->json($akar) as $row) {
            $v = $row;
            foreach (explode('.', $path) as $seg) {
                $v = $v[$seg] ?? null;
            }
            $out[] = $v;
        }

        return $out;
    }

    // ---------- santri ----------

    public function test_santri_urut_nama(): void
    {
        $this->santriTiga();
        $this->assertSame(
            ['Ahmad', 'Budi', 'Candra'],
            $this->kolom($this->super(), '/api/admin/santri?per_page=50&sort=nama&arah=naik', 'nama_lengkap')
        );
    }

    public function test_santri_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/santri?sort=password')
            ->assertStatus(422);
    }

    public function test_santri_bawaan_jk_lalu_nama(): void
    {
        $this->santriTiga();
        $this->assertSame(
            ['Budi', 'Candra', 'Ahmad'],
            $this->kolom($this->super(), '/api/admin/santri?per_page=50', 'nama_lengkap')
        );
    }

    // ---------- kelas ----------

    public function test_kelas_urut_nama(): void
    {
        $f = $this->dasar();
        foreach (['Kelas B', 'Kelas A'] as $nama) {
            Kelas::create([
                'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'nama_kelas' => $nama,
            ]);
        }
        $this->assertSame(
            ['Kelas A', 'Kelas B'],
            $this->kolom($this->super(), '/api/admin/kelas?per_page=50&sort=nama&arah=naik', 'nama_kelas')
        );
    }

    public function test_kelas_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/kelas?sort=password')
            ->assertStatus(422);
    }

    // ---------- lembaga ----------

    public function test_lembaga_urut_kode_turun(): void
    {
        $this->dasar();
        $this->assertSame(
            ['PESANTREN', 'MI'],
            $this->kolom($this->super(), '/api/admin/lembaga?per_page=50&sort=kode&arah=turun', 'kode')
        );
    }

    public function test_lembaga_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/lembaga?sort=password')
            ->assertStatus(422);
    }

    // ---------- users ----------

    public function test_users_urut_nama(): void
    {
        foreach ([['Candra', 'candra'], ['Ahmad', 'ahmad']] as [$nama, $uname]) {
            $this->seq++;
            $u = User::create([
                'name' => $nama,
                'email' => "{$uname}_".uniqid().'@example.com',
                'phone' => '0813'.str_pad((string) (20000000 + $this->seq), 8, '0', STR_PAD_LEFT),
                'username' => $uname.'_'.$this->seq,
                'password' => 'password',
            ]);
            $u->assignRole('guru');
        }
        $rows = $this->kolom($this->super(), '/api/admin/users?per_page=50&sort=nama&arah=naik', 'name');
        $this->assertSame(['Ahmad', 'Candra', 'Super'], $rows);
    }

    public function test_users_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/users?sort=password')
            ->assertStatus(422);
    }

    // ---------- tahun ajaran ----------

    public function test_tahun_ajaran_urut_nama(): void
    {
        TahunAjaran::create([
            'lembaga_id' => null, 'nama' => '2027/2028',
            'tanggal_mulai' => '2027-07-01', 'is_aktif' => false, 'is_active' => true,
        ]);
        TahunAjaran::create([
            'lembaga_id' => null, 'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'is_aktif' => false, 'is_active' => true,
        ]);
        $this->assertSame(
            ['2025/2026', '2027/2028'],
            $this->kolom($this->super(), '/api/admin/tahun-ajaran?per_page=50&sort=nama&arah=naik', 'nama')
        );
    }

    public function test_tahun_ajaran_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/tahun-ajaran?sort=password')
            ->assertStatus(422);
    }

    // ---------- riwayat belajar ----------

    public function test_riwayat_urut_santri(): void
    {
        $f = $this->dasar();
        [$ahmad, $budi, $candra] = $this->santriTiga();
        foreach ([$candra, $ahmad, $budi] as $s) {
            RiwayatBelajar::create([
                'santri_id' => $s->id, 'tahun_ajaran_id' => $f['ta']->id,
                'lembaga_id' => $f['mi']->id, 'semester' => '1',
            ]);
        }
        $this->assertSame(
            ['Ahmad', 'Budi', 'Candra'],
            $this->kolom($this->super(), '/api/admin/riwayat-belajar?per_page=50&sort=santri&arah=naik', 'santri.nama_lengkap')
        );
    }

    public function test_riwayat_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/riwayat-belajar?sort=password')
            ->assertStatus(422);
    }

    // ---------- mutasi keluar ----------

    public function test_mutasi_urut_santri(): void
    {
        $f = $this->dasar();
        [$ahmad, $budi] = $this->santriTiga();
        foreach ([$budi, $ahmad] as $s) {
            MutasiKeluar::create([
                'santri_id' => $s->id, 'lembaga_id' => $f['mi']->id,
                'tanggal_mutasi' => '2026-05-01',
            ]);
        }
        $this->assertSame(
            ['Ahmad', 'Budi'],
            $this->kolom($this->super(), '/api/admin/mutasi-keluar?per_page=50&sort=santri&arah=naik', 'santri.nama_lengkap')
        );
    }

    public function test_mutasi_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/mutasi-keluar?sort=password')
            ->assertStatus(422);
    }

    // ---------- alumni ----------

    public function test_alumni_urut_santri(): void
    {
        $f = $this->dasar();
        [$ahmad, $budi] = $this->santriTiga();
        foreach ([$budi, $ahmad] as $s) {
            Alumni::create([
                'santri_id' => $s->id, 'lembaga_lulus_id' => $f['mi']->id,
                'tahun_ajaran_lulus_id' => $f['ta']->id, 'tanggal_lulus' => '2026-06-01',
            ]);
        }
        $this->assertSame(
            ['Ahmad', 'Budi'],
            $this->kolom($this->super(), '/api/admin/alumni?per_page=50&sort=santri&arah=naik', 'santri.nama_lengkap')
        );
    }

    public function test_alumni_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/alumni?sort=password')
            ->assertStatus(422);
    }

    // ---------- pengajuan biodata ----------

    public function test_pengajuan_urut_santri(): void
    {
        [$ahmad, $budi] = $this->santriTiga();
        $wali = $this->super();
        foreach ([$budi, $ahmad] as $s) {
            PengajuanBiodataSantri::create([
                'santri_id' => $s->id, 'wali_user_id' => $wali->id,
                'perubahan_json' => ['nama_lengkap' => ['lama' => $s->nama_lengkap, 'baru' => $s->nama_lengkap.' X']],
                'status' => 'diajukan',
            ]);
        }
        $this->assertSame(
            ['Ahmad', 'Budi'],
            $this->kolom($this->super(), '/api/admin/pengajuan-biodata?per_page=50&sort=santri&arah=naik', 'santri.nama_lengkap', 'data.data')
        );
    }

    public function test_pengajuan_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/pengajuan-biodata?sort=password')
            ->assertStatus(422);
    }

    // ---------- antrean PSB ----------

    public function test_antrean_urut_nama(): void
    {
        $f = $this->dasar();
        $this->seq++;
        foreach ([['Candra', '1111111111111111'], ['Ahmad', '2222222222222222']] as [$nama, $nik]) {
            PsbCalonSantri::create([
                'nik' => $nik, 'nama_lengkap' => $nama,
                'no_pendaftaran' => 'PSB_2026_MI_1_'.$this->seq.'_'.$nik,
                'lembaga_id' => $f['mi']->id,
                'status_pendaftaran' => 'ajukan_daftar_ulang',
            ]);
        }
        $res = $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/psb/antrean-daftar-ulang?status=ajukan_daftar_ulang&per_page=50&sort=nama&arah=naik')
            ->assertStatus(200);

        $this->assertSame(['Ahmad', 'Candra'], array_column($res->json('data.data'), 'nama_lengkap'));
    }

    public function test_antrean_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/psb/antrean-daftar-ulang?status=ajukan_daftar_ulang&sort=password')
            ->assertStatus(422);
    }
}
