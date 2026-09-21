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
        Schema::create('tahun_ajaran', function (Blueprint $table) {
            // Kunci alami: nama tahun, mis. '2025/2026' (wajib pola YYYY/YYYY).
            // Dipakai sebagai PK string; anak-anak FK ke kolom ini dengan ON UPDATE CASCADE.
            $table->string('nama', 9)->primary();
            $table->date('tanggal_mulai')->nullable();
            $table->date('tanggal_selesai')->nullable();
            $table->boolean('is_aktif')->default(false); // TA berjalan (satu, global)
            $table->unsignedTinyInteger('semester_aktif')->default(1); // 1 ganjil, 2 genap
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tahun_ajaran');
    }
};
