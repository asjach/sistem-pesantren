<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Field penerimaan/keanggotaan + penyeragaman nama keaktifan.
 *
 * - `lembaga_santri`: `tgl_mulai` → `tgl_masuk`; `is_active` → `is_active_lembaga`
 *   (ENUM Ya/Tidak); + `tahaj_masuk`, `tingkat_masuk`, `no_urut`, dan detail
 *   sekolah asal (`nama/npsn/nss/alamat_sekolah_asal`).
 * - `riwayat_belajar`: `is_aktif` → `is_active_riwayat` (ENUM Ya/Tidak).
 * - `santri`: `status_global` → `is_active_pst` (ENUM Ya/Tidak) + `kepala_keluarga`.
 *
 * MySQL memakai raw SQL (rename tanpa doctrine/dbal; ENUM untuk keaktifan).
 * SQLite (test) memakai renameColumn + kolom string (dynamic typing).
 */
return new class extends Migration
{
    private bool $mysql;

    public function __construct()
    {
        $this->mysql = DB::getDriverName() === 'mysql';
    }

    public function up(): void
    {
        Schema::table('lembaga_santri', function (Blueprint $table) {
            $table->string('tahaj_masuk', 50)->nullable()->after('nis_kemenag');
            $table->string('tingkat_masuk', 20)->nullable()->after('tahaj_masuk');
            $table->unsignedInteger('no_urut')->nullable()->after('tingkat_masuk');
            $table->string('nama_sekolah_asal')->nullable()->after('no_urut');
            $table->string('npsn_sekolah_asal', 20)->nullable()->after('nama_sekolah_asal');
            $table->string('nss_sekolah_asal', 30)->nullable()->after('npsn_sekolah_asal');
            $table->text('alamat_sekolah_asal')->nullable()->after('nss_sekolah_asal');
        });

        Schema::table('santri', function (Blueprint $table) {
            $table->string('kepala_keluarga')->nullable()->after('no_kk');
        });

        if (! $this->mysql) {
            Schema::table('lembaga_santri', function (Blueprint $table) {
                $table->renameColumn('tgl_mulai', 'tgl_masuk');
                $table->renameColumn('is_active', 'is_active_lembaga');
            });
            Schema::table('riwayat_belajar', function (Blueprint $table) {
                $table->renameColumn('is_aktif', 'is_active_riwayat');
            });
            Schema::table('santri', function (Blueprint $table) {
                $table->renameColumn('status_global', 'is_active_pst');
            });

            return;
        }

        DB::statement('ALTER TABLE lembaga_santri CHANGE tgl_mulai tgl_masuk DATE NULL');

        $this->ubahKeEnum('ALTER TABLE lembaga_santri CHANGE is_active is_active_lembaga', 'lembaga_santri', 'is_active_lembaga', 'Ya');
        $this->ubahKeEnum('ALTER TABLE riwayat_belajar CHANGE is_aktif is_active_riwayat', 'riwayat_belajar', 'is_active_riwayat', 'Ya');
        $this->ubahKeEnum('ALTER TABLE santri CHANGE status_global is_active_pst', 'santri', 'is_active_pst', 'Tidak');
    }

    public function down(): void
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->dropColumn('kepala_keluarga');
        });

        if (! $this->mysql) {
            Schema::table('santri', function (Blueprint $table) {
                $table->renameColumn('is_active_pst', 'status_global');
            });
            Schema::table('riwayat_belajar', function (Blueprint $table) {
                $table->renameColumn('is_active_riwayat', 'is_aktif');
            });
            Schema::table('lembaga_santri', function (Blueprint $table) {
                $table->renameColumn('is_active_lembaga', 'is_active');
                $table->renameColumn('tgl_masuk', 'tgl_mulai');
            });
        } else {
            DB::statement("ALTER TABLE santri CHANGE is_active_pst status_global VARCHAR(5) NOT NULL DEFAULT 'Tidak'");
            DB::statement("UPDATE santri SET status_global = CASE WHEN status_global = 'Ya' THEN '1' ELSE '0' END");
            DB::statement('ALTER TABLE santri MODIFY status_global TINYINT(1) NOT NULL DEFAULT 0');

            DB::statement("ALTER TABLE riwayat_belajar CHANGE is_active_riwayat is_aktif VARCHAR(5) NOT NULL DEFAULT 'Ya'");
            DB::statement("UPDATE riwayat_belajar SET is_aktif = CASE WHEN is_aktif = 'Ya' THEN '1' ELSE '0' END");
            DB::statement('ALTER TABLE riwayat_belajar MODIFY is_aktif TINYINT(1) NOT NULL DEFAULT 1');

            DB::statement("ALTER TABLE lembaga_santri CHANGE is_active_lembaga is_active VARCHAR(5) NOT NULL DEFAULT 'Ya'");
            DB::statement("UPDATE lembaga_santri SET is_active = CASE WHEN is_active = 'Ya' THEN '1' ELSE '0' END");
            DB::statement('ALTER TABLE lembaga_santri MODIFY is_active TINYINT(1) NOT NULL DEFAULT 1');
            DB::statement('ALTER TABLE lembaga_santri CHANGE tgl_masuk tgl_mulai DATE NULL');
        }

        Schema::table('lembaga_santri', function (Blueprint $table) {
            $table->dropColumn([
                'tahaj_masuk', 'tingkat_masuk', 'no_urut',
                'nama_sekolah_asal', 'npsn_sekolah_asal', 'nss_sekolah_asal', 'alamat_sekolah_asal',
            ]);
        });
    }

    /** Boolean → ENUM('Ya','Tidak') via VARCHAR perantara (1/0 lama terbaca benar). */
    private function ubahKeEnum(string $changeToVarchar, string $tabel, string $kolom, string $bawaan): void
    {
        DB::statement("{$changeToVarchar} VARCHAR(5) NOT NULL DEFAULT '{$bawaan}'");
        DB::statement("UPDATE {$tabel} SET {$kolom} = CASE WHEN {$kolom} IN ('1', 'Ya') THEN 'Ya' ELSE 'Tidak' END");
        DB::statement("ALTER TABLE {$tabel} MODIFY {$kolom} ENUM('Ya', 'Tidak') NOT NULL DEFAULT '{$bawaan}'");
    }
};
