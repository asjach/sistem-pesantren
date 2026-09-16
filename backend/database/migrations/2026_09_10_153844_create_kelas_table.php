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
        Schema::create('kelas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
            $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->cascadeOnDelete();
            $table->foreignId('walas_id')->nullable()->constrained('pegawai')->nullOnDelete(); // wali kelas → pegawai
            $table->string('tingkat')->nullable(); // ref_tingkat ('7','8','9'); grouping saat kelas_id null di riwayat
            $table->integer('urutan')->default(0); // urutan tampil per lingkup (0 = belum diatur)
            $table->string('nama_kelas'); // 'VII-A'
            $table->integer('kapasitas')->nullable();
            $table->timestamps();

            $table->unique(['lembaga_id', 'tahun_ajaran_id', 'nama_kelas'], 'kelas_lingkup_nama_unique');
            $table->index(['lembaga_id', 'tahun_ajaran_id', 'urutan'], 'kelas_lingkup_urutan_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kelas');
    }
};
