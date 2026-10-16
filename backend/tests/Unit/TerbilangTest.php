<?php

namespace Tests\Unit;

use App\Support\Terbilang;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Terbilang rapor: eja per-digit (bukan ejaan baku) + ordinal peringkat.
 * Murah diuji, mahal bila salah di ratusan rapor.
 */
class TerbilangTest extends TestCase
{
    #[DataProvider('perDigitProvider')]
    public function test_per_digit(mixed $masuk, string $harap): void
    {
        $this->assertSame($harap, Terbilang::perDigit($masuk));
    }

    /** @return array<string, array{0: mixed, 1: string}> */
    public static function perDigitProvider(): array
    {
        return [
            'bulat dua digit' => [96, 'sembilan enam'],
            'satu digit' => [8, 'delapan'],
            'nol' => [0, 'nol'],
            'desimal koma' => ['86,67', 'delapan enam koma enam tujuh'],
            'float dua desimal' => [86.67, 'delapan enam koma enam tujuh'],
            'float bulat dibuang nolnya' => [90.0, 'sembilan nol'],
            'kosong' => [null, ''],
            'string kosong' => ['', ''],
            'titik ribuan dibuang' => ['1.234', 'satu dua tiga empat'],
        ];
    }

    #[DataProvider('ordinalProvider')]
    public function test_ordinal(int $n, string $harap): void
    {
        $this->assertSame($harap, Terbilang::ordinal($n));
    }

    /** @return array<string, array{0: int, 1: string}> */
    public static function ordinalProvider(): array
    {
        return [
            '1 pertama' => [1, 'pertama'],
            '2 kedua' => [2, 'kedua'],
            '3 ketiga' => [3, 'ketiga'],
            '6 keenam' => [6, 'keenam'],
            '9 kesembilan' => [9, 'kesembilan'],
            '10 kesepuluh' => [10, 'kesepuluh'],
            '11 kesebelas' => [11, 'kesebelas'],
            '12 kedua belas' => [12, 'kedua belas'],
            '20 kedua puluh' => [20, 'kedua puluh'],
            '21 kedua puluh satu' => [21, 'kedua puluh satu'],
            '100 keseratus' => [100, 'keseratus'],
            'nol kosong' => [0, ''],
        ];
    }
}
