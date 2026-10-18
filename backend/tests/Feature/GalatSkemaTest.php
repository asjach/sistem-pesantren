<?php

namespace Tests\Feature;

use App\Support\GalatSkema;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Route;
use PDOException;
use Tests\TestCase;

/**
 * Pengaman "skema database tertinggal": migrasi belum jalan di server tidak
 * boleh muncul sebagai dump SQL mentah di toast aplikasi, tapi sebagai pesan
 * yang bisa ditindaklanjuti admin server.
 *
 * Fokus tes: kode SQLSTATE yang DIKLAIM (kolom/tabel hilang, kolom ganda),
 * kode yang TIDAK boleh diklaim (supaya galat lain tidak tertutup pesan
 * menyesatkan), dan bentuk jawaban HTTP-nya.
 */
class GalatSkemaTest extends TestCase
{
    /** QueryException seperti yang dilempar koneksi MySQL (errorInfo PDO). */
    private function galat(string $sqlstate): QueryException
    {
        $pdo = new PDOException('SQLSTATE error', 0);
        $pdo->errorInfo = [$sqlstate, 1054, 'Unknown column'];

        return new QueryException(
            'mysql',
            'update `toolbar_preset` set `info_html` = ? where `id` = ?',
            ['Test', 13],
            $pdo,
        );
    }

    public function test_kolom_hilang_dikenali(): void
    {
        $this->assertSame('42S22', GalatSkema::kode($this->galat('42S22')));
        $this->assertSame(GalatSkema::PESAN, GalatSkema::pesan($this->galat('42S22')));
    }

    public function test_tabel_hilang_dan_kolom_ganda_dikenali(): void
    {
        foreach (['42S02', '42S21'] as $sqlstate) {
            $this->assertSame($sqlstate, GalatSkema::kode($this->galat($sqlstate)), $sqlstate);
        }
    }

    /** Constraint/sintaks/koneksi bukan urusan pengaman ini. */
    public function test_galat_query_lain_tidak_diklaim(): void
    {
        foreach (['23000', '42000', 'HY000', '42S22X'] as $sqlstate) {
            $this->assertNull(GalatSkema::pesan($this->galat($sqlstate)), $sqlstate);
        }

        $tanpaErrorInfo = new QueryException(
            'mysql',
            'select 1',
            [],
            new PDOException('Connection refused', 2002),
        );
        $this->assertNull(GalatSkema::pesan($tanpaErrorInfo));
    }

    public function test_endpoint_menjawab_503_dengan_pesan_jelas_tanpa_sql_mentah(): void
    {
        Route::get('/api/uji-skema-tertinggal', fn () => throw $this->galat('42S22'));

        $res = $this->getJson('/api/uji-skema-tertinggal');

        $res->assertStatus(503)
            ->assertJsonPath('kode', GalatSkema::KODE)
            ->assertJsonPath('pesan', GalatSkema::PESAN);

        // Alasan pengaman ini ada: nama tabel/kolom dan SQL tak boleh bocor ke
        // UI pengguna lewat badan jawaban.
        $isi = (string) $res->getContent();
        $this->assertStringNotContainsString('toolbar_preset', $isi);
        $this->assertStringNotContainsString('SQLSTATE', $isi);
    }
}
