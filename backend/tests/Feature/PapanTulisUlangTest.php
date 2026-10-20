<?php

namespace Tests\Feature;

use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Services\PapanTulisUlang;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

/**
 * Penulisan ulang berkas peta dari papan.
 *
 * Yang dijaga: berkas baik tidak boleh tertimpa hasil timpang. Markdown cuma
 * turunan, jadi kehilangan isi besar-besaran selalu berarti papan tidak
 * terbaca — bukan isinya memang menyusut.
 */
class PapanTulisUlangTest extends TestCase
{
    use RefreshDatabase;

    private string $berkas;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('database.connections.papan.database', ':memory:');

        $this->artisan('migrate', [
            '--path' => 'database/migrations/papan',
            '--database' => 'papan',
            '--force' => true,
        ])->run();

        $this->berkas = tempnam(sys_get_temp_dir(), 'peta').'.md';
    }

    protected function tearDown(): void
    {
        if (is_file($this->berkas)) {
            unlink($this->berkas);
        }

        parent::tearDown();
    }

    public function test_menulis_ulang_saat_isi_berbeda(): void
    {
        $this->buatItem('A.1', 'Setup (001)', 'done', ['Proyek berjalan.']);
        $this->tulisBerkas($this->isiPeta('todo'));

        $hasil = app(PapanTulisUlang::class)->jalankan($this->berkas);

        $this->assertTrue($hasil['berubah']);
        $this->assertStringContainsString('## A.1 Setup (001) '.chr(96).'Selesai (Done)'.chr(96), file_get_contents($this->berkas));
    }

    public function test_tidak_menulis_saat_sudah_selaras(): void
    {
        $this->buatItem('A.1', 'Setup (001)', 'done', ['Proyek berjalan.']);

        $sekali = app(PapanTulisUlang::class)->jalankan($this->berkas($this->isiPeta('todo')));
        $duaKali = app(PapanTulisUlang::class)->jalankan($this->berkas);

        $this->assertTrue($sekali['berubah']);
        $this->assertFalse($duaKali['berubah']);
    }

    public function test_menolak_berkas_kosong(): void
    {
        $this->tulisBerkas('');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Berkas peta kosong');

        app(PapanTulisUlang::class)->jalankan($this->berkas);
    }

    /**
     * Pengaman utama: berkas yang jauh lebih kaya daripada isi papan tidak
     * boleh tertimpa. Terjadi kalau papan terbaca kosong/hampir kosong —
     * mis. koneksi salah — padahal berkasnya masih utuh.
     */
    public function test_menolak_hasil_yang_jauh_lebih_pendek(): void
    {
        // Berkas kaya butir (kepala panjang + banyak butir di A.1).
        $gemuk = $this->isiPeta('todo', array_fill(0, 300, 'Butir panjang sekali supaya berkasnya gemuk.'));
        $this->tulisBerkas($gemuk);

        // Papan hanya punya satu sub-modul berbutir satu -> hasil jauh lebih pendek.
        $this->buatItem('A.1', 'Setup (001)', 'done', ['Proyek berjalan.']);

        $pesan = null;

        try {
            app(PapanTulisUlang::class)->jalankan($this->berkas);
        } catch (RuntimeException $e) {
            $pesan = $e->getMessage();
        }

        $this->assertNotNull($pesan, 'Seharusnya menolak hasil yang jauh lebih pendek.');
        $this->assertStringContainsString('penulisan dibatalkan', (string) $pesan);
        $this->assertSame($gemuk, file_get_contents($this->berkas), 'Berkas harus utuh.');
    }

    public function test_menolak_berkas_tanpa_penanda(): void
    {
        $this->tulisBerkas('# PETA\n\nTanpa penanda apa pun.\n');

        $this->expectException(RuntimeException::class);

        app(PapanTulisUlang::class)->jalankan($this->berkas);
    }

    public function test_coba_jalankan_mengembalikan_pesan_bukan_melempar(): void
    {
        $this->tulisBerkas('');

        $pesan = app(PapanTulisUlang::class)->cobaJalankan($this->berkas);

        $this->assertIsString($pesan);
        $this->assertStringContainsString('kosong', $pesan);
    }

    /**
     * Isi peta minimal yang bisa dipotong generator.
     *
     * @param  array<int, string>  $butir  butir tambahan di A.1 (untuk membuat berkas gemuk)
     */
    private function isiPeta(string $status, array $butir = ['Proyek berjalan.']): string
    {
        $daftar = implode("\n", array_map(fn (string $b): string => "- {$b}", $butir));

        return "# PETA\n\n> kepala\n\n# Aplikasi: Desktop Admin\n\n## A. Fondasi\n\n### A.1 Setup (001) {$status}\n**"
            .strtoupper($status)."**\n{$daftar}\n\n# SEDANG DIKERJAKAN\n\n**Kosong.**\n\n---\n\n"
            ."# RINCIAN TEKNIS LAINNYA\n\n- Sesuatu\n";
    }

    /** Tulis berkas lalu kembalikan lokasinya. */
    private function berkas(string $isi): string
    {
        $this->tulisBerkas($isi);

        return $this->berkas;
    }

    private function tulisBerkas(string $isi): void
    {
        file_put_contents($this->berkas, $isi);
    }

    /** @param array<int, string> $butir */
    private function buatItem(string $kode, string $nama, string $status, array $butir): void
    {
        $modul = PapanModul::query()->firstOrCreate(
            ['kode' => 'A'],
            ['nama' => 'Fondasi', 'urutan' => 1],
        );

        $item = PapanItem::create([
            'modul_id' => $modul->id,
            'kode' => $kode,
            'nama' => $nama,
            'status' => $status,
            'urutan' => 1,
        ]);

        foreach ($butir as $i => $deskripsi) {
            $item->butir()->create(['status' => $status, 'deskripsi' => $deskripsi, 'urutan' => $i + 1]);
        }
    }
}
