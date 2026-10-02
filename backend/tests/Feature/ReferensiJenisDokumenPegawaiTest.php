<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use Database\Seeders\ReferensiSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Seeder menambah 6 jenis dokumen pegawai baru (SK sudah ada: tak diduplikasi)
// dan tetap idempoten saat dijalankan ulang.
class ReferensiJenisDokumenPegawaiTest extends TestCase
{
    use RefreshDatabase;

    public function test_jenis_dokumen_pegawai_baru_tersedia(): void
    {
        Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);

        $this->seed(ReferensiSeeder::class);
        $this->seed(ReferensiSeeder::class);

        $nama = DB::table('ref_jenis_dokumen_pegawai')
            ->where('jenjang', 'MI')
            ->pluck('nama')
            ->all();

        foreach (['Ijazah', 'Foto', 'Tanda Tangan Elektronik', 'Dokumen Simpatika', 'Dokumen EMISGTK', 'Foto Profil'] as $baru) {
            $this->assertContains($baru, $nama);
        }
        // Nilai lama utuh + SK tidak ganda.
        foreach (['Kartu Keluarga', 'KTP', 'Nomor Rekening', 'NPWP', 'BPJS', 'SK', 'Kartu Anggota'] as $lama) {
            $this->assertContains($lama, $nama);
        }
        $this->assertSame(1, collect($nama)->filter(fn ($n) => $n === 'SK')->count());
        $this->assertCount(13, $nama);
    }
}
