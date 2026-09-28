<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `pegawai.status_aktif`: aktif/cuti/keluar → Ya/Tidak
     * (selaras `is_active_lembaga`, `is_active_pst`).
     * Pemetaan: aktif → Ya; cuti/keluar → Tidak.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE pegawai MODIFY status_aktif ENUM('aktif','cuti','keluar','Ya','Tidak') NOT NULL DEFAULT 'aktif'");
            DB::table('pegawai')->where('status_aktif', 'aktif')->update(['status_aktif' => 'Ya']);
            DB::table('pegawai')->whereIn('status_aktif', ['cuti', 'keluar'])->update(['status_aktif' => 'Tidak']);
            DB::statement("ALTER TABLE pegawai MODIFY status_aktif ENUM('Ya','Tidak') NOT NULL DEFAULT 'Ya'");

            return;
        }

        // SQLite (tes) menegakkan CHECK dari CREATE TABLE lama: rebuild tabel.
        $this->rebuildSqlite(
            ['aktif' => 'Ya', 'cuti' => 'Tidak', 'keluar' => 'Tidak'],
            ['Ya', 'Tidak'],
            'Ya'
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE pegawai MODIFY status_aktif ENUM('aktif','cuti','keluar','Ya','Tidak') NOT NULL DEFAULT 'Ya'");
            DB::table('pegawai')->where('status_aktif', 'Ya')->update(['status_aktif' => 'aktif']);
            DB::table('pegawai')->where('status_aktif', 'Tidak')->update(['status_aktif' => 'keluar']);
            DB::statement("ALTER TABLE pegawai MODIFY status_aktif ENUM('aktif','cuti','keluar') NOT NULL DEFAULT 'aktif'");

            return;
        }

        $this->rebuildSqlite(
            ['Ya' => 'aktif', 'Tidak' => 'keluar'],
            ['aktif', 'cuti', 'keluar'],
            'aktif'
        );
    }

    /**
     * Rebuild `pegawai` di SQLite: salin DDL, ganti CHECK + DEFAULT
     * `status_aktif`, pindahkan data dengan pemetaan nilai, buat ulang index.
     *
     * @param  array<string, string>  $peta  nilai lama => nilai baru
     * @param  list<string>  $daftar  nilai CHECK yang baru
     */
    private function rebuildSqlite(array $peta, array $daftar, string $bawaan): void
    {
        $ddl = DB::selectOne(
            "select sql from sqlite_master where type = 'table' and name = 'pegawai'"
        )->sql;

        $isi = implode(', ', array_map(fn ($v) => "'{$v}'", $daftar));
        $baru = preg_replace(
            '/CHECK\s*\(\s*"status_aktif"\s+IN\s*\([^)]*\)/i',
            "CHECK (\"status_aktif\" IN ({$isi})",
            $ddl
        );
        // Hanya kolom status_aktif yang ber-default 'aktif'/'keluar' di tabel ini.
        $baru = str_replace("not null default 'aktif'", "not null default '{$bawaan}'", $baru);
        $baru = str_replace('not null default "aktif"', "not null default '{$bawaan}'", $baru);
        $baru = str_replace('CREATE TABLE "pegawai"', 'CREATE TABLE "pegawai_baru"', $baru);

        $kolom = Schema::getColumnListing('pegawai');
        $kasus = collect($peta)
            ->map(fn ($tujuan, $asal) => "WHEN '{$asal}' THEN '{$tujuan}'")
            ->implode(' ');
        $pilih = collect($kolom)
            ->map(fn ($c) => $c === 'status_aktif'
                ? "CASE status_aktif {$kasus} ELSE status_aktif END AS status_aktif"
                : "\"{$c}\"")
            ->implode(', ');

        $indeks = DB::select(
            "select sql from sqlite_master where type = 'index' and tbl_name = 'pegawai' and sql is not null"
        );

        DB::statement('PRAGMA foreign_keys = OFF');
        try {
            DB::statement($baru);
            DB::statement('INSERT INTO "pegawai_baru" ("'.implode('", "', $kolom)."\") SELECT {$pilih} FROM \"pegawai\"");
            Schema::drop('pegawai');
            DB::statement('ALTER TABLE "pegawai_baru" RENAME TO "pegawai"');
            foreach ($indeks as $row) {
                DB::statement($row->sql);
            }
        } finally {
            DB::statement('PRAGMA foreign_keys = ON');
        }
    }
};
