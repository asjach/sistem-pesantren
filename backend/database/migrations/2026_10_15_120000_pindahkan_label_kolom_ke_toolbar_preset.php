<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pindahkan LABEL kolom dari `preset_tabel` (per preset) ke `toolbar_preset`
 * (per tabel).
 *
 * Alasan: perataan (`align`) sudah per tabel, sedangkan label masih ikut
 * preset. Akibatnya pengguna harus mengisi ulang nama kolom tiap kali
 * berganti preset, padahal yang berubah hanyalah kolom mana yang TAMPIL -
 * bukan bagaimana kolom itu dinamai. Label yang mengikuti preset membuat
 * pekerjaan menamai terbuang saat preset berpindah.
 *
 * Data lama diangkat, bukan dibuang: label dari preset yang punya label
 * dipakai sebagai label tabel. Kolom `preset_tabel.label` SENGAJA tidak
 * dihapus di migrasi ini supaya bisa dibandingkan bila ada yang meleset;
 * penghapusannya pekerjaan terpisah setelah terbukti aman.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('toolbar_preset', 'label')) {
            Schema::table('toolbar_preset', function (Blueprint $table) {
                // Peta kolom -> label tampil. NULL = belum diatur (pakai
                // label bawaan dari kode), berbeda dari peta kosong.
                $table->json('label')->nullable()->after('align');
            });
        }

        // Angkat label per preset menjadi label per tabel. Bila beberapa preset
        // punya label, yang terisi paling banyak dianggap paling mewakili.
        $perTabel = [];
        foreach (DB::table('preset_tabel')->whereNotNull('label')->get(['table_key', 'label']) as $row) {
            $peta = json_decode((string) $row->label, true);
            if (! is_array($peta) || $peta === []) {
                continue;
            }
            $sekarang = $perTabel[$row->table_key] ?? [];
            if (count($peta) > count($sekarang)) {
                $perTabel[$row->table_key] = $peta;
            }
        }

        foreach ($perTabel as $tableKey => $peta) {
            // Hanya isi bila belum ada, jangan timpa setelan yang lebih baru.
            DB::table('toolbar_preset')
                ->where('table_key', $tableKey)
                ->whereNull('label')
                ->update(['label' => json_encode($peta)]);
        }
    }

    public function down(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->dropColumn('label');
        });
    }
};
