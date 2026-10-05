<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Santri tambahan dispensasi pindah dari kolom JSON `dispensasi.santri_ids`
 * ke tabel pivot `santri_dispensasi` (FK cascade kedua sisi, unik per
 * pasangan). Data lama di-backfill, lalu kolom JSON dihapus.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('santri_dispensasi', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispensasi_id')->constrained('dispensasi')->cascadeOnDelete();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['dispensasi_id', 'santri_id']);
            $table->index('santri_id');
        });

        $validSantri = DB::table('santri')->pluck('id')->map(fn ($id) => (int) $id)->all();
        $valid = array_flip($validSantri);
        $sekarang = now()->toDateTimeString();

        DB::table('dispensasi')->whereNotNull('santri_ids')->orderBy('id')->chunkById(200, function ($baris) use ($valid, $sekarang) {
            $sisip = [];
            foreach ($baris as $d) {
                $ids = json_decode((string) $d->santri_ids, true);
                if (! is_array($ids)) {
                    continue;
                }
                foreach (array_unique(array_map('intval', $ids)) as $santriId) {
                    if ($santriId > 0 && isset($valid[$santriId])) {
                        $sisip[] = [
                            'dispensasi_id' => (int) $d->id,
                            'santri_id' => $santriId,
                            'created_at' => $sekarang,
                            'updated_at' => $sekarang,
                        ];
                    }
                }
            }
            if ($sisip !== []) {
                DB::table('santri_dispensasi')->upsert($sisip, ['dispensasi_id', 'santri_id']);
            }
        });

        Schema::table('dispensasi', function (Blueprint $table) {
            $table->dropColumn('santri_ids');
        });
    }

    public function down(): void
    {
        Schema::table('dispensasi', function (Blueprint $table) {
            $table->json('santri_ids')->nullable()->after('kelas_id');
        });

        DB::table('santri_dispensasi')->orderBy('id')->chunkById(500, function ($baris) {
            $kelompok = [];
            foreach ($baris as $r) {
                $kelompok[(int) $r->dispensasi_id][] = (int) $r->santri_id;
            }
            foreach ($kelompok as $dispensasiId => $ids) {
                $lama = DB::table('dispensasi')->where('id', $dispensasiId)->value('santri_ids');
                $gabung = array_values(array_unique(array_merge(json_decode((string) ($lama ?? '[]'), true) ?? [], $ids)));
                sort($gabung);
                DB::table('dispensasi')->where('id', $dispensasiId)->update(['santri_ids' => json_encode($gabung)]);
            }
        });

        Schema::dropIfExists('santri_dispensasi');
    }
};
