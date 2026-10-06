<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\Dispensasi;
use App\Models\JenisTagihan;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MutasiKeluar;
use App\Models\PengajuanBiodataSantri;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKegiatan;
use App\Models\PsbKuotaBiaya;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\TarifTagihan;
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
            'nama' => 'Pesantren Root', 'jenjang' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'jenjang' => null, 'nama' => '2026/2027',
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

    public function test_santri_urut_ayah(): void
    {
        Santri::create(['nama_lengkap' => 'Satu', 'jk' => 'L', 'ayah_nama' => 'Zul']);
        Santri::create(['nama_lengkap' => 'Dua', 'jk' => 'L', 'ayah_nama' => 'Ari']);
        $this->assertSame(
            ['Dua', 'Satu'],
            $this->kolom($this->super(), '/api/admin/santri?per_page=50&sort=ayah&arah=naik', 'nama_lengkap')
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
                'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => $nama,
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
            $this->kolom($this->super(), '/api/admin/lembaga?per_page=50&sort=kode&arah=turun', 'jenjang')
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

    public function test_users_search_mencakup_role(): void
    {
        $this->seq++;
        $admin = User::create([
            'name' => 'Uji Alfa',
            'email' => "uji_alfa_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0813'.str_pad((string) (30000000 + $this->seq), 8, '0', STR_PAD_LEFT),
            'username' => 'uji_alfa_'.$this->seq,
            'password' => 'password',
        ]);
        $admin->assignRole('admin');
        $this->seq++;
        $ortu = User::create([
            'name' => 'Uji Beta',
            'email' => "uji_beta_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0813'.str_pad((string) (30000000 + $this->seq), 8, '0', STR_PAD_LEFT),
            'username' => 'uji_beta_'.$this->seq,
            'password' => 'password',
        ]);
        $ortu->assignRole('orang_tua');

        $this->assertSame(
            ['Uji Beta'],
            $this->kolom($this->super(), '/api/admin/users?per_page=50&search=orang_tua', 'name')
        );
    }

    // ---------- tahun ajaran ----------

    public function test_tahun_ajaran_urut_nama(): void
    {
        TahunAjaran::create([
            'jenjang' => null, 'nama' => '2027/2028',
            'tanggal_mulai' => '2027-07-01', 'is_aktif' => false, 'is_active' => true,
        ]);
        TahunAjaran::create([
            'jenjang' => null, 'nama' => '2025/2026',
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
                'santri_id' => $s->id, 'tahun_ajaran' => $f['ta']->nama,
                'jenjang' => $f['mi']->jenjang, 'semester' => '1',
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
                'santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang,
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
                'santri_id' => $s->id, 'lembaga_lulus' => $f['mi']->jenjang,
                'tahun_ajaran_lulus' => $f['ta']->nama, 'tanggal_lulus' => '2026-06-01',
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
                'jenjang' => $f['mi']->jenjang,
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

    // ---------- keuangan ----------

    public function test_keuangan_jenis_urut_nama(): void
    {
        foreach (['Zakat', 'Infaq'] as $nama) {
            JenisTagihan::create(['nama' => $nama, 'tipe' => 'non_bulanan']);
        }
        $res = $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/keuangan/jenis?sort=nama&arah=naik')
            ->assertStatus(200);

        $this->assertSame(['Infaq', 'Zakat'], array_column($res->json(), 'nama'));
    }

    public function test_keuangan_jenis_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/keuangan/jenis?sort=password')
            ->assertStatus(422);
    }

    public function test_keuangan_tarif_urut_nominal(): void
    {
        $jenis = JenisTagihan::create(['nama' => 'SPP', 'tipe' => 'bulanan']);
        foreach ([200000, 100000] as $nominal) {
            TarifTagihan::create([
                'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
                'jenis_id' => $jenis->id, 'nominal' => $nominal,
            ]);
        }
        $res = $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/keuangan/tarif?sort=nominal&arah=naik')
            ->assertStatus(200);

        $this->assertSame([100000, 200000], array_column($res->json(), 'nominal'));
    }

    public function test_keuangan_tagihan_urut_nominal_dan_santri(): void
    {
        $zed = Santri::create(['nama_lengkap' => 'Zed', 'jk' => 'L']);
        $alfa = Santri::create(['nama_lengkap' => 'Alfa', 'jk' => 'L']);
        $jenis = JenisTagihan::create(['nama' => 'SPP', 'tipe' => 'bulanan']);
        Tagihan::create([
            'santri_id' => $zed->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
            'jenis_id' => $jenis->id, 'periode' => '2026-07', 'nominal' => 300000, 'status' => 'belum', 'terbayar' => 0,
        ]);
        Tagihan::create([
            'santri_id' => $alfa->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
            'jenis_id' => $jenis->id, 'periode' => '2026-07', 'nominal' => 100000, 'status' => 'belum', 'terbayar' => 0,
        ]);
        $this->assertSame(
            ['Alfa', 'Zed'],
            $this->kolom($this->super(), '/api/admin/keuangan/tagihan?per_page=50&sort=nominal&arah=naik', 'santri.nama_lengkap')
        );
        $this->assertSame(
            ['Zed', 'Alfa'],
            $this->kolom($this->super(), '/api/admin/keuangan/tagihan?per_page=50&sort=santri&arah=turun', 'santri.nama_lengkap')
        );
    }

    public function test_keuangan_dispensasi_urut_nama(): void
    {
        $this->dasar();
        foreach (['Zeta', 'Alfa'] as $nama) {
            Dispensasi::create(['nama' => $nama, 'tahun_ajaran' => '2026/2027']);
        }
        $res = $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/keuangan/dispensasi?sort=nama&arah=naik')
            ->assertStatus(200);

        $this->assertSame(['Alfa', 'Zeta'], array_column($res->json(), 'nama'));
    }

    public function test_keuangan_tunggakan_urut_sisa(): void
    {
        $besar = Santri::create(['nama_lengkap' => 'Besar', 'jk' => 'L']);
        $kecil = Santri::create(['nama_lengkap' => 'Kecil', 'jk' => 'L']);
        $jenis = JenisTagihan::create(['nama' => 'SPP', 'tipe' => 'bulanan']);
        Tagihan::create([
            'santri_id' => $besar->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
            'jenis_id' => $jenis->id, 'periode' => '2026-07', 'nominal' => 100000, 'status' => 'sebagian', 'terbayar' => 50000,
        ]);
        Tagihan::create([
            'santri_id' => $kecil->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
            'jenis_id' => $jenis->id, 'periode' => '2026-07', 'nominal' => 100000, 'status' => 'sebagian', 'terbayar' => 90000,
        ]);
        $this->assertSame(
            ['Besar', 'Kecil'],
            $this->kolom($this->super(), '/api/admin/keuangan/tunggakan?sort=sisa&arah=turun', 'nama', 'per_santri')
        );
    }

    public function test_kandidat_urut_nama(): void
    {
        $f = $this->dasar();
        $zed = Santri::create(['nama_lengkap' => 'Zed', 'jk' => 'L']);
        $alfa = Santri::create(['nama_lengkap' => 'Alfa', 'jk' => 'L']);
        foreach ([$zed, $alfa] as $s) {
            RiwayatBelajar::create([
                'santri_id' => $s->id, 'tahun_ajaran' => $f['ta']->nama,
                'jenjang' => $f['mi']->jenjang, 'semester' => '1',
            ]);
        }
        $this->assertSame(
            ['Alfa', 'Zed'],
            $this->kolom($this->super(), '/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2026/2027&kelompok=aktif&sort=nama&arah=naik', 'nama_lengkap')
        );
    }

    public function test_kandidat_nilai_liar_ditolak(): void
    {
        $this->actingAs($this->super(), 'sanctum')
            ->getJson('/api/admin/keuangan/tagihan/kandidat?tahun_ajaran=2026/2027&kelompok=aktif&sort=password')
            ->assertStatus(422);
    }

    // ---------- psb gelombang & kuota ----------

    public function test_gelombang_urut_nama(): void
    {
        $this->dasar();
        $keg = PsbKegiatan::create(['tahun_ajaran' => '2026/2027', 'nama' => 'PSB 2026']);
        PsbGelombang::create(['psb_kegiatan_id' => $keg->id, 'nomor' => 2, 'nama' => 'Zulu']);
        PsbGelombang::create(['psb_kegiatan_id' => $keg->id, 'nomor' => 1, 'nama' => 'Alfa']);
        $this->assertSame(
            ['Alfa', 'Zulu'],
            $this->kolom($this->super(), '/api/psb/gelombang?sort=nama&arah=naik', 'nama')
        );
    }

    public function test_kuota_urut_kuota(): void
    {
        $this->dasar();
        $keg = PsbKegiatan::create(['tahun_ajaran' => '2026/2027', 'nama' => 'PSB 2026']);
        $gel = PsbGelombang::create(['psb_kegiatan_id' => $keg->id, 'nomor' => 1, 'nama' => 'G1']);
        foreach ([['semua', 30], ['asrama', 10]] as [$tipe, $kuota]) {
            PsbKuotaBiaya::create(['gelombang_id' => $gel->id, 'jenjang' => 'MI', 'tipe_santri' => $tipe, 'kuota' => $kuota]);
        }
        $res = $this->actingAs($this->super(), 'sanctum')
            ->getJson("/api/admin/psb/kuota-biaya?gelombang_id={$gel->id}&sort=kuota&arah=naik")
            ->assertStatus(200);

        $this->assertSame([10, 30], array_column($res->json('data.rows'), 'kuota'));
    }

    // ---------- semester aktif ----------

    public function test_semester_aktif_urut_nama(): void
    {
        $this->dasar();
        $this->assertSame(
            ['Madrasah Ibtidaiyah', 'Pesantren Root'],
            $this->kolom($this->super(), '/api/admin/semester-aktif?sort=nama&arah=naik', 'nama')
        );
    }
}
