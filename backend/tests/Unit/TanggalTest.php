<?php

namespace Tests\Unit;

use App\Support\Tanggal;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class TanggalTest extends TestCase
{
    #[DataProvider('tanggalNolProvider')]
    public function test_tanggal_nol_dikenali(mixed $masuk, bool $harap): void
    {
        $this->assertSame($harap, Tanggal::adalahTanggalNol($masuk));
    }

    /** @return array<string, array{0: mixed, 1: bool}> */
    public static function tanggalNolProvider(): array
    {
        return [
            'bulan 00' => ['2026-00-15', true],
            'hari 00' => ['2026-05-00', true],
            'tahun 0000' => ['0000-05-15', true],
            'tanggal normal' => ['2026-05-15', false],
            'bukan string (int) tak dianggap nol' => [20260515, false],
            'null tak dianggap nol' => [null, false],
            'spasi dipangkas dulu' => ['  2026-00-15  ', true],
            'bentuk tak dikenal' => ['15/05/2026', false],
        ];
    }

    public function test_parse_teks_tanggal(): void
    {
        $this->assertSame('2026-05-15', Tanggal::parse('2026-05-15'));
        $this->assertSame('2026-05-15', Tanggal::parse('15-05-2026'));
    }

    /** Serial Excel (angka hari sejak 1900) diterima sebagai tanggal. */
    public function test_parse_serial_excel(): void
    {
        $this->assertSame('2026-05-15', Tanggal::parse(46157));
    }

    #[DataProvider('kosongProvider')]
    public function test_nilai_kosong_jadi_null(mixed $masuk): void
    {
        $this->assertNull(Tanggal::parse($masuk));
    }

    /** @return array<string, array{0: mixed}> */
    public static function kosongProvider(): array
    {
        return [
            'null' => [null],
            'string kosong' => [''],
            'nol' => [0],
            'tanggal nol' => ['2026-00-15'],
        ];
    }

    public function test_teks_tak_bisa_diparse_jadi_null_bukan_melempar(): void
    {
        $this->assertNull(Tanggal::parse('bukan tanggal sama sekali'));
    }
}
