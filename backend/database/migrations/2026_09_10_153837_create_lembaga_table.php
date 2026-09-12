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
                    $table->id();
                    $table->foreignId('parent_id')->nullable()->constrained('lembaga')->nullOnDelete(); // null = root pesantren
                    $table->string('nama'); // PENYATUAN: bukan 'nama_lembaga'
                    $table->string('nama_singkat')->nullable(); // EMIS: nama singkatan
                    $table->string('kode', 20)->nullable(); // kode beku: PESANTREN (root), MI, MD, MTS, MUA (untuk no_pendaftaran + tampilan)
                    $table->string('mudir_am')->nullable(); // kepala lembaga (di root = pimpinan pesantren, di unit = kepala madrasah)
                    $table->string('jenjang')->nullable(); // free string (tidak di-enum)
                    $table->enum('status', ['negeri', 'swasta'])->default('swasta'); // EMIS: status madrasah
                    $table->string('npsn', 20)->nullable()->unique(); // EMIS/Kemendikbud, global unique
                    $table->string('nsm', 30)->nullable()->unique(); // EMIS/Kemenag 12 digit, global unique
                    $table->string('npwp')->nullable(); // EMIS/BOS
                    $table->unique('kode'); // kode lembaga unik global (single-pesantren)
                    // Legalitas full EMIS:
                    $table->string('no_izin_operasional')->nullable();
                    $table->date('tgl_izin')->nullable();
                    $table->string('no_sk_pendirian')->nullable();
                    $table->date('tgl_sk_pendirian')->nullable();
                    $table->integer('tahun_berdiri')->nullable();
                    $table->string('no_sk_kemenkumham')->nullable();
                    $table->enum('akreditasi', ['A', 'B', 'C', 'belum'])->nullable();
                    $table->date('tgl_akreditasi')->nullable();
                    $table->string('penyelenggara')->nullable(); // yayasan/perorangan
                    // Wilayah pecah (ekspor EMIS) + alamat jalan/detail:
                    $table->string('provinsi')->nullable();
                    $table->string('kab_kota')->nullable();
                    $table->string('kecamatan')->nullable();
                    $table->string('desa')->nullable();
                    $table->string('rt', 3)->nullable(); // string agar '01' utuh
                    $table->string('rw', 3)->nullable();
                    $table->string('kode_pos', 10)->nullable(); // ejaan kode_pos selaras santri
                    $table->text('alamat')->nullable(); // jalan/detail
                    $table->decimal('lintang', 10, 7)->nullable(); // koordinat EMIS lokasi
                    $table->decimal('bujur', 10, 7)->nullable();
                    // Kontak + branding per lembaga (null = fallback ke pesantren):
                    $table->string('telepon')->nullable();
                    $table->string('email')->nullable();
                    $table->string('website')->nullable();
                    $table->string('logo_url')->nullable();
                    // Operasional:
                    $table->enum('waktu_belajar', ['pagi', 'siang', 'pagi_siang'])->nullable(); // pagi_siang = "pagi dan siang"
                    // Kolom Modul 202 (mode rapor):
                    $table->enum('mode_rapor', ['terpisah', 'digabung'])->default('digabung');
                    $table->string('template_rapor')->default('default');
                    // Kolom Modul 100 PSB (konfigurasi jalur fleksibel):
                    $table->boolean('is_seleksi')->default(false); // default jalur lembaga: false = langsung (A), true = seleksi (B); override per-gelombang via psb_kuota_biaya.membutuhkan_seleksi (root PRD Lampiran E)
                    $table->enum('kelompok_psb', ['combo_mi_md', 'eksklusif'])->default('eksklusif'); // combo khusus MI/MD; selain itu eksklusif (pool & aturan ganda sendiri)
                    $table->boolean('is_active')->default(true); // nonaktifkan tanpa hapus
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
