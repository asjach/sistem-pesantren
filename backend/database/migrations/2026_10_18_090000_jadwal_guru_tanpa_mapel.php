<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jadwal boleh berisi GURU dulu tanpa mapel.
 *
 * Sel jadwal kini punya dua sumber identitas:
 *  - `pengampu_mapel_id` (kelas × mapel → guru) saat mapel sudah diisi;
 *  - `keaktifan_pegawai_id` langsung di sel saat baru guru yang diisi.
 * `kelas_id` ditambahkan supaya sel guru-saja tetap bisa diatribusikan ke
 * kelasnya (pengampu null tidak bisa dipakai mencari kelas).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jadwal_pelajaran', function (Blueprint $table) {
            $table->foreignId('kelas_id')->nullable()->after('id')
                ->constrained('kelas')->cascadeOnDelete();
            $table->foreignId('keaktifan_pegawai_id')->nullable()->after('pengampu_mapel_id')
                ->constrained('keaktifan_pegawai')->cascadeOnDelete();
        });

        DB::table('jadwal_pelajaran')->orderBy('id')->chunkById(500, function ($rows): void {
            $peta = DB::table('pengampu_mapel')
                ->whereIn('id', $rows->pluck('pengampu_mapel_id')->filter()->all())
                ->pluck('kelas_id', 'id');
            foreach ($rows as $row) {
                $kelasId = $peta[$row->pengampu_mapel_id] ?? null;
                if ($kelasId !== null) {
                    DB::table('jadwal_pelajaran')->where('id', $row->id)->update(['kelas_id' => $kelasId]);
                }
            }
        });

        Schema::table('jadwal_pelajaran', function (Blueprint $table) {
            $table->foreignId('pengampu_mapel_id')->nullable()->change();
            $table->unique(['kelas_id', 'slot_jam_id', 'hari'], 'uq_jadwal_kelas_slot_hari');
        });
    }

    public function down(): void
    {
        Schema::table('jadwal_pelajaran', function (Blueprint $table) {
            $table->dropUnique('uq_jadwal_kelas_slot_hari');
            $table->dropConstrainedForeignId('keaktifan_pegawai_id');
            $table->dropConstrainedForeignId('kelas_id');
        });

        DB::table('jadwal_pelajaran')->whereNull('pengampu_mapel_id')->delete();
        Schema::table('jadwal_pelajaran', function (Blueprint $table) {
            $table->foreignId('pengampu_mapel_id')->nullable(false)->change();
        });
    }
};
