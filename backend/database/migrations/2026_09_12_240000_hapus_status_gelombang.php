<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Status gelombang dihapus: gerbang pendaftaran murni dari tgl_buka/tgl_tutup. */
    public function up(): void
    {
        Schema::table('psb_gelombang', function (Blueprint $table) {
            $table->dropColumn('is_aktif');
        });
    }

    public function down(): void
    {
        Schema::table('psb_gelombang', function (Blueprint $table) {
            $table->boolean('is_aktif')->default(true);
        });
    }
};
