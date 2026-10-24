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
 * "Done" padahal masih ada pekerjaan — karena itu tiap cabang diuji
 * terpisah, termasuk urutan prioritasnya.
 */
class PapanStatusTurunanTest extends TestCase
{
    /** @return array<string, array{0: array<int, string>, 1: string}> */
    public static function kasus(): array
    {
        return [
            'tanpa poin masuk Backlog' => [[], 'backlog'],
            'semua Pending tetap Pending' => [['pending', 'pending'], 'pending'],
            'Pending bercampur Done tetap Pending' => [['pending', 'done'], 'pending'],
            'Pending menahan For Review' => [['pending', 'for_review'], 'pending'],
            'pekerjaan aktif tetap didahulukan dari Pending' => [['pending', 'in_progress'], 'in_progress'],
            'To Do tetap didahulukan dari Pending' => [['pending', 'todo'], 'todo'],
            'Backlog tetap didahulukan dari Pending' => [['pending', 'backlog'], 'backlog'],
            'semua Done berarti selesai' => [['done', 'done'], 'done'],
            'In Progress menang atas Done' => [['done', 'in_progress'], 'in_progress'],
            'In Progress menang atas To Do' => [['todo', 'in_progress'], 'in_progress'],
            'To Do menahan sub-modul' => [['done', 'done', 'todo'], 'todo'],
            'semua Backlog berarti Backlog' => [['backlog', 'backlog'], 'backlog'],
            'Backlog bercampur Done tetap Backlog' => [['backlog', 'done'], 'backlog'],
            'Backlog bercampur To Do berarti To Do' => [['backlog', 'todo'], 'todo'],
            'For Review menang atas Done' => [['done', 'for_review'], 'for_review'],
            'To Do menang atas For Review' => [['for_review', 'todo'], 'todo'],
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
