<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Nama index dipertahankan agar jejak migrasi lama tetap sah. */
    private const INDEX = 'uq_tarif_tagihan';

    /** Nama FK jenjang (dipasang migrasi 2026_10_09_063353). */
    private const FK = 'tarif_tagihan_jenjang_foreign';

    /**
     * Keunikan tarif tanpa `tingkat`.
     *
     * Index lama memuat kolom `tingkat` yang nullable; MySQL & SQLite
     * menganggap NULL berbeda, sehingga (jenjang, tahun_ajaran, jenis_id) yang
     * sama bisa tersimpan berkali-kali selama `tingkat` NULL — persis bentuk
     * yang dikirim formulir (baris input & dialog Tambah Tarif). Generate
     * tagihan juga tak pernah membaca `tingkat` (nominal dikirim dialog, tidak
     * diambil dari tabel ini), jadi kolom itu bukan bagian identitas tarif.
     *
     * Baris ganda yang sudah ada TIDAK dihapus di sini: migrasi berhenti dan
     * menyebut barisnya supaya operator memutuskan nominal mana yang benar.
     */
    public function up(): void
    {
        $this->hentikanBilaGanda();

        $this->pasang(['jenjang', 'tahun_ajaran', 'jenis_id']);
    }

    /**
     * Balik ke bentuk lama (memuat `tingkat`) — sama seperti migrasi
     * 2026_10_06_114509 yang melepas kolom `paket`.
     */
    public function down(): void
    {
        $this->pasang(['jenjang', 'tahun_ajaran', 'jenis_id', 'tingkat']);
    }

    /** Ganti index unik tarif dengan daftar kolom baru (nama index tetap). */
    private function pasang(array $kolom): void
    {
        /* MySQL menolak melepas index yang masih menopang FK: `jenjang` adalah
           kolom kiri `uq_tarif_tagihan`, jadi FK jenjang ikut bergantung
           padanya. FK dilepas dulu, index baru (kolom kiri sama) dipasang,
           lalu FK dikembalikan — hasilnya tetap satu index + satu FK. */
        $mysql = DB::getDriverName() === 'mysql';
        if ($mysql && $this->adaFk()) {
            Schema::table('tarif_tagihan', function (Blueprint $table): void {
                $table->dropForeign(self::FK);
            });
        }

        if (Schema::hasIndex('tarif_tagihan', self::INDEX)) {
            Schema::table('tarif_tagihan', function (Blueprint $table): void {
                $table->dropUnique(self::INDEX);
            });
        }

        Schema::table('tarif_tagihan', function (Blueprint $table) use ($kolom): void {
            $table->unique($kolom, self::INDEX);
        });

        if ($mysql && ! $this->adaFk()) {
            Schema::table('tarif_tagihan', function (Blueprint $table): void {
                $table->foreign('jenjang', self::FK)
                    ->references('jenjang')->on('lembaga')
                    ->cascadeOnUpdate()->restrictOnDelete();
            });
        }
    }

    /** FK jenjang sudah terpasang? (sqlite: tidak pernah — migrasi FK khusus MySQL). */
    private function adaFk(): bool
    {
        return collect(Schema::getForeignKeys('tarif_tagihan'))
            ->contains(fn (array $fk): bool => ($fk['name'] ?? null) === self::FK);
    }

    /** Berhenti sebelum menyentuh skema bila tarif sudah punya pasangan ganda. */
    private function hentikanBilaGanda(): void
    {
        $ganda = DB::table('tarif_tagihan')
            ->select('jenjang', 'tahun_ajaran', 'jenis_id', DB::raw('COUNT(*) as jumlah'))
            ->groupBy('jenjang', 'tahun_ajaran', 'jenis_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        if ($ganda->isEmpty()) {
            return;
        }

        $daftar = $ganda->take(10)
            ->map(fn ($d) => "{$d->jenjang} {$d->tahun_ajaran} jenis #{$d->jenis_id} ({$d->jumlah} baris)")
            ->implode('; ');
        $sisa = $ganda->count() > 10 ? ' +'.($ganda->count() - 10).' grup lain' : '';

        throw new RuntimeException(
            "Migrasi dihentikan: ada {$ganda->count()} pasangan tarif ganda di luar `tingkat` — {$daftar}{$sisa}. "
            .'Rapikan baris duplikat lebih dulu (tentukan nominal mana yang benar), lalu jalankan `php artisan migrate` lagi. '
            .'Migrasi ini tidak menghapus data apa pun.'
        );
    }
};
