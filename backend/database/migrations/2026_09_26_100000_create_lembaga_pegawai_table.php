<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lembaga_pegawai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pegawai_id')->constrained('pegawai')->cascadeOnDelete();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nipp', 30)->nullable();
            $table->string('tugas_utama')->default('Guru Pengampu');
            $table->enum('is_active_lembaga', ['Ya', 'Tidak'])->default('Ya');
            $table->date('tgl_masuk')->nullable();
            $table->date('tgl_selesai')->nullable();
            $table->string('tahaj_masuk', 50)->nullable();
            $table->timestamps();

            $table->unique(['pegawai_id', 'jenjang']);
            $table->unique(['jenjang', 'nipp']);
            $table->index(['jenjang', 'is_active_lembaga']);
        });

        // Backfill: satu baris aktif per pasangan (pegawai, jenjang) dari keaktifan.
        $pasangan = DB::table('keaktifan_pegawai')
            ->select('pegawai_id', 'jenjang', DB::raw('MIN(tahun_ajaran) as tahaj_masuk'))
            ->groupBy('pegawai_id', 'jenjang')
            ->get();

        foreach ($pasangan as $row) {
            DB::table('lembaga_pegawai')->insert([
                'pegawai_id' => $row->pegawai_id,
                'jenjang' => $row->jenjang,
                'tugas_utama' => 'Guru Pengampu',
                'is_active_lembaga' => 'Ya',
                'tahaj_masuk' => $row->tahaj_masuk,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('lembaga_pegawai');
    }
};
