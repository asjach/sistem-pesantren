<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * riwayat:sinkron-aktif — backfill invarian "maks 1 riwayat aktif per
 * (santri, jenjang)": hanya periode TERAKHIR yang status_akhir-nya aktif.
 * Perintah ini pernah dipakai memperbaiki data produksi (3.924 → 1.064 baris
 * aktif), jadi invariannya wajib dikunci.
 */
class SinkronAktifRiwayatCommandTest extends TestCase
{
    use RefreshDatabase;

    /** FK wajib: riwayat_belajar.jenjang → lembaga.jenjang, .tahun_ajaran → tahun_ajaran.nama. */
    protected function setUp(): void
    {
        parent::setUp();
        foreach (['MI', 'MD'] as $jenjang) {
            Lembaga::create(['nama' => $jenjang, 'jenjang' => $jenjang, 'is_active' => true]);
        }
        foreach (['2024/2025', '2025/2026'] as $nama) {
            TahunAjaran::create(['nama' => $nama, 'tanggal_mulai' => substr($nama, 0, 4).'-07-01']);
        }
    }

    private function santri(): Santri
    {
        return Santri::create(['nama_lengkap' => 'Santri '.uniqid(), 'jk' => 'L']);
    }

    private function riwayat(int $santriId, string $ta, string $semester, string $statusAkhir, string $jenjang = 'MI', array $ubah = []): RiwayatBelajar
    {
        return RiwayatBelajar::create(array_merge([
            'santri_id' => $santriId, 'tahun_ajaran' => $ta, 'semester' => $semester,
            'jenjang' => $jenjang, 'status_awal' => 'santri_baru',
            'status_akhir' => $statusAkhir, 'is_active_riwayat' => 'Ya',
        ], $ubah));
    }

    public function test_hanya_periode_terakhir_yang_aktif(): void
    {
        $s = $this->santri();
        // Periode lama non-aktif, periode terakhir aktif.
        $lama = $this->riwayat($s->id, '2024/2025', '1', 'lulus');
        $baru = $this->riwayat($s->id, '2025/2026', '1', 'aktif');

        $this->artisan('riwayat:sinkron-aktif')->assertSuccessful();

        $this->assertSame('Tidak', $lama->fresh()->is_active_riwayat);
        $this->assertSame('Ya', $baru->fresh()->is_active_riwayat);
    }

    /** Periode terakhir TIDAK aktif (mis. pindah keluar) → tak ada yang aktif. */
    public function test_periode_terakhir_nonaktif_membuat_semuanya_arsip(): void
    {
        $s = $this->santri();
        $a = $this->riwayat($s->id, '2025/2026', '1', 'aktif');
        $b = $this->riwayat($s->id, '2025/2026', '2', 'pindah_keluar');

        $this->artisan('riwayat:sinkron-aktif')->assertSuccessful();

        $this->assertSame('Tidak', $a->fresh()->is_active_riwayat);
        $this->assertSame('Tidak', $b->fresh()->is_active_riwayat);
    }

    /** Ganjil bertanda aktif yang punya genap di TA sama ditandai ulang jadi lanjut. */
    public function test_ganjil_yang_punya_genap_jadi_lanjut(): void
    {
        $s = $this->santri();
        $ganjil = $this->riwayat($s->id, '2025/2026', '1', 'aktif');
        $this->riwayat($s->id, '2025/2026', '2', 'aktif');

        $this->artisan('riwayat:sinkron-aktif')->assertSuccessful();

        $this->assertSame('lanjut', $ganjil->fresh()->status_akhir);
    }

    /** Opsi --santri membatasi ke satu santri; yang lain tak tersentuh. */
    public function test_opsi_santri_membatasi_lingkup(): void
    {
        $a = $this->santri();
        $this->riwayat($a->id, '2024/2025', '1', 'lulus');
        $this->riwayat($a->id, '2025/2026', '1', 'aktif');

        $b = $this->santri();
        $lain = $this->riwayat($b->id, '2024/2025', '1', 'aktif', 'MI');

        $this->artisan('riwayat:sinkron-aktif', ['--santri' => $a->id])->assertSuccessful();

        // Santri B tak ikut diproses → barisnya tetap seperti semula.
        $this->assertSame('Ya', $lain->fresh()->is_active_riwayat);
    }

    /** Opsi --jenjang membatasi ke satu lembaga. */
    public function test_opsi_jenjang_membatasi_lingkup(): void
    {
        $s = $this->santri();
        $mi = $this->riwayat($s->id, '2024/2025', '1', 'aktif', 'MI');
        $mdLama = $this->riwayat($s->id, '2024/2025', '1', 'lulus', 'MD');
        $mdBaru = $this->riwayat($s->id, '2025/2026', '1', 'aktif', 'MD');

        $this->artisan('riwayat:sinkron-aktif', ['--jenjang' => 'MD'])->assertSuccessful();

        // MI tak diproses (tetap Ya walau bukan periode terakhir).
        $this->assertSame('Ya', $mi->fresh()->is_active_riwayat);
        $this->assertSame('Tidak', $mdLama->fresh()->is_active_riwayat);
        $this->assertSame('Ya', $mdBaru->fresh()->is_active_riwayat);
    }

    public function test_tanpa_riwayat_cocok_berakhir_sukses(): void
    {
        $this->artisan('riwayat:sinkron-aktif', ['--jenjang' => 'ZZ'])
            ->expectsOutputToContain('Tidak ada baris riwayat yang cocok')
            ->assertSuccessful();
    }

    /** Idempoten: menjalankan dua kali tidak mengubah hasil. */
    public function test_idempoten(): void
    {
        $s = $this->santri();
        $this->riwayat($s->id, '2024/2025', '1', 'lulus');
        $aktif = $this->riwayat($s->id, '2025/2026', '1', 'aktif');

        $this->artisan('riwayat:sinkron-aktif')->assertSuccessful();
        $this->artisan('riwayat:sinkron-aktif')->assertSuccessful();

        $this->assertSame('Ya', $aktif->fresh()->is_active_riwayat);
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $s->id)->where('is_active_riwayat', 'Ya')->count());
    }
}
