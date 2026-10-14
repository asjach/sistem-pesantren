<?php

namespace Tests\Unit;

use App\Support\NikFlag;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class NikFlagTest extends TestCase
{
    public function test_nik_16_digit_valid_tidak_ditandai(): void
    {
        $this->assertSame('3204104609050011', NikFlag::tandai('3204104609050011'));
        $this->assertTrue(NikFlag::valid('3204104609050011'));
    }

    public function test_digit_bukan_16_ditandai(): void
    {
        $this->assertSame('X-320410460905001', NikFlag::tandai('320410460905001'));
        $this->assertSame('X-32041046090500112', NikFlag::tandai('32041046090500112'));
        $this->assertFalse(NikFlag::valid('X-320410460905001'));
    }

    /** Idempoten: menandai ulang yang sudah bertanda tidak menambah X- kedua. */
    public function test_idempoten_tidak_menambah_tanda_ganda(): void
    {
        $sekali = NikFlag::tandai('123');
        $this->assertSame('X-123', $sekali);
        $this->assertSame('X-123', NikFlag::tandai($sekali));
        $this->assertSame('X-123', NikFlag::tandai(NikFlag::tandai($sekali)));
    }

    public function test_string_kosong_dikembalikan_sebagai_nilai_asli(): void
    {
        // '' -> '' (bukan 'X-'), tapi spasi dipangkas.
        $this->assertSame('', NikFlag::tandai(''));
        $this->assertSame('X-abc', NikFlag::tandai('  abc  '));
    }

    /** Nilai non-skalar diteruskan apa adanya (jangan merusak array/null). */
    public function test_nilai_non_skalar_dilewatkan(): void
    {
        $this->assertNull(NikFlag::tandai(null));
        $this->assertSame(['a'], NikFlag::tandai(['a']));
        $this->assertTrue(NikFlag::tandai(true));
    }

    #[DataProvider('angkaProvider')]
    public function test_bilangan_diperlakukan_sebagai_teks_digit(int|float $masuk, string $harap): void
    {
        $this->assertSame($harap, NikFlag::tandai($masuk));
    }

    /** @return array<string, array{0: int|float, 1: string}> */
    public static function angkaProvider(): array
    {
        return [
            'int 16 digit valid' => [3204104609050011, '3204104609050011'],
            'int pendek ditandai' => [123, 'X-123'],
            // float 1.0 -> (string) '1' -> ditandai; bukan '1.0'.
            'float bulat jadi digit polos' => [1.0, 'X-1'],
        ];
    }

    public function test_valid_hanya_untuk_string_16_digit(): void
    {
        $this->assertFalse(NikFlag::valid(null));
        $this->assertFalse(NikFlag::valid(3204104609050011), 'int bukan string: tak dianggap valid');
        $this->assertTrue(NikFlag::valid(' 3204104609050011 '), 'spasi dipangkas');
        $this->assertFalse(NikFlag::valid('3204-1046-0905-001'));
    }
}
