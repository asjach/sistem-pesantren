<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Slot JP menjadi frame per kelas dan per hari. `kelas_id` = null berarti
 * slot lama per jenjang (fallback untuk kelas yang belum punya frame);
 * `hari` = null berarti berlaku semua hari aktif. Porsi JP/Minggu dihapus
 * karena mapel/guru diisi manual, bukan digenerate.
 */
return new class extends Migration
{
    private const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

    public function up(): void
    {
        Schema::table('slot_jam_pelajaran', function (Blueprint $table) {
            $table->foreignId('kelas_id')->nullable()->after('jenjang')
                ->constrained('kelas')->cascadeOnDelete();
            $table->enum('hari', self::HARI)->nullable()->after('kelas_id');
            $table->index(['kelas_id', 'hari', 'urutan'], 'idx_slot_kelas_hari');
        });

        Schema::table('pengampu_mapel', function (Blueprint $table) {
            $table->dropColumn('jp_per_minggu');
        });
    }

    public function down(): void
    {
        Schema::table('pengampu_mapel', function (Blueprint $table) {
            $table->unsignedTinyInteger('jp_per_minggu')->nullable()->after('mata_pelajaran_id');
        });

        Schema::table('slot_jam_pelajaran', function (Blueprint $table) {
            $table->dropIndex('idx_slot_kelas_hari');
            $table->dropConstrainedForeignId('kelas_id');
            $table->dropColumn('hari');
        });
    }
};
