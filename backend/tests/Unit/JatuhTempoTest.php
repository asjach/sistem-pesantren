<?php

namespace Tests\Unit;

use App\Support\JatuhTempo;
use PHPUnit\Framework\TestCase;

class JatuhTempoTest extends TestCase
{
    public function test_bulanan_tanggal_suluh_bulan_berjalan(): void
    {
        $this->assertSame('2025-07-10', JatuhTempo::bulanan('2025-07'));
        $this->assertSame('2025-01-10', JatuhTempo::bulanan('2025-01'));
    }

    public function test_bulanan_tidak_geser_bulan_depan(): void
    {
        // Aturan lama memakai tanggal 10 bulan berikutnya; ini yang dikunci
        // supaya tidak kembali bergeser diam-diam.
        $this->assertSame('2025-12-10', JatuhTempo::bulanan('2025-12'));
        $this->assertSame('2026-01-10', JatuhTempo::bulanan('2026-01'));
    }

    public function test_periode_tidak_valid_kosong(): void
    {
        $this->assertNull(JatuhTempo::bulanan('2025-13'));
        $this->assertNull(JatuhTempo::bulanan('2025-00'));
        $this->assertNull(JatuhTempo::bulanan('2025/2026'));
        $this->assertNull(JatuhTempo::bulanan(null));
        $this->assertNull(JatuhTempo::bulanan(''));
    }

    public function test_bulanan_mengabaikan_input_manual(): void
    {
        $this->assertSame('2025-07-10', JatuhTempo::untuk('bulanan', '2025-07', '2025-12-31'));
    }

    public function test_non_bulanan_pakai_input_manual(): void
    {
        $this->assertSame('2025-08-15', JatuhTempo::untuk('non_bulanan', null, '2025-08-15'));
        $this->assertNull(JatuhTempo::untuk('non_bulanan', '2025/2026', null));
        $this->assertNull(JatuhTempo::untuk('non_bulanan', '2025/2026', ''));
    }
}
