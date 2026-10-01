<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use PDO;
use Tests\Feature\Concerns\VerifikasiSkemaDokumen;
use Tests\TestCase;
use Throwable;

/**
 * Smoke test skema pada **MySQL** sungguhan: menjalankan `migrate:fresh` lalu
 * memverifikasi tabel, kolom, index, dan foreign key dengan penjaga yang sama
 * seperti `SchemaDocTest`. Tujuannya menangkap perbedaan driver MySQL vs SQLite
 * (panjang/penamaan index, unique lintas kolom, perilaku foreign key, dll.)
 * yang tidak terlihat di suite SQLite in-memory.
 *
 * Sengaja **opt-in** dan memakai database terpisah agar tidak pernah menyentuh
 * database dev. Jalankan dengan:
 *
 *     SIMPES_SMOKE_MYSQL=1 php artisan test --filter SchemaMysqlSmokeTest
 *
 * Nama database dibuat dari kredensial koneksi `mysql` di `.env`
 * (host/user/password), tetapi database-nya sendiri baru:
 * `simpes_schema_smoke` (bisa ditimpa lewat `SIMPES_SMOKE_MYSQL_DATABASE`).
 * Database ini dibuat sebelum dan dihapus setelah test.
 */
class SchemaMysqlSmokeTest extends TestCase
{
    use VerifikasiSkemaDokumen;

    private const NAMA_DATABASE_BAWAAAN = 'simpes_schema_smoke';

    /** Nama database smoke aktif (null = tidak sedang berjalan). */
    private static ?string $dbSmoke = null;

    /** Kredensial server, disimpan agar bisa drop DB dari tearDownAfterClass statik. */
    private static array $kredensial = [];

    private static bool $sudahMigrasi = false;

    protected function setUp(): void
    {
        parent::setUp();

        if ($this->app->environment('production')) {
            $this->fail('Smoke test MySQL tidak boleh dijalankan di production.');
        }

        $nama = $this->namaDatabaseSmoke();
        if ($nama === null) {
            $this->markTestSkipped(
                'Lewati smoke test MySQL. Aktifkan dengan SIMPES_SMOKE_MYSQL=1 '.
                '(butuh server MySQL yang bisa diakses dan boleh membuat database).',
            );
        }

        $this->siapkanDatabaseSmoke($nama);
    }

    public static function tearDownAfterClass(): void
    {
        parent::tearDownAfterClass();

        if (self::$dbSmoke === null || self::$kredensial === []) {
            return;
        }

        try {
            self::pdo(self::$kredensial)->exec('DROP DATABASE IF EXISTS `'.self::$dbSmoke.'`');
        } catch (Throwable) {
            // Pembersihan gagal bukan kegagalan test; DB smoke boleh tertinggal.
        } finally {
            self::$dbSmoke = null;
            self::$kredensial = [];
            self::$sudahMigrasi = false;
        }
    }

    /**
     * Nama database smoke, atau null bila smoke test tidak diminta.
     */
    private function namaDatabaseSmoke(): ?string
    {
        if (! filter_var(env('SIMPES_SMOKE_MYSQL', false), FILTER_VALIDATE_BOOLEAN)) {
            return null;
        }

        $nama = (string) env('SIMPES_SMOKE_MYSQL_DATABASE', self::NAMA_DATABASE_BAWAAAN);

        // Sabuk pengaman: hanya boleh membuat/menghapus database bernama pola
        // smoke, agar tidak mungkin menimpa database dev/production.
        if (preg_match('/^simpes_[a-z0-9_]*smoke[a-z0-9_]*$/', $nama) !== 1) {
            $this->fail("Nama database smoke `{$nama}` tidak aman (harus berpola `simpes_*smoke*`).");
        }

        return $nama;
    }

    /**
     * Arahkan koneksi default ke database smoke dan jalankan `migrate:fresh`
     * sekali saja (test berikutnya memakai skema yang sama).
     */
    private function siapkanDatabaseSmoke(string $nama): void
    {
        $konfig = config('database.connections.mysql');
        self::$kredensial = $konfig;

        if (self::$dbSmoke !== $nama) {
            self::pdo($konfig)->exec(
                'CREATE DATABASE IF NOT EXISTS `'.$nama.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
            );
            self::$dbSmoke = $nama;
            self::$sudahMigrasi = false;
        }

        config([
            'database.connections.mysql_smoke' => array_merge($konfig, ['database' => $nama]),
            'database.default' => 'mysql_smoke',
        ]);
        DB::purge('mysql_smoke');

        if (self::$sudahMigrasi) {
            return;
        }

        Artisan::call('migrate:fresh', ['--force' => true, '--database' => 'mysql_smoke']);
        self::$sudahMigrasi = true;

        $this->assertSame(
            'mysql',
            DB::connection('mysql_smoke')->getDriverName(),
            'Koneksi smoke seharusnya memakai driver MySQL.',
        );
    }

    /**
     * Koneksi PDO ke server tanpa memilih database (untuk CREATE/DROP DATABASE).
     *
     * @param  array<string, mixed>  $konfig
     */
    private static function pdo(array $konfig): PDO
    {
        $dsn = 'mysql:host='.($konfig['host'] ?? '127.0.0.1').';port='.($konfig['port'] ?? '3306');

        if (! empty($konfig['unix_socket'])) {
            $dsn .= ';unix_socket='.$konfig['unix_socket'];
        }

        if (! empty($konfig['charset'])) {
            $dsn .= ';charset='.$konfig['charset'];
        }

        return new PDO(
            $dsn,
            (string) ($konfig['username'] ?? 'root'),
            (string) ($konfig['password'] ?? ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
        );
    }
}
