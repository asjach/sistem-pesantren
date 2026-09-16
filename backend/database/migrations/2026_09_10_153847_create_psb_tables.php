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
        Schema::create('psb_kegiatan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->cascadeOnDelete();
            $table->string('nama');
            $table->boolean('is_aktif')->default(true);
            $table->timestamps();

            // Se-pesantren: satu kegiatan per tahun ajaran.
            $table->unique('tahun_ajaran_id');
        });

        Schema::create('psb_gelombang', function (Blueprint $table) {
            $table->id();
            $table->foreignId('psb_kegiatan_id')->nullable()->constrained('psb_kegiatan')->nullOnDelete();
            $table->unsignedInteger('nomor')->nullable(); // urutan gelombang dalam kegiatan
            $table->string('nama'); // misal: 'Gelombang 1 2026/2027'
            // Gerbang pendaftaran murni dari rentang tanggal (tanpa flag status).
            $table->date('tgl_buka')->nullable();
            $table->date('tgl_tutup')->nullable();
            $table->timestamps();
        });

        Schema::create('psb_kuota_biaya', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gelombang_id')->constrained('psb_gelombang')->cascadeOnDelete();
            $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
            $table->enum('tipe_santri', ['semua', 'asrama', 'non_asrama'])->default('semua');
            $table->boolean('paket_tersedia')->default(false); // paket MI-MD ditawarkan (di baris primer MI)
            $table->integer('kuota')->nullable();
            $table->boolean('membutuhkan_seleksi')->nullable(); // null = ikut lembaga.is_seleksi
            $table->boolean('membutuhkan_pemberkasan')->default(true);
            $table->timestamps();

            $table->unique(['gelombang_id', 'lembaga_id', 'tipe_santri']);
        });

        Schema::create('psb_calon_santri', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete(); // lembaga tujuan
            $table->foreignId('gelombang_id')->nullable()->constrained('psb_gelombang')->nullOnDelete();
            $table->foreignId('tahun_ajaran_id')->nullable()->constrained('tahun_ajaran')->nullOnDelete();
            $table->foreignId('kelas_id')->nullable()->constrained('kelas')->nullOnDelete();
            // Pendaftaran lanjutan (anak sudah santri): FK ke santri asal. Hasil konversi: santri_id.
            $table->foreignId('santri_asal_id')->nullable()->constrained('santri')->nullOnDelete();
            $table->foreignId('santri_id')->nullable()->constrained('santri')->nullOnDelete();
            $table->string('no_pendaftaran'); // satuan: PSB_{tahun}_{kodeLembaga}_{noGelombang}_{seq4}; paket MI-MD: PSB_{tahun}_MIMD_{noGelombang}_{seq4} (1 nomor untuk 1 calon)
            // Tahap 1 (inti, wajib): nik + nama. NIK boleh fiktif (tanpa flag); dedup identitas di service.
            $table->string('nik', 16);
            $table->string('nama_lengkap');
            $table->string('nama_singkat')->nullable();
            $table->enum('jk', ['L', 'P'])->nullable();
            $table->date('tgl_lahir')->nullable();
            $table->string('tmp_lahir')->nullable();
            $table->enum('tipe_santri', ['asrama', 'non_asrama'])->default('non_asrama');
            $table->string('nisn', 10)->nullable();
            $table->integer('anak_ke')->nullable();
            $table->integer('j_saudara')->nullable();
            $table->string('agama')->nullable(); // kamus: string bebas, tanpa FK
            $table->string('cita_cita')->nullable();
            $table->string('hobi')->nullable();
            $table->string('kebutuhan_khusus')->nullable();
            $table->string('kebutuhan_disabilitas')->nullable();
            $table->string('nomor_kip')->nullable();
            $table->string('no_hp_santri')->nullable();
            $table->string('email_santri')->nullable();
            $table->string('no_kk', 16)->nullable();
            $table->string('kewarganegaraan')->default('WNI');
            $table->string('bahasa_sehari')->nullable();
            $table->string('status_tempat_tinggal')->nullable();
            $table->string('jarak_ke_pesantren')->nullable();
            $table->string('waktu_tempuh')->nullable();
            $table->string('transportasi')->nullable();
            $table->date('tanggal_masuk')->nullable();
            $table->text('alamat')->nullable();
            $table->string('provinsi')->nullable();
            $table->string('kab_kota')->nullable();
            $table->string('kecamatan')->nullable();
            $table->string('desa_kelurahan')->nullable();
            $table->string('rt', 3)->nullable();
            $table->string('rw', 3)->nullable();
            $table->string('kode_pos')->nullable();
            $table->string('ayah_nama')->nullable();
            $table->string('ayah_nik', 16)->nullable();
            $table->string('ayah_tmp_lahir')->nullable();
            $table->date('ayah_tgl_lahir')->nullable();
            $table->string('ayah_status')->nullable();
            $table->string('ayah_pendidikan')->nullable();
            $table->string('ayah_pekerjaan')->nullable();
            $table->string('ayah_penghasilan')->nullable();
            $table->string('ayah_telp')->nullable();
            $table->string('ayah_alamat')->nullable();
            $table->string('ayah_status_tempat_tinggal')->nullable();
            $table->string('ibu_nama')->nullable();
            $table->string('ibu_nik', 16)->nullable();
            $table->string('ibu_tmp_lahir')->nullable();
            $table->date('ibu_tgl_lahir')->nullable();
            $table->string('ibu_status')->nullable();
            $table->string('ibu_pendidikan')->nullable();
            $table->string('ibu_pekerjaan')->nullable();
            $table->string('ibu_penghasilan')->nullable();
            $table->string('ibu_telp')->nullable();
            $table->string('ibu_alamat')->nullable();
            $table->string('ibu_status_tempat_tinggal')->nullable();
            $table->string('wali_nama')->nullable();
            $table->string('wali_nik', 16)->nullable();
            $table->string('wali_tmp_lahir')->nullable();
            $table->date('wali_tgl_lahir')->nullable();
            $table->string('wali_status')->nullable();
            $table->string('wali_pendidikan')->nullable();
            $table->string('wali_pekerjaan')->nullable();
            $table->string('wali_penghasilan')->nullable();
            $table->string('wali_telp')->nullable();
            $table->string('wali_alamat')->nullable();
            $table->string('wali_status_tempat_tinggal')->nullable();
            $table->string('yang_membiayai')->nullable();
            $table->string('email_ortu')->nullable();
            $table->string('telp_ortu')->nullable();
            $table->string('foto_url')->nullable();
            $table->string('status_pendaftaran')->default('baru'); // baru,terverifikasi,lolos,tidak_lolos,pemberkasan,ajukan_daftar_ulang,daftar_ulang,ditolak,waiting_list (tanpa status seleksi)
            $table->boolean('is_duplikat_kontak')->default(false);
            $table->boolean('is_lanjutan')->default(false); // true jika santri_asal_id terisi
            // Jenis PSB: false = santri baru, true = pindahan (root PRD: status_awal ACC).
            // Tingkat masuk disimpan per lembaga di psb_calon_lembaga.masuk_tingkat.
            $table->boolean('is_pindahan')->default(false);
            $table->date('tanggal_daftar')->nullable();
            $table->text('catatan')->nullable(); // catatan admin (manual)
            $table->text('catatan_sistem')->nullable(); // auto: duplikat email/telp/nik
            $table->text('catatan_admin')->nullable();
            $table->softDeletes();
            $table->unsignedBigInteger('deleted_by')->nullable(); // admin yang menghapus
            $table->timestamps();

            $table->unique('no_pendaftaran'); // 1 calon = 1 nomor (paket MI-MD kini 1 baris calon)
            // TANPA unique NIK: NIK boleh fiktif/ganda antar anak berbeda; dedup identitas (nik+nama+tgl_lahir) di service.
            $table->index(['gelombang_id', 'nik']);
            $table->index(['lembaga_id', 'status_pendaftaran', 'updated_at']);
        });

        // Detail lembaga tujuan per calon (1 baris = 1 lembaga):
        // satuan = 1 baris primer; paket MI-MD = 2 baris (MI primer + MD anggota).
        // Kuota & scoping tenant dihitung dari tabel ini.
        Schema::create('psb_calon_lembaga', function (Blueprint $table) {
            $table->id();
            $table->foreignId('psb_calon_santri_id')->constrained('psb_calon_santri')->cascadeOnDelete();
            $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
            $table->string('peran', 10)->default('primer'); // primer | anggota
            $table->string('masuk_tingkat', 2)->nullable(); // tingkat per lembaga (paket MI-MD = 1 & 1)
            $table->timestamps();

            $table->unique(['psb_calon_santri_id', 'lembaga_id']);
            $table->index('lembaga_id');
        });

        Schema::create('dokumen_santri', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->nullable()->constrained('santri')->cascadeOnDelete();
            $table->foreignId('psb_calon_santri_id')->nullable()->constrained('psb_calon_santri')->cascadeOnDelete();
            $table->string('jenis_dokumen_santri')->nullable(); // ref_jenis_dokumen_santri
            $table->string('path_file')->nullable(); // null = baris checklist (belum diunggah)
            $table->enum('status_verifikasi', ['menunggu', 'valid', 'ditolak'])->default('menunggu');
            $table->boolean('tidak_memiliki')->default(false); // tanda "tidak memiliki dokumen ini"
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index(['santri_id', 'jenis_dokumen_santri']);
            $table->index(['psb_calon_santri_id', 'jenis_dokumen_santri']);
        });

        Schema::create('dokumen_wajib_lembaga', function (Blueprint $table) {
            $table->id();
            // Ketentuan dokumen PSB per kegiatan + lembaga.
            $table->foreignId('psb_kegiatan_id')->nullable()->constrained('psb_kegiatan')->cascadeOnDelete();
            $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
            $table->string('jenis_dokumen_santri'); // ref_jenis_dokumen_santri
            $table->boolean('is_wajib')->default(true);
            $table->timestamps();

            $table->index('lembaga_id');
            $table->unique(['psb_kegiatan_id', 'lembaga_id', 'jenis_dokumen_santri'], 'dokumen_wajib_scope_unique');
        });

        Schema::create('psb_log_status', function (Blueprint $table) {
            $table->id();
            $table->foreignId('psb_calon_santri_id')->constrained('psb_calon_santri')->cascadeOnDelete();
            $table->string('dari')->nullable();
            $table->string('ke');
            $table->foreignId('oleh_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('catatan')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('psb_log_status');
        Schema::dropIfExists('dokumen_wajib_lembaga');
        Schema::dropIfExists('dokumen_santri');
        Schema::dropIfExists('psb_calon_lembaga');
        Schema::dropIfExists('psb_calon_santri');
        Schema::dropIfExists('psb_kuota_biaya');
        Schema::dropIfExists('psb_gelombang');
        Schema::dropIfExists('psb_kegiatan');
    }
};
