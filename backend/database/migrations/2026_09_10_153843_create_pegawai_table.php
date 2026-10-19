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
        Schema::create('pegawai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('nip')->nullable();

            $table->string('nipp', 30)->nullable();
            $table->string('nik', 16)->nullable();
            $table->string('nama_lengkap');
            $table->string('gelar_depan')->nullable();
            $table->string('gelar_belakang')->nullable();
            $table->enum('jenis_kelamin', ['L', 'P']);
            $table->string('tempat_lahir')->nullable();
            $table->date('tanggal_lahir')->nullable();
            $table->string('no_hp', 20)->nullable();
            $table->string('email_pribadi')->nullable();
            $table->string('email_gws')->nullable();
            $table->string('foto_url')->nullable();
            $table->string('npwp')->nullable();
            $table->string('no_kk', 16)->nullable();
            $table->string('status_pernikahan')->nullable();
            $table->string('agama')->nullable();
            $table->string('no_bpjs')->nullable();
            $table->string('gol_darah')->nullable();
            $table->string('status_tempat_tinggal')->nullable();
            $table->string('pendidikan_terakhir')->nullable();
            $table->string('niat_npa')->nullable();
            $table->string('jenis_ptk')->nullable();
            $table->string('jarak_ke_pesantren')->nullable();
            $table->string('waktu_tempuh')->nullable();
            $table->string('transportasi')->nullable();
            $table->enum('sertifikasi', ['sudah', 'belum'])->default('belum');

            $table->string('provinsi')->nullable();
            $table->string('kab_kota')->nullable();
            $table->string('kecamatan')->nullable();
            $table->string('desa_kelurahan')->nullable();
            $table->string('rt', 3)->nullable();
            $table->string('rw', 3)->nullable();
            $table->string('kode_pos')->nullable();
            $table->text('alamat')->nullable();
            $table->date('tgl_mulai_kerja')->nullable();
            $table->string('no_sk_awal', 100)->nullable();
            $table->date('tgl_sk_awal')->nullable();
            $table->enum('status_aktif', ['Ya', 'Tidak'])->default('Ya');
            $table->timestamps();

            $table->unique('nip');
            $table->unique('nipp');
            $table->unique('nik');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pegawai');
    }
};
