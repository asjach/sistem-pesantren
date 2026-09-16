<?php

namespace Tests\Feature;

use App\Exports\SantriLembagaDataExport;
use App\Exports\SantriLembagaTemplateExport;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Import gabungan siswa: satu file → `santri` + `lembaga_santri`.
 * Blok keanggotaan di awal kolom; file juga bisa dipakai update (round-trip).
 */
class SantriLembagaImportTest extends TestCase
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
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI', 'nsm' => '123456789012',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD', 'nsm' => '123456789013',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);

        return compact('root', 'mi', 'md');
    }

    protected int $userSeq = 0;

    protected function makeAdmin(array $lembagaIds): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Admin '.$this->userSeq,
            'email' => "gabungan_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9200000000 + $this->userSeq * 97), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole('admin');
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'lembaga_id' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function makeCsv(array $rows): string
    {
        $headers = [
            'santri_id', 'kode_lembaga', 'lembaga_id', 'nis_lokal', 'nis_kemenag',
            'is_active', 'tgl_mulai', 'tgl_selesai', 'nama_lengkap', 'nik', 'jk', 'tgl_lahir',
        ];
        $tmp = tempnam(sys_get_temp_dir(), 'gabungan').'.csv';
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

    protected function upload(User $admin, string $csvPath, string $endpoint = 'import-gabungan')
    {
        return $this->actingAs($admin, 'sanctum')->post("/api/admin/santri/{$endpoint}", [
            'file' => new UploadedFile($csvPath, 'gabungan.csv', 'text/csv', null, true),
        ]);
    }

    // ---------- 01. kolom: blok lembaga dulu ----------

    public function test_01_kolom_blok_lembaga_dulu(): void
    {
        $kolom = SantriLembagaTemplateExport::kolom();

        $this->assertSame(
            ['santri_id', 'kode_lembaga', 'lembaga_id', 'nis_lokal', 'nis_kemenag', 'is_active', 'tgl_mulai', 'tgl_selesai'],
            array_slice($kolom, 0, 8),
        );
        foreach (Santri::KOLOM_PROFIL as $k) {
            $this->assertContains($k, $kolom);
        }
    }

    // ---------- 02. baris baru: santri + keanggotaan tercipta ----------

    public function test_02_baris_baru_buat_santri_dan_anggota(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id]);

        $this->upload($admin, $this->makeCsv([[
            'kode_lembaga' => 'mi', // case-insensitive
            'nis_lokal' => '26001',
            'is_active' => '1',
            'tgl_mulai' => '2026-07-01',
            'nama_lengkap' => 'Siswa Baru',
            'nik' => '1101010000000001',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
        ]]))->assertStatus(200);

        $santri = Santri::where('nik', '1101010000000001')->firstOrFail();
        $ls = LembagaSantri::where('santri_id', $santri->id)->where('lembaga_id', $f['mi']->id)->firstOrFail();
        $this->assertSame('26001', $ls->nis_lokal);
        $this->assertTrue((bool) $ls->is_active);
        $this->assertSame('2026-07-01', $ls->tgl_mulai->format('Y-m-d'));
    }

    // ---------- 03. NIK cocok: profil + keanggotaan ter-update ----------

    public function test_03_nik_cocok_update_profil_dan_anggota(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id]);

        $santri = Santri::create(['nama_lengkap' => 'Lama', 'nik' => '1101010000000002', 'jk' => 'L', 'tgl_lahir' => '2015-01-01']);
        LembagaSantri::create(['santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25001', 'is_active' => true]);

        $csv = $this->makeCsv([[
            'kode_lembaga' => 'MI',
            'nis_lokal' => '25002',
            'nama_lengkap' => 'Lama',
            'nik' => '1101010000000002',
            'jk' => 'L',
            'tgl_lahir' => '2015-01-01',
        ]]);

        $this->upload($admin, $csv)->assertStatus(200);

        $this->assertSame(1, Santri::where('nik', '1101010000000002')->count());
        $this->assertSame('25002', LembagaSantri::where('santri_id', $santri->id)->firstOrFail()->nis_lokal);

        // Mode periksa melaporkan baris update tanpa menulis ulang yang merusak.
        $res = $this->upload($admin, $csv, 'import-periksa-gabungan')->assertStatus(200);
        $this->assertTrue((bool) $res->json('siap_import'));
        $this->assertSame(1, (int) $res->json('ringkasan.baris_diperbarui'));
    }

    // ---------- 04. tanpa NIK: fallback NIS + lembaga ----------

    public function test_04_tanpa_nik_cocok_via_nis(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id]);

        $santri = Santri::create(['nama_lengkap' => 'Tanpa NIK', 'jk' => 'P']);
        LembagaSantri::create(['santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25009', 'is_active' => true]);

        $this->upload($admin, $this->makeCsv([[
            'kode_lembaga' => 'MI',
            'nis_lokal' => '25009',
            'nama_lengkap' => 'Tanpa NIK',
            'jk' => 'P',
        ]]))->assertStatus(200);

        $this->assertSame(1, Santri::where('nama_lengkap', 'Tanpa NIK')->count());
    }

    // ---------- 05. santri_id eksak: baris parsial ----------

    public function test_05_santri_id_kunci_eksak_parsial(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id]);

        $santri = Santri::create(['nama_lengkap' => 'Parsial', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25100', 'is_active' => true]);

        $this->upload($admin, $this->makeCsv([[
            'santri_id' => (string) $santri->id,
            'kode_lembaga' => 'MI',
            'nis_lokal' => '25101',
        ]]))->assertStatus(200);

        // Profil tidak terhapus oleh sel kosong; NIS ter-update.
        $this->assertSame('Parsial', $santri->fresh()->nama_lengkap);
        $this->assertSame('25101', LembagaSantri::where('santri_id', $santri->id)->firstOrFail()->nis_lokal);
    }

    // ---------- 06. dry-run tidak menulis ----------

    public function test_06_periksa_tidak_menulis(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id]);

        $sebelumSantri = Santri::count();
        $sebelumLs = LembagaSantri::count();

        $res = $this->upload($admin, $this->makeCsv([[
            'kode_lembaga' => 'MI',
            'nis_lokal' => '25200',
            'nama_lengkap' => 'Calon Saja',
            'nik' => '1101010000000003',
            'jk' => 'L',
        ]]), 'import-periksa-gabungan')->assertStatus(200);

        $this->assertTrue((bool) $res->json('siap_import'));
        $this->assertSame($sebelumSantri, Santri::count());
        $this->assertSame($sebelumLs, LembagaSantri::count());
    }

    // ---------- 07. NIS dipakai santri lain → gagal baris ----------

    public function test_07_nis_ganda_gagal_baris(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id]);

        $a = Santri::create(['nama_lengkap' => 'Pemilik NIS', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $a->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25300', 'is_active' => true]);

        $res = $this->upload($admin, $this->makeCsv([[
            'kode_lembaga' => 'MI',
            'nis_lokal' => '25300',
            'nama_lengkap' => 'Penyerobot',
            'nik' => '1101010000000004',
            'jk' => 'L',
        ]]))->assertStatus(422);

        $attrs = collect($res->json('errors'))->pluck('attribute')->all();
        $this->assertContains('nis_lokal', $attrs);
        $this->assertNull(Santri::where('nik', '1101010000000004')->first()?->lembagaSantri()->first());
    }

    // ---------- 08. tenant: baris luar lingkup gagal, dalam lingkup masuk ----------

    public function test_08_baris_luar_lingkup_gagal(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeAdmin([$f['mi']->id]);

        $res = $this->upload($adminMi, $this->makeCsv([
            [
                'kode_lembaga' => 'MI', 'nis_lokal' => '25401',
                'nama_lengkap' => 'Anak MI', 'nik' => '1101010000000005', 'jk' => 'L',
            ],
            [
                'kode_lembaga' => 'MD', 'nis_lokal' => '25402',
                'nama_lengkap' => 'Anak MD', 'nik' => '1101010000000006', 'jk' => 'L',
            ],
        ]))->assertStatus(422);

        $this->assertNotNull(Santri::where('nik', '1101010000000005')->first());
        $this->assertNull(Santri::where('nik', '1101010000000006')->first());
        $attrs = collect($res->json('errors'))->pluck('attribute')->all();
        $this->assertContains('kode_lembaga', $attrs);
    }

    // ---------- 09. izin AND: tambah tanpa ubah → 403 ----------

    public function test_09_tambah_tanpa_ubah_ditolak(): void
    {
        $f = $this->baseFixture();
        $this->userSeq++;
        $u = User::create([
            'name' => 'Kritis '.$this->userSeq,
            'email' => "gabungan_kritis_{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9300000000 + $this->userSeq * 97), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->givePermissionTo(['santri.lihat', 'santri.tambah']);
        DB::table('user_lembaga')->insert([
            'user_id' => $u->id, 'lembaga_id' => $f['mi']->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->upload($u, $this->makeCsv([[
            'kode_lembaga' => 'MI', 'nis_lokal' => '25501',
            'nama_lengkap' => 'Tertolak', 'nik' => '1101010000000007', 'jk' => 'L',
        ]]))->assertStatus(403);
    }

    // ---------- 10. salah template ditolak jelas ----------

    public function test_10_file_identitas_ditolak_di_endpoint_gabungan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id]);

        $tmp = tempnam(sys_get_temp_dir(), 'identitas').'.csv';
        $h = fopen($tmp, 'w');
        fputcsv($h, ['nama_lengkap', 'jk', 'nik']);
        fputcsv($h, ['Salah Template', 'L', '1101010000000008']);
        fclose($h);

        $res = $this->upload($admin, $tmp)->assertStatus(422);
        $this->assertStringContainsString('bukan template gabungan', (string) $res->json('pesan'));
        $this->assertNull(Santri::where('nik', '1101010000000008')->first());
    }

    // ---------- 11. template & data-gabungan bisa diunduh ----------

    public function test_11_unduh_template_dan_data(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id]);

        $santri = Santri::create(['nama_lengkap' => 'Unduh Saya', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25601', 'is_active' => true]);

        $this->actingAs($admin, 'sanctum')
            ->get('/api/admin/santri/import-template-gabungan')
            ->assertStatus(200);

        $this->actingAs($admin, 'sanctum')
            ->get('/api/admin/santri/data-gabungan?kode_lembaga=MI')
            ->assertStatus(200)
            ->assertHeader('content-disposition', 'attachment; filename=data-siswa-MI-'.$f['mi']->id.'.xlsx');

        // Isi pra-isi: santri_id + kode + nis di posisi blok lembaga.
        $isi = (new SantriLembagaDataExport($f['mi']->id))->array();
        $this->assertCount(1, $isi);
        $this->assertSame((string) $santri->id, $isi[0][0]);
        $this->assertSame('MI', $isi[0][1]);
        $this->assertSame('25601', $isi[0][3]);
        $this->assertSame('Unduh Saya', $isi[0][8]);
    }
}
