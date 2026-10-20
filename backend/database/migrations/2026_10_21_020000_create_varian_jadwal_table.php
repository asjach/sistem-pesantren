<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Varian (snapshot versi) jadwal pelajaran per lembaga + tahun ajaran.
 *
 * Dibuat MANUAL lewat tombol "Simpan sebagai varian". `snapshot` menyimpan
 * salinan slot, pengampu, dan sel jadwal dengan kunci alami (nama kelas,
 * hari + nama slot, id mapel, id pegawai) agar bisa dipulihkan walau id baris
 * berubah. Hanya satu varian berstatus aktif per jenjang + tahun ajaran.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('varian_jadwal', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nama', 100);
            $table->boolean('is_active')->default(false);
            $table->json('snapshot');
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['jenjang', 'tahun_ajaran', 'is_active'], 'varian_jadwal_lingkup_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('varian_jadwal');
    }
};
