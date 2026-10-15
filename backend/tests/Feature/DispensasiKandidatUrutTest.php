<?php

namespace Tests\Feature;

use App\Models\Santri;
use App\Models\User;
use App\Services\UrutKatalog;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Opsi Urut dropdown Daftar Santri di tab Kelola Dispensasi
 * (`table_key='dispensasi_kandidat'`).
 *
 * Yang dijaga di sini: table_key-nya DIKENAL UrutKatalog (kalau tidak, endpoint
 * preset menolak 422 dan dropdown tampil kosong walau migrasinya ada), kode
 * opsinya sah untuk endpoint `santri`, dan kode itu benar-benar mengurutkan.
 */
class DispensasiKandidatUrutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        // `kelas.tahun_ajaran` FK wajib ke `tahun_ajaran.nama`; kolom `kelas`
        // memakai TA acuan yang sama dengan filternya di endpoint.
        DB::table('tahun_ajaran')->insert([
            'nama' => '2025/2026', 'is_aktif' => true,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    /** `table_key` wajib terdaftar, kalau tidak preset-nya tak pernah tersaji. */
    public function test_table_key_dispensasi_kandidat_dikenal_katalog(): void
    {
        $this->assertTrue(UrutKatalog::kenal('dispensasi_kandidat'));

        $kode = array_column(UrutKatalog::tersedia('dispensasi_kandidat'), 'kode');
        $this->assertSame(['nama', 'nisn', 'jk', 'kelas', 'jenjang', 'id'], $kode);
    }

    /** Opsi hasil seed tersaji lengkap dengan kolomnya. */
    public function test_preset_dispensasi_kandidat_tersedia_ke_dropdown(): void
    {
        $admin = User::create([
            'name' => 'Admin Urut', 'email' => 'admin_urut_dispensasi@example.com',
            'phone' => '081234500001', 'password' => 'password',
        ]);
        $admin->assignRole('super_admin');

        $res = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/urut-preset?table_key=dispensasi_kandidat');
        $res->assertStatus(200);

        // Opsi seed ada, tanpa bawaan terpilih: urutan awal tetap dari endpoint.
        $this->assertSame(['nama'], $res->json('data.opsi.0.kode'));
        $this->assertFalse($res->json('data.opsi.0.bawaan'));
        $this->assertSame(
            ['nama', 'nisn', 'jk', 'kelas', 'jenjang', 'id'],
            array_column($res->json('data.tersedia'), 'kode'),
        );
    }

    /** Kode preset benar-benar diterima & mengurutkan endpoint santri. */
    public function test_urut_nama_dan_nisn_berlaku_di_daftar_santri(): void
    {
        $this->seedLembaga('MI');
        $admin = $this->adminMi();

        $budi = $this->santri('Budi Santoso', '1111111111');
        $ani = $this->santri('Ani Lestari', '2222222222');
        $cici = $this->santri('Cici Amelia', '3333333333');
        foreach ([$budi, $ani, $cici] as $s) {
            $this->keanggotaan($s, 'MI');
        }

        // Nama menaik.
        $res = $this->actingAs($admin)
            ->getJson('/api/admin/santri?sort=nama&arah=naik&per_page=50');
        $res->assertStatus(200);
        $this->assertSame(
            ['Ani Lestari', 'Budi Santoso', 'Cici Amelia'],
            array_column($res->json('data'), 'nama_lengkap'),
        );

        // NISN menurun (urutan panjang digit sama karena semua 10 digit).
        $resNisn = $this->actingAs($admin)
            ->getJson('/api/admin/santri?sort=nisn&arah=turun&per_page=50');
        $resNisn->assertStatus(200);
        $this->assertSame(
            ['3333333333', '2222222222', '1111111111'],
            array_column($resNisn->json('data'), 'nisn'),
        );
    }

    /** Kode di luar katalog tetap ditolak (allowlist, bukan diabaikan). */
    public function test_kode_urut_liar_ditolak(): void
    {
        $this->seedLembaga('MI');
        $admin = $this->adminMi();

        // Kode di luar allowlist harus 422, bukan diam-diam diabaikan.
        $this->actingAs($admin)
            ->getJson('/api/admin/santri?sort=ngawur')
            ->assertStatus(422);
    }

    // ---------- helper ----------

    protected function seedLembaga(string $jenjang): void
    {
        DB::table('lembaga')->insert([
            'nama' => $jenjang, 'jenjang' => $jenjang,
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    protected function adminMi(): User
    {
        $u = User::create([
            'name' => 'Admin MI', 'email' => 'admin_disp_kandidat@example.com',
            'phone' => '081234500002', 'password' => 'password',
        ]);
        $u->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $u->id, 'jenjang' => 'MI',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $u;
    }

    protected function santri(string $nama, string $nisn): Santri
    {
        return Santri::create([
            'nama_lengkap' => $nama, 'nisn' => $nisn, 'jk' => 'L',
            'is_active_pst' => Santri::YA,
        ]);
    }

    protected function keanggotaan(Santri $santri, string $jenjang): void
    {
        DB::table('lembaga_santri')->insert([
            'santri_id' => $santri->id, 'jenjang' => $jenjang,
            'nis_lokal' => $santri->nisn, 'is_active_lembaga' => 'Ya',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    // ---------- urut Kelas & Jenjang (pseudo-kolom) ----------

    /** Kelas diurutkan dari nama kelas acuan (bukan abjad nama santri). */
    public function test_urut_kelas_memakai_nama_kelas_acuan(): void
    {
        $this->seedLembaga('MI');
        $admin = $this->adminMi();

        // Sengaja TIDAK urut abjad nama: kalau urutannya benar dari kelas,
        // hasilnya beda dari urutan nama — jadi tesnya benar-benar menguji kelas.
        $budi = $this->santri('Budi', '1111111111');   // Kelas 3A
        $ani = $this->santri('Ani', '2222222222');     // Kelas 1A
        $cici = $this->santri('Cici', '3333333333');   // Kelas 2A
        $this->keanggotaan($budi, 'MI');
        $this->keanggotaan($ani, 'MI');
        $this->keanggotaan($cici, 'MI');
        $this->riwayat($budi, 'MI', '3A', '1');
        $this->riwayat($ani, 'MI', '1A', '1');
        $this->riwayat($cici, 'MI', '2A', '1');

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/santri?sort=kelas&arah=naik&per_page=50');
        $res->assertStatus(200);

        $this->assertSame(['Ani', 'Cici', 'Budi'], array_column($res->json('data'), 'nama_lengkap'));
        // Kolom `kelas` yang tampil ikut terisi sesuai urutannya.
        $this->assertSame(['1A', '2A', '3A'], array_column($res->json('data'), 'kelas'));
    }

    /** Semester 2 menang: kelas semester 2 yang dipakai untuk mengurutkan. */
    public function test_urut_kelas_mengutamakan_semester_dua(): void
    {
        $this->seedLembaga('MI');
        $admin = $this->adminMi();

        $satu = $this->santri('Satu', '1111111111');
        $dua = $this->santri('Dua', '2222222222');
        $this->keanggotaan($satu, 'MI');
        $this->keanggotaan($dua, 'MI');
        // Semester 1 di kelas BELAKANG, semester 2 di kelas DEPAN.
        $this->riwayat($satu, 'MI', '9Z', '1');
        $this->riwayat($satu, 'MI', '1A', '2');
        $this->riwayat($dua, 'MI', '5A', '1');
        $this->riwayat($dua, 'MI', '5B', '2');

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/santri?sort=kelas&arah=naik&per_page=50');
        $res->assertStatus(200);

        // Satu pakai 1A (sem 2), Dua pakai 5B (sem 2) → Satu dulu.
        $this->assertSame(['Satu', 'Dua'], array_column($res->json('data'), 'nama_lengkap'));
        $this->assertSame(['1A', '5B'], array_column($res->json('data'), 'kelas'));
    }

    /** Jenjang diurutkan MI > MD, dan bawaannya menaik. */
    public function test_urut_jenjang_mengutamakan_mi_lalu_md(): void
    {
        $this->seedLembaga('MI');
        $this->seedLembaga('MD');
        $admin = $this->adminPusat();

        $md = $this->santri('Santri MD', '1111111111');
        $mi = $this->santri('Santri MI', '2222222222');
        $this->keanggotaan($md, 'MD');
        $this->keanggotaan($mi, 'MI');
        $this->riwayat($md, 'MD', '1A', '1');
        $this->riwayat($mi, 'MI', '1A', '1');

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/santri?sort=jenjang&arah=naik&per_page=50');
        $res->assertStatus(200);

        // MI dulu, walau abjad 'MD' < 'MI': yang diurutkan peringkat jenjang,
        // bukan namanya.
        $this->assertSame(['Santri MI', 'Santri MD'], array_column($res->json('data'), 'nama_lengkap'));
    }

    /** Santri tanpa riwayat tetap muncul, di BELAKANG (NULL terakhir). */
    public function test_urut_kelas_menaruh_santri_tanpa_riwayat_di_belakang(): void
    {
        $this->seedLembaga('MI');
        $admin = $this->adminMi();

        $punya = $this->santri('Punya Kelas', '1111111111');
        $tanpa = $this->santri('Tanpa Kelas', '2222222222');
        $this->keanggotaan($punya, 'MI');
        $this->keanggotaan($tanpa, 'MI');
        $this->riwayat($punya, 'MI', '5A', '1');

        // Menurun: kalau NULL tidak dipaksa di bawah, "Tanpa Kelas" melompat
        // ke paling atas dan menutupi baris yang benar-benar punya kelas.
        $res = $this->actingAs($admin)
            ->getJson('/api/admin/santri?sort=kelas&arah=turun&per_page=50');
        $res->assertStatus(200);

        $nama = array_column($res->json('data'), 'nama_lengkap');
        $this->assertSame('Tanpa Kelas', end($nama));
    }

    // ---------- helper tambahan ----------

    protected function adminPusat(): User
    {
        $u = User::create([
            'name' => 'Admin Pusat', 'email' => 'admin_pusat_kandidat@example.com',
            'phone' => '081234500003', 'password' => 'password',
        ]);
        $u->assignRole('super_admin');

        return $u;
    }

    /** Riwayat belajar satu semester di satu kelas (sumber kolom `kelas`). */
    protected function riwayat(Santri $santri, string $jenjang, string $kelas, string $semester): void
    {
        $kelasId = DB::table('kelas')->where('nama_kelas', $kelas)->value('id');
        if ($kelasId === null) {
            $kelasId = DB::table('kelas')->insertGetId([
                'nama_kelas' => $kelas, 'jenjang' => $jenjang, 'tingkat' => '1',
                'tahun_ajaran' => '2025/2026',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        DB::table('riwayat_belajar')->insert([
            'santri_id' => $santri->id, 'jenjang' => $jenjang,
            'tahun_ajaran' => '2025/2026', 'semester' => $semester,
            'tingkat' => '1', 'kelas_id' => $kelasId, 'status_akhir' => 'aktif',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    // ---------- saring keaktifan kandidat ----------

    /**
     * Daftar kandidat harus bisa menyaring keaktifan.
     *
     * Sebelum ini halaman dispensasi TIDAK PERNAH mengirim `is_active_pst`,
     * dan backend memperlakukan parameter yang absen sebagai "jangan saring"
     * — jadi santri nonaktif ikut tampil bercampur tanpa penanda. Tes ini
     * mengunci kontraknya: absen = tanpa saring, `false` = nonaktif saja.
     */
    public function test_saring_keaktifan_memisahkan_santri_aktif_dan_nonaktif(): void
    {
        $this->seedLembaga('MI');
        $admin = $this->adminMi();

        $aktif = $this->santri('Santri Aktif', '1111111111');
        $nonaktif = $this->santriNonaktif('Santri Nonaktif', '2222222222');
        $this->keanggotaan($aktif, 'MI');
        $this->keanggotaan($nonaktif, 'MI');

        // is_active_pst=true → hanya yang aktif.
        $hanyaAktif = $this->actingAs($admin)
            ->getJson('/api/admin/santri?is_active_pst=1&per_page=50');
        $hanyaAktif->assertStatus(200);
        $this->assertSame(['Santri Aktif'], array_column($hanyaAktif->json('data'), 'nama_lengkap'));

        // is_active_pst=false → hanya yang nonaktif.
        $hanyaNonaktif = $this->actingAs($admin)
            ->getJson('/api/admin/santri?is_active_pst=0&per_page=50');
        $hanyaNonaktif->assertStatus(200);
        $this->assertSame(['Santri Nonaktif'], array_column($hanyaNonaktif->json('data'), 'nama_lengkap'));

        // 'semua' → keduanya (dikirim eksplisit sebagai opsi "Semua" di UI).
        $semua = $this->actingAs($admin)
            ->getJson('/api/admin/santri?is_active_pst=semua&per_page=50');
        $semua->assertStatus(200);
        $this->assertEqualsCanonicalizing(
            ['Santri Aktif', 'Santri Nonaktif'],
            array_column($semua->json('data'), 'nama_lengkap'),
        );
    }

    /** Santri dengan `is_active_pst` = TIDAK. */
    protected function santriNonaktif(string $nama, string $nisn): Santri
    {
        return Santri::create([
            'nama_lengkap' => $nama, 'nisn' => $nisn, 'jk' => 'L',
            'is_active_pst' => Santri::TIDAK,
        ]);
    }
}
