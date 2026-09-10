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
                Schema::create('kurikulum', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
                    $table->string('nama');
                    $table->text('deskripsi')->nullable();
                    $table->timestamps();

                    $table->unique(['lembaga_id', 'nama']);
                });

                Schema::create('mata_pelajaran', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
                    $table->string('nama_mapel');
                    // Kolom darí Modul 202 (kelompok rapor):
                    $table->enum('kelompok', ['formal', 'pesantren'])->default('formal');
                    $table->string('kode_mapel', 20)->nullable();
                    $table->timestamps();

                    $table->unique(['lembaga_id', 'nama_mapel']);
                });

                Schema::create('kelas_kurikulum', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('kelas_id')->constrained('kelas')->cascadeOnDelete();
                    $table->foreignId('kurikulum_id')->constrained('kurikulum')->cascadeOnDelete();
                    $table->timestamps();

                    $table->unique(['kelas_id', 'kurikulum_id']);
                });

                Schema::create('kurikulum_mapel', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('kurikulum_id')->constrained('kurikulum')->cascadeOnDelete();
                    $table->foreignId('mata_pelajaran_id')->constrained('mata_pelajaran')->cascadeOnDelete();
                    $table->string('tingkat')->nullable(); // ref_tingkat: null = semua tingkat; '8'/'9' = khusus
                    $table->decimal('kkm', 5, 2)->nullable(); // null = predikat manual (202)
                    $table->integer('urutan')->default(0); // urutan tampil di rapor/leger
                    $table->timestamps();

                    $table->unique(['kurikulum_id', 'mata_pelajaran_id', 'tingkat'], 'uq_kurikulum_mapel_kmt'); // nama pendek: auto-name 61 char, margin aman dari limit 64
                });

                Schema::create('pengampu_mapel', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('kelas_id')->constrained('kelas')->cascadeOnDelete();
                    $table->foreignId('mata_pelajaran_id')->constrained('mata_pelajaran')->cascadeOnDelete();
                    $table->foreignId('keaktifan_pegawai_id')->nullable()->constrained('keaktifan_pegawai')->nullOnDelete();
                    $table->timestamps();

                    $table->unique(['kelas_id', 'mata_pelajaran_id']);
                });

                Schema::create('slot_jam_pelajaran', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
                    $table->string('nama_slot')->nullable(); // 'Jam 1', 'Jam 2', dsb.
                    $table->time('jam_mulai')->nullable();
                    $table->time('jam_selesai')->nullable();
                    $table->timestamps();
                });

                Schema::create('jadwal_pelajaran', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('pengampu_mapel_id')->constrained('pengampu_mapel')->cascadeOnDelete();
                    $table->foreignId('slot_jam_id')->constrained('slot_jam_pelajaran')->cascadeOnDelete();
                    $table->enum('hari', ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']);
                    $table->string('ruangan')->nullable();
                    $table->timestamps();

                    // Unik per slot/hari = backing constraint validasi bentrok
                    $table->unique(['pengampu_mapel_id', 'slot_jam_id', 'hari']);
                });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jadwal_pelajaran');
        Schema::dropIfExists('slot_jam_pelajaran');
        Schema::dropIfExists('pengampu_mapel');
        Schema::dropIfExists('kurikulum_mapel');
        Schema::dropIfExists('kelas_kurikulum');
        Schema::dropIfExists('mata_pelajaran');
        Schema::dropIfExists('kurikulum');
    }
};
