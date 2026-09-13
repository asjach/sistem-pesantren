<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Dokumen santri mendukung baris checklist: file boleh kosong + tanda "tidak memiliki". */
    public function up(): void
    {
        Schema::table('dokumen_santri', function (Blueprint $table) {
            $table->string('path_file')->nullable()->change();
            $table->boolean('tidak_memiliki')->default(false)->after('status_verifikasi');
        });
    }

    public function down(): void
    {
        Schema::table('dokumen_santri', function (Blueprint $table) {
            $table->dropColumn('tidak_memiliki');
            $table->string('path_file')->change();
        });
    }
};
