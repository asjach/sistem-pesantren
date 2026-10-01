<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Penempatan pegawai per lembaga. NIPP adalah identitas global di `pegawai`
     * (bukan lagi per lembaga), jadi tidak ada kolom NIPP di sini.
     */
    public function up(): void
    {
        Schema::create('lembaga_pegawai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pegawai_id')->constrained('pegawai')->cascadeOnDelete();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tugas_utama')->nullable(); // ref_tugas_utama (diisi eksplisit dari kamus)
            $table->string('no_sk_awal_ptk', 100)->nullable(); // SK awal per jenjang
            $table->date('tgl_sk_awal_ptk')->nullable();
            $table->enum('is_active_lembaga', ['Ya', 'Tidak'])->default('Ya');
            $table->date('tgl_masuk')->nullable();
            $table->date('tgl_selesai')->nullable();
            $table->string('tahaj_masuk', 50)->nullable();
            $table->timestamps();

            $table->unique(['pegawai_id', 'jenjang']);
            $table->index(['jenjang', 'is_active_lembaga']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lembaga_pegawai');
    }
};
