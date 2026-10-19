<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Status dipindah dari SUB-MODUL ke POIN.
 *
 * Semula tiap sub-modul punya kolom `status` sendiri, dan yang bergerak
 * di papan adalah sub-modulnya. Setelah ditinjau, yang sebenarnya bergerak
 * adalah POIN (butir) di dalamnya: sub-modul yang punya 5 poin bisa separuh
 * selesai, dan status tunggal tidak bisa mewakilinya.
 *
 * Migrasi ini:
 * 1. membuang kolom `status` dari `papan_item` (beserta indeksnya);
 * 2. menambah `butir_id` di `papan_riwayat` supaya jejak perpindahan
 *    menunjuk poin mana yang berpindah.
 *
 * Data status item yang ada TIDAK dibuang diam-diam: statusnya disalin ke
 * poin-poin yang belum punya status yang sama, supaya informasi "sudah
 * sampai mana" tidak hilang saat model berpindah.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Wariskan status item ke poin-nya lebih dulu, kalau perlu.
        //    Hanya untuk baris yang masih memakai kolom status.
        if (Schema::connection('papan')->hasColumn('papan_item', 'status')) {
            foreach (DB::connection('papan')->table('papan_item')->get() as $item) {
                // Poin tanpa status yang jelas dianggap mengikuti status itemnya
                // hanya bila status item itu 'sudah' (satu-satunya yang berisiko
                // kehilangan makna: sub-modul dianggap beres padahal poinnya belum
                // pernah ditandai).
                if ($item->status === 'sudah') {
                    DB::connection('papan')->table('papan_butir')
                        ->where('item_id', $item->id)
                        ->where('status', 'akan')
                        ->update(['status' => 'sudah']);
                }
            }
        }

        // 2. Buang kolom status dari papan_item.
        Schema::connection('papan')->table('papan_item', function (Blueprint $table) {
            $table->dropIndex(['status']);
        });

        Schema::connection('papan')->table('papan_item', function (Blueprint $table) {
            $table->dropColumn('status');
        });

        // 3. Tambah butir_id di riwayat (nullable: baris lama tidak punya poin).
        if (! Schema::connection('papan')->hasColumn('papan_riwayat', 'butir_id')) {
            Schema::connection('papan')->table('papan_riwayat', function (Blueprint $table) {
                $table->foreignId('butir_id')->nullable()->after('item_id')
                    ->constrained('papan_butir')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::connection('papan')->table('papan_riwayat', function (Blueprint $table) {
            $table->dropConstrainedForeignId('butir_id');
        });

        Schema::connection('papan')->table('papan_item', function (Blueprint $table) {
            $table->string('status', 10)->default('akan');
            $table->index('status');
        });
    }
};
