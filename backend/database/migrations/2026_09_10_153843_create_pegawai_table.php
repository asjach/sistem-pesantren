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
                    $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete(); // akun login
                    $table->string('nip')->nullable();
                    $table->string('nik', 16)->nullable();
                    $table->string('nama_lengkap');
                    $table->string('gelar_depan')->nullable();
                    $table->string('gelar_belakang')->nullable();
                    $table->enum('jenis_kelamin', ['L', 'P']);
                    $table->string('tempat_lahir')->nullable();
                    $table->date('tanggal_lahir')->nullable();
                    $table->string('no_hp', 20)->nullable();
                    $table->string('email_pribadi')->nullable(); // data saja (BUKAN link akun; jembatan akun hanya user_id)
                    $table->string('email_gws')->nullable(); // Google Workspace (data saja)
                    $table->string('foto_url')->nullable();
                    $table->string('npwp')->nullable();
                    $table->string('no_kk', 16)->nullable();
                    $table->string('status_pernikahan')->nullable(); // ref_status_pernikahan
                    $table->string('agama')->nullable(); // ref_agama
                    $table->string('no_bpjs')->nullable();
                    $table->string('gol_darah')->nullable(); // ref_gol_darah
                    $table->string('status_tempat_tinggal')->nullable(); // ref_status_tinggal
                    $table->string('pendidikan_terakhir')->nullable(); // ref_pendidikan
                    $table->string('niat_npa')->nullable(); // nomor keanggotaan Persatuan Islam (bebas, tanpa unique)
                    $table->string('jenis_ptk')->nullable(); // ref_jenis_ptk
                    $table->string('jarak_ke_pesantren')->nullable(); // ref_jarak
                    $table->string('waktu_tempuh')->nullable(); // ref_waktu_tempuh
                    $table->string('transportasi')->nullable(); // ref_transportasi
                    $table->enum('sertifikasi', ['sudah', 'belum'])->default('belum'); // ringkas; auto-sync baris pegawai_sertifikasi
                    // Alamat pecah selaras santri:
                    $table->string('provinsi')->nullable();
                    $table->string('kab_kota')->nullable(); // ref_kota saran
                    $table->string('kecamatan')->nullable();
                    $table->string('desa_kelurahan')->nullable();
                    $table->string('rt', 3)->nullable();
                    $table->string('rw', 3)->nullable();
                    $table->string('kode_pos')->nullable();
                    $table->text('alamat')->nullable(); // jalan/detail
                    $table->date('tgl_mulai_kerja')->nullable();
                    $table->enum('status_aktif', ['aktif', 'cuti', 'keluar'])->default('aktif');
                    $table->timestamps();

                    // Unik global (single-pesantren; NIP/NIK ganda antar pesantren tidak relevan lagi)
                    $table->unique('nip');
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
