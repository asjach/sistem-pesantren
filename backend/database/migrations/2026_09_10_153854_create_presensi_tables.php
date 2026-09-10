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
                Schema::create('sesi_presensi', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('lembaga_id')->nullable()->constrained('lembaga')->nullOnDelete();
                    $table->string('nama_sesi'); // 'KBM Pagi', 'Shalat Subuh Jamaah'
                    $table->enum('kategori', ['kbm', 'kegiatan_asrama', 'shalat']);
                    $table->time('jam_mulai')->nullable();
                    $table->time('jam_selesai')->nullable();
                    $table->boolean('is_active')->default(true);
                    $table->timestamps();
                });

                Schema::create('presensi_santri', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
                    $table->foreignId('kelas_id')->constrained('kelas')->cascadeOnDelete();
                    $table->foreignId('sesi_presensi_id')->constrained('sesi_presensi')->cascadeOnDelete();
                    $table->date('tanggal');
                    $table->enum('status', ['hadir', 'sakit', 'izin', 'alpa'])->default('hadir');
                    $table->text('keterangan')->nullable();
                    $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
                    $table->timestamps();

                    $table->unique(['santri_id', 'sesi_presensi_id', 'tanggal']);
                });

                Schema::create('pelanggaran_santri', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
                    $table->foreignId('lembaga_id')->nullable()->constrained('lembaga')->nullOnDelete();
                    $table->date('tanggal')->nullable();
                    $table->string('tipe_pelanggaran')->nullable(); // ref_tipe_pelanggaran
                    $table->text('deskripsi')->nullable();
                    $table->integer('poin')->default(0); // dipakai portal wali (total poin)
                    $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
                    $table->timestamps();
                });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pelanggaran_santri');
        Schema::dropIfExists('presensi_santri');
        Schema::dropIfExists('sesi_presensi');
    }
};
