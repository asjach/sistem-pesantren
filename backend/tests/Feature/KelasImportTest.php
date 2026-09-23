<?php

namespace Tests\Feature;

use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaTahunAjaran;
use App\Models\Pegawai;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\ReferensiSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Import file kelas multi-lembaga + multi-TA: template + periksa + eksekusi,
// duplikat dilewati, izin mengikuti akun per baris.
class KelasImportTest extends TestCase
{
    use RefreshDatabase;

    protected int $userSeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(ReferensiSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function baseFixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
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
        $ta2 = TahunAjaran::create([
            'nama' => '2027/2028',
            'tanggal_mulai' => '2027-07-01', 'tanggal_selesai' => '2028-06-30', 'is_aktif' => false,
        ]);
        $super = $this->makeAdmin([], 'super_admin');

        return compact('mi', 'mts', 'ta', 'ta2', 'super');
    }

    protected function makeAdmin(array $jenjangs, string $role = 'admin'): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Admin '.$this->userSeq,
            'email' => "kelas_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9300000000 + $this->userSeq * 53), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($jenjangs as $j) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $j,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function makeCsv(array $rows): string
    {
        $headers = ['jenjang', 'tahun_ajaran', 'nama_kelas', 'nama_alias', 'walas', 'tingkat', 'urutan', 'kapasitas'];
        $tmp = tempnam(sys_get_temp_dir(), 'kelas').'.csv';
        $h = fopen($tmp, 'w');
        fputcsv($h, $headers);
        foreach ($rows as $r) {
            $line = [];
            foreach ($headers as $col) {
                $line[] = $r[$col] ?? '';
            }
            fputcsv($h, $line);
        }
        fclose($h);

        return $tmp;
    }

    protected function upload(User $admin, string $csvPath, string $endpoint = 'import')
    {
        return $this->actingAs($admin, 'sanctum')->post("/api/admin/kelas/{$endpoint}", [
            'file' => new UploadedFile($csvPath, 'kelas.csv', 'text/csv', null, true),
        ]);
    }

    public function test_01_template_bisa_diunduh(): void
    {
        $f = $this->baseFixture();

        $res = $this->actingAs($f['super'], 'sanctum')->get('/api/admin/kelas/import-template');
        $res->assertStatus(200);
        $this->assertStringContainsString('attachment', (string) $res->headers->get('content-disposition'));
    }

