<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Hapus kolom `paket` dari tabel keuangan.
 *
 * Alasan: saat generate tagihan, `paket` SELALU dihitung dari riwayat belajar
 * (`petaSantriGenerate`), tidak pernah diambil dari tarif_tagihan. Akibatnya
 * tarif ber-`paket = MI-MD` tidak pernah bisa terpilih — `jenjang_utama` selalu
 * MI atau MD. Kolom ini hanya membingungkan. `jenjang` sudah menyimpan lembaga
 * penagih (primer), jadi tidak ada informasi yang benar-benar hilang; yang hilang
 * hanya label keanggotaan ganda ("MI-MD").
 *
 * `down()` bersifat lossy: nilai MI-MD tidak dapat direkonstruksi karena
 * `jenjang` sudah storing lembaga primer sejak awal.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Bersihkan preset kolom & urut yang masih menyimpan kode "paket".
        //    Tanpa ini FE tidak rusak (PresetKolom/ExcelTable menyaring kode
        //    yang tak dikenal), tapi preset lama jadi tidak bisa disimpan ulang
        //    dan `?sort=paket` akan 422.
        foreach (DB::table('preset_tabel')->get() as $preset) {
            $kolom = json_decode((string) $preset->kolom, true);
            if (! is_array($kolom)) {
                continue;
            }
            $bersih = array_values(array_filter($kolom, fn ($k) => $k !== 'paket'));
            if (count($bersih) !== count($kolom)) {
                DB::table('preset_tabel')->where('id', $preset->id)
                    ->update(['kolom' => json_encode($bersih)]);
            }
        }

        foreach (DB::table('preset_tabel_aktif')->get() as $aktif) {
            $kolom = json_decode((string) $aktif->kolom, true);
            if (! is_array($kolom)) {
                continue;
            }
            $bersih = array_values(array_filter($kolom, fn ($k) => $k !== 'paket'));
            if (count($bersih) !== count($kolom)) {
                DB::table('preset_tabel_aktif')->where('id', $aktif->id)
                    ->update(['kolom' => json_encode($bersih)]);
            }
        }

        foreach (DB::table('urut_preset')->get() as $preset) {
            $opsi = json_decode((string) $preset->opsi, true);
            if (! is_array($opsi)) {
                continue;
            }
            $berubah = false;
            foreach ($opsi as &$opt) {
                if (! is_array($opt)) {
                    continue;
                }
                if (isset($opt['kode']) && is_array($opt['kode']) && in_array('paket', $opt['kode'], true)) {
                    $opt['kode'] = array_values(array_filter($opt['kode'], fn ($k) => $k !== 'paket'));
                    $berubah = true;
                }
                if (isset($opt['arah_kolom']) && is_array($opt['arah_kolom']) && isset($opt['arah_kolom']['paket'])) {
                    unset($opt['arah_kolom']['paket']);
                    $berubah = true;
                }
            }
            unset($opt);
            if ($berubah) {
                DB::table('urut_preset')->where('id', $preset->id)
                    ->update(['opsi' => json_encode($opsi)]);
            }
        }

        // 2. Index harus dilepas SEBELUM dropColumn (SQLite/MySQL sama-samanya).
        Schema::table('tarif_tagihan', function ($table) {
            $table->dropUnique('uq_tarif_tagihan');
        });

        Schema::table('tarif_tagihan', function ($table) {
            $table->dropColumn('paket');
        });

        // 3. Unique baru tanpa paket; nama index dipertahankan.
        Schema::table('tarif_tagihan', function ($table) {
            $table->unique(['jenjang', 'tahun_ajaran', 'jenis_id', 'tingkat'], 'uq_tarif_tagihan');
        });

        // 4. tagihan.paket tidak dipakai index mana pun: uq_tagihan_santri_jenis_periode
        //    hanya memuat (santri_id, jenis_id, periode), sehingga deduplikasi
        //    firstOrCreate saat generate tidak berubah sama sekali. Aman di-drop.
        Schema::table('tagihan', function ($table) {
            $table->dropColumn('paket');
        });
    }

    public function down(): void
    {
        Schema::table('tagihan', function ($table) {
            $table->string('paket', 20)->nullable()->after('jenjang');
        });
        // Nilai asli (MI vs MI-MD) tidak dapat direkonstruksi — jenjang sudah
        // menyimpan lembaga primer sejak kolom paket dihapus.
        DB::table('tagihan')->update(['paket' => DB::raw('jenjang')]);

        Schema::table('tarif_tagihan', function ($table) {
            $table->string('paket', 20)->nullable()->after('jenjang');
        });
        DB::table('tarif_tagihan')->update(['paket' => DB::raw('jenjang')]);

        Schema::table('tarif_tagihan', function ($table) {
            $table->dropUnique('uq_tarif_tagihan');
        });
        Schema::table('tarif_tagihan', function ($table) {
            $table->unique(['jenjang', 'paket', 'tahun_ajaran', 'jenis_id', 'tingkat'], 'uq_tarif_tagihan');
        });
    }
};
