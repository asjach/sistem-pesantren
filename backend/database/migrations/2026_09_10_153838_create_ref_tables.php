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
        Schema::create('ref_agama', function (Blueprint $table) {
            $table->id();
            // null = baris global (seed bawaan); terisi = baris khusus lembaga (tambah/shadow, tanpa ganggu lembaga lain)
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('nama');
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'nama']); // PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index
        });

        Schema::create('ref_cita_cita', function (Blueprint $table) {
            $table->id();
            // null = baris global (seed bawaan); terisi = baris khusus lembaga (tambah/shadow, tanpa ganggu lembaga lain)
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('nama');
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'nama']); // PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index
        });

        Schema::create('ref_hobi', function (Blueprint $table) {
            $table->id();
            // null = baris global (seed bawaan); terisi = baris khusus lembaga (tambah/shadow, tanpa ganggu lembaga lain)
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('nama');
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'nama']); // PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index
        });

        Schema::create('ref_pekerjaan', function (Blueprint $table) {
            $table->id();
            // null = baris global (seed bawaan); terisi = baris khusus lembaga (tambah/shadow, tanpa ganggu lembaga lain)
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('nama');
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'nama']); // PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index
        });

        Schema::create('ref_pendidikan', function (Blueprint $table) {
            $table->id();
            // null = baris global (seed bawaan); terisi = baris khusus lembaga (tambah/shadow, tanpa ganggu lembaga lain)
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('nama');
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'nama']); // PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index
        });

        Schema::create('ref_kebutuhan_khusus', function (Blueprint $table) {
            $table->id();
            // null = baris global (seed bawaan); terisi = baris khusus lembaga (tambah/shadow, tanpa ganggu lembaga lain)
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('nama');
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'nama']); // PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index
        });

        Schema::create('ref_kota', function (Blueprint $table) {
            $table->id();
            // null = baris global (seed bawaan); terisi = baris khusus lembaga (tambah/shadow, tanpa ganggu lembaga lain)
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('nama');
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'nama']); // PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index
        });

        Schema::create('ref_alamat', function (Blueprint $table) {
            $table->id();
            // null = global (contoh bawaan); terisi = milik lembaga itu
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('nama'); // mis. 'Sekebolek'
            $table->string('provinsi')->nullable();
            $table->string('kab_kota')->nullable();
            $table->string('kecamatan')->nullable();
            $table->string('desa_kelurahan')->nullable();
            $table->text('alamat')->nullable();
            $table->string('rt', 3)->nullable();
            $table->string('rw', 3)->nullable();
            $table->string('kode_pos', 10)->nullable();
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'nama']); // scope LEMBAGA, pola KEY sama dengan ref lain
        });

        Schema::create('ref_status_awal', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('kode'); // santri_baru, naik_kelas, mengulang, pindahan (+ custom)
            $table->string('nama'); // seragam dengan tabel ref lain (pengurutan: urutan ASC, nama ASC)
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'kode']);
        });

        Schema::create('ref_status_akhir', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('kode'); // aktif, naik, tidak_naik, pindah_keluar, lulus, tidak_lulus (+ custom, no.51)
            $table->string('nama'); // seragam dengan tabel ref lain (nilai konsumen tetap `kode`)
            // Sifat logika (terkunci untuk baris sistem):
            $table->boolean('is_aktif_bawaan')->default(false); // true HANYA untuk 'aktif' (is_aktif=true iff status_akhir aktif)
            $table->string('terminal_ke')->nullable(); // null = bukan terminal (custom baru selalu null = non-aktif netral)
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'kode']);
        });

        foreach (['ref_penghasilan', 'ref_transportasi', 'ref_status_tinggal', 'ref_jarak', 'ref_waktu_tempuh', 'ref_bahasa_sehari_hari', 'ref_disabilitas', 'ref_tmp_lahir', 'ref_status_ortu', 'ref_yang_membiayai', 'ref_provinsi', 'ref_kecamatan', 'ref_desa_kelurahan', 'ref_alasan_mutasi', 'ref_jenis_dokumen_santri', 'ref_jenis_dokumen_pegawai', 'ref_status_pernikahan', 'ref_gol_darah', 'ref_jenis_ptk', 'ref_jenjang_sertifikasi', 'ref_tingkat', 'ref_tugas_utama', 'ref_tipe_pelanggaran', 'ref_jalur_sertifikasi'] as $refTabel) {
            Schema::create($refTabel, function (Blueprint $table) {
                $table->id();
                $table->string('jenjang', 20)->nullable();
                $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
                $table->string('nama');
                $table->integer('urutan')->default(0);
                $table->boolean('is_active')->default(true);

                $table->unique(['jenjang', 'nama']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ref_jalur_sertifikasi');
        Schema::dropIfExists('ref_tipe_pelanggaran');
        Schema::dropIfExists('ref_tugas_utama');
        Schema::dropIfExists('ref_tingkat');
        Schema::dropIfExists('ref_jenjang_sertifikasi');
        Schema::dropIfExists('ref_jenis_ptk');
        Schema::dropIfExists('ref_gol_darah');
        Schema::dropIfExists('ref_status_pernikahan');
        Schema::dropIfExists('ref_jenis_dokumen_pegawai');
        Schema::dropIfExists('ref_jenis_dokumen_santri');
        Schema::dropIfExists('ref_alasan_mutasi');
        Schema::dropIfExists('ref_desa_kelurahan');
        Schema::dropIfExists('ref_kecamatan');
        Schema::dropIfExists('ref_provinsi');
        Schema::dropIfExists('ref_yang_membiayai');
        Schema::dropIfExists('ref_status_ortu');
        Schema::dropIfExists('ref_tmp_lahir');
        Schema::dropIfExists('ref_disabilitas');
        Schema::dropIfExists('ref_bahasa_sehari_hari');
        Schema::dropIfExists('ref_waktu_tempuh');
        Schema::dropIfExists('ref_jarak');
        Schema::dropIfExists('ref_status_tinggal');
        Schema::dropIfExists('ref_transportasi');
        Schema::dropIfExists('ref_penghasilan');
        Schema::dropIfExists('ref_status_akhir');
        Schema::dropIfExists('ref_status_awal');
        Schema::dropIfExists('ref_alamat');
        Schema::dropIfExists('ref_kota');
        Schema::dropIfExists('ref_kebutuhan_khusus');
        Schema::dropIfExists('ref_pendidikan');
        Schema::dropIfExists('ref_pekerjaan');
        Schema::dropIfExists('ref_hobi');
        Schema::dropIfExists('ref_cita_cita');
        Schema::dropIfExists('ref_agama');
    }
};
