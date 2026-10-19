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
        Schema::create('lembaga', function (Blueprint $table) {

            $table->string('jenjang', 20)->primary();
            $table->string('nama');
            $table->string('nama_singkat')->nullable();
            $table->string('mudir_am')->nullable();
            $table->enum('status', ['negeri', 'swasta'])->default('swasta');
            $table->string('npsn', 20)->nullable()->unique();
            $table->string('nsm', 30)->nullable()->unique();
            $table->string('npwp')->nullable();

            $table->string('no_izin_operasional')->nullable();
            $table->date('tgl_izin')->nullable();
            $table->string('no_sk_pendirian')->nullable();
            $table->date('tgl_sk_pendirian')->nullable();
            $table->integer('tahun_berdiri')->nullable();
            $table->string('no_sk_kemenkumham')->nullable();
            $table->enum('akreditasi', ['A', 'B', 'C', 'belum'])->nullable();
            $table->date('tgl_akreditasi')->nullable();
            $table->string('penyelenggara')->nullable();

            $table->string('provinsi')->nullable();
            $table->string('kab_kota')->nullable();
            $table->string('kecamatan')->nullable();
            $table->string('desa')->nullable();
            $table->string('rt', 3)->nullable();
            $table->string('rw', 3)->nullable();
            $table->string('kode_pos', 10)->nullable();
            $table->text('alamat')->nullable();
            $table->decimal('lintang', 10, 7)->nullable();
            $table->decimal('bujur', 10, 7)->nullable();

            $table->string('telepon')->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('logo_url')->nullable();

            $table->enum('waktu_belajar', ['pagi', 'siang', 'pagi_siang'])->nullable();

            $table->enum('mode_rapor', ['terpisah', 'digabung'])->default('digabung');
            $table->string('template_rapor')->default('default');

            $table->boolean('is_seleksi')->default(false);
            $table->enum('kelompok_psb', ['combo_mi_md', 'eksklusif'])->default('eksklusif');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lembaga');
    }
};
