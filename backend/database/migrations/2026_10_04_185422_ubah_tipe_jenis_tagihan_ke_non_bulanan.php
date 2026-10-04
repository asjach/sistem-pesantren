<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ubah nilai tipe jenis tagihan: `sekali` → `non_bulanan` (semantik:
     * ASAS/ASAT/HIPA dsb. bukan sekali seumur, hanya satu periode per
     * generate; yang menentukan perilaku generate tetap `bulanan` vs bukan).
     */
    public function up(): void
    {
        // Lebarkan dulu agar nilai baru valid, baru sempitkan.
        Schema::table('jenis_tagihan', function (Blueprint $table) {
            $table->enum('tipe', ['bulanan', 'sekali', 'non_bulanan'])->default('non_bulanan')->change();
        });
        DB::table('jenis_tagihan')->where('tipe', 'sekali')->update(['tipe' => 'non_bulanan']);
        Schema::table('jenis_tagihan', function (Blueprint $table) {
            $table->enum('tipe', ['bulanan', 'non_bulanan'])->default('non_bulanan')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jenis_tagihan', function (Blueprint $table) {
            $table->enum('tipe', ['bulanan', 'sekali', 'non_bulanan'])->default('sekali')->change();
        });
        DB::table('jenis_tagihan')->where('tipe', 'non_bulanan')->update(['tipe' => 'sekali']);
        Schema::table('jenis_tagihan', function (Blueprint $table) {
            $table->enum('tipe', ['bulanan', 'sekali'])->default('sekali')->change();
        });
    }
};
