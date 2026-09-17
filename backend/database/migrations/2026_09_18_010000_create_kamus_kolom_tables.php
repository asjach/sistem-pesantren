<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kamus kolom level TABEL DATABASE (global se-pesantren): nama header,
     * perataan, lebar acuan, tooltip, format tampil, dan kontrol urut.
     * Berlaku di semua halaman/grid yang menampilkan kolom itu (dikunci via
     * pasangan tabel + kolom, bukan per halaman).
     */
    public function up(): void
    {
        Schema::create('label_kolom', function (Blueprint $table) {
            $table->id();
            $table->string('tabel', 64);
            $table->string('kolom', 64);
            $table->string('label', 100)->nullable();
            $table->enum('align', ['left', 'center', 'right'])->nullable();
            $table->integer('lebar')->nullable();
            $table->boolean('kunci_lebar')->default(false);
            $table->boolean('bisa_urut')->default(true);
            $table->enum('arah_bawaan', ['naik', 'turun'])->nullable();
            $table->string('tooltip', 200)->nullable();
            $table->string('format', 32)->nullable();
            $table->timestamps();

            $table->unique(['tabel', 'kolom']);
        });

        Schema::create('urut_bawaan', function (Blueprint $table) {
            $table->id();
            $table->string('endpoint', 120)->unique();
            $table->json('kunci');
            $table->string('arah', 8)->default('naik');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('urut_bawaan');
        Schema::dropIfExists('label_kolom');
    }
};
