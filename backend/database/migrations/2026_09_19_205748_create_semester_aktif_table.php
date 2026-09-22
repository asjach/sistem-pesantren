<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Semester aktif terpusat per lembaga operasional: satu baris per
     * lembaga (`lembaga_id` unik; root pesantren tak punya semester).
     * `semester`: '1' = Ganjil, '2' = Genap. Absen baris = belum diatur.
     */
    public function up(): void
    {
        Schema::create('semester_aktif', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20)->unique();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->char('semester', 1);
            $table->foreignId('diubah_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('semester_aktif');
    }
};