    public function test_02_super_admin_multi_lembaga_dan_multi_ta(): void
    {
        $f = $this->baseFixture();
        $csv = $this->makeCsv([
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1A', 'nama_alias' => 'Umar', 'tingkat' => '1', 'urutan' => '1', 'kapasitas' => '28'],
            ['jenjang' => 'MTS', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '7A', 'tingkat' => '7', 'urutan' => '1', 'kapasitas' => ''],
            ['jenjang' => 'MI', 'tahun_ajaran' => '2027/2028', 'nama_kelas' => '1A', 'tingkat' => '1'],
        ]);

        // Dry-run tak menulis.
        $periksa = $this->upload($f['super'], $csv, 'import-periksa')->assertStatus(200);
        $this->assertTrue((bool) $periksa->json('siap_import'));
        $this->assertSame(3, (int) $periksa->json('ringkasan.dibuat'));
        $this->assertSame(0, Kelas::count());

        $res = $this->upload($f['super'], $csv)->assertStatus(200);
        $this->assertStringContainsString('3 kelas dibuat', (string) $res->json('pesan'));
        $this->assertDatabaseHas('kelas', ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1A', 'nama_alias' => 'Umar', 'kapasitas' => 28]);
        $this->assertDatabaseHas('kelas', ['jenjang' => 'MTS', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '7A']);
        // Nama sama di TA berbeda = lingkup berbeda, dua-duanya dibuat.
        $this->assertDatabaseHas('kelas', ['jenjang' => 'MI', 'tahun_ajaran' => '2027/2028', 'nama_kelas' => '1A']);
    }

    public function test_03_admin_lembaga_hanya_lembaganya(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeAdmin([$f['mi']->jenjang]);
        $csv = $this->makeCsv([
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1A', 'tingkat' => '1'],
            ['jenjang' => 'MTS', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '7A', 'tingkat' => '7'],
        ]);

        $res = $this->upload($adminMi, $csv)->assertStatus(422);
        // Baris MTS gagal per baris (bukan 403); baris MI tetap dibuat.
        $this->assertSame('jenjang', $res->json('errors.0.attribute'));
        $this->assertStringContainsString('lingkup akses', (string) $res->json('errors.0.errors.0'));
        $this->assertDatabaseHas('kelas', ['jenjang' => 'MI', 'nama_kelas' => '1A']);
        $this->assertSame(0, Kelas::where('jenjang', 'MTS')->count());
    }

    public function test_04_admin_multi_lembaga_sesuai_akunnya(): void
    {
        $f = $this->baseFixture();
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $admin = $this->makeAdmin(['MI', 'MD']);
        $csv = $this->makeCsv([
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1A', 'tingkat' => '1'],
            ['jenjang' => 'MD', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1A', 'tingkat' => '1'],
            ['jenjang' => 'MTS', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '7A', 'tingkat' => '7'],
        ]);

        $res = $this->upload($admin, $csv)->assertStatus(422);
        // Hanya baris MTS yang gagal (satu-satunya galat); MI+MD tetap dibuat.
        $this->assertCount(1, $res->json('errors'));
        $this->assertSame('jenjang', $res->json('errors.0.attribute'));
        $this->assertDatabaseHas('kelas', ['jenjang' => 'MI', 'nama_kelas' => '1A']);
        $this->assertDatabaseHas('kelas', ['jenjang' => 'MD', 'nama_kelas' => '1A']);
        $this->assertSame(0, Kelas::where('jenjang', 'MTS')->count());
    }

    public function test_05_duplikat_dilewati_ta_tak_berlaku_gagal(): void
    {
        $f = $this->baseFixture();
        // TA 2027/2028 disembunyikan untuk MI → tak berlaku di MI, berlaku di MTS.
        LembagaTahunAjaran::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta2']->nama, 'is_active' => false,
        ]);
        Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1A', 'tingkat' => '1', 'urutan' => 1]);

        $csv = $this->makeCsv([
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1A'], // ada di DB
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1C'],
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1c'], // duplikat intra-file
            ['jenjang' => 'MI', 'tahun_ajaran' => '2027/2028', 'nama_kelas' => '2A'], // TA tak berlaku di MI
            ['jenjang' => 'MTS', 'tahun_ajaran' => '2027/2028', 'nama_kelas' => '8A', 'tingkat' => '8'],
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => ''], // tanpa nama dilewati diam-diam
        ]);

        $res = $this->upload($f['super'], $csv)->assertStatus(422);
        $this->assertSame('tahun_ajaran', $res->json('errors.0.attribute'));
        $this->assertDatabaseHas('kelas', ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1C']);
        $this->assertDatabaseHas('kelas', ['jenjang' => 'MTS', 'tahun_ajaran' => '2027/2028', 'nama_kelas' => '8A']);
        $this->assertSame(0, Kelas::where('jenjang', 'MI')->where('tahun_ajaran', '2027/2028')->count());
        // 1A lama + 1C + 8A (duplikat dilewati, baris tanpa nama diabaikan).
        $this->assertSame(3, Kelas::count());
    }

