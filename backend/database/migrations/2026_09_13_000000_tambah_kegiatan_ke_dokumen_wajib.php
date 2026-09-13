<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Ketentuan dokumen PSB kini per kegiatan + lembaga. Data lama dihapus (input ulang). */
    public function up(): void
    {
        Schema::table('dokumen_wajib_lembaga', function (Blueprint $table) {
            $table->foreignId('psb_kegiatan_id')->nullable()->after('lembaga_id')->constrained('psb_kegiatan')->cascadeOnDelete();
        });

        DB::table('dokumen_wajib_lembaga')->delete();

        Schema::table('dokumen_wajib_lembaga', function (Blueprint $table) {
            $table->index('lembaga_id');
            $table->unique(['psb_kegiatan_id', 'lembaga_id', 'jenis_dokumen_santri'], 'dokumen_wajib_scope_unique');
            $table->dropUnique(['lembaga_id', 'jenis_dokumen_santri']);
        });
    }

    public function down(): void
    {
        Schema::table('dokumen_wajib_lembaga', function (Blueprint $table) {
            $table->unique(['lembaga_id', 'jenis_dokumen_santri']);
            $table->dropUnique('dokumen_wajib_scope_unique');
            $table->dropIndex(['lembaga_id']);
            $table->dropConstrainedForeignId('psb_kegiatan_id');
        });
    }
};
