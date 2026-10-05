<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Perataan kolom per tabel, GLOBAL satu nilai per kolom (bukan per
     * preset): peta key kolom → 'left'|'center'|'right'. Absen = ikut
     * preferensi pribadi pengguna, lalu bawaan tengah di frontend.
     */
    public function up(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->json('align')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->dropColumn('align');
        });
    }
};
