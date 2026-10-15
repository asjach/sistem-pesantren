<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\PenerimaanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Unit `PenerimaanService` — satu pintu penerimaan santri. Mengunci cabang
 * yang TIDAK terjangkau tes endpoint: reaktivasi arsip sendiri, isi-hanya-
 * yang-kosong, penolakan NIS terpakai, tiga validasi `terima()`, dan
 * `tahunAjaranBerikut()` (termasuk TA tanpa tanggal_mulai).
 */
class PenerimaanServiceTest extends TestCase
{
    use RefreshDatabase;

    private PenerimaanService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new PenerimaanService;
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
    }

    private function santri(string $nama = 'Santri'): Santri
    {
        return Santri::create(['nama_lengkap' => $nama.' '.uniqid(), 'jk' => 'L']);
    }

    private function ta(string $nama, ?string $mulai = null): TahunAjaran
    {
        return TahunAjaran::create(['nama' => $nama, 'tanggal_mulai' => $mulai]);
    }

    // ---------- pastikanKeanggotaan ----------

    public function test_pastikan_keanggotaan_membuat_baris_aktif_baru(): void
    {
        $s = $this->santri();

        $baris = $this->svc->pastikanKeanggotaan($s, 'MI', ['nis_lokal' => '100', 'tgl_masuk' => '2026-07-01']);

        $this->assertSame('Ya', $baris->is_active_lembaga);
        $this->assertSame('100', $baris->nis_lokal);
        $this->assertSame('2026-07-01', $baris->tgl_masuk?->format('Y-m-d'));
    }

    public function test_pastikan_keanggotaan_idempoten_baris_aktif_sama(): void
    {
        $s = $this->santri();

        $satu = $this->svc->pastikanKeanggotaan($s, 'MI', ['nis_lokal' => '100']);
        $dua = $this->svc->pastikanKeanggotaan($s, 'MI', ['nis_lokal' => '100']);

        $this->assertSame($satu->id, $dua->id);
        $this->assertSame(1, LembagaSantri::where('santri_id', $s->id)->count());
    }

    /** Isi-hanya-yang-kosong: nilai lama tidak ditimpa data penerimaan baru. */
    public function test_konteks_hanya_mengisi_kolom_kosong(): void
    {
        $s = $this->santri();
        $this->svc->pastikanKeanggotaan($s, 'MI', ['tgl_masuk' => '2025-01-01', 'no_urut' => '7']);

        $baris = $this->svc->pastikanKeanggotaan($s, 'MI', [
            'tgl_masuk' => '2026-09-09', 'no_urut' => '9', 'tingkat_masuk' => '1',
        ]);

        // tgl_masuk & no_urut lama dipertahankan; yang kosong diisi.
        $this->assertSame('2025-01-01', $baris->tgl_masuk?->format('Y-m-d'));
        $this->assertSame('7', (string) $baris->no_urut);
        $this->assertSame('1', $baris->tingkat_masuk);
    }

    public function test_nis_lokal_dipakai_santri_lain_ditolak(): void
    {
        $pemilik = $this->santri('Pemilik');
        $this->svc->pastikanKeanggotaan($pemilik, 'MI', ['nis_lokal' => '200']);
        $lain = $this->santri('Lain');

        $this->expectException(ValidationException::class);
        $this->svc->pastikanKeanggotaan($lain, 'MI', ['nis_lokal' => '200']);
    }

    /**
     * Reaktivasi arsip sendiri: keluar lalu masuk lagi dengan NIS SAMA →
     * baris lama diaktifkan (bukan baris baru), tgl_selesai dikosongkan.
     */
    public function test_reaktivasi_arsip_dengan_nis_sama(): void
    {
        $s = $this->santri();
        $lama = $this->svc->pastikanKeanggotaan($s, 'MI', ['nis_lokal' => '300']);
        $lama->update(['is_active_lembaga' => 'Tidak', 'tgl_selesai' => '2026-06-30']);

        $kembali = $this->svc->pastikanKeanggotaan($s, 'MI', ['nis_lokal' => '300']);

        $this->assertSame($lama->id, $kembali->id);
        $this->assertSame('Ya', $kembali->is_active_lembaga);
        $this->assertNull($kembali->tgl_selesai);
        $this->assertSame(1, LembagaSantri::where('santri_id', $s->id)->count());
    }

    /** Arsip dengan NIS BERBEDA → baris baru; jejak lama tetap utuh. */
    public function test_arsip_nis_beda_membuat_baris_baru(): void
    {
        $s = $this->santri();
        $lama = $this->svc->pastikanKeanggotaan($s, 'MI', ['nis_lokal' => '300']);
        $lama->update(['is_active_lembaga' => 'Tidak', 'tgl_selesai' => '2026-06-30']);

        $baru = $this->svc->pastikanKeanggotaan($s, 'MI', ['nis_lokal' => '400']);

        $this->assertNotSame($lama->id, $baru->id);
        $this->assertSame('400', $baru->nis_lokal);
        $this->assertSame('Tidak', $lama->fresh()->is_active_lembaga);
        $this->assertSame(2, LembagaSantri::where('santri_id', $s->id)->count());
    }

    /** NIS kosong/spasi tidak diperlakukan sebagai "terpakai". */
    public function test_nis_kosong_tidak_bentrok(): void
    {
        $a = $this->santri('A');
        $b = $this->santri('B');

        $this->svc->pastikanKeanggotaan($a, 'MI', ['nis_lokal' => '']);
        $baris = $this->svc->pastikanKeanggotaan($b, 'MI', ['nis_lokal' => '   ']);

        $this->assertNull($baris->nis_lokal);
    }

    // ---------- terima ----------

    public function test_terima_membuat_riwayat_perdana_dan_keanggotaan(): void
    {
        $s = $this->santri();
        $this->ta('2026/2027', '2026-07-01');

        $riwayat = $this->svc->terima($s, 'MI', '2026/2027', ['nis_lokal' => '500', 'tingkat' => '1']);

        $this->assertSame('1', $riwayat->semester);
        $this->assertSame('aktif', $riwayat->status_akhir);
        $this->assertSame('Ya', $riwayat->is_active_riwayat);
        $this->assertSame('1', $riwayat->tingkat);
        $this->assertNotNull(LembagaSantri::aktif($s->id, 'MI'));
    }

    public function test_terima_ta_tidak_ada_ditolak(): void
    {
        $s = $this->santri();

        try {
            $this->svc->terima($s, 'MI', '2099/2100');
            $this->fail('Seharusnya menolak TA yang tidak ada.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('tahun_ajaran', $e->errors());
        }
    }

    public function test_terima_riwayat_aktif_ganda_ditolak(): void
    {
        $s = $this->santri();
        $this->ta('2026/2027', '2026-07-01');
        $this->svc->terima($s, 'MI', '2026/2027');

        try {
            $this->svc->terima($s, 'MI', '2026/2027');
            $this->fail('Seharusnya menolak riwayat aktif kedua.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('riwayat', $e->errors());
        }
    }

    public function test_terima_kelas_lembaga_lain_ditolak(): void
    {
        Lembaga::create(['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true]);
        $this->ta('2026/2027', '2026-07-01');
        $kelasMd = Kelas::create(['nama_kelas' => 'MD 1A', 'jenjang' => 'MD', 'tahun_ajaran' => '2026/2027', 'tingkat' => '1']);
        $s = $this->santri();

        try {
            $this->svc->terima($s, 'MI', '2026/2027', ['kelas_id' => $kelasMd->id]);
            $this->fail('Seharusnya menolak kelas lembaga lain.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('kelas_id', $e->errors());
        }
    }

    /** Tingkat mewarisi kelas bila tidak diisi eksplisit. */
    public function test_terima_tingkat_mewarisi_kelas(): void
    {
        $this->ta('2026/2027', '2026-07-01');
        $kelas = Kelas::create(['nama_kelas' => 'MI 3A', 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'tingkat' => '3']);
        $s = $this->santri();

        $riwayat = $this->svc->terima($s, 'MI', '2026/2027', ['kelas_id' => $kelas->id]);

        $this->assertSame('3', $riwayat->tingkat);
    }

    // ---------- tahunAjaranBerikut ----------

    public function test_tahun_ajaran_berikut_memilih_yang_terdekat_setelahnya(): void
    {
        $this->ta('2025/2026', '2025-07-01');
        $this->ta('2026/2027', '2026-07-01');
        $this->ta('2027/2028', '2027-07-01');
        $s = $this->santri();
        $lama = $this->svc->terima($s, 'MI', '2026/2027');

        $berikut = $this->svc->tahunAjaranBerikut('MI', $lama);

        $this->assertSame('2027/2028', $berikut?->nama);
    }

    /** TA terakhir tidak punya lanjutan → null. */
    public function test_tahun_ajaran_berikut_null_di_ta_terakhir(): void
    {
        $this->ta('2025/2026', '2025-07-01');
        $this->ta('2026/2027', '2026-07-01');
        $s = $this->santri();
        $akhir = $this->svc->terima($s, 'MI', '2026/2027');

        $this->assertNull($this->svc->tahunAjaranBerikut('MI', $akhir));
    }

    /** TA tanpa tanggal_mulai tetap jadi kandidat (filter dilewati). */
    public function test_tahun_ajaran_berikut_tanpa_tanggal_mulai_tetap_mengembalikan(): void
    {
        $this->ta('2026/2027', null);
        $this->ta('2027/2028', null);
        $s = $this->santri();
        $lama = $this->svc->terima($s, 'MI', '2026/2027');

        $berikut = $this->svc->tahunAjaranBerikut('MI', $lama);

        // Yang dikunci: tanpa tanggal_mulai, filter perbandingan dilewati
        // sehingga kandidat tetap ada (bukan null karena tanggalnya kosong).
        $this->assertNotNull($berikut);
        $this->assertContains($berikut->nama, ['2026/2027', '2027/2028']);
    }
}
