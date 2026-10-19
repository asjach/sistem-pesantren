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
        Schema::create('santri', function (Blueprint $table) {
            $table->id();

            $table->string('nama_lengkap');
            $table->string('nama_singkat')->nullable();
            $table->string('nik', 20)->nullable();
            $table->string('nisn', 10)->nullable();
            $table->string('tmp_lahir')->nullable();
            $table->date('tgl_lahir')->nullable();
            $table->enum('jk', ['L', 'P']);
            $table->integer('anak_ke')->nullable();
            $table->integer('j_saudara')->nullable();
            $table->enum('tipe_santri', ['asrama', 'non_asrama'])->default('non_asrama');
            $table->string('no_hp_santri')->nullable();
            $table->string('email_santri')->nullable();

            $table->string('agama')->nullable();
            $table->string('cita_cita')->nullable();
            $table->string('hobi')->nullable();
            $table->string('kebutuhan_khusus')->nullable();
            $table->string('kebutuhan_disabilitas')->nullable();
            $table->string('nomor_kip')->nullable();

            $table->string('ayah_nama')->nullable();
            $table->string('ayah_nik', 20)->nullable();
            $table->string('ayah_tmp_lahir')->nullable();
            $table->date('ayah_tgl_lahir')->nullable();
            $table->string('ayah_status')->nullable();
            $table->string('ayah_pekerjaan')->nullable();
            $table->string('ayah_pendidikan')->nullable();
            $table->string('ayah_penghasilan')->nullable();
            $table->string('ayah_telp')->nullable();
            $table->string('ayah_alamat')->nullable();
            $table->string('ayah_status_tempat_tinggal')->nullable();

            $table->string('ibu_nama')->nullable();
            $table->string('ibu_nik', 20)->nullable();
            $table->string('ibu_tmp_lahir')->nullable();
            $table->date('ibu_tgl_lahir')->nullable();
            $table->string('ibu_status')->nullable();
            $table->string('ibu_pekerjaan')->nullable();
            $table->string('ibu_pendidikan')->nullable();
            $table->string('ibu_penghasilan')->nullable();
            $table->string('ibu_telp')->nullable();
            $table->string('ibu_alamat')->nullable();
            $table->string('ibu_status_tempat_tinggal')->nullable();

            $table->string('wali_nama')->nullable();
            $table->string('wali_nik', 20)->nullable();
            $table->string('wali_tmp_lahir')->nullable();
            $table->date('wali_tgl_lahir')->nullable();
            $table->string('wali_status')->nullable();
            $table->string('wali_pekerjaan')->nullable();
            $table->string('wali_pendidikan')->nullable();
            $table->string('wali_penghasilan')->nullable();
            $table->string('wali_telp')->nullable();
            $table->string('wali_alamat')->nullable();
            $table->string('wali_status_tempat_tinggal')->nullable();
            $table->string('yang_membiayai')->nullable();

            $table->string('no_kk', 20)->nullable();
            $table->string('kepala_keluarga')->nullable();
            $table->string('kewarganegaraan')->default('WNI');
            $table->string('bahasa_sehari')->nullable();
            $table->string('status_tempat_tinggal')->nullable();
            $table->string('jarak_ke_pesantren')->nullable();
            $table->string('waktu_tempuh')->nullable();
            $table->string('transportasi')->nullable();
            $table->date('tanggal_masuk')->nullable();

            $table->string('provinsi')->nullable();
            $table->string('kab_kota')->nullable();
            $table->string('kecamatan')->nullable();
            $table->string('desa_kelurahan')->nullable();
            $table->string('rt', 3)->nullable();
            $table->string('rw', 3)->nullable();
            $table->text('alamat')->nullable();
            $table->string('kode_pos')->nullable();

            $table->string('foto_url')->nullable();

            $table->enum('is_active_pst', ['Ya', 'Tidak'])->default('Tidak');

            $table->timestamps();

            $table->index(['nik']);
            $table->index(['nisn']);
        });

        Schema::create('riwayat_belajar', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('kelas_id')->nullable()->constrained('kelas')->nullOnDelete();
            $table->string('semester', 2)->default('1');
            $table->date('tgl_masuk')->nullable();
            $table->integer('no_absen')->nullable();
            $table->string('tingkat')->nullable();

            $table->string('status_awal')->default('santri_baru');

            $table->string('status_akhir')->default('aktif');

            $table->enum('is_active_riwayat', ['Ya', 'Tidak'])->default('Ya');
            $table->timestamps();

            $table->unique(['santri_id', 'tahun_ajaran', 'jenjang', 'semester'], 'uq_riwayat_belajar_stls');

            $table->index(['kelas_id', 'tahun_ajaran', 'semester', 'no_absen']);
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('mutasi_keluar', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('kelas_terakhir_id')->nullable()->constrained('kelas')->nullOnDelete();
            $table->date('tanggal_mutasi')->nullable();
            $table->string('alasan_mutasi')->nullable();
            $table->string('no_surat')->nullable();
            $table->string('nama_sekolah_tujuan')->nullable();
            $table->string('npsn_sekolah_tujuan', 20)->nullable();
            $table->string('nsm_sekolah_tujuan', 30)->nullable();
            $table->text('alamat_sekolah_tujuan')->nullable();
            $table->text('keterangan')->nullable();
            $table->timestamps();
        });

        Schema::create('alumni', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->string('lembaga_lulus', 20);
            $table->foreign('lembaga_lulus')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran_lulus', 9);
            $table->foreignId('kelas_lulus_id')->nullable()->constrained('kelas')->nullOnDelete();
            $table->string('nomor_ijazah')->nullable();
            $table->string('no_surat_ijazah')->nullable();
            $table->string('no_peserta')->nullable();
            $table->string('skhun')->nullable();
            $table->date('tanggal_lulus')->nullable();
            $table->string('kegiatan_setelah_lulus')->nullable();
            $table->enum('penyerahan_ijazah', ['sudah', 'belum'])->default('belum');
            $table->enum('melanjutkan', ['ya', 'tidak'])->nullable();
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->unique(['santri_id', 'lembaga_lulus']);
            $table->foreign('tahun_ajaran_lulus')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alumni');
        Schema::dropIfExists('mutasi_keluar');
        Schema::dropIfExists('riwayat_belajar');
        Schema::dropIfExists('santri');
    }
};
