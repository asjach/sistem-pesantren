<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Backfill TA global:
 * 1. Isi `psb_kegiatan.lembaga_id` dari TA lamanya (sebelum TA di-dedupe).
 * 2. Dedupe TA per `nama`: pilih satu baris kanonik (yang aktif lebih dulu),
 *    pindahkan seluruh FK ke baris kanonik, hapus baris kembar.
 * 3. Jadikan baris kanonik global (`lembaga_id` NULL) dan sisakan SATU aktif.
 * 4. `psb_kegiatan.lembaga_id` wajib + unique (lembaga_id, tahun_ajaran_id).
 */
return new class extends Migration
{
    /** [tabel, kolom] yang merujuk tahun_ajaran.id (alumni ditangani terpisah). */
    private const REFERENSI = [
        ['kelas', 'tahun_ajaran_id'],
        ['riwayat_belajar', 'tahun_ajaran_id'],
        ['nilai_santri', 'tahun_ajaran_id'],
        ['rapor_catatan_wali', 'tahun_ajaran_id'],
        ['keaktifan_pegawai', 'tahun_ajaran_id'],
        ['psb_calon_santri', 'tahun_ajaran_id'],
    ];

    public function up(): void
    {
        // 1. Penaut lembaga PSB diambil dari TA sebelum TA kehilangan lembaganya.
        DB::table('psb_kegiatan')->orderBy('id')->chunkById(200, function ($rows) {
            foreach ($rows as $kegiatan) {
                $lembagaId = DB::table('tahun_ajaran')
                    ->where('id', $kegiatan->tahun_ajaran_id)
                    ->value('lembaga_id');
                if ($lembagaId !== null) {
                    DB::table('psb_kegiatan')->where('id', $kegiatan->id)->update(['lembaga_id' => $lembagaId]);
                }
            }
        });

        // Nama TA yang jadi TA aktif global (tanggal_mulai terbaru, tie-break id).
        $namaAktif = DB::table('tahun_ajaran')
            ->where('is_aktif', true)
            ->orderByDesc('tanggal_mulai')
            ->orderByDesc('id')
            ->value('nama');

        // 2. Dedupe per nama. Urutan: aktif dulu, lalu id terkecil → baris kanonik.
        $perNama = DB::table('tahun_ajaran')
            ->orderByDesc('is_aktif')
            ->orderBy('id')
            ->get()
            ->groupBy('nama');

        foreach ($perNama as $rows) {
            $kanonik = $rows->first();
            $kembar = $rows->pluck('id')->reject(fn ($id) => $id === $kanonik->id)->values()->all();

            if ($kembar !== []) {
                foreach (self::REFERENSI as [$tabel, $kolom]) {
                    DB::table($tabel)->whereIn($kolom, $kembar)->update([$kolom => $kanonik->id]);
                }
                DB::table('alumni')->whereIn('tahun_ajaran_lulus_id', $kembar)
                    ->update(['tahun_ajaran_lulus_id' => $kanonik->id]);
                DB::table('tahun_ajaran')->whereIn('id', $kembar)->delete();
            }

            DB::table('tahun_ajaran')->where('id', $kanonik->id)->update([
                'lembaga_id' => null,
                'is_aktif' => false,
                'is_active' => true,
            ]);
        }

        // 3. Tandai satu TA aktif global.
        DB::table('tahun_ajaran')->update(['is_aktif' => false]);
        if ($namaAktif) {
            DB::table('tahun_ajaran')->where('nama', $namaAktif)->update(['is_aktif' => true]);
        }

        // 4. PSB: satu kegiatan per lembaga per TA.
        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->unsignedBigInteger('lembaga_id')->nullable(false)->change();
            $table->unique(['lembaga_id', 'tahun_ajaran_id'], 'psb_kegiatan_lembaga_ta_unique');
        });
    }

    public function down(): void
    {
        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropUnique('psb_kegiatan_lembaga_ta_unique');
        });
    }
};
