<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::connection('papan')->table('papan_butir', function (Blueprint $table) {
            $table->json('subpoin')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('papan')->table('papan_butir', function (Blueprint $table) {
            $table->dropColumn('subpoin');
        });
    }
};
