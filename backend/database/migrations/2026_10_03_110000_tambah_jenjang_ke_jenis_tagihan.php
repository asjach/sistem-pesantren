<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jenis_tagihan', function (Blueprint $table) {
            // null = berlaku semua lembaga; terisi = khusus lembaga itu.
            $table->string('jenjang', 50)->nullable()->after('tipe');
            $table->index('jenjang');
        });
    }

    public function down(): void
    {
        Schema::table('jenis_tagihan', function (Blueprint $table) {
            $table->dropIndex(['jenjang']);
            $table->dropColumn('jenjang');
        });
    }
};
