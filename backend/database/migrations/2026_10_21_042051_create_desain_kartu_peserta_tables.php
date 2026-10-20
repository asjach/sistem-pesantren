<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('desain_kartu_peserta', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nama', 100);
            $table->json('elemen');
            $table->string('warna_latar', 7)->default('#ffffff');
            $table->string('gaya_latar', 30)->default('bersih');
            $table->string('latar_path')->nullable();
            $table->timestamps();

            $table->unique(['jenjang', 'nama'], 'uq_desain_kartu_jenjang_nama');
        });

        Schema::create('pengaturan_kartu_peserta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('peristiwa_id')->constrained('peristiwa_nilai')->cascadeOnDelete();
            $table->foreignId('desain_id')->nullable()->constrained('desain_kartu_peserta')->nullOnDelete();
            $table->string('template_bawaan', 30)->nullable();
            $table->decimal('lebar_mm', 6, 2)->default(85.60);
            $table->decimal('tinggi_mm', 6, 2)->default(53.98);
            $table->timestamps();

            $table->unique('peristiwa_id', 'uq_pengaturan_kartu_peristiwa');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pengaturan_kartu_peserta');
        Schema::dropIfExists('desain_kartu_peserta');
    }
};
