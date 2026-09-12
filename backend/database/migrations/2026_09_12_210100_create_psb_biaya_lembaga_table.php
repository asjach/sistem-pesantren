<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('psb_biaya_lembaga', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lembaga_id')->unique()->constrained('lembaga')->cascadeOnDelete();
            $table->decimal('biaya_masuk', 12, 2)->default(0);
            $table->decimal('biaya_asrama', 12, 2)->default(0);
            $table->timestamps();
        });

        $perLembaga = DB::table('psb_kuota_biaya')->get()->groupBy('lembaga_id');
        foreach ($perLembaga as $lembagaId => $rows) {
            $dasar = $rows->firstWhere('tipe_santri', 'non_asrama')
                ?? $rows->firstWhere('tipe_santri', 'semua')
                ?? $rows->first();
            $asrama = $rows->firstWhere('tipe_santri', 'asrama');
            $biayaMasuk = (float) ($dasar->nominal_masuk ?? 0);
            $biayaAsrama = max(0, (float) ($asrama->nominal_masuk ?? 0) - $biayaMasuk);
            DB::table('psb_biaya_lembaga')->insert([
                'lembaga_id' => $lembagaId,
                'biaya_masuk' => $biayaMasuk,
                'biaya_asrama' => $biayaAsrama,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('psb_kuota_biaya', function (Blueprint $table) {
            $table->dropColumn('nominal_masuk');
        });

        Schema::table('psb_kuota_biaya', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tahun_ajaran_id');
        });
    }

    public function down(): void
    {
        Schema::table('psb_kuota_biaya', function (Blueprint $table) {
            $table->foreignId('tahun_ajaran_id')->nullable()->constrained('tahun_ajaran')->nullOnDelete();
            $table->decimal('nominal_masuk', 12, 2)->default(0)->after('nominal_paket');
        });

        Schema::dropIfExists('psb_biaya_lembaga');
    }
};
