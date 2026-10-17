<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Template jadwal = kerangka jam murni (tanpa mapel/pengampu): tiap baris
 * adalah satu jam pelajaran generik (jam ke-n, nama, jam mulai–selesai,
 * penanda istirahat). Contoh: "8 JP + istirahat", "6 JP". Berlaku untuk semua
 * hari aktif lembaga. Diterapkan = membuat `slot_jam_pelajaran` nyata di
 * jenjang itu; pengisian mapel/guru tetap manual di matriks jadwal.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // FK `mata_pelajaran_id` TIDAK selalu ada di DB nyata: di MySQL
        // dev/produksi constraint-nya gagal terbentuk saat tabel dibuat
        // (namanya bentrok dengan index biasa yang sudah terpasang), sehingga
        // `dropForeign` buta akan meledak "Can't DROP ...; check that
        // column/key exists". Buang keduanya secara defensif: FK dulu (bila
        // ada), lalu sisa index bernama sama.
        $this->buangFkDanIndex('template_jadwal_baris', 'mata_pelajaran_id');

        $this->siapkanIndexPenggantiFk();

        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->dropUnique('uq_template_baris_hari_slot');
            $table->dropColumn(['hari', 'mata_pelajaran_id']);
            $table->string('nama_slot', 50)->nullable()->after('urutan_slot');
            $table->time('jam_mulai')->nullable()->after('nama_slot');
            $table->time('jam_selesai')->nullable()->after('jam_mulai');
            $table->boolean('is_istirahat')->default(false)->after('jam_selesai');

            $table->unique(['template_jadwal_id', 'urutan_slot'], 'uq_template_baris_urutan');
        });
    }

    /**
     * MySQL menolak melepas `uq_template_baris_hari_slot` selama index itu
     * masih menopang FK `template_jadwal_id` (1553: needed in a foreign key
     * constraint). Pasang index pengganti untuk kolom FK lebih dulu, baru
     * unique lama boleh dibuang. Index pengganti harus BERBEDA dari unique
     * yang akan dibuang (index itu sendiri menopang FK, jadi kehadirannya
     * bukan alasan melewati langkah ini). SQLite (tes) tak butuh ini.
     */
    private function siapkanIndexPenggantiFk(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $ada = DB::selectOne(
            'SELECT INDEX_NAME FROM information_schema.STATISTICS'
            .' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
            ['template_jadwal_baris', 'idx_template_baris_template'],
        ) !== null;
        if (! $ada) {
            Schema::table('template_jadwal_baris', fn (Blueprint $t) => $t->index('template_jadwal_id', 'idx_template_baris_template'));
        }
    }

    /**
     * Hapus FK + index peninggalan sebuah kolom bila ada (aman dijalankan di
     * MySQL maupun SQLite). Nama constraint mengikuti konvensi Laravel
     * (`<tabel>_<kolom>_foreign`).
     */
    private function buangFkDanIndex(string $tabel, string $kolom): void
    {
        $nama = $tabel.'_'.$kolom.'_foreign';

        if (DB::getDriverName() === 'mysql') {
            $fkAda = DB::selectOne(
                'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS'
                .' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?'
                .' AND CONSTRAINT_TYPE = ?',
                [$tabel, $nama, 'FOREIGN KEY'],
            ) !== null;
            if ($fkAda) {
                Schema::table($tabel, fn (Blueprint $t) => $t->dropForeign($nama));
            }

            // Sisa index biasa — di DB ini justru itu yang ada tanpa FK-nya.
            $indexAda = DB::selectOne(
                'SELECT INDEX_NAME FROM information_schema.STATISTICS'
                .' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
                [$tabel, $nama],
            ) !== null;
            if ($indexAda) {
                Schema::table($tabel, fn (Blueprint $t) => $t->dropIndex($nama));
            }

            return;
        }

        // SQLite (tes): FK benar-benar ada dan harus dilepas SEBELUM kolomnya
        // dibuang — kalau tidak, SQLite menolak dengan "error in table ... after
        // drop column: unknown column ... in foreign key definition". SQLite
        // hanya menerima bentuk berbasis kolom, bukan nama constraint.
        Schema::table($tabel, fn (Blueprint $t) => $t->dropForeign([$kolom]));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Index pengganti FK tak punya pasangan di skema lama — buang dulu agar
        // rollback tak meninggalkan index yatim.
        if (DB::getDriverName() === 'mysql') {
            $ada = DB::selectOne(
                'SELECT INDEX_NAME FROM information_schema.STATISTICS'
                .' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
                ['template_jadwal_baris', 'idx_template_baris_template'],
            ) !== null;
            if ($ada) {
                Schema::table('template_jadwal_baris', fn (Blueprint $t) => $t->dropIndex('idx_template_baris_template'));
            }
        }

        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->dropUnique('uq_template_baris_urutan');
            $table->dropColumn(['nama_slot', 'jam_mulai', 'jam_selesai', 'is_istirahat']);
            $table->enum('hari', ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'])->after('template_jadwal_id');
            $table->foreignId('mata_pelajaran_id')->constrained('mata_pelajaran')->cascadeOnDelete();
            $table->unique(['template_jadwal_id', 'hari', 'urutan_slot'], 'uq_template_baris_hari_slot');
        });
    }
};
