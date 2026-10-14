<?php

namespace Tests\Unit;

use App\Support\Telepon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class TeleponTest extends TestCase
{
    #[DataProvider('normalisasiProvider')]
    public function test_normalisasi_ke_bentuk_kanonik_62(mixed $masuk, ?string $harap): void
    {
        $this->assertSame($harap, Telepon::normalisasi($masuk));
    }

    /** @return array<string, array{0: mixed, 1: ?string}> */
    public static function normalisasiProvider(): array
    {
        return [
            'awalan 0 diganti 62' => ['081234567890', '6281234567890'],
            'sudah 62 dibiarkan' => ['6281234567890', '6281234567890'],
            'strip & spasi dibuang' => ['0812-3456-7890', '6281234567890'],
            'plus kode negara diabaikan' => ['+62 812 3456 7890', '6281234567890'],
            'titik & kurung diabaikan' => ['(0812) 3456.7890', '6281234567890'],
            // Tanpa 0/62: diasumsikan nomor lokal, ditempeli 62.
            'tanpa awalan ditempeli 62' => ['8123456789', '628123456789'],
            'string kosong jadi null' => ['', null],
            'spasi saja jadi null' => ['   ', null],
            'mengandung huruf jadi null' => ['0812abc3456', null],
            'tanpa digit jadi null' => ['+++---', null],
            'terlalu pendek jadi null' => ['0812', null],
            'terlalu panjang jadi null' => ['62812345678901234567', null],
        ];
    }

    /** Batas panjang diuji tepat di tepinya: 10 lolos, 9 tidak; 16 lolos, 17 tidak. */
    public function test_batas_panjang_tepat_di_tepi(): void
    {
        $this->assertNotNull(Telepon::normalisasi('62'.str_repeat('1', 8)), 'total 10 digit');
        $this->assertNull(Telepon::normalisasi('62'.str_repeat('1', 7)), 'total 9 digit');
        $this->assertNotNull(Telepon::normalisasi('62'.str_repeat('1', 14)), 'total 16 digit');
        $this->assertNull(Telepon::normalisasi('62'.str_repeat('1', 15)), 'total 17 digit');
    }

    public function test_nilai_non_string_dipaksa_jadi_teks(): void
    {
        // 8123456789 (10 digit) tak berawalan 0/62 -> ditempeli 62 -> 12 digit.
        $this->assertSame('628123456789', Telepon::normalisasi(8123456789));
        $this->assertNull(Telepon::normalisasi(null));
    }

    public function test_varian_menyertakan_bentuk_08(): void
    {
        $this->assertSame(['6281234567890', '081234567890'], Telepon::varian('6281234567890'));
    }

    /** `varian()` memotong dua digit pertama lalu menempelkan `0`.
     *  Untuk masukan yang BUKAN kanonik `62...` hasilnya bisa aneh (`0812` ->
     *  `012`) - itu di luar kontrak (input selalu keluaran `normalisasi()`),
     *  tapi dikunci supaya perilakunya eksplisit, bukan kejutan. */
    public function test_varian_pada_masukan_bukan_kanonik(): void
    {
        $this->assertSame(['0812', '012'], Telepon::varian('0812'));
    }

    /** Untuk masukan kanonik, kedua bentuk SELALU berbeda - tak ada duplikat. */
    public function test_varian_kanonik_selalu_dua_bentuk_berbeda(): void
    {
        $v = Telepon::varian('6281234567890');
        $this->assertCount(2, $v);
        $this->assertSame($v, array_values(array_unique($v)));
    }
}
