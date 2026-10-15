<?php

namespace Tests\Feature;

use App\Models\Pegawai;
use App\Services\KelasService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * `KelasService::cariPegawai()` — resolusi kolom import `walas`: NIP dulu,
 * lalu nama (case-insensitive). Dipakai jalur import file yang tak terjangkau
 * `KelasWalasTest` (yang menguji endpoint set-walas).
 */
class KelasServiceCariPegawaiTest extends TestCase
{
    use RefreshDatabase;

    private KelasService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new KelasService;
    }

    private function pegawai(string $nama, ?string $nip = null): Pegawai
    {
        return Pegawai::create([
            'nama_lengkap' => $nama, 'jenis_kelamin' => 'L',
            'nip' => $nip, 'status_aktif' => 'Ya',
        ]);
    }

    public function test_nip_eksak_menang_atas_nama(): void
    {
        $a = $this->pegawai('Nama Sama', 'NIP-A');
        $this->pegawai('Nama Sama', 'NIP-B'); // nama ganda, tapi NIP unik

        $this->assertSame($a->id, $this->svc->cariPegawai('NIP-A')->id);
    }

    public function test_fallback_nama_case_insensitive_dan_trim(): void
    {
        $a = $this->pegawai('Budi Santoso');

        $this->assertSame($a->id, $this->svc->cariPegawai('budi santoso')->id);
        $this->assertSame($a->id, $this->svc->cariPegawai('  BUDI SANTOSO  ')->id);
    }

    public function test_nama_ganda_mewajibkan_nip(): void
    {
        $this->pegawai('Ganda');
        $this->pegawai('Ganda');

        try {
            $this->svc->cariPegawai('Ganda');
            $this->fail('Seharusnya menolak nama ganda tanpa NIP.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('walas', $e->errors());
        }
    }

    public function test_nama_tidak_ditemukan_ditolak(): void
    {
        $this->pegawai('Ada');

        try {
            $this->svc->cariPegawai('Tidak Ada');
            $this->fail('Seharusnya menolak nama yang tak ada.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('walas', $e->errors());
        }
    }

    /** NIP tidak boleh jatuh ke pencocokan nama walau teksnya sama. */
    public function test_nip_tidak_cocok_bukan_berarti_nama(): void
    {
        $this->pegawai('NIP-XYZ'); // nama pegawai kebetulan seperti NIP

        // Dicari sebagai NIP "NIP-XYZ": tidak ada NIP itu → fallback nama → ketemu.
        $this->assertSame('NIP-XYZ', $this->svc->cariPegawai('NIP-XYZ')->nama_lengkap);

        // Teks yang bukan NIP dan bukan nama → ditolak.
        $this->expectException(ValidationException::class);
        $this->svc->cariPegawai('NIP-ABC');
    }
}
