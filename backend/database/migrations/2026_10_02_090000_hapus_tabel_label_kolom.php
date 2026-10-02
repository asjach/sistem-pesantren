<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kamus Label dihapus: label kolom tabel kini ditulis di kode frontend
 * (lihat `lib/labelKolom.ts` untuk humanizer nama kolom). Tabel preset
 * (`preset_tabel`, `toolbar_preset`, `urut_preset`) TIDAK ikut terpengaruh
 * karena fitur tersebut terpisah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('label_kolom');
    }

    public function down(): void
    {
        Schema::create('label_kolom', function (Blueprint $table) {
            $table->id();
            $table->string('tabel', 64);
            $table->string('kolom', 64);
            $table->string('label', 150)->nullable();
            $table->string('align', 12)->nullable();
            $table->string('format', 24)->nullable();
            $table->unsignedSmallInteger('lebar')->nullable();
            $table->boolean('kunci_lebar')->default(false);
            $table->string('tooltip', 255)->nullable();
            $table->timestamps();

            $table->unique(['tabel', 'kolom']);
        });
    }
};