<?php

namespace Tests\Feature;

use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Support\PapanMarkdown;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

/**
 * Generator markdown papan: bagian A–G dihasilkan dari database, bagian H ke
 * bawah dipertahankan apa adanya. Yang diuji di sini adalah pemotongan berkas
 * dan bentuk keluaran — bagian yang bisa rusak diam-diam tanpa disadari.
 */
class PapanMarkdownTest extends TestCase
{
    use RefreshDatabase;

    private const KEPALA = "# PETA\n\n> kepala\n\n";

    private const EKOR = "# H. SEDANG DIKERJAKAN\n\n**Kosong.**\n\n---\n\n# I. RINCIAN TEKNIS LAINNYA\n\n- Sesuatu\n";

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('database.connections.papan.database', ':memory:');

        $this->artisan('migrate', [
            '--path' => 'database/migrations/papan',
            '--database' => 'papan',
            '--force' => true,
        ])->run();
    }

    public function test_potong_memisahkan_kepala_dan_ekor(): void
    {
        $isi = self::KEPALA."# A. Fondasi\n\n## A.1 Setup\n**SUDAH**\n- Satu.\n\n".self::EKOR;

        [$kepala, $ekor] = PapanMarkdown::potong($isi);

        $this->assertSame(self::KEPALA, $kepala);
        $this->assertSame(self::EKOR, $ekor);
    }

    public function test_potong_menolak_berkas_tanpa_penanda(): void
    {
        $this->expectException(RuntimeException::class);

        PapanMarkdown::potong("# PETA\n\nTanpa penanda apa pun.\n");
    }

    public function test_hasilkan_menyisipkan_modul_di_antara_kepala_dan_ekor(): void
    {
        $this->buatItem('A.1', 'Setup (001)', 'sudah', ['Proyek berjalan.']);

        $hasil = app(PapanMarkdown::class)->hasilkan(self::KEPALA, self::EKOR);

        $this->assertStringStartsWith(self::KEPALA, $hasil);
        $this->assertStringContainsString('# A. Fondasi', $hasil);
        $this->assertStringContainsString('## A.1 Setup (001)', $hasil);
        $this->assertStringContainsString('- Proyek berjalan.', $hasil);
        $this->assertStringContainsString('# I. RINCIAN TEKNIS LAINNYA', $hasil);
    }

    public function test_status_sub_modul_tampil_di_judul(): void
    {
        $this->buatItem('A.1', 'Setup (001)', 'sedang', ['Sedang jalan.']);

        $hasil = app(PapanMarkdown::class)->hasilkan(self::KEPALA, self::EKOR);

        // Tanpa ini, `papan:tandai` tidak terlihat di markdown selama
        // butir-butirnya belum ikut dipindahkan.
        $this->assertStringContainsString('## A.1 Setup (001) '.chr(96).'SEDANG'.chr(96), $hasil);
    }

    public function test_bagian_sedang_kosong_saat_tidak_ada_yang_dikerjakan(): void
    {
        $this->buatItem('A.1', 'Setup (001)', 'sudah', ['Proyek berjalan.']);

        $hasil = app(PapanMarkdown::class)->hasilkan(self::KEPALA, self::EKOR);

        $this->assertStringContainsString(
            "# H. SEDANG DIKERJAKAN\n\n**Kosong.**",
            $hasil,
        );
    }

    public function test_bagian_sedang_mendaftar_sub_modul_yang_dikerjakan(): void
    {
        $this->buatItem('A.1', 'Setup (001)', 'sedang', ['Sedang jalan.']);

        $hasil = app(PapanMarkdown::class)->hasilkan(self::KEPALA, self::EKOR);

        $this->assertStringContainsString('- **A.1 Setup (001)** (Fondasi)', $hasil);
        $this->assertStringNotContainsString('**Kosong.**', $hasil);
    }

    public function test_hasil_selalu_memuat_empat_blok_status(): void
    {
        $this->buatItem('A.1', 'Setup (001)', 'sudah', ['Proyek berjalan.']);

        $hasil = app(PapanMarkdown::class)->hasilkan(self::KEPALA, self::EKOR);

        foreach (['SUDAH', 'SEDANG', 'AKAN', 'DITUNDA'] as $status) {
            $this->assertStringContainsString("**{$status}**", $hasil);
        }
    }

    public function test_blok_status_kosong_ditulis_kosong(): void
    {
        $this->buatItem('A.1', 'Setup (001)', 'sudah', ['Proyek berjalan.']);

        $hasil = app(PapanMarkdown::class)->hasilkan(self::KEPALA, self::EKOR);

        $this->assertStringContainsString("**SEDANG**\n- (kosong)", $hasil);
    }

    public function test_hasil_stabil_saat_dijalankan_ulang(): void
    {
        $this->buatItem('A.1', 'Setup (001)', 'sudah', ['Proyek berjalan.']);

        $papan = app(PapanMarkdown::class);

        $sekali = $papan->hasilkan(self::KEPALA, self::EKOR);
        $duaKali = $papan->hasilkan(self::KEPALA, self::EKOR);

        $this->assertSame($sekali, $duaKali);
    }

    /**
     * Buat modul + sub-modul + butir untuk pengujian.
     *
     * @param  array<int, string>  $butir
     */
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
            $item->butir()->create([
                'status' => $status,
                'deskripsi' => $deskripsi,
                'urutan' => $i + 1,
            ]);
        }
    }
}
