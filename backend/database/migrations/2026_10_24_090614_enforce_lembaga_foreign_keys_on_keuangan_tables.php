<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // SQLite PRAGMA foreign_keys harus diubah sebelum transaction dimulai.
    public $withinTransaction = false;

    private const TABEL = ['jenis_tagihan', 'tarif_tagihan', 'tagihan'];

    public function up(): void
    {
        $tabelBaru = [];
        foreach (self::TABEL as $tabel) {
            $relasi = array_filter(Schema::getForeignKeys($tabel), fn (array $fk): bool => $fk['columns'] === ['jenjang']);
            if ($relasi === []) {
                $tabelBaru[] = $tabel;

                continue;
            }
            foreach ($relasi as $fk) {
                if ($fk['foreign_table'] !== 'lembaga' || $fk['foreign_columns'] !== ['jenjang']
                    || strtolower($fk['on_update']) !== 'cascade' || strtolower($fk['on_delete']) !== 'restrict') {
                    throw new RuntimeException("Relasi {$tabel}.jenjang berbeda dari kontrak lembaga; periksa skema sebelum upgrade.");
                }
            }
        }

        if (DB::getDriverName() === 'sqlite' && $tabelBaru !== []) {
            $this->ubahSqlite($tabelBaru, true);

            return;
        }

        $this->periksaOrphan();
        foreach ($tabelBaru as $tabel) {
            Schema::table($tabel, function (Blueprint $table) use ($tabel): void {
                $table->foreign('jenjang', $this->namaFk($tabel))
                    ->references('jenjang')->on('lembaga')->cascadeOnUpdate()->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        $tabelBaru = [];
        foreach (self::TABEL as $tabel) {
            if (DB::getDriverName() === 'sqlite') {
                if (str_contains($this->sqlTabel($tabel), $this->klausaFk($tabel))) {
                    $tabelBaru[] = $tabel;
                }
            } else {
                foreach (Schema::getForeignKeys($tabel) as $fk) {
                    if ($fk['name'] === $this->namaFk($tabel)) {
                        $tabelBaru[] = $tabel;
                    }
                }
            }
        }

        if (DB::getDriverName() === 'sqlite' && $tabelBaru !== []) {
            $this->ubahSqlite($tabelBaru, false);

            return;
        }

        foreach ($tabelBaru as $tabel) {
            Schema::table($tabel, fn (Blueprint $table) => $table->dropForeign($this->namaFk($tabel)));
        }
    }

    private function periksaOrphan(): void
    {
        $masalah = [];
        foreach (self::TABEL as $tabel) {
            $jumlah = DB::table($tabel.' as sumber')->whereNotNull('sumber.jenjang')
                ->whereNotExists(function ($query): void {
                    $query->selectRaw('1')->from('lembaga')->whereColumn('lembaga.jenjang', 'sumber.jenjang');
                })->count();
            if ($jumlah > 0) {
                $masalah[] = "{$tabel}: {$jumlah} baris";
            }
        }
        if ($masalah !== []) {
            throw new RuntimeException('Upgrade relasi lembaga dihentikan. Jenjang tidak terdaftar pada '.implode(', ', $masalah).'. Data tidak diperbaiki atau dihapus otomatis.');
        }
    }

    /** @param list<string> $tabelBaru */
    private function ubahSqlite(array $tabelBaru, bool $tambah): void
    {
        $db = DB::connection();
        if ($db->transactionLevel() !== 0 || $db->getPdo()->inTransaction()) {
            throw new RuntimeException('Migration relasi lembaga SQLite harus dijalankan di luar transaction yang sudah aktif.');
        }
        $fkAktif = (bool) $db->scalar('PRAGMA foreign_keys');
        $legacyAlter = (bool) $db->scalar('PRAGMA legacy_alter_table');
        try {
            $db->statement('PRAGMA foreign_keys = OFF');
            // Reference pada trigger/view lain tetap menunjuk nama tabel asli
            // selama celah DROP -> RENAME di dalam transaction.
            $db->statement('PRAGMA legacy_alter_table = ON');
            if ((bool) $db->scalar('PRAGMA foreign_keys')) {
                throw new RuntimeException('Foreign key SQLite tidak dapat dinonaktifkan untuk rebuild yang aman.');
            }
            $db->transaction(function () use ($tabelBaru, $tambah): void {
                if ($tambah) {
                    $this->periksaOrphan();
                }
                foreach ($tabelBaru as $tabel) {
                    $this->rebuildSqlite($tabel, $tambah);
                }
                if (DB::select('PRAGMA foreign_key_check') !== []) {
                    throw new RuntimeException('Verifikasi foreign key SQLite gagal; seluruh perubahan relasi lembaga dibatalkan.');
                }
            });
        } finally {
            $db->statement('PRAGMA legacy_alter_table = '.($legacyAlter ? 'ON' : 'OFF'));
            $db->statement('PRAGMA foreign_keys = '.($fkAktif ? 'ON' : 'OFF'));
        }
    }

    private function rebuildSqlite(string $tabel, bool $tambah): void
    {
        $sementara = '__fk_651_'.$tabel;
        if (Schema::hasTable($sementara)) {
            throw new RuntimeException("Tabel sementara {$sementara} sudah ada; periksa sebelum melanjutkan.");
        }
        // SQL asli menjaga CHECK, generated column, unique, dan opsi tabel.
        // Blueprint rebuild tidak menyimpan seluruh metadata SQLite tersebut.
        $sql = $this->sqlTabel($tabel);
        $awal = strpos($sql, '(');
        $akhir = strrpos($sql, ')');
        if ($awal === false || $akhir === false) {
            throw new RuntimeException("Definisi tabel {$tabel} tidak dapat dibaca untuk rebuild.");
        }
        $sql = $tambah
            ? substr($sql, 0, $akhir).$this->klausaFk($tabel).substr($sql, $akhir)
            : str_replace($this->klausaFk($tabel), '', $sql);
        $metadata = DB::select("select sql from sqlite_schema where tbl_name = ? and type in ('index', 'trigger') and sql is not null", [$tabel]);
        $sequence = DB::table('sqlite_sequence')->where('name', $tabel)->value('seq');
        $kolom = array_filter(DB::select('PRAGMA table_xinfo("'.$tabel.'")'), fn (object $kolom): bool => $kolom->hidden === 0);
        $namaKolom = implode(', ', array_map(fn (object $kolom): string => '"'.str_replace('"', '""', $kolom->name).'"', $kolom));

        DB::statement('CREATE TABLE "'.$sementara.'" '.substr($sql, $awal));
        DB::statement('INSERT INTO "'.$sementara.'" ('.$namaKolom.') SELECT '.$namaKolom.' FROM "'.$tabel.'"');
        DB::statement('DROP TABLE "'.$tabel.'"');
        DB::statement('ALTER TABLE "'.$sementara.'" RENAME TO "'.$tabel.'"');
        foreach ($metadata as $objek) {
            DB::statement($objek->sql);
        }
        if ($sequence !== null) {
            DB::table('sqlite_sequence')->updateOrInsert(['name' => $tabel], ['seq' => max((int) $sequence, (int) DB::table('sqlite_sequence')->where('name', $tabel)->value('seq'))]);
        }
    }

    private function sqlTabel(string $tabel): string
    {
        return (string) DB::table('sqlite_schema')->where('type', 'table')->where('name', $tabel)->value('sql');
    }

    private function namaFk(string $tabel): string
    {
        return 'fk_651_'.$tabel.'_jenjang';
    }

    private function klausaFk(string $tabel): string
    {
        return ', constraint "'.$this->namaFk($tabel).'" foreign key ("jenjang") references "lembaga" ("jenjang") on update cascade on delete restrict';
    }
};
