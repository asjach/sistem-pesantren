<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('psb_kegiatan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->cascadeOnDelete();
            $table->string('nama');
            $table->boolean('is_aktif')->default(true);
            $table->timestamps();

            $table->unique(['tahun_ajaran_id', 'nama']);
        });

        Schema::table('psb_gelombang', function (Blueprint $table) {
            $table->foreignId('psb_kegiatan_id')->nullable()->after('id')->constrained('psb_kegiatan')->nullOnDelete();
            $table->unsignedInteger('nomor')->nullable()->after('psb_kegiatan_id');
        });

        $gelombangs = DB::table('psb_gelombang')->orderBy('id')->get();
        foreach ($gelombangs as $g) {
            if (! $g->tahun_ajaran_id) {
                continue;
            }
            $ta = DB::table('tahun_ajaran')->where('id', $g->tahun_ajaran_id)->first();
            $nama = 'PSB ' . ($ta->nama ?? ('TA ' . $g->tahun_ajaran_id));
            $kegiatanId = DB::table('psb_kegiatan')
                ->where('tahun_ajaran_id', $g->tahun_ajaran_id)
                ->where('nama', $nama)
                ->value('id');
            if (! $kegiatanId) {
                $kegiatanId = DB::table('psb_kegiatan')->insertGetId([
                    'tahun_ajaran_id' => $g->tahun_ajaran_id,
                    'nama' => $nama,
                    'is_aktif' => (bool) $g->is_aktif,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            $nomor = DB::table('psb_gelombang')->where('psb_kegiatan_id', $kegiatanId)->count() + 1;
            DB::table('psb_gelombang')->where('id', $g->id)->update([
                'psb_kegiatan_id' => $kegiatanId,
                'nomor' => $nomor,
            ]);
        }

        Schema::table('psb_gelombang', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tahun_ajaran_id');
        });
    }

    public function down(): void
    {
        Schema::table('psb_gelombang', function (Blueprint $table) {
            $table->foreignId('tahun_ajaran_id')->nullable()->constrained('tahun_ajaran')->nullOnDelete();
        });

        Schema::table('psb_gelombang', function (Blueprint $table) {
            $table->dropConstrainedForeignId('psb_kegiatan_id');
            $table->dropColumn('nomor');
        });

        Schema::dropIfExists('psb_kegiatan');
    }
};
