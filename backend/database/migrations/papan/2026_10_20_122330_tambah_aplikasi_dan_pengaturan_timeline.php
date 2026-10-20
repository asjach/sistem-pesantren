<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('papan')->table('papan_modul', function (Blueprint $table) {
            // Modul lama otomatis masuk aplikasi Desktop Admin.
            $table->string('aplikasi', 40)->default('desktop-admin')->after('kode')->index();
        });

        Schema::connection('papan')->create('papan_pengaturan', function (Blueprint $table) {
            $table->string('kunci', 60)->primary();
            $table->text('nilai')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('papan')->dropIfExists('papan_pengaturan');

        Schema::connection('papan')->table('papan_modul', function (Blueprint $table) {
            $table->dropIndex(['aplikasi']);
            $table->dropColumn('aplikasi');
        });
    }
};
