<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\TemplateDokumen;
use App\Models\User;
use App\Services\Template\AsetGambar;
use App\Services\Template\DokumenPdf;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Alur lengkap yang dilakukan pengguna: buat template, unggah PDF, susun
 * medan, isi dengan data nyata, lalu cetak. Diuji lewat HTTP agar jalur yang
 * dilalui sama dengan yang dipakai frontend.
 */
class AlurTemplateCetakTest extends TestCase
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

    private function superAdmin(): User
    {
        $user = User::create([
            'name' => 'Operator TU', 'email' => 'tu-'.uniqid().'@example.com', 'password' => 'password',
        ]);
        $user->assignRole('super_admin');

        return $user;
    }

    /** PDF template dua halaman, menyalin tata letak surat pada halaman 1. */
    private function berkasTemplate(int $halaman = 2): UploadedFile
    {
        $pdf = new DokumenPdf;
        $pdf->matikanTautanPustaka();
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);

        for ($i = 1; $i <= $halaman; $i++) {
            $pdf->AddPage();
            $pdf->SetFont('helvetica', 'B', 16);
            $pdf->SetXY(20, 15);
            $pdf->Cell(0, 10, 'SURAT KETERANGANGAN HALAMAN '.$i);
        }

        $jalur = tempnam(sys_get_temp_dir(), 'alur').'.pdf';
        file_put_contents($jalur, $pdf->Output('', 'S'));

        return new UploadedFile($jalur, 'template.pdf', 'application/pdf', null, true);
    }

    /** Literally = semua string literal pada stream yang sudah ditiup. */
    private function teksPdf(string $bytes): string
    {
        $gabung = '';

        if (preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $bytes, $cocok)) {
            foreach ($cocok[1] as $mentah) {
                $stream = @gzuncompress($mentah);
                if ($stream !== false) {
                    $gabung .= $stream;
                }
            }
        }

        preg_match_all('/\(((?:\\\\.|[^\\\\()])*)\)/s', $gabung, $literal);

        return implode('', array_map(
            fn (string $s) => str_replace(['\\(', '\\)', '\\\\'], ['(', ')', '\\'], $s),
            $literal[1] ?? [],
        ));
    }

    public function test_alur_lengkap_dari_membuat_template_sampai_mencetak(): void
    {
        Lembaga::create(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);

        $auth = $this->superAdmin();
        $api = $this->actingAs($auth, 'sanctum');

        // 1. Buat template.
        $res = $api->postJson('/api/admin/template-dokumen', [
            'nama' => 'Surat Keterangan Santri',
            'kategori' => 'surat',
            'jenis' => 'pdf',
        ])->assertCreated();

        $id = $res->json('data.id');
        $this->assertSame('surat-keterangan-santri', $res->json('data.kode'), 'kode diturunkan dari nama');
        $this->assertFalse($res->json('data.punya_berkas'));

        // 2. Unggah PDF dua halaman.
        $res = $api->post('/api/admin/template-dokumen/'.$id.'/berkas', [
            'berkas' => $this->berkasTemplate(2),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame(2, $res->json('data.jumlah_halaman'));

        // 3. Susun medan: nama Santri, NIS lokal, dan nomor halaman di footer.
        $res = $api->patchJson('/api/admin/template-dokumen/'.$id, [
            'nama' => 'Surat Keterangan Santri',
            'kategori' => 'surat',
            'definisi' => ['medan' => [
                [
                    'tipe' => 'teks', 'label' => 'Nama Santri', 'halaman' => 1,
                    'x' => 20, 'y' => 50, 'w' => 170, 'h' => 8,
                    'sumber' => 'santri', 'kunci' => 'nama_lengkap',
                ],
                [
                    'tipe' => 'teks', 'label' => 'NIS Lokal', 'halaman' => 1,
                    'x' => 20, 'y' => 60, 'w' => 80, 'h' => 8,
                    'sumber' => 'penempatan_santri', 'kunci' => 'nis_lokal',
                ],
                [
                    'tipe' => 'halaman_otomatis', 'label' => 'Footer', 'halaman' => 2,
                    'x' => 20, 'y' => 280, 'w' => 100, 'h' => 6,
                ],
                [
                    'tipe' => 'teks', 'label' => 'Pencetak', 'halaman' => 2,
                    'x' => 20, 'y' => 270, 'w' => 100, 'h' => 6,
                    'sumber' => 'sistem', 'kunci' => 'pencetak',
                ],
            ]],
        ])->assertOk();

        $this->assertSame(4, $res->json('data.jumlah_medan'));
        $this->assertSame('helvetica', $res->json('data.definisi.medan.0.gaya.font'));

        // 4. Siapkan data nyata.
        $santri = Santri::create([
            'nama_lengkap' => 'Ahmad Fauzi bin Abdul', 'jk' => 'L', 'tipe_santri' => 'asrama',
        ]);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MTS', 'nis_lokal' => '2026-0012', 'is_active_lembaga' => 'Ya',
        ]);
        $santri->riwayatBelajar()->create([
            'tahun_ajaran' => '2026/2027', 'jenjang' => 'MTS', 'semester' => '1', 'is_active_riwayat' => 'Ya',
        ]);

        // 5. Isi dan cetak.
        $res = $api->post('/api/admin/template-dokumen/'.$id.'/isi', [
            'id_santri' => $santri->id,
            'tahun_ajaran' => '2026/2027',
            'semester' => '1',
        ])->assertOk();

        $this->assertStringStartsWith('application/pdf', (string) $res->headers->get('Content-Type'));

        $teks = $this->teksPdf((string) $res->getContent());

        $this->assertStringContainsString('SURAT KETERANGANGAN HALAMAN 1', $teks, 'halaman template 1');
        $this->assertStringContainsString('SURAT KETERANGANGAN HALAMAN 2', $teks, 'halaman template 2');
        $this->assertStringContainsString('Ahmad Fauzi bin Abdul', $teks, 'nama dari database');
        $this->assertStringContainsString('2026-0012', $teks, 'NIS lokal dari penempatan');
        $this->assertStringContainsString('Halaman 2 dari 2', $teks, 'nomor halaman dihitung');
        $this->assertStringContainsString('Operator TU', $teks, 'pencetak dari pengguna yang masuk');
        $this->assertStringNotContainsString('Powered by TCPDF', $teks);

        // 6. Berkas template masih utuh di penyimpanan.
        $path = TemplateDokumen::find($id)->path_pdf;
        Storage::disk(AsetGambar::DISK)->assertExists($path);
        $this->assertStringStartsWith('template/pdf/', $path, 'nama berkas diacak');
    }

    public function test_isi_gagal_dengan_pesan_indonesia_bila_berkas_hilang(): void
    {
        Lembaga::create(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true]);
        $auth = $this->superAdmin();
        $api = $this->actingAs($auth, 'sanctum');

        $id = $api->postJson('/api/admin/template-dokumen', [
            'nama' => 'Tanpa Berkas', 'kategori' => 'surat', 'jenis' => 'pdf',
        ])->assertCreated()->json('data.id');

        $api->postJson('/api/admin/template-dokumen/'.$id.'/isi', [])
            ->assertStatus(422)
            ->assertJsonPath('pesan', fn (string $p) => str_contains($p, 'belum memiliki berkas PDF'));
    }

    public function test_isi_menolak_medan_yang_menunjuk_halaman_di_luar_berkas(): void
    {
        Lembaga::create(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true]);
        $auth = $this->superAdmin();
        $api = $this->actingAs($auth, 'sanctum');

        $id = $api->postJson('/api/admin/template-dokumen', [
            'nama' => 'Surat Dua Halaman', 'kategori' => 'surat', 'jenis' => 'pdf',
        ])->assertCreated()->json('data.id');

        $api->post('/api/admin/template-dokumen/'.$id.'/berkas', [
            'berkas' => $this->berkasTemplate(1),
        ], ['Accept' => 'application/json'])->assertOk();

        $api->patchJson('/api/admin/template-dokumen/'.$id, [
            'nama' => 'Surat Dua Halaman', 'kategori' => 'surat',
            'definisi' => ['medan' => [[
                'tipe' => 'teks', 'label' => 'Di luar', 'halaman' => 5,
                'x' => 20, 'y' => 50, 'w' => 80, 'h' => 8,
            ]]],
        ])->assertStatus(422);
    }
}
