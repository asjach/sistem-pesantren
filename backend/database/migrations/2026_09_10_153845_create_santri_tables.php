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

                    // Relasi Lembaga & Kelas Saat Ini (Kondisi Aktif Terakhir)
                    $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
                    $table->foreignId('kelas_id')->nullable()->constrained('kelas')->nullOnDelete();

                    // Identitas Personal
                    $table->string('nama_lengkap');
                    $table->string('nama_singkat')->nullable();
                    $table->string('nik', 16)->nullable();
                    $table->string('nisn', 10)->nullable();
                    $table->string('nis')->nullable(); // NIS aktif terakhir (kuitansi/rapor/leger/portal)
                    $table->string('tmp_lahir')->nullable(); // kamus ref_tmp_lahir
                    $table->date('tgl_lahir')->nullable();
                    $table->enum('jk', ['L', 'P']);
                    $table->integer('anak_ke')->nullable();
                    $table->integer('j_saudara')->nullable();
                    $table->enum('tipe_santri', ['asrama', 'non_asrama'])->default('non_asrama');
                    $table->string('no_hp_santri')->nullable();
                    $table->string('email_santri')->nullable();

                    // Relasi Tabel Kamus (string bebas nullable, TANPA FK — hanya saran combobox)
                    $table->string('agama')->nullable(); // ref_agama
                    $table->string('cita_cita')->nullable(); // ref_cita_cita
                    $table->string('hobi')->nullable(); // ref_hobi
                    $table->string('kebutuhan_khusus')->nullable(); // ref_kebutuhan_khusus
                    $table->string('kebutuhan_disabilitas')->nullable(); // ref_disabilitas
                    $table->string('nomor_kip')->nullable();

                    // Orang Tua & Wali (alamat pisah per pihak; kamus via ref_*)
                    $table->string('ayah_nama')->nullable();
                    $table->string('ayah_nik', 16)->nullable();
                    $table->string('ayah_tmp_lahir')->nullable(); // ref_tmp_lahir
                    $table->date('ayah_tgl_lahir')->nullable();
                    $table->string('ayah_status')->nullable(); // ref_status_ortu
                    $table->string('ayah_pekerjaan')->nullable(); // ref_pekerjaan
                    $table->string('ayah_pendidikan')->nullable(); // ref_pendidikan
                    $table->string('ayah_penghasilan')->nullable(); // ref_penghasilan
                    $table->string('ayah_telp')->nullable();
                    $table->string('ayah_alamat')->nullable();
                    $table->string('ayah_status_tempat_tinggal')->nullable(); // ref_status_tinggal

                    $table->string('ibu_nama')->nullable();
                    $table->string('ibu_nik', 16)->nullable();
                    $table->string('ibu_tmp_lahir')->nullable(); // ref_tmp_lahir
                    $table->date('ibu_tgl_lahir')->nullable();
                    $table->string('ibu_status')->nullable(); // ref_status_ortu
                    $table->string('ibu_pekerjaan')->nullable(); // ref_pekerjaan
                    $table->string('ibu_pendidikan')->nullable(); // ref_pendidikan
                    $table->string('ibu_penghasilan')->nullable(); // ref_penghasilan
                    $table->string('ibu_telp')->nullable();
                    $table->string('ibu_alamat')->nullable();
                    $table->string('ibu_status_tempat_tinggal')->nullable(); // ref_status_tinggal

                    $table->string('wali_nama')->nullable();
                    $table->string('wali_nik', 16)->nullable();
                    $table->string('wali_tmp_lahir')->nullable(); // ref_tmp_lahir
                    $table->date('wali_tgl_lahir')->nullable();
                    $table->string('wali_status')->nullable(); // ref_status_ortu
                    $table->string('wali_pekerjaan')->nullable(); // ref_pekerjaan
                    $table->string('wali_pendidikan')->nullable(); // ref_pendidikan
                    $table->string('wali_penghasilan')->nullable(); // ref_penghasilan
                    $table->string('wali_telp')->nullable();
                    $table->string('wali_alamat')->nullable();
                    $table->string('wali_status_tempat_tinggal')->nullable(); // ref_status_tinggal
                    $table->string('yang_membiayai')->nullable(); // ref_yang_membiayai

                    // EMIS santri tambahan:
                    $table->string('no_kk', 16)->nullable();
                    $table->string('kewarganegaraan')->default('WNI');
                    $table->string('bahasa_sehari')->nullable(); // ref_bahasa_sehari_hari
                    $table->string('status_tempat_tinggal')->nullable(); // ref_status_tinggal
                    $table->string('jarak_ke_pesantren')->nullable(); // ref_jarak
                    $table->string('waktu_tempuh')->nullable(); // ref_waktu_tempuh
                    $table->string('transportasi')->nullable(); // ref_transportasi
                    $table->date('tanggal_masuk')->nullable(); // arsip awal masuk (selain riwayat)

                    // Alamat keluarga (wilayah kamus via ref_provinsi/kota/kecamatan/desa)
                    $table->string('provinsi')->nullable(); // ref_provinsi
                    $table->string('kab_kota')->nullable(); // ref_kota
                    $table->string('kecamatan')->nullable(); // ref_kecamatan
                    $table->string('desa_kelurahan')->nullable(); // ref_desa_kelurahan
                    $table->string('rt', 3)->nullable();
                    $table->string('rw', 3)->nullable();
                    $table->text('alamat')->nullable();
                    $table->string('kode_pos')->nullable();

                    // Flag pesantren: true = masih aktif di pesantren ini, false = tidak aktif.
                    // Lulus/mutasi TIDAK disimpan di sini — dibaca dari tabel alumni / mutasi_keluar.
                    $table->string('foto_url')->nullable();
                    $table->boolean('status_global')->default(true);

                    $table->timestamps();

                    // NIK/NISN boleh fiktif/ganda — BUKAN unique; hanya index biasa, dedup identitas (nik+nama+tgl_lahir) di service.
                    $table->index(['nik']);
                    $table->index(['nisn']);
                });

                Schema::create('riwayat_belajar', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
                    $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->cascadeOnDelete();
                    $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
                    $table->foreignId('kelas_id')->nullable()->constrained('kelas')->nullOnDelete(); // null = belum ditempatkan (naik dulu, penempatan menyusul)
                    $table->string('semester', 2)->default('1'); // '1' ganjil, '2' genap (selaras nilai_santri)
                    $table->date('tgl_masuk')->nullable(); // mulai per semester (ganjil=awal tahun, genap=awal semester 2)
                    $table->integer('no_absen')->nullable(); // no urut rombel per semester; unique per kelas dicek di service
                    $table->string('nis')->nullable(); // arsip per tahun/lembaga; santri.nis = mirror terakhir lembaga primer
                    $table->string('tingkat')->nullable(); // ref_tingkat: target jenjang tahun ini ('7','8','9'); grouping saat kelas_id null
                    // Sumber masuk (string bebas, validasi ke ref_status_awal efektif per lembaga).
                    // TERKUNCI: sama antara ganjil-genap dalam 1 tahun (genap copy ganjil).
                    $table->string('status_awal')->default('santri_baru');
                    // Hasil semester ini (string bebas, validasi ke ref_status_akhir efektif).
                    $table->string('status_akhir')->default('aktif');
                    // Sedang berjalan. INVARIANT: true iff status_akhir='aktif'. Ditulis hanya via SiklusSantriService.
                    // Ganjil→genap: ganjil ditutup (is_aktif=false, arsip), genap aktif — 1 aktif per santri-lembaga terjaga.
                    // Berhenti satu jenjang (paket MD berhenti, MI lanjut): baris MD (is_aktif=false, status_akhir dipertahankan).
                    // santri.status_global=false hanya jika SELURUH riwayat non-aktif (dihitung ulang di 102).
                    $table->boolean('is_aktif')->default(true);
                    $table->timestamps();

                    $table->unique(['santri_id', 'tahun_ajaran_id', 'lembaga_id', 'semester'], 'uq_riwayat_belajar_stls'); // nama pendek: auto-name 68 char > limit MySQL 64
                    // Performa cek bentrok no_absen (bukan unique: kelas_id/no_absen nullable, multi-NULL diizinkan MySQL).
                    $table->index(['kelas_id', 'tahun_ajaran_id', 'semester', 'no_absen']);
                });

                Schema::create('mutasi_keluar', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
                    $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
                    $table->foreignId('kelas_terakhir_id')->nullable()->constrained('kelas')->nullOnDelete();
                    $table->date('tanggal_mutasi');
                    $table->string('alasan_mutasi')->nullable(); // kamus ref_alasan_mutasi (string bebas, tanpa FK)
                    $table->string('no_surat')->nullable(); // nomor surat keterangan pindah/keluar (arsip EMIS)
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
                    $table->foreignId('lembaga_lulus_id')->constrained('lembaga')->cascadeOnDelete();
                    $table->foreignId('tahun_ajaran_lulus_id')->constrained('tahun_ajaran')->cascadeOnDelete();
                    $table->string('nomor_ijazah')->nullable();
                    $table->string('no_surat_ijazah')->nullable(); // nomor surat pengantar/SKHU
                    $table->date('tanggal_lulus');
                    $table->string('kegiatan_setelah_lulus')->nullable();
                    $table->enum('penyerahan_ijazah', ['sudah', 'belum'])->default('belum');
                    $table->enum('melanjutkan', ['ya', 'tidak'])->nullable();
                    $table->text('catatan')->nullable();
                    $table->timestamps();

                    $table->unique(['santri_id']); // 1 santri = max 1 record alumni
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
