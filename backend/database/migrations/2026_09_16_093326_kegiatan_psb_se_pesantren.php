<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Kegiatan PSB kembali se-pesantren: satu kegiatan per tahun ajaran, dipakai
 * semua lembaga (kuota/biaya/dokumen tetap per lembaga di dalam gelombang).
 * Kolom `lembaga_id` dihapus karena tidak lagi dipakai logika mana pun.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Bila ada beberapa kegiatan pada TA yang sama, gabungkan ke satu
        //    kegiatan kanonik sebelum unique per-TA dipasang.
        $perTa = DB::table('psb_kegiatan')->get()->groupBy('tahun_ajaran_id');
        foreach ($perTa as $rows) {
            if ($rows->count() < 2) {
                continue;
            }

            $kanonik = $rows->firstWhere('is_aktif', true)
                ?? $rows->sortByDesc(fn ($r) => DB::table('psb_gelombang')->where('psb_kegiatan_id', $r->id)->count())->first()
                ?? $rows->sortByDesc('id')->first();
            $lain = $rows->pluck('id')->reject(fn ($id) => $id === $kanonik->id)->values()->all();

            DB::table('psb_gelombang')->whereIn('psb_kegiatan_id', $lain)->update(['psb_kegiatan_id' => $kanonik->id]);

            $nomor = 0;
            foreach (DB::table('psb_gelombang')->where('psb_kegiatan_id', $kanonik->id)->orderBy('id')->pluck('id') as $gelombangId) {
                DB::table('psb_gelombang')->where('id', $gelombangId)->update(['nomor' => ++$nomor]);
            }

            foreach (DB::table('dokumen_wajib_lembaga')->whereIn('psb_kegiatan_id', $lain)->get() as $dokumen) {
                $bentrok = DB::table('dokumen_wajib_lembaga')
                    ->where('psb_kegiatan_id', $kanonik->id)
                    ->where('lembaga_id', $dokumen->lembaga_id)
                    ->where('jenis_dokumen_santri', $dokumen->jenis_dokumen_santri)
                    ->exists();
                $bentrok
                    ? DB::table('dokumen_wajib_lembaga')->where('id', $dokumen->id)->delete()
                    : DB::table('dokumen_wajib_lembaga')->where('id', $dokumen->id)->update(['psb_kegiatan_id' => $kanonik->id]);
            }

            DB::table('psb_kegiatan')->whereIn('id', $lain)->delete();
        }

        // 2. Hapus penanda lembaga (tidak dipakai lagi pada kegiatan se-pesantren).
        //    Urutan wajib: lepas FK → lepas unique → baru buang kolom.
        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropForeign(['lembaga_id']);
        });

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropUnique('psb_kegiatan_lembaga_ta_unique');
        });

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropColumn('lembaga_id');
        });

        // 3. Satu kegiatan per tahun ajaran; index biasa digantikan unique.
        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->unique('tahun_ajaran_id');
        });

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropIndex('psb_kegiatan_tahun_ajaran_id_index');
        });
    }

    public function down(): void
    {
        // Nilai lembaga lama tidak bisa dipulihkan.
        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropUnique(['tahun_ajaran_id']);
            $table->index('tahun_ajaran_id');
        });

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->foreignId('lembaga_id')->nullable()->after('id')->constrained('lembaga')->cascadeOnDelete();
            $table->unique(['lembaga_id', 'tahun_ajaran_id'], 'psb_kegiatan_lembaga_ta_unique');
        });
    }
};
