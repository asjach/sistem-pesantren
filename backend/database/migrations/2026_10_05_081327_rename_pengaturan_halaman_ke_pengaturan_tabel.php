<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Visibilitas filter topBar pindah dari per halaman (`page_key`) ke per
     * tabel (`table_key`) agar dikelola dari dialog tiap tabel. Baris lama
     * di-fan-out ke seluruh tabel yang didaftarkan halaman terkait; halaman
     * tanpa tabel (mis. Dokumen Santri Lihat) tetap memakai kunci page_key.
     */
    private const PETA_HALAMAN_KE_TABEL = [
        'kegiatan_psb' => ['kegiatan_psb_gelombang', 'kegiatan_psb_kuota'],
        'kelulusan' => ['kelulusan_santri_akhir', 'kelulusan_alumni', 'kelulusan_tidak_lulus'],
        'kenaikan' => ['kenaikan_santri_genap', 'kenaikan_naik_kelas', 'kenaikan_tidak_naik_kelas'],
        'keuangan' => ['keuangan_jenis', 'keuangan_tarif', 'keuangan_tagihan', 'keuangan_tunggakan', 'keuangan_dispensasi'],
        'lembaga_pegawai' => ['pegawai_ringkas', 'pegawai_lembaga'],
        'mi_md' => ['mi_md_mi', 'mi_md_md', 'mi_md_beda'],
        'mutasi_keluar' => ['mutasi_santri_aktif', 'mutasi_arsip'],
        'pembayaran' => ['pembayaran_kasir'],
        'pengaturan_semester' => ['semester_aktif'],
        'psb_pendaftar' => ['psb'],
        'psb_terdaftar' => ['psb'],
        'psb_daftar_ulang' => ['psb'],
        'psb_diterima' => ['psb'],
        'psb_mengundurkan_diri' => ['psb'],
        'psb_ditolak' => ['psb'],
        'riwayat_belajar' => ['riwayat_belum_masuk', 'riwayat_belajar'],
    ];

    public function up(): void
    {
        Schema::rename('pengaturan_halaman', 'pengaturan_tabel');
        Schema::table('pengaturan_tabel', function (Blueprint $table) {
            $table->renameColumn('page_key', 'table_key');
        });

        $baris = DB::table('pengaturan_tabel')->get();
        foreach ($baris as $row) {
            $target = self::PETA_HALAMAN_KE_TABEL[$row->table_key] ?? null;
            if ($target === null) {
                continue;
            }

            DB::table('pengaturan_tabel')->where('id', $row->id)->delete();
            foreach ($target as $tableKey) {
                if (DB::table('pengaturan_tabel')->where('table_key', $tableKey)->exists()) {
                    continue;
                }
                DB::table('pengaturan_tabel')->insert([
                    'table_key' => $tableKey,
                    'filter' => $row->filter,
                    'filter_mode' => $row->filter_mode,
                    'dibuat_oleh' => $row->dibuat_oleh,
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $peta = [];
        foreach (self::PETA_HALAMAN_KE_TABEL as $halaman => $tabel) {
            foreach ($tabel as $key) {
                $peta[$key] = $halaman;
            }
        }

        $hapus = [];
        $simpan = [];
        foreach (DB::table('pengaturan_tabel')->get() as $row) {
            if (! isset($peta[$row->table_key])) {
                continue;
            }
            $hapus[] = $row->id;
            $simpan[$peta[$row->table_key]] = $row;
        }

        DB::table('pengaturan_tabel')->whereIn('id', $hapus)->delete();
        foreach ($simpan as $halaman => $row) {
            if (DB::table('pengaturan_tabel')->where('table_key', $halaman)->exists()) {
                continue;
            }
            DB::table('pengaturan_tabel')->insert([
                'table_key' => $halaman,
                'filter' => $row->filter,
                'filter_mode' => $row->filter_mode,
                'dibuat_oleh' => $row->dibuat_oleh,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ]);
        }

        Schema::table('pengaturan_tabel', function (Blueprint $table) {
            $table->renameColumn('table_key', 'page_key');
        });
        Schema::rename('pengaturan_tabel', 'pengaturan_halaman');
    }
};
