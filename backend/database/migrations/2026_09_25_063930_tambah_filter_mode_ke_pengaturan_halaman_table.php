<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pengaturan_halaman', function (Blueprint $table) {
            $table->json('filter_mode')->nullable()->after('filter');
        });
    }

    public function down(): void
    {
        Schema::table('pengaturan_halaman', function (Blueprint $table) {
            $table->dropColumn('filter_mode');
        });
    }
};
