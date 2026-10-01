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
        Schema::create('pegawai_pendidikan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pegawai_id')->constrained('pegawai')->cascadeOnDelete();
            $table->string('tingkatan')->nullable(); // S1, D4, dsb.
            $table->string('nama_institusi')->nullable();
            $table->integer('tahun_selesai')->nullable();
            $table->text('catatan')->nullable();
            $table->timestamps();
        });

        Schema::create('pegawai_sertifikasi', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pegawai_id')->constrained('pegawai')->cascadeOnDelete();
            $table->string('nrg')->nullable();
            $table->string('mapel')->nullable();
            $table->string('nomor_peserta')->nullable();
            $table->string('lptk_penyelenggara')->nullable();
            $table->string('nomor_sertifikat')->nullable();
            $table->date('tgl_kelulusan')->nullable();
            $table->integer('tahun_sertifikasi')->nullable();
            $table->string('model_sertifikasi')->nullable();
            $table->string('jalur_sertifikasi')->nullable(); // ref_jalur_sertifikasi
            $table->string('jenjang_sertifikasi')->nullable(); // ref_jenjang_sertifikasi
            $table->string('nama_sertifikasi')->nullable();
            $table->string('institusi')->nullable();
            $table->date('tanggal_peroleh')->nullable();
            $table->string('file_path')->nullable();
            $table->timestamps();

            $table->unique(['pegawai_id']);
        });

        Schema::create('keluarga_pegawai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pegawai_id')->constrained('pegawai')->cascadeOnDelete();
            $table->string('nama');
            $table->string('nik', 16)->nullable();
            $table->enum('hubungan', ['suami', 'istri', 'anak', 'ayah', 'ibu', 'lainnya'])->default('lainnya');
            $table->string('tmp_lahir')->nullable();
            $table->date('tgl_lahir')->nullable();
            $table->string('pekerjaan')->nullable();
            $table->string('pendidikan')->nullable();
            $table->string('telp')->nullable();
            $table->timestamps();

            $table->index(['pegawai_id', 'hubungan']);
        });

        // Nama tabel diselaraskan dengan dokumen_santri/dokumen_lembaga.
        Schema::create('dokumen_pegawai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pegawai_id')->constrained('pegawai')->cascadeOnDelete();
            $table->string('jenis_dokumen_pegawai')->nullable(); // ref_jenis_dokumen_pegawai
            $table->string('nama_file')->nullable(); // nama template berkas (tampil/unduh)
            $table->string('penyimpanan', 10)->default('server'); // lokasi byte: server|lokal|test
            $table->enum('status_verifikasi', ['menunggu', 'valid', 'ditolak'])->default('menunggu');
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index(['pegawai_id', 'jenis_dokumen_pegawai']);
        });

        Schema::create('keaktifan_pegawai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pegawai_id')->constrained('pegawai')->cascadeOnDelete();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9); // FK ke tahun_ajaran.nama
            $table->string('tugas_utama')->nullable(); // ref_tugas_utama (diisi eksplisit dari kamus)
            $table->string('no_sk', 100)->nullable(); // nomor SK tahunan (boleh sama lintas lembaga)
            $table->date('tgl_sk')->nullable();
            $table->enum('status_keaktifan', ['Ya', 'Tidak'])->default('Ya');
            $table->timestamps();

            $table->unique(['pegawai_id', 'jenjang', 'tahun_ajaran'], 'uq_keaktifan_pegawai_plt'); // nama pendek: auto-name 61 char, margin aman dari limit 64
            $table->index(['tahun_ajaran', 'jenjang'], 'idx_keaktifan_ta_jenjang_sk');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('presensi_pegawai', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('pegawai_id')->constrained('pegawai')->cascadeOnDelete();
            $table->date('tanggal');
            $table->time('jam_masuk')->nullable();
            $table->time('jam_keluar')->nullable();
            $table->enum('status', ['hadir', 'izin', 'sakit', 'alpa'])->default('hadir');
            $table->string('sumber')->default('mobile');
            $table->text('keterangan')->nullable();
            $table->string('foto_selfie')->nullable();
            $table->string('lokasi_gps')->nullable();
            $table->timestamps();

            $table->unique(['pegawai_id', 'tanggal']);
        });

        Schema::create('pengaturan_hari_lembaga', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->enum('hari', ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']);
            $table->boolean('is_hari_libur')->default(false);
            $table->timestamps();

            $table->unique(['jenjang', 'hari']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pengaturan_hari_lembaga');
        Schema::dropIfExists('presensi_pegawai');
        Schema::dropIfExists('keaktifan_pegawai');
        Schema::dropIfExists('dokumen_pegawai');
        Schema::dropIfExists('keluarga_pegawai');
        Schema::dropIfExists('pegawai_sertifikasi');
        Schema::dropIfExists('pegawai_pendidikan');
    }
};
