<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Pegawai;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\TemplateDokumen;
use App\Models\User;
use App\Services\Template\DokumenPdf;
use App\Services\Template\KonteksCetak;
use App\Services\Template\PdfIsian;
use App\Services\Template\PengisiNilai;
use App\Services\Template\TemplatePdfTidakValidException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Pencetakan diuji sampai isi teksnya, bukan hanya "%PDF-". Isi PDF berada di
 * dalam stream yang dikompresi, jadi stream-nya ditiup dulu dengan zlib bawaan
 * PHP. Cara ini dipilih supaya tes tidak perlu pdf.js: job backend di CI
 * berjalan tanpa `npm install`, dan keresahan-test tidak boleh bergantung pada
 * node_modules frontend.
 */
class PdfIsianTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private array $sisaBerkas = [];

    protected function tearDown(): void
    {
        foreach ($this->sisaBerkas as $berkas) {
            @unlink($berkas);
        }

        $this->sisaBerkas = [];

        parent::tearDown();
    }

    /** Simulasikan hasil ekspor Word/Canva: judul tetap di setiap halaman. */
    private function pdfTemplate(int $halaman = 1): string
    {
        $pdf = new DokumenPdf;
        $pdf->matikanTautanPustaka();
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);

        for ($i = 1; $i <= $halaman; $i++) {
            $pdf->AddPage();
            $pdf->SetFont('helvetica', 'B', 18);
            $pdf->SetXY(20, 15);
            $pdf->Cell(0, 10, 'HALAMAN '.$i.' SURAT KETERANGAN');
        }

        $jalur = 'template/uji-'.uniqid().'.pdf';
        Storage::disk('local')->put($jalur, $pdf->Output('', 'S'));

        return $jalur;
    }

    private function template(array $definisi, ?string $pathPdf = null, int $halaman = 1): TemplateDokumen
    {
        return TemplateDokumen::create([
            'kode' => 'uji-'.uniqid(),
            'nama' => 'Surat Uji',
            'path_pdf' => $pathPdf ?? $this->pdfTemplate($halaman),
            'halaman' => array_fill(0, $halaman, ['lebar_mm' => 210.0, 'tinggi_mm' => 297.0]),
            'jumlah_halaman' => $halaman,
            'definisi' => $definisi,
        ]);
    }

    private function fixture(): array
    {
        Storage::fake('local');

        $lembaga = Lembaga::create([
            'nama' => 'Pondasi WLAN 2', 'jenjang' => 'MTS', 'akreditasi' => 'A', 'is_active' => true,
        ]);
        TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);
        $kelas = Kelas::create(['jenjang' => 'MTS', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '7A', 'tingkat' => 'VII']);

        $santri = Santri::create([
            'nama_lengkap' => 'Ahmad Fauzi bin Abdul', 'jk' => 'L', 'tipe_santri' => 'asrama',
            'tmp_lahir' => 'Bandung', 'tgl_lahir' => '2012-05-17', 'nisn' => '0081234567',
        ]);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => 'MTS', 'nis_lokal' => '2026-0012', 'is_active_lembaga' => 'Ya']);
        $santri->riwayatBelajar()->create([
            'tahun_ajaran' => '2026/2027', 'jenjang' => 'MTS', 'kelas_id' => $kelas->id,
            'semester' => '1', 'no_absen' => 7, 'is_active_riwayat' => 'Ya',
        ]);

        $kedua = Santri::create(['nama_lengkap' => 'Budi Santoso', 'jk' => 'P', 'tipe_santri' => 'non_asrama']);
        $kedua->riwayatBelajar()->create([
            'tahun_ajaran' => '2026/2027', 'jenjang' => 'MTS', 'kelas_id' => $kelas->id,
            'semester' => '1', 'no_absen' => 3, 'is_active_riwayat' => 'Ya',
        ]);

        $pegawai = Pegawai::create([
            'nama_lengkap' => 'Siti Aminah, S.Pd.', 'jenis_kelamin' => 'P', 'nip' => '198705122011011004',
        ]);

        $user = User::create(['name' => 'Operator TU', 'email' => 'tu-'.uniqid().'@example.com', 'password' => 'x']);

        return compact('lembaga', 'kelas', 'santri', 'kedua', 'pegawai', 'user');
    }

    private function cetak(TemplateDokumen $template, array $konteks = []): string
    {
        $ctx = new KonteksCetak(
            jenjang: 'MTS',
            tahunAjaran: '2026/2027',
            semester: '1',
            kelasId: $konteks['kelas_id'] ?? null,
            pencetak: $konteks['pencetak'] ?? null,
            tetap: $konteks['tetap'] ?? [],
            tanggalAbsen: $konteks['tanggal_absen'] ?? null,
            idSantri: $konteks['id_santri'] ?? null,
            idPegawai: $konteks['id_pegawai'] ?? null,
        );

        return (new PdfIsian($template, new PengisiNilai($ctx), $ctx))->hasil();
    }

    /**
     * Seluruh string literal di dalam stream halaman, sudah ditiup. Dengan
     * begitu assertion bisa menulis "nilai ini benar-benar tercetak".
     */
    private function teksPdf(string $bytes): string
    {
        $gabung = '';

        if (preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $bytes, $cocok)) {
            foreach ($cocok[1] as $mentah) {
                $stream = @gzuncompress($mentah);

                if ($stream === false) {
                    continue;
                }

                $gabung .= $stream;
            }
        }

        // Ambil literal ( ... ) yang ditulis TCPDF di operator Tj/TJ.
        preg_match_all('/\(((?:\\\\.|[^\\\\()])*)\)/s', $gabung, $literal);

        // TCPDF memecah satu teks menjadi beberapa literal di dalam operator TJ
        // saat ada kerning, jadi literal digabung tanpa pemisah. Spasi akan
        // menyisipkan celah palsu di tengah satu kata.
        return implode('', array_map(
            fn (string $s) => str_replace(['\\(', '\\)', '\\\\'], ['(', ')', '\\'], $s),
            $literal[1] ?? [],
        ));
    }

    private function assertTercetak(string $bytes, string $harapan, string $pesan = ''): void
    {
        $this->assertStringContainsString($harapan, $this->teksPdf($bytes), $pesan);
    }

    private function assertTidakTercetak(string $bytes, string $takDiharapkan, string $pesan = ''): void
    {
        $this->assertStringNotContainsString($takDiharapkan, $this->teksPdf($bytes), $pesan);
    }

    public function test_menghasilkan_pdf_yang_sah_dengan_nilai_santri(): void
    {
        $f = $this->fixture();

        $template = $this->template(['medan' => [
            ['tipe' => 'teks', 'label' => 'Nama', 'sumber' => 'santri', 'kunci' => 'nama_lengkap', 'x' => 20, 'y' => 50, 'w' => 170, 'h' => 8],
            ['tipe' => 'teks', 'label' => 'NISN', 'sumber' => 'santri', 'kunci' => 'nisn', 'x' => 20, 'y' => 60, 'w' => 60, 'h' => 8],
            ['tipe' => 'teks', 'label' => 'Lembaga', 'sumber' => 'lembaga', 'kunci' => 'nama', 'x' => 20, 'y' => 70, 'w' => 170, 'h' => 8],
        ]]);

        $hasil = $this->cetak($template, ['id_santri' => $f['santri']->id, 'pencetak' => $f['user']]);

        $this->assertStringStartsWith('%PDF-', $hasil);
        $this->assertGreaterThan(2000, strlen($hasil));

        $this->assertTercetak($hasil, 'HALAMAN 1 SURAT KETERANGAN', 'halaman template harus tetap ada');
        $this->assertTercetak($hasil, 'Ahmad Fauzi bin Abdul');
        $this->assertTercetak($hasil, '0081234567');
        $this->assertTercetak($hasil, 'Pondasi WLAN 2');
        $this->assertTidakTercetak($hasil, 'Powered by TCPDF', 'branding pustaka tidak boleh muncul di dokumen pengguna');
    }

    public function test_semua_halaman_template_diimpor(): void
    {
        $f = $this->fixture();
        $template = $this->template(
            ['medan' => [
                ['tipe' => 'teks', 'label' => 'Nama', 'sumber' => 'santri', 'kunci' => 'nama_lengkap', 'halaman' => 2, 'x' => 20, 'y' => 50, 'w' => 170, 'h' => 8],
            ]],
            halaman: 2,
        );

        $hasil = $this->cetak($template, ['id_santri' => $f['santri']->id]);

        $this->assertTercetak($hasil, 'HALAMAN 1 SURAT KETERANGAN');
        $this->assertTercetak($hasil, 'HALAMAN 2 SURAT KETERANGAN');
        $this->assertTercetak($hasil, 'Ahmad Fauzi bin Abdul');
    }

    public function test_medan_halaman_otomatis_menghitung_nomor(): void
    {
        $f = $this->fixture();
        $template = $this->template(
            ['medan' => [
                ['tipe' => 'halaman_otomatis', 'label' => 'Footer 1', 'halaman' => 1, 'x' => 20, 'y' => 280, 'w' => 100, 'h' => 6],
                ['tipe' => 'halaman_otomatis', 'label' => 'Footer 2', 'halaman' => 2, 'x' => 20, 'y' => 280, 'w' => 100, 'h' => 6],
            ]],
            halaman: 2,
        );

        $hasil = $this->cetak($template, ['id_santri' => $f['santri']->id]);

        $this->assertTercetak($hasil, 'Halaman 1 dari 2');
        $this->assertTercetak($hasil, 'Halaman 2 dari 2');
    }

    public function test_tanda_tangan_tidak_mencetak_apa_pun(): void
    {
        $f = $this->fixture();
        $template = $this->template(['medan' => [
            ['tipe' => 'tanda_tangan', 'label' => 'TandaTangan', 'x' => 140, 'y' => 240, 'w' => 40, 'h' => 20],
        ]]);

        $hasil = $this->cetak($template, ['id_santri' => $f['santri']->id]);

        $this->assertStringStartsWith('%PDF-', $hasil);
        $this->assertTidakTercetak($hasil, 'TandaTangan', 'penanda slot tidak boleh ikut tercetak');
    }

    public function test_centang_hanya_tercetak_bila_nilai_cocok(): void
    {
        $f = $this->fixture();

        $template = $this->template(['medan' => [
            ['tipe' => 'centang', 'label' => 'L', 'sumber' => 'santri', 'kunci' => 'jk', 'bawa' => 'L',
                'huruf' => 'CENTANG', 'x' => 20, 'y' => 50, 'w' => 30, 'h' => 5],
        ]]);

        $this->assertTercetak(
            $this->cetak($template, ['id_santri' => $f['santri']->id]),
            'CENTANG',
            'jk = L harus tercentang',
        );

        $this->assertTidakTercetak(
            $this->cetak($template, ['id_santri' => $f['kedua']->id]),
            'CENTANG',
            'jk = P tidak boleh tercentang',
        );
    }

    public function test_tanggal_dan_bentuk_turunan_tercetak(): void
    {
        $f = $this->fixture();
        $template = $this->template(['medan' => [
            ['tipe' => 'teks', 'label' => 'Tgl lahir', 'sumber' => 'santri', 'kunci' => 'tgl_lahir_umur', 'x' => 20, 'y' => 50, 'w' => 120, 'h' => 8],
            ['tipe' => 'teks', 'label' => 'Tipe', 'sumber' => 'santri', 'kunci' => 'tipe_santri_tercantum', 'x' => 20, 'y' => 60, 'w' => 60, 'h' => 8],
        ]]);

        $hasil = $this->cetak($template, ['id_santri' => $f['santri']->id]);

        $this->assertTercetak($hasil, '17 Mei 2012');
        $this->assertTercetak($hasil, 'Asrama');
    }

    public function test_huruf_besar_dan_skala_otomatis(): void
    {
        $f = $this->fixture();
        $template = $this->template(['medan' => [
            ['tipe' => 'teks', 'label' => 'Nama', 'sumber' => 'santri', 'kunci' => 'nama_lengkap',
                'x' => 20, 'y' => 50, 'w' => 30, 'h' => 6,
                'gaya' => ['huruf_besar' => true, 'ukuran' => 14, 'skala_otomatis' => true, 'huruf_min' => 5]],
        ]]);

        $hasil = $this->cetak($template, ['id_santri' => $f['santri']->id]);

        $this->assertTercetak($hasil, 'AHMAD FAUZI');
    }

    public function test_baris_berulang_menulis_kolom_dan_menomborkan_baris(): void
    {
        $f = $this->fixture();
        $template = $this->template(['medan' => [
            ['tipe' => 'baris_berulang', 'label' => 'Daftar', 'x' => 20, 'y' => 60, 'w' => 170, 'h' => 40,
                'baris_berulang' => [
                    'sumber' => 'daftar_santri_kelas', 'jumlah' => 10, 'tinggi_baris' => 8,
                    'kolom' => [
                        ['label' => 'No', 'x' => 0, 'w' => 12, 'sumber' => 'tetap', 'kunci' => 'no_urut', 'gaya' => ['rata' => 'tengah']],
                        ['label' => 'Nama', 'x' => 14, 'w' => 120, 'sumber' => 'baris', 'kunci' => 'nama_lengkap'],
                    ],
                ]],
        ]]);

        $hasil = $this->cetak($template, ['id_santri' => $f['santri']->id, 'kelas_id' => $f['kelas']->id]);

        $this->assertTercetak($hasil, 'Budi Santoso', 'kelas terurut dari no_absen terkecil');
        $this->assertTercetak($hasil, 'Ahmad Fauzi bin Abdul');
    }

    public function test_baris_berulang_dibatasi_jumlah_slot(): void
    {
        $f = $this->fixture();
        $template = $this->template(['medan' => [
            ['tipe' => 'baris_berulang', 'label' => 'Daftar', 'x' => 20, 'y' => 60, 'w' => 170, 'h' => 100,
                'baris_berulang' => [
                    'sumber' => 'daftar_santri_kelas', 'jumlah' => 1, 'tinggi_baris' => 8,
                    'kolom' => [['label' => 'Nama', 'x' => 0, 'w' => 120, 'sumber' => 'baris', 'kunci' => 'nama_lengkap']],
                ]],
        ]]);

        $hasil = $this->cetak($template, ['id_santri' => $f['santri']->id, 'kelas_id' => $f['kelas']->id]);

        $this->assertTercetak($hasil, 'Budi Santoso');
        $this->assertTidakTercetak($hasil, 'Ahmad Fauzi bin Abdul', 'kelas hanya punya satu slot baris');
    }

    public function test_gambar_ada_dan_hilang_tidak_menggagalkan_pencetakan(): void
    {
        $f = $this->fixture();
        Storage::disk('local')->put('santri/foto/uji.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQ4jWNgGAWjYBSMglEwCkbBKBgFo4AaAQNUH8kNAvJm2SAAAAAElFTkSuQmCC'
        ));

        $santri = Santri::find($f['santri']->id);
        $santri->forceFill(['foto_url' => 'santri/foto/uji.png'])->save();

        $template = $this->template(['medan' => [
            ['tipe' => 'gambar', 'label' => 'Foto', 'sumber' => 'santri', 'kunci' => 'foto',
                'x' => 20, 'y' => 50, 'w' => 30, 'h' => 40, 'sizemode' => 'potong'],
        ]]);

        $hasil = $this->cetak($template, ['id_santri' => $santri->id]);
        $this->assertStringStartsWith('%PDF-', $hasil);

        $santri->forceFill(['foto_url' => 'santri/foto/hilang.png'])->save();
        $tanpaGambar = $this->cetak($template, ['id_santri' => $santri->id]);
        $this->assertStringStartsWith('%PDF-', $tanpaGambar, 'foto yang hilang tidak boleh menggagalkan pencetakan');
    }

    public function test_medan_dengan_sumber_tak_dikenal_dilewati(): void
    {
        $this->fixture();
        $template = $this->template(['medan' => [
            ['tipe' => 'teks', 'label' => 'Aneh', 'sumber' => 'entah', 'kunci' => 'apa', 'x' => 20, 'y' => 50, 'w' => 50, 'h' => 8],
        ]]);

        $this->assertStringStartsWith('%PDF-', $this->cetak($template));
    }

    public function test_pegawai_dan_nilai_tetap_terisi(): void
    {
        $f = $this->fixture();
        $template = $this->template(['medan' => [
            ['tipe' => 'teks', 'label' => 'Nama', 'sumber' => 'pegawai', 'kunci' => 'nama_lengkap', 'x' => 20, 'y' => 50, 'w' => 170, 'h' => 8],
            ['tipe' => 'teks', 'label' => 'NIP', 'sumber' => 'pegawai', 'kunci' => 'nip', 'x' => 20, 'y' => 60, 'w' => 170, 'h' => 8],
            ['tipe' => 'paragraf', 'label' => 'Nomor', 'sumber' => 'tetap', 'kunci' => 'teks', 'x' => 20, 'y' => 75, 'w' => 100, 'h' => 12],
            ['tipe' => 'teks', 'label' => 'Pencetak', 'sumber' => 'sistem', 'kunci' => 'pencetak', 'x' => 20, 'y' => 95, 'w' => 100, 'h' => 8],
        ]]);

        $hasil = $this->cetak($template, [
            'id_pegawai' => $f['pegawai']->id,
            'tetap' => ['teks' => 'Nomor 123/MTS/2026'],
            'pencetak' => $f['user'],
        ]);

        $this->assertTercetak($hasil, 'Siti Aminah, S.Pd.');
        $this->assertTercetak($hasil, '198705122011011004');
        $this->assertTercetak($hasil, 'Nomor 123/MTS/2026');
        $this->assertTercetak($hasil, 'Operator TU');
    }

    public function test_berkas_pdf_rusak_ditolak_dengan_pesan_indonesia(): void
    {
        $this->fixture();
        Storage::disk('local')->put('template/rusak.pdf', 'ini bukan pdf sama sekali');

        $template = $this->template(['medan' => []], 'template/rusak.pdf');

        $this->expectException(TemplatePdfTidakValidException::class);
        $this->expectExceptionMessageMatches('/tidak dapat|diproteksi/');

        $this->cetak($template);
    }

    public function test_berkas_pdf_hilang_ditolak(): void
    {
        $this->fixture();
        $template = $this->template(['medan' => []], 'template/tidak-ada.pdf');

        $this->expectException(TemplatePdfTidakValidException::class);

        $this->cetak($template);
    }

    public function test_template_tanpa_berkas_ditolak(): void
    {
        $this->fixture();
        $template = TemplateDokumen::create([
            'kode' => 'tanpa-'.uniqid(),
            'nama' => 'Tanpa Berkas',
            'definisi' => ['medan' => []],
        ]);

        $this->expectException(TemplatePdfTidakValidException::class);

        $this->cetak($template);
    }

    public function test_nama_berkas_memakai_nama_template(): void
    {
        $this->fixture();
        $template = $this->template(['medan' => []]);
        $template->nama = 'Surat Keterangan Santri';

        $ctx = new KonteksCetak;
        $nama = (new PdfIsian($template, new PengisiNilai($ctx), $ctx))->namaBerkas();

        $this->assertStringStartsWith('surat-keterangan-santri-', $nama);
        $this->assertStringEndsWith('.pdf', $nama);
    }
}
