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
            $table->id();
            // Global pesantren (mirip ref_*): NULL = TA global (super_admin, berlaku semua
            // lembaga); terisi = baris bayangan lembaga (hanya untuk menyembunyikan).
            $table->foreignId('lembaga_id')->nullable()->constrained('lembaga')->nullOnDelete();
            $table->string('nama'); // misal: '2025/2026' (PENYATUAN: bukan 'nama_tahun_ajaran')
            $table->date('tanggal_mulai')->nullable();
            $table->date('tanggal_selesai')->nullable();
            $table->boolean('is_aktif')->default(false); // TA berjalan (satu, global)
            $table->boolean('is_active')->default(true); // tampil/tidak (bayangan)
            $table->timestamps();

            $table->unique(['lembaga_id', 'nama']); // nama tahun unik per lembaga
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
