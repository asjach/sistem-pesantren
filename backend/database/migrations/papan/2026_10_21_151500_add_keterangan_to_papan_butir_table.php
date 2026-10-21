<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Keterangan bebas per poin, terpisah dari judul poinnya. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('papan')->table('papan_butir', function (Blueprint $table) {
            $table->text('keterangan')->nullable()->after('deskripsi');
        });
    }

    public function down(): void
    {
        Schema::connection('papan')->table('papan_butir', function (Blueprint $table) {
            $table->dropColumn('keterangan');
        });
    }
};
