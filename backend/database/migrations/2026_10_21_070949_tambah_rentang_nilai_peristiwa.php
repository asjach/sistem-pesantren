<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('peristiwa_nilai', function (Blueprint $table) {
            $table->string('rentang_nilai', 10)->default('0-100')->after('jenis_rapor');
        });
    }

    public function down(): void
    {
        Schema::table('peristiwa_nilai', function (Blueprint $table) {
            $table->dropColumn('rentang_nilai');
        });
    }
};
