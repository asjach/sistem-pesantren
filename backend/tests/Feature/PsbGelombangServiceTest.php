<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\PsbGelombang;
use App\Models\PsbKegiatan;
use App\Models\TahunAjaran;
use App\Services\PsbGelombangService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PsbGelombangServiceTest extends TestCase
{
    use RefreshDatabase;

    private PsbGelombangService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = app(PsbGelombangService::class);
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'kelompok_psb' => 'eksklusif', 'is_seleksi' => false, 'is_active' => true]);
        // `psb_kegiatan.tahun_ajaran` ber-FK ke tabel `tahun_ajaran`.
        TahunAjaran::create([
            'nama' => '2026/2027', 'tanggal_mulai' => '2026-07-01',
            'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
    }

    private function kegiatan(bool $aktif = true, string $nama = 'PSB'): PsbKegiatan
    {
        return PsbKegiatan::create(['tahun_ajaran' => '2026/2027', 'nama' => $nama, 'is_aktif' => $aktif]);
    }

    private function gelombang(PsbKegiatan $keg, ?string $buka, ?string $tutup, int $nomor = 1, string $nama = 'G1'): PsbGelombang
    {
        return PsbGelombang::create([
            'psb_kegiatan_id' => $keg->id,
            'nomor' => $nomor,
            'nama' => $nama,
            'tgl_buka' => $buka,
            'tgl_tutup' => $tutup,
        ]);
    }

    // ---------- cekBukaDanKuota ----------

    public function test_cek_buka_menolak_sebelum_tanggal_buka(): void
    {
        Carbon::setTestNow('2026-05-01');
        $g = $this->gelombang($this->kegiatan(), '2026-06-01', '2026-07-01');

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('belum dibuka');
        $this->svc->cekBukaDanKuota($g->id, 'MI');
    }

    public function test_cek_buka_menolak_setelah_tanggal_tutup(): void
    {
        Carbon::setTestNow('2026-08-01');
        $g = $this->gelombang($this->kegiatan(), '2026-06-01', '2026-07-01');

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('sudah ditutup');
        $this->svc->cekBukaDanKuota($g->id, 'MI');
    }

    public function test_cek_buka_menerima_di_dalam_rentang_dan_tanpa_batas(): void
    {
        Carbon::setTestNow('2026-06-15');
        $keg = $this->kegiatan();
        $g = $this->gelombang($keg, '2026-06-01', '2026-07-01');
        $this->svc->cekBukaDanKuota($g->id, 'MI');
        $this->addToAssertionCount(1);

        // Tanggal null = tanpa batas, BUKAN dianggap tertutup. Kegiatan yang
        // sama (psb_kegiatan.tahun_ajaran UNIQUE, jadi tak boleh bikin dua).
        $g2 = $this->gelombang($keg, null, null, 2, 'G2');
        $this->svc->cekBukaDanKuota($g2->id, 'MI');
        $this->addToAssertionCount(1);
    }

    public function test_cek_buka_menerima_tepat_di_tanggal_batas(): void
    {
        $keg = $this->kegiatan();
        $g = $this->gelombang($keg, '2026-06-01', '2026-07-01');
        foreach (['2026-06-01', '2026-07-01'] as $batas) {
            Carbon::setTestNow($batas);
            $this->svc->cekBukaDanKuota($g->id, 'MI');
            $this->addToAssertionCount(1);
        }
    }

    // ---------- gelombangAktif ----------

    public function test_gelombang_aktif_mengabaikan_yang_di_luar_rentang(): void
    {
        Carbon::setTestNow('2026-06-15');
        $keg = $this->kegiatan();
        $this->gelombang($keg, '2026-01-01', '2026-02-01', 1, 'Lewat');
        $this->gelombang($keg, '2026-12-01', '2027-01-01', 2, 'Belum');
        $g = $this->gelombang($keg, '2026-06-01', '2026-07-01', 3, 'Sekarang');

        $this->assertSame($g->id, $this->svc->gelombangAktif()?->id);
    }

    public function test_gelombang_aktif_tanpa_batas_tanggal_dianggap_terbuka(): void
    {
        Carbon::setTestNow('2026-06-15');
        $g = $this->gelombang($this->kegiatan(), null, null);
        $this->assertSame($g->id, $this->svc->gelombangAktif()?->id);
    }

    public function test_gelombang_aktif_null_bila_semua_di_luar_rentang(): void
    {
        Carbon::setTestNow('2026-06-15');
        $keg = $this->kegiatan();
        $this->gelombang($keg, '2026-01-01', '2026-02-01', 1, 'Lewat');
        $this->assertNull($this->svc->gelombangAktif());
    }

    /** Dahulukan kegiatan yang ditandai AKTIF, walau kegiatan lain lebih baru. */
    public function test_gelombang_aktif_mendahulukan_kegiatan_aktif(): void
    {
        Carbon::setTestNow('2026-06-15');
        $lamaAktif = $this->kegiatan(true, 'Lama aktif');
        $gAktif = $this->gelombang($lamaAktif, '2026-06-01', '2026-07-01', 1, 'A');

        // Kegiatan kedua butuh TA lain (psb_kegiatan.tahun_ajaran UNIQUE).
        TahunAjaran::create([
            'nama' => '2027/2028', 'tanggal_mulai' => '2027-07-01',
            'tanggal_selesai' => '2028-06-30', 'is_aktif' => false,
        ]);
        $baruNonaktif = PsbKegiatan::create([
            'tahun_ajaran' => '2027/2028', 'nama' => 'Baru nonaktif', 'is_aktif' => false,
        ]);
        $this->gelombang($baruNonaktif, '2026-06-01', '2026-07-01', 1, 'B');

        $this->assertSame($gAktif->id, $this->svc->gelombangAktif()?->id, 'yang aktif menang');
    }

    /** `$kegiatanId` membatasi pencarian ke satu kegiatan. */
    public function test_gelombang_aktif_dibatasi_kegiatan_id(): void
    {
        Carbon::setTestNow('2026-06-15');
        $keg1 = $this->kegiatan(false, 'K1');
        $this->gelombang($keg1, '2026-06-01', '2026-07-01', 1, 'A');
        TahunAjaran::create([
            'nama' => '2027/2028', 'tanggal_mulai' => '2027-07-01',
            'tanggal_selesai' => '2028-06-30', 'is_aktif' => false,
        ]);
        $keg2 = PsbKegiatan::create(['tahun_ajaran' => '2027/2028', 'nama' => 'K2', 'is_aktif' => false]);
        $g2 = $this->gelombang($keg2, '2026-06-01', '2026-07-01', 1, 'B');

        $this->assertSame($g2->id, $this->svc->gelombangAktif($keg2->id)?->id);
        $this->assertNull($this->svc->gelombangAktif(999999));
    }

    // ---------- validasiRentang ----------

    public function test_validasi_rentang_dilewati_bila_data_tak_lengkap(): void
    {
        // Tanpa kegiatan / tanpa tanggal: tak ada yang divalidasi, tak melempar.
        $this->svc->validasiRentang(null, '2026-06-01', '2026-07-01');
        $this->svc->validasiRentang(1, null, '2026-07-01');
        $this->svc->validasiRentang(1, '2026-06-01', null);
        $this->addToAssertionCount(3);
    }

    public function test_validasi_rentang_menolak_tutup_sebelum_buka(): void
    {
        $keg = $this->kegiatan();
        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('setelah tanggal buka');
        $this->svc->validasiRentang($keg->id, '2026-07-01', '2026-06-01');
    }

    public function test_validasi_rentang_menolak_tumpang_tindih(): void
    {
        $keg = $this->kegiatan();
        $this->gelombang($keg, '2026-06-01', '2026-07-01', 1, 'Ada');

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('bertabrakan');
        $this->svc->validasiRentang($keg->id, '2026-06-15', '2026-08-01');
    }

    public function test_validasi_rentang_menerima_yang_tidak_bersinggungan(): void
    {
        $keg = $this->kegiatan();
        $this->gelombang($keg, '2026-06-01', '2026-07-01', 1, 'Ada');

        // Bersebelahan tepat (mulai di hari tutup+1) = tidak tumpang tindih.
        $this->svc->validasiRentang($keg->id, '2026-07-02', '2026-08-01');
        $this->addToAssertionCount(1);
    }

    public function test_validasi_rentang_mengabaikan_id_yang_diberi_kecuali(): void
    {
        $keg = $this->kegiatan();
        $g = $this->gelombang($keg, '2026-06-01', '2026-07-01', 1, 'Sendiri');

        // Mengubah gelombang itu sendiri tak boleh dianggap bertabrakan diri sendiri.
        $this->svc->validasiRentang($keg->id, '2026-06-01', '2026-07-01', $g->id);
        $this->addToAssertionCount(1);
    }

    /** Gelombang di KEGIATAN LAIN tak boleh dianggap bertabrakan. */
    public function test_validasi_rentang_hanya_dalam_kegiatan_yang_sama(): void
    {
        $keg1 = $this->kegiatan();
        $this->gelombang($keg1, '2026-06-01', '2026-07-01', 1, 'Keg1');
        TahunAjaran::create([
            'nama' => '2027/2028', 'tanggal_mulai' => '2027-07-01',
            'tanggal_selesai' => '2028-06-30', 'is_aktif' => false,
        ]);
        $keg2 = PsbKegiatan::create(['tahun_ajaran' => '2027/2028', 'nama' => 'K2', 'is_aktif' => false]);

        $this->svc->validasiRentang($keg2->id, '2026-06-01', '2026-07-01');
        $this->addToAssertionCount(1);
    }
}
