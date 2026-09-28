<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\TemplateDokumen;
use App\Models\User;
use App\Services\Template\DokumenPdf;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TemplateDokumenApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
        Storage::fake('local');
    }

    private function fixture(): void
    {
        Lembaga::create(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true]);
        Lembaga::create(['nama' => 'MA', 'jenjang' => 'MA', 'is_active' => true]);
    }

    private function superAdmin(): User
    {
        $user = User::create([
            'name' => 'Super', 'email' => 'super-'.uniqid().'@example.com', 'password' => 'password',
        ]);
        $user->assignRole('super_admin');

        return $user;
    }

    private function tanpaIzin(string $role = 'guru'): User
    {
        $user = User::create([
            'name' => 'Tanpa Izin', 'email' => 'tanpa-'.uniqid().'@example.com', 'password' => 'password',
        ]);
        $user->assignRole($role);

        return $user;
    }

    /** Berkas PDF template sekali pakai untuk pengujian unggah. */
    private function berkasPdf(int $halaman = 1): UploadedFile
    {
        $pdf = new DokumenPdf;
        $pdf->matikanTautanPustaka();
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);

        for ($i = 1; $i <= $halaman; $i++) {
            $pdf->AddPage();
            $pdf->SetFont('helvetica', 'B', 16);
            $pdf->SetXY(20, 15);
            $pdf->Cell(0, 10, 'SURAT KETERANGAN '.$i);
        }

        $jalur = tempnam(sys_get_temp_dir(), 'tpl').'.pdf';
        file_put_contents($jalur, $pdf->Output('', 'S'));

        return new UploadedFile($jalur, 'template.pdf', 'application/pdf', null, true);
    }

    private function template(array $atribut = []): TemplateDokumen
    {
        return TemplateDokumen::create(array_merge([
            'kode' => 'tpl-'.uniqid(),
            'nama' => 'Surat Uji',
            'path_pdf' => $this->simpanPdfFixture(1),
            'halaman' => [['lebar_mm' => 210.0, 'tinggi_mm' => 297.0]],
            'jumlah_halaman' => 1,
            'definisi' => ['medan' => []],
        ], $atribut));
    }

    private function simpanPdfFixture(int $halaman): string
    {
        $berkas = $this->berkasPdf($halaman);
        $path = 'template/fixture-'.uniqid().'.pdf';
        Storage::disk('local')->put($path, (string) file_get_contents($berkas->getRealPath()));

        return $path;
    }

    public function test_daftar_menampilkan_template_global_dan_milik_lembaga_yang_boleh(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        $global = TemplateDokumen::create(['kode' => 'g-'.uniqid(), 'nama' => 'Global']);
        $mts = TemplateDokumen::create(['kode' => 'm-'.uniqid(), 'nama' => 'MTS', 'jenjang' => 'MTS']);
        TemplateDokumen::create(['kode' => 'a-'.uniqid(), 'nama' => 'MA', 'jenjang' => 'MA']);

        $res = $this->actingAs($auth, 'sanctum')
            ->getJson('/api/admin/template-dokumen?jenjang=MTS')
            ->assertOk();

        $id = array_column($res->json('data'), 'id');
        $this->assertContains($global->id, $id);
        $this->assertContains($mts->id, $id);
        $this->assertCount(2, $id, 'template lembaga lain tidak boleh terlihat');
    }

    public function test_daftar_menghormati_filter_kategori_dan_pencarian(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();

        TemplateDokumen::create(['kode' => 'a-'.uniqid(), 'nama' => 'Sertifikat Kelulusan', 'kategori' => 'sertifikat']);
        TemplateDokumen::create(['kode' => 'b-'.uniqid(), 'nama' => 'Surat Izin Keluar', 'kategori' => 'surat']);

        $res = $this->actingAs($auth, 'sanctum')
            ->getJson('/api/admin/template-dokumen?kategori=sertifikat')
            ->assertOk();
        $this->assertCount(1, $res->json('data'));
        $this->assertSame('Sertifikat Kelulusan', $res->json('data.0.nama'));

        $res = $this->actingAs($auth, 'sanctum')
            ->getJson('/api/admin/template-dokumen?q=Keluar')
            ->assertOk();
        $this->assertCount(1, $res->json('data'));
    }

    public function test_katalog_nilai_tersedia_untuk_editor(): void
    {
        $auth = $this->superAdmin();

        $res = $this->actingAs($auth, 'sanctum')
            ->getJson('/api/admin/template-dokumen/katalog')
            ->assertOk();

        $this->assertNotEmpty($res->json('data.sumber'));
        $this->assertNotEmpty($res->json('data.koleksi'));
    }

    public function test_membuat_template_menolak_kategori_asing(): void
    {
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')
            ->postJson('/api/admin/template-dokumen', ['nama' => 'X', 'kategori' => 'entah', 'jenis' => 'pdf'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('kategori');
    }

    public function test_membuat_template_menolak_berkas_bukan_pdf(): void
    {
        $auth = $this->superAdmin();

        $this->actingAs($auth, 'sanctum')
            ->post('/api/admin/template-dokumen', [
                'nama' => 'X', 'kategori' => 'surat', 'jenis' => 'pdf',
                'berkas' => UploadedFile::fake()->create('nama.txt', 4, 'text/plain'),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('berkas');
    }

    public function test_mencadangkan_tenant_lain_ditolak(): void
    {
        $this->fixture();
        $auth = $this->tanpaIzin('guru');
        $auth->lembagas()->attach('MTS');

        $this->actingAs($auth, 'sanctum')
            ->postJson('/api/admin/template-dokumen', [
                'nama' => 'Milik MA', 'kategori' => 'surat', 'jenis' => 'pdf', 'jenjang' => 'MA',
            ])
            ->assertStatus(403);
    }

    public function test_unggah_berkas_pdf_membaca_jumlah_halaman(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();

        $res = $this->actingAs($auth, 'sanctum')
            ->post('/api/admin/template-dokumen/'.$template->id.'/berkas', [
                'berkas' => $this->berkasPdf(3),
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->assertSame(3, $res->json('data.jumlah_halaman'));
        $this->assertCount(3, $res->json('data.halaman'));
        $this->assertEqualsWithDelta(210.0, (float) $res->json('data.halaman.0.lebar_mm'), 0.01);
        $this->assertEqualsWithDelta(297.0, (float) $res->json('data.halaman.0.tinggi_mm'), 0.01);
        $this->assertTrue($res->json('data.punya_berkas'));
    }

    public function test_unggah_berkas_rusak_ditolak_dengan_pesan(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();

        $rusak = UploadedFile::fake()->createWithContent('rusak.pdf', 'ini jelas bukan pdf');

        $this->actingAs($auth, 'sanctum')
            ->post('/api/admin/template-dokumen/'.$template->id.'/berkas', ['berkas' => $rusak], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('pesan', fn (string $p) => str_contains($p, 'tidak dapat dibaca'));
    }

    public function test_simpan_medan_menolak_koleksi_tak_dikenal(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();

        $this->actingAs($auth, 'sanctum')
            ->patchJson('/api/admin/template-dokumen/'.$template->id, [
                'nama' => 'Surat Uji', 'kategori' => 'surat',
                'definisi' => ['medan' => [[
                    'tipe' => 'baris_berulang', 'label' => 'X', 'halaman' => 1, 'x' => 1, 'y' => 1, 'w' => 10, 'h' => 5,
                    'baris_berulang' => ['sumber' => 'entah', 'jumlah' => 3, 'kolom' => [['w' => 5]]],
                ]]],
            ])
            ->assertStatus(422);
    }

    public function test_simpan_medan_menolak_halaman_di_luar_jangkauan(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();

        $this->actingAs($auth, 'sanctum')
            ->patchJson('/api/admin/template-dokumen/'.$template->id, [
                'nama' => 'Surat Uji', 'kategori' => 'surat',
                'definisi' => ['medan' => [[
                    'tipe' => 'teks', 'label' => 'X', 'halaman' => 7, 'x' => 1, 'y' => 1, 'w' => 10, 'h' => 5,
                ]]],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('definisi.medan.0.halaman');
    }

    public function test_medan_berhasil_disimpan_dan_dinormalisasi(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();

        $res = $this->actingAs($auth, 'sanctum')
            ->patchJson('/api/admin/template-dokumen/'.$template->id, [
                'nama' => 'Surat Uji', 'kategori' => 'surat',
                'definisi' => ['medan' => [[
                    'tipe' => 'teks', 'label' => 'Nama', 'halaman' => 1, 'x' => 20, 'y' => 50, 'w' => 170, 'h' => 8,
                    'sumber' => 'santri', 'kunci' => 'nama_lengkap',
                ]]],
            ])
            ->assertOk();

        $medan = $res->json('data.definisi.medan.0');
        $this->assertSame('nama_lengkap', $medan['kunci']);
        $this->assertSame('helvetica', $medan['gaya']['font'], 'nilai bawaan gaya harus terisi');
        $this->assertTrue($medan['gaya']['skala_otomatis']);
    }

    public function test_duplikat_membuat_salinan_dengan_kode_baru(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template(['nama' => 'Surat Keterangan']);

        $res = $this->actingAs($auth, 'sanctum')
            ->postJson('/api/admin/template-dokumen/'.$template->id.'/duplikat')
            ->assertCreated();

        $this->assertNotSame($template->kode, $res->json('data.kode'));
        $this->assertStringContainsString('salinan', $res->json('data.nama'));
        $this->assertDatabaseHas('template_dokumen', ['kode' => $res->json('data.kode')]);
    }

    public function test_hapus_template_ikut_menghapus_berkas(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();
        $path = $template->path_pdf;

        $this->actingAs($auth, 'sanctum')
            ->deleteJson('/api/admin/template-dokumen/'.$template->id)
            ->assertOk();

        $this->assertDatabaseMissing('template_dokumen', ['id' => $template->id]);
        Storage::disk('local')->assertMissing($path);
    }

    public function test_isi_cetak_menghasilkan_pdf(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template(['definisi' => ['medan' => [
            ['tipe' => 'teks', 'label' => 'Tanggal', 'sumber' => 'sistem', 'kunci' => 'tanggal_hari_ini', 'x' => 20, 'y' => 50, 'w' => 80, 'h' => 8],
        ]]]);

        $res = $this->actingAs($auth, 'sanctum')
            ->post('/api/admin/template-dokumen/'.$template->id.'/isi', [])
            ->assertOk();

        $this->assertStringStartsWith('application/pdf', (string) $res->headers->get('Content-Type'));
        $this->assertStringContainsString('inline', (string) $res->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF-', (string) $res->getContent());
    }

    public function test_isi_cetak_bisa_diminta_sebagai_unduhan(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();

        $res = $this->actingAs($auth, 'sanctum')
            ->postJson('/api/admin/template-dokumen/'.$template->id.'/isi', ['unduh' => true])
            ->assertOk();

        $this->assertStringContainsString('attachment', (string) $res->headers->get('Content-Disposition'));
    }

    public function test_isi_cetak_menolak_santri_tidak_ada(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();

        $this->actingAs($auth, 'sanctum')
            ->postJson('/api/admin/template-dokumen/'.$template->id.'/isi', ['id_santri' => 999999])
            ->assertStatus(422)
            ->assertJsonValidationErrors('id_santri');
    }

    public function test_isi_cetak_menolak_tahun_ajaran_tidak_dikenal(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();

        $this->actingAs($auth, 'sanctum')
            ->postJson('/api/admin/template-dokumen/'.$template->id.'/isi', ['tahun_ajaran' => '1999/2000'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('tahun_ajaran');
    }

    public function test_berkas_template_disajikan_untuk_editor(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = $this->template();

        $res = $this->actingAs($auth, 'sanctum')
            ->get('/api/admin/template-dokumen/'.$template->id.'/berkas')
            ->assertOk();

        $this->assertStringStartsWith('application/pdf', (string) $res->headers->get('Content-Type'));
        // BinaryFileResponse tidak menahan isi di memori; isinya dibaca dari berkas.
        $jalur = $res->baseResponse->getFile()?->getPathname();
        $this->assertIsString($jalur);
        $this->assertStringStartsWith('%PDF-', (string) file_get_contents($jalur));
        // pdf.js membaca lewat Authorization, jadi tidak boleh disimpan di cache.
        $this->assertStringContainsString('no-store', (string) $res->headers->get('Cache-Control'));
    }

    public function test_berkas_template_tanpa_berkas_menghasilkan_404(): void
    {
        $this->fixture();
        $auth = $this->superAdmin();
        $template = TemplateDokumen::create([
            'kode' => 'kosong-'.uniqid(),
            'nama' => 'Tanpa Berkas',
            'definisi' => ['medan' => []],
        ]);

        $this->actingAs($auth, 'sanctum')
            ->get('/api/admin/template-dokumen/'.$template->id.'/berkas')
            ->assertNotFound();
    }

    public function test_berkas_template_milik_lembaga_lain_ditolak(): void
    {
        $this->fixture();
        $auth = $this->tanpaIzin('guru');
        $auth->lembagas()->attach('MTS');
        $template = $this->template(['jenjang' => 'MA']);

        $this->actingAs($auth, 'sanctum')
            ->get('/api/admin/template-dokumen/'.$template->id.'/berkas')
            ->assertStatus(403);
    }

    public function test_endpoint_menuntut_izin(): void
    {
        $this->fixture();
        $auth = $this->tanpaIzin();

        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/template-dokumen')->assertStatus(403);
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/template-dokumen/katalog')->assertStatus(403);
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/template-dokumen', [])->assertStatus(403);
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/aset-dokumen')->assertStatus(403);

        $template = $this->template();
        $this->actingAs($auth, 'sanctum')
            ->get('/api/admin/template-dokumen/'.$template->id.'/berkas')
            ->assertStatus(403);
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/admin/template-dokumen')->assertStatus(401);
    }
}
