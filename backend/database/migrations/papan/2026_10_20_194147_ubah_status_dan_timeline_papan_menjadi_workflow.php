<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Selaraskan kosakata Board dengan workflow Kanban lima tahap.
 *
 * Status lama dipetakan tanpa membuang progres. `for_review` tidak punya
 * padanan lama; saat rollback ia dikembalikan ke `sedang`.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->ubahPanjangStatus(20, 'backlog');

        DB::connection('papan')->transaction(function () {
            $this->ubahStatus([
                'ditunda' => 'backlog',
                'akan' => 'todo',
                'sedang' => 'in_progress',
                'sudah' => 'done',
            ]);

            $this->ubahKunciPengaturan('timeline_aktif', 'workflow_aktif');
        });
    }

    public function down(): void
    {
        DB::connection('papan')->transaction(function () {
            $this->ubahStatus([
                'backlog' => 'ditunda',
                'todo' => 'akan',
                'in_progress' => 'sedang',
                'for_review' => 'sedang',
                'done' => 'sudah',
            ]);

            $this->ubahKunciPengaturan('workflow_aktif', 'timeline_aktif');
        });

        $this->ubahPanjangStatus(10, 'akan');
    }

    /** @param array<string, string> $pemetaan */
    private function ubahStatus(array $pemetaan): void
    {
        foreach ($pemetaan as $lama => $baru) {
            DB::connection('papan')->table('papan_butir')
                ->where('status', $lama)
                ->update(['status' => $baru]);

            DB::connection('papan')->table('papan_riwayat')
                ->where('dari_status', $lama)
                ->update(['dari_status' => $baru]);

            DB::connection('papan')->table('papan_riwayat')
                ->where('ke_status', $lama)
                ->update(['ke_status' => $baru]);
        }
    }

    private function ubahKunciPengaturan(string $lama, string $baru): void
    {
        $pengaturan = DB::connection('papan')->table('papan_pengaturan')
            ->where('kunci', $lama)
            ->orWhere('kunci', 'like', $lama.':%')
            ->get();

        foreach ($pengaturan as $baris) {
            $kunciBaru = $baru.substr((string) $baris->kunci, strlen($lama));

            DB::connection('papan')->table('papan_pengaturan')->updateOrInsert(
                ['kunci' => $kunciBaru],
                ['nilai' => $baris->nilai],
            );
        }

        DB::connection('papan')->table('papan_pengaturan')
            ->where('kunci', $lama)
            ->orWhere('kunci', 'like', $lama.':%')
            ->delete();
    }

    private function ubahPanjangStatus(int $panjang, string $bawaan): void
    {
        Schema::connection('papan')->table('papan_butir', function (Blueprint $table) use ($panjang, $bawaan) {
            $table->string('status', $panjang)->default($bawaan)->change();
        });

        Schema::connection('papan')->table('papan_riwayat', function (Blueprint $table) use ($panjang) {
            $table->string('dari_status', $panjang)->nullable()->change();
            $table->string('ke_status', $panjang)->change();
        });
    }
};
