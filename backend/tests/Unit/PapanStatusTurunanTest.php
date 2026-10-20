<?php

namespace Tests\Unit;

use App\Services\PapanService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Aturan turunan status sub-modul dari poin-poinnya.
 *
 * Ini inti model papan: yang bergerak adalah POIN, dan status sub-modul
 * hanyalah ringkasannya. Kalau aturan ini salah, papan bisa bilang
 * "sudah" padahal masih ada pekerjaan — karena itu tiap cabang diuji
 * terpisah, termasuk urutan prioritasnya.
 */
class PapanStatusTurunanTest extends TestCase
{
    /** @return array<string, array{0: array<int, string>, 1: string}> */
    public static function kasus(): array
    {
        return [
            'tanpa poin dianggap belum dikerjakan' => [[], 'akan'],
            'semua sudah berarti selesai' => [['sudah', 'sudah'], 'sudah'],
            'satu sedang menang atas sudah' => [['sudah', 'sedang'], 'sedang'],
            'sedang menang atas akan' => [['akan', 'sedang'], 'sedang'],
            'satu akan menahan sub-modul tetap akan' => [['sudah', 'sudah', 'akan'], 'akan'],
            'semua ditunda berarti ditunda' => [['ditunda', 'ditunda'], 'ditunda'],
            'ditunda bercampur sudah tetap dianggap ditunda' => [['ditunda', 'sudah'], 'ditunda'],
            'ditunda bercampur akan berarti akan' => [['ditunda', 'akan'], 'akan'],
        ];
    }

    /** @param array<int, string> $status */
    #[DataProvider('kasus')]
    public function test_status_turunan(array $status, string $harapan): void
    {
        $butir = array_map(fn (string $s) => ['status' => $s], $status);

        $this->assertSame($harapan, PapanService::statusTurunan($butir));
    }
}
