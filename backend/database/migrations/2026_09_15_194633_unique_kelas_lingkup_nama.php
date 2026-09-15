<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Tabel yang mereferensikan `kelas.id` → kolomnya, ikut dipindah saat dedupe. */
    private const REFERENSI = [
        'santri' => 'kelas_id',
        'riwayat_belajar' => 'kelas_id',
        'presensi_santri' => 'kelas_id',
        'psb_calon_santri' => 'kelas_id',
        'mutasi_keluar' => 'kelas_terakhir_id',
        'kelas_kurikulum' => 'kelas_id',
        'pengampu_mapel' => 'kelas_id',
        'rapor_catatan_wali' => 'kelas_id',
    ];

    /** Tabel ber-unique yang bisa bentrok setelah referensinya dipindah. */
    private const UNIQUE_TERDAMPAK = [
        'kelas_kurikulum' => ['kelas_id', 'kurikulum_id'],
        'pengampu_mapel' => ['kelas_id', 'mata_pelajaran_id'],
        'rapor_catatan_wali' => ['santri_id', 'kelas_id', 'tahun_ajaran_id', 'semester'],
    ];

    /**
     * Nama kelas wajib unik per lembaga + tahun ajaran (FB-004-01). Sebelum index
     * dipasang: rapikan spasi nama lama, lalu satukan kelas kembar (keeper = id
     * terkecil, referensi dipindah, baris kembar dihapus). Perbandingan nama
     * mengikuti kolasi kolom (utf8mb4_unicode_ci = case-insensitive).
     */
    public function up(): void
    {
        $this->rapikanNamaLama();
        $this->gabungkanKelasKembar();

        Schema::table('kelas', function (Blueprint $table) {
            $table->unique(['lembaga_id', 'tahun_ajaran_id', 'nama_kelas'], 'kelas_lingkup_nama_unique');
        });
    }

    public function down(): void
    {
        Schema::table('kelas', function (Blueprint $table) {
            $table->dropUnique('kelas_lingkup_nama_unique');
        });
    }

    /** Samakan normalisasi dengan model Kelas (trim + rapatkan spasi). */
    private function rapikanNamaLama(): void
    {
        foreach (DB::table('kelas')->select('id', 'nama_kelas')->orderBy('id')->get() as $baris) {
            $rapi = preg_replace('/\s+/u', ' ', trim((string) $baris->nama_kelas)) ?? '';

            if ($rapi !== $baris->nama_kelas) {
                DB::table('kelas')->where('id', $baris->id)->update(['nama_kelas' => $rapi]);
            }
        }
    }

    private function gabungkanKelasKembar(): void
    {
        $kembar = DB::table('kelas')
            ->select('lembaga_id', 'tahun_ajaran_id', 'nama_kelas', DB::raw('MIN(id) AS keeper'))
            ->groupBy('lembaga_id', 'tahun_ajaran_id', 'nama_kelas')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($kembar as $grup) {
            $ganda = DB::table('kelas')
                ->where('lembaga_id', $grup->lembaga_id)
                ->where('tahun_ajaran_id', $grup->tahun_ajaran_id)
                ->where('nama_kelas', $grup->nama_kelas)
                ->where('id', '!=', $grup->keeper)
                ->pluck('id');

            foreach (self::REFERENSI as $tabel => $kolom) {
                DB::table($tabel)->whereIn($kolom, $ganda)->update([$kolom => $grup->keeper]);
            }

            $this->rapikanBarisKembar();

            DB::table('kelas')->whereIn('id', $ganda)->delete();
        }
    }

    /** Setelah reassign, sisakan baris ber-id terkecil per kunci unique. */
    private function rapikanBarisKembar(): void
    {
        foreach (self::UNIQUE_TERDAMPAK as $tabel => $kolom) {
            $kembar = DB::table($tabel)
                ->select($kolom)
                ->selectRaw('MIN(id) AS keeper')
                ->groupBy($kolom)
                ->havingRaw('COUNT(*) > 1')
                ->get();

            foreach ($kembar as $grup) {
                $query = DB::table($tabel)->where('id', '!=', $grup->keeper);

                foreach ($kolom as $nama) {
                    $query->where($nama, $grup->{$nama});
                }

                $query->delete();
            }
        }
    }
};
