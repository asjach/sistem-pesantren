<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $taDuplikat = DB::table('psb_kegiatan')
            ->select('tahun_ajaran_id')
            ->groupBy('tahun_ajaran_id')
            ->havingRaw('count(*) > 1')
            ->pluck('tahun_ajaran_id');

        foreach ($taDuplikat as $taId) {
            $rows = DB::table('psb_kegiatan')->where('tahun_ajaran_id', $taId)->orderBy('id')->get(['id', 'is_aktif']);
            $ids = $rows->pluck('id');
            $punyaGelombang = DB::table('psb_gelombang')
                ->whereIn('psb_kegiatan_id', $ids)
                ->distinct()
                ->pluck('psb_kegiatan_id');
            $simpan = $punyaGelombang->first()
                ?? $rows->firstWhere('is_aktif', true)?->id
                ?? $ids->first();
            $hapus = $ids->reject(fn ($id) => (int) $id === (int) $simpan || $punyaGelombang->contains($id));
            if ($hapus->isNotEmpty()) {
                DB::table('psb_kegiatan')->whereIn('id', $hapus)->delete();
            }
        }

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->unique('tahun_ajaran_id');
        });
    }

    public function down(): void
    {
        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropUnique(['tahun_ajaran_id']);
        });
    }
};
