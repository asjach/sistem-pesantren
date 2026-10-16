<?php

namespace Tests\Unit;

use App\Support\NilaiRapor;
use Tests\TestCase;

/** Aturan nilai akhir (Σ skor×bobot), rata-rata, peringkat, dan predikat vs KKM. */
class NilaiRaporTest extends TestCase
{
    public function test_nilai_akhir_dihitung_bila_semua_komponen_berbobot_terisi(): void
    {
        // UH 80 (20%), Tugas 90 (20%), PTS 70 (20%), ASAS 100 (40%) = 88
        $hasil = NilaiRapor::nilaiAkhir(
            [1 => 80.0, 2 => 90.0, 3 => 70.0, 4 => 100.0],
            [1 => 20.0, 2 => 20.0, 3 => 20.0, 4 => 40.0],
        );
        $this->assertSame(88.0, $hasil['nilai']);
        $this->assertSame([], $hasil['kurang']);
    }

    public function test_nilai_akhir_null_bila_ada_komponen_berbobot_kosong(): void
    {
        $hasil = NilaiRapor::nilaiAkhir(
            [1 => 80.0, 2 => 90.0],
            [1 => 20.0, 2 => 20.0, 3 => 20.0, 4 => 40.0],
        );
        $this->assertNull($hasil['nilai']);
        $this->assertSame([3, 4], $hasil['kurang']);
    }

    public function test_komponen_bobot_nol_diabaikan(): void
    {
        $hasil = NilaiRapor::nilaiAkhir(
            [1 => 100.0],
            [1 => 100.0, 2 => 0.0],
        );
        $this->assertSame(100.0, $hasil['nilai']);
    }

    public function test_nilai_akhir_null_bila_total_bobot_nol(): void
    {
        $hasil = NilaiRapor::nilaiAkhir([1 => 90.0], [1 => 0.0]);
        $this->assertNull($hasil['nilai']);
    }

    public function test_predikat_berjangkar_ke_kkm_akhir(): void
    {
        $rentang = [
            ['predikat' => 'A', 'offset_bawah' => 20.0],
            ['predikat' => 'B', 'offset_bawah' => 10.0],
            ['predikat' => 'C', 'offset_bawah' => 0.0],
            ['predikat' => 'D', 'offset_bawah' => null],
        ];
        $this->assertSame('A', NilaiRapor::predikat(95, 75, $rentang));
        $this->assertSame('B', NilaiRapor::predikat(85, 75, $rentang));
        $this->assertSame('C', NilaiRapor::predikat(75, 75, $rentang));
        $this->assertSame('D', NilaiRapor::predikat(74.99, 75, $rentang));
    }

    public function test_predikat_batas_tepat_pada_offset(): void
    {
        $rentang = [
            ['predikat' => 'A', 'offset_bawah' => 20.0],
            ['predikat' => 'B', 'offset_bawah' => 10.0],
            ['predikat' => 'C', 'offset_bawah' => 0.0],
            ['predikat' => 'D', 'offset_bawah' => null],
        ];
        $this->assertSame('A', NilaiRapor::predikat(95, 75, $rentang)); // 75+20
        $this->assertSame('B', NilaiRapor::predikat(85, 75, $rentang)); // 75+10
    }

    public function test_rata_rata_mengabaikan_nilai_kosong(): void
    {
        $this->assertSame(80.0, NilaiRapor::rataRata([70, null, 90]));
        $this->assertNull(NilaiRapor::rataRata([null, null]));
    }

    public function test_peringkat_menurun_dengan_nilai_sama_berbagi_posisi(): void
    {
        $peringkat = NilaiRapor::peringkat([10 => 90.0, 11 => 80.0, 12 => 90.0, 13 => 70.0]);
        $this->assertSame(1, $peringkat[10]);
        $this->assertSame(1, $peringkat[12]);
        $this->assertSame(3, $peringkat[11]);
        $this->assertSame(4, $peringkat[13]);
    }
}
