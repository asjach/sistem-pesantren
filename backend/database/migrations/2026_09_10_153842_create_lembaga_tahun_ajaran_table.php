<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pivot visibilitas TA per lembaga (pengganti "baris bayangan").
     * TA sendiri murni global; baris di sini hanya menyembunyikan/menampilkan.
     */
    public function up(): void
    {
        Schema::create('lembaga_tahun_ajaran', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->boolean('is_active')->default(true); // tampil/tidak untuk lembaga ini
            $table->timestamps();

            $table->unique(['lembaga_id', 'tahun_ajaran']);
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lembaga_tahun_ajaran');
    }
};
