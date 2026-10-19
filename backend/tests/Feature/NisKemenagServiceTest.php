<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\NisKemenagService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Unit `NisKemenagService::generate()` — pola NISK
 * NSM(12) + YY tahun diterima + 4 digit akhir nis_lokal, beserta tiga
 * penolakan yang menjaga kelengkapan data. Bulk-nya sudah bertes
 * (NiskBulkTest); berkas ini mengunci cabang satuan yang tak tersentuh.
 */
class NisKemenagServiceTest extends TestCase
{
    use RefreshDatabase;

    private NisKemenagService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new NisKemenagService;
    }

    private function lembaga(string $jenjang = 'MI', ?string $nsm = '123456789012'): Lembaga
    {
        return Lembaga::create([
            'nama' => $jenjang, 'jenjang' => $jenjang, 'nsm' => $nsm, 'is_active' => true,
        ]);
    }

    private function anggota(string $jenjang, ?string $nisLokal, ?string $tglMasuk = null): LembagaSantri
    {
        $santri = Santri::create(['nama_lengkap' => 'Uji '.uniqid(), 'jk' => 'L']);

        return LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => $jenjang,
            'nis_lokal' => $nisLokal, 'tgl_masuk' => $tglMasuk,
            'is_active_lembaga' => 'Ya',
        ]);
    }

    /** Tahun ajaran + riwayat semester 1 sebagai sumber YY. */
    private function riwayat(LembagaSantri $anggota, string $namaTa, string $semester = '1'): void
    {
        TahunAjaran::firstOrCreate(
            ['nama' => $namaTa],
            ['tanggal_mulai' => substr($namaTa, 0, 4).'-07-01', 'tanggal_selesai' => (substr($namaTa, 0, 4) + 1).'-06-30']
        );
        RiwayatBelajar::create([
            'santri_id' => $anggota->santri_id, 'jenjang' => $anggota->jenjang,
            'tahun_ajaran' => $namaTa, 'semester' => $semester,
            'status_awal' => 'santri_baru', 'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya',
        ]);
    }

    public function test_pola_nsm_tahun_riwayat_dan_empat_digit_akhir(): void
    {
        $this->lembaga('MI', '123456789012');
        $a = $this->anggota('MI', '26001');
        $this->riwayat($a, '2026/2027');

        $this->assertSame('123456789012266001', $this->svc->generate($a)->nis_kemenag);
    }

    /** nis_lokal lebih pendek dari 4 digit dipad kiri, bukan dipotong. */
    public function test_nis_lokal_pendek_dipad_kiri(): void
    {
        $this->lembaga('MI', '123456789012');
        $a = $this->anggota('MI', '7');
        $this->riwayat($a, '2026/2027');

        $this->assertSame('123456789012260007', $this->svc->generate($a)->nis_kemenag);
    }

    /** NSM ditulis dengan pemisah — hanya digit yang dipakai. */
    public function test_nsm_dibersihkan_dari_nondigit(): void
    {
        $this->lembaga('MI', '123.456.789-012');
        $a = $this->anggota('MI', '26001');
        $this->riwayat($a, '2026/2027');

        $this->assertSame('123456789012266001', $this->svc->generate($a)->nis_kemenag);
    }

    public function test_tanpa_nis_lokal_ditolak(): void
    {
        $this->lembaga('MI');
        $a = $this->anggota('MI', null);

        $this->expectException(ValidationException::class);
        $this->svc->generate($a);
    }

    /** NIS lokal berisi spasi saja = kosong (trim dulu). */
    public function test_nis_lokal_spasi_saja_dianggap_kosong(): void
    {
        $this->lembaga('MI');
        $a = $this->anggota('MI', '   ');

        $this->expectException(ValidationException::class);
        $this->svc->generate($a);
    }

    public function test_nsm_tidak_12_digit_ditolak(): void
    {
        $this->lembaga('MI', '12345');
        $a = $this->anggota('MI', '26001');
        $this->riwayat($a, '2026/2027');

        try {
            $this->svc->generate($a);
            $this->fail('Seharusnya menolak NSM pendek.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('nsm', $e->errors());
        }
    }

    public function test_nsm_null_ditolak(): void
    {
        $this->lembaga('MI', null);
        $a = $this->anggota('MI', '26001');
        $this->riwayat($a, '2026/2027');

        try {
            $this->svc->generate($a);
            $this->fail('Seharusnya menolak NSM kosong.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('nsm', $e->errors());
        }
    }

    /**
     * YY berurutan: riwayat semester 1 paling AWAL yang dipakai (bukan
     * semester 2 atau TA terbaru).
     */
    public function test_yy_dari_semester_1_paling_awal(): void
    {
        $this->lembaga('MI');
        $a = $this->anggota('MI', '26001');
        $this->riwayat($a, '2026/2027');
        $this->riwayat($a, '2027/2028');

        $this->assertSame('123456789012266001', $this->svc->generate($a)->nis_kemenag);
    }

    /** Semester 2 bukan sumber tahun: jatuh ke tgl_masuk. */
    public function test_semester_2_bukan_sumber_tahun(): void
    {
        $this->lembaga('MI');
        $a = $this->anggota('MI', '26001', '2025-07-01');
        $this->riwayat($a, '2026/2027', '2');

        $this->assertSame('123456789012256001', $this->svc->generate($a)->nis_kemenag);
    }

    /** Riwayat milik lembaga lain tidak dipakai (jenjang disaring). */
    public function test_riwayat_lembaga_lain_tidak_dipakai(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MD', '123456789013');
        $a = $this->anggota('MI', '26001', '2025-07-01');
        $this->riwayat($a, '2026/2027');
        RiwayatBelajar::where('santri_id', $a->santri_id)->update(['jenjang' => 'MD']);

        $this->assertSame('123456789012256001', $this->svc->generate($a)->nis_kemenag);
    }

    /** Tanpa riwayat: YY dari tgl_masuk (fallback terakhir). */
    public function test_tanpa_riwayat_pakai_tgl_masuk(): void
    {
        $this->lembaga('MI');
        $a = $this->anggota('MI', '26001', '2019-07-15');

        $this->assertSame('123456789012196001', $this->svc->generate($a)->nis_kemenag);
    }

    /** Tanpa riwayat DAN tanpa tgl_masuk → tahun tak diketahui, ditolak. */
    public function test_tanpa_tahun_diterima_ditolak(): void
    {
        $this->lembaga('MI');
        $a = $this->anggota('MI', '26001', null);

        try {
            $this->svc->generate($a);
            $this->fail('Seharusnya menolak bila tahun diterima tak diketahui.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('nis_kemenag', $e->errors());
        }
    }

    /** Generate ulang boleh (duplikat sengaja dibiarkan) & nilainya stabil. */
    public function test_generate_ulang_stabil_dan_menimpa(): void
    {
        $this->lembaga('MI');
        $a = $this->anggota('MI', '26001');
        $this->riwayat($a, '2026/2027');

        $this->svc->generate($a);
        $ulang = $this->svc->generate($a->fresh());

        $this->assertSame('123456789012266001', $ulang->nis_kemenag);
    }
}