    public function test_06_baris_bermasalah_ditolak_per_baris(): void
    {
        $f = $this->baseFixture();
        // Kamus tingkat MI terisi → '99' ditolak; tanpa kamus (MTS) bebas.
        foreach (['1', '2', '3', '4', '5', '6'] as $i => $t) {
            DB::table('ref_tingkat')->insert([
                'jenjang' => $f['mi']->jenjang, 'nama' => $t, 'urutan' => $i, 'is_active' => true,
            ]);
        }
        $csv = $this->makeCsv([
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '2A', 'tingkat' => '99'],
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '2B', 'urutan' => '-1'],
            ['jenjang' => 'ZZ', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '2C'],
        ]);

        $res = $this->upload($f['super'], $csv)->assertStatus(422);
        $attrs = collect($res->json('errors'))->pluck('attribute')->sort()->values()->all();
        $this->assertSame(['jenjang', 'tingkat', 'urutan'], $attrs);
        $this->assertSame(0, Kelas::count());
    }

    // ---------- 07. kolom walas: NIP/nama + gagal per baris ----------

    public function test_07_walas_nip_nama_dan_gagal_per_baris(): void
    {
        $f = $this->baseFixture();
        $guru = Pegawai::create(['nama_lengkap' => 'Guru Wali', 'jenis_kelamin' => 'L', 'nip' => 'NIP101']);
        KeaktifanPegawai::create([
            'pegawai_id' => $guru->id, 'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['ta']->nama, 'status_keaktifan' => 'aktif',
        ]);
        $cuti = Pegawai::create(['nama_lengkap' => 'Guru Cuti', 'jenis_kelamin' => 'L', 'nip' => 'NIP102', 'status_aktif' => 'cuti']);
        KeaktifanPegawai::create([
            'pegawai_id' => $cuti->id, 'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['ta']->nama, 'status_keaktifan' => 'aktif',
        ]);
        Pegawai::create(['nama_lengkap' => 'Guru Kembar', 'jenis_kelamin' => 'L']);
        Pegawai::create(['nama_lengkap' => 'Guru Kembar', 'jenis_kelamin' => 'P']);

        $csv = $this->makeCsv([
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1A', 'walas' => 'NIP101', 'tingkat' => '1'],
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1B', 'walas' => 'Guru Wali', 'tingkat' => '1'],
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1C', 'walas' => 'Tak Dikenal', 'tingkat' => '1'],
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1D', 'walas' => 'Guru Cuti', 'tingkat' => '1'],
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1E', 'walas' => 'Guru Kembar', 'tingkat' => '1'],
        ]);

        $res = $this->upload($f['super'], $csv)->assertStatus(422);
        $this->assertSame(['walas', 'walas', 'walas'], collect($res->json('errors'))->pluck('attribute')->all());
        $this->assertSame($guru->id, Kelas::where('nama_kelas', '1A')->firstOrFail()->walas_id);
        $this->assertSame($guru->id, Kelas::where('nama_kelas', '1B')->firstOrFail()->walas_id);
        // Baris gagal tak membuat kelas.
        $this->assertDatabaseMissing('kelas', ['nama_kelas' => '1C']);
        $this->assertDatabaseMissing('kelas', ['nama_kelas' => '1D']);
        $this->assertDatabaseMissing('kelas', ['nama_kelas' => '1E']);
    }

    // ---------- 08. nama cocok → update kolom terisi; kosong = pertahankan ----------

    public function test_08_nama_cocok_update_kolom_terisi(): void
    {
        $f = $this->baseFixture();
        $guru = Pegawai::create(['nama_lengkap' => 'Guru Wali', 'jenis_kelamin' => 'L', 'nip' => 'NIP201']);
        KeaktifanPegawai::create([
            'pegawai_id' => $guru->id, 'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['ta']->nama, 'status_keaktifan' => 'aktif',
        ]);
        Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama,
            'nama_kelas' => '1A', 'nama_alias' => 'Lama', 'tingkat' => '1',
            'urutan' => 1, 'kapasitas' => 20,
        ]);

        $csv = $this->makeCsv([
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1A', 'nama_alias' => 'Baru', 'walas' => 'NIP201', 'urutan' => '5', 'kapasitas' => ''],
            ['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '1B', 'tingkat' => '1'],
        ]);

        $periksa = $this->upload($f['super'], $csv, 'import-periksa')->assertStatus(200);
        $this->assertTrue((bool) $periksa->json('siap_import'));
        $this->assertSame(1, (int) $periksa->json('ringkasan.dibuat'));
        $this->assertSame(1, (int) $periksa->json('ringkasan.diperbarui'));

        $this->upload($f['super'], $csv)->assertStatus(200);
        $kelas = Kelas::where('nama_kelas', '1A')->firstOrFail();
        $this->assertSame('Baru', $kelas->nama_alias);
        $this->assertSame($guru->id, $kelas->walas_id);
        $this->assertSame(5, $kelas->urutan);
        // Sel kosong tidak menimpa.
        $this->assertSame('1', $kelas->tingkat);
        $this->assertSame(20, $kelas->kapasitas);
        $this->assertDatabaseHas('kelas', ['nama_kelas' => '1B']);
    }
}
