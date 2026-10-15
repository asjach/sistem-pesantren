<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lingkup lembaga paket dispensasi.
 *
 * `jenjang` null = berlaku semua lembaga (perilaku lama, semua baris lama
 * otomatis null), terisi = paket khusus lembaga itu. Mengikuti pola
 * `jenis_tagihan.jenjang`: FK → `lembaga.jenjang`, `restrict` saat lembaga
 * dihapus (menghapus lembaga tak boleh diam-diam meluaskan paket ke semua
 * lembaga — lingkup uang harus eksplisit).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispensasi', function (Blueprint $table) {
            $table->string('jenjang', 20)->nullable()->after('tahun_ajaran');
            $table->index('jenjang');
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('dispensasi', function (Blueprint $table) {
            $table->dropForeign(['jenjang']);
            $table->dropIndex(['jenjang']);
            $table->dropColumn('jenjang');
        });
    }
};
