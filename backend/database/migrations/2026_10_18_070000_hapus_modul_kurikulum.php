<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hapus modul kurikulum — mapel kelas berdiri sendiri lewat `pengampu_mapel`.
 *
 * Latar: kurikulum (per jenjang) + komposisi + cakupan tingkat + peta
 * `kelas_kurikulum` cuma dipakai untuk MENENTUKAN mapel apa saja yang
 * ada di sebuah kelas. Padahal satuan penilaian (`nilai_santri`,
 * `jadwal_pelajaran`) sudah dibangun di atas `pengampu_mapel` (kelas × mapel →
 * guru), dan `kurikulum_mapel.kkm`/`.urutan` belum dibaca modul mana pun. Jadi
 * daftar mapel kelas sekarang = baris `pengampu_mapel` itu sendiri, dan
 * kurikulum beserta seluruh turunannya dihapus.
 *
 * Konsekuensi yang disepakati:
 *  - Tidak ada lagi "peta mapel per jenjang": tiap kelas punya daftarnya sendiri
 *    (diisi lewat halaman Pengampu: Tambah mapel & Salin dari kelas lain).
 *  - KKM + urutan tampil rapor pindah ke master `mata_pelajaran` (satu tempat
 *    per jenjang, bukan per kelas), jadi kolom itu tak hilang.
 *  - Data komposisi yang ada dibuang (pilihan pengguna): `pengampu_mapel` yang
 *    sudah ada tetap utuh.
 */
return new class extends Migration
{
    public function up(): void
    {

        Schema::table('mata_pelajaran', function (Blueprint $table) {
            $table->decimal('kkm', 5, 2)->nullable()->after('kode_mapel');
            $table->integer('urutan')->default(0)->after('kkm');
        });

        Schema::dropIfExists('kurikulum_mapel_tingkat');
        Schema::dropIfExists('kurikulum_mapel');
        Schema::dropIfExists('kelas_kurikulum');
        Schema::dropIfExists('kurikulum');
    }

    public function down(): void
    {
        Schema::create('kurikulum', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nama');
            $table->text('deskripsi')->nullable();
            $table->timestamps();

            $table->unique(['jenjang', 'nama']);
        });

        Schema::create('kurikulum_mapel', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kurikulum_id')->constrained('kurikulum')->cascadeOnDelete();
            $table->foreignId('mata_pelajaran_id')->constrained('mata_pelajaran')->cascadeOnDelete();
            $table->decimal('kkm', 5, 2)->nullable();
            $table->integer('urutan')->default(0);
            $table->timestamps();

            $table->unique(['kurikulum_id', 'mata_pelajaran_id'], 'uq_kurikulum_mapel_mapel');
        });

        Schema::create('kurikulum_mapel_tingkat', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kurikulum_mapel_id')->constrained('kurikulum_mapel')->cascadeOnDelete();
            $table->string('tingkat', 20);
            $table->timestamps();

            $table->unique(['kurikulum_mapel_id', 'tingkat']);
        });

        Schema::create('kelas_kurikulum', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kelas_id')->constrained('kelas')->cascadeOnDelete();
            $table->foreignId('kurikulum_id')->constrained('kurikulum')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['kelas_id', 'kurikulum_id']);
        });

        Schema::table('mata_pelajaran', function (Blueprint $table) {
            $table->dropColumn(['kkm', 'urutan']);
        });
    }
};
