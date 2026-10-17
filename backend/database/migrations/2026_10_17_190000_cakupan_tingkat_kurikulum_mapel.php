<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cakupan tingkat per mapel kurikulum (menggantikan jangkar `tingkat` tunggal).
 *
 * Latar: kolom `tingkat` hanya bisa menyatakan "semua tingkat" atau SATU tingkat.
 * Yang dibutuhkan: mapel boleh berlaku untuk beberapa tingkat (mis. 1 & 2), jadi
 * pivot baru `kurikulum_mapel_tingkat`. **KOSONG = berlaku di semua tingkat**
 * (menjaga perilaku lama `tingkat IS NULL`).
 *
 * Tingkat diambil dari referensi `tingkat` dan dicocokkan dengan `kelas.tingkat`
 * (nama, bukan id) — sama seperti kolom lama, sehingga nilainya tetap lintas tahun
 * ajaran: tahun ajaran baru otomatis ikut karena tingkat tak terikat tahun.
 *
 * Karena `tingkat` ikut jadi bagian UNIQUE lama, baris yang sama bisa terduplikasi
 * (satu mapel per tingkat). Baris itu digabung dulu: id terkecil dipertahankan,
 * sisanya dihapus (KKM/urutan ikut hilang bersama duplikatnya).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Idempoten: kalau kolom `tingkat` sudah hilang (migrasi pernah
        // dijalankan lalu dibatalkan sebagian), langkah hilangnya dilewati.
        if (Schema::hasColumn('kurikulum_mapel', 'tingkat')) {
            $this->buangTingkat();
        }
        if (! Schema::hasTable('kurikulum_mapel_tingkat')) {
            Schema::create('kurikulum_mapel_tingkat', function (Blueprint $table) {
                $table->id();
                $table->foreignId('kurikulum_mapel_id')->constrained('kurikulum_mapel')->cascadeOnDelete();
                $table->string('tingkat', 20); // ref_tingkat.nama — sama dengan `kelas.tingkat`
                $table->timestamps();

                $table->unique(['kurikulum_mapel_id', 'tingkat']);
            });
        }
    }

    /** Foreign key `kurikulum_mapel.kurikulum_id` masih ada? */
    private function adaFakKurikulum(): bool
    {
        return DB::select(
            "select 1 from information_schema.key_column_usage
             where table_schema = database() and table_name = 'kurikulum_mapel'
               and constraint_name = 'kurikulum_mapel_kurikulum_id_foreign' limit 1"
        ) !== [];
    }

    /** Buang jangkar `tingkat`: gabung baris duplikat, buang kolom, ubah indeks. */
    private function buangTingkat(): void
    {
        $adaDuplikat = DB::table('kurikulum_mapel')
            ->select('kurikulum_id', 'mata_pelajaran_id', DB::raw('MIN(id) as simpan'))
            ->groupBy('kurikulum_id', 'mata_pelajaran_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();
        foreach ($adaDuplikat as $grup) {
            $buang = DB::table('kurikulum_mapel')
                ->where('kurikulum_id', $grup->kurikulum_id)
                ->where('mata_pelajaran_id', $grup->mata_pelajaran_id)
                ->where('id', '!=', $grup->simpan)
                ->pluck('id');
            if ($buang->isNotEmpty()) {
                DB::table('kurikulum_mapel')->whereIn('id', $buang)->delete();
            }
        }

        // Urutan buang indeks lalu kolom BERBEDA per driver:
        //  - MySQL: indeks `uq_kurikulum_mapel_kmt` juga melayani foreign key,
        //    jadi `dropIndex` ditolak ("needed in a foreign key constraint");
        //    dropping kolom otomatis ikut membuang indeks itu.
        //  - SQLite: justru tidak boleh dropping kolom yang masih dipakai indeks
        //    ("error in index … after drop column"), jadi indeksnya dibuang dulu.
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('kurikulum_mapel', function (Blueprint $table) {
                $table->dropUnique('uq_kurikulum_mapel_kmt');
            });
        }
        Schema::table('kurikulum_mapel', function (Blueprint $table) {
            $table->dropColumn('tingkat');
        });
        // Di MySQL indeks lama MENYISA setelah kolom dibuang (kempercil jadi dua
        // kolom, namanya tetap `uq_kurikulum_mapel_kmt`) — aturan uniqueness-nya
        // sudah sama, tapi namanya menyesatkan; rename supaya jelas bahwa kuncinya
        // sudah tak melibatkan tingkat.
        if (Schema::hasIndex('kurikulum_mapel', 'uq_kurikulum_mapel_kmt')) {
            DB::statement('alter table kurikulum_mapel rename index uq_kurikulum_mapel_kmt to uq_kurikulum_mapel_mapel');
        } elseif (! Schema::hasIndex('kurikulum_mapel', 'uq_kurikulum_mapel_mapel')) {
            Schema::table('kurikulum_mapel', function (Blueprint $table) {
                $table->unique(['kurikulum_id', 'mata_pelajaran_id'], 'uq_kurikulum_mapel_mapel');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('kurikulum_mapel_tingkat');

        // Nama indeks unik berbeda antar versi migrasi ini, jadi keduanya dibuang
        // bila ada. MySQL memakai indeks unik itu sebagai penopang foreign key
        // `kurikulum_id`, jadi FK-nya dilepas sebentar lebih dulu — bila gagal
        // (mis. FK sudah tak ada), langkah indeks tetap dicoba: rollback lebih
        // baik setengah jalan daripada gagal total.
        if (Schema::hasIndex('kurikulum_mapel', 'uq_kurikulum_mapel_mapel')
            || Schema::hasIndex('kurikulum_mapel', 'uq_kurikulum_mapel_kmt')) {
            try {
                Schema::table('kurikulum_mapel', function (Blueprint $table) {
                    $table->dropForeign('kurikulum_mapel_kurikulum_id_foreign');
                });
            } catch (Throwable) {
                // FK tak ada / tak bisa dilepas — lanjut saja.
            }
        }

        Schema::table('kurikulum_mapel', function (Blueprint $table) {
            if (Schema::hasIndex('kurikulum_mapel', 'uq_kurikulum_mapel_mapel')) {
                $table->dropUnique('uq_kurikulum_mapel_mapel');
            }
            if (Schema::hasIndex('kurikulum_mapel', 'uq_kurikulum_mapel_kmt')) {
                $table->dropUnique('uq_kurikulum_mapel_kmt');
            }
            if (! Schema::hasColumn('kurikulum_mapel', 'tingkat')) {
                $table->string('tingkat')->nullable(); // ref_tingkat: null = semua tingkat
            }
        });
        Schema::table('kurikulum_mapel', function (Blueprint $table) {
            $table->unique(['kurikulum_id', 'mata_pelajaran_id', 'tingkat'], 'uq_kurikulum_mapel_kmt');
        });

        try {
            Schema::table('kurikulum_mapel', function (Blueprint $table) {
                $table->foreign('kurikulum_id')->constrained('kurikulum')->cascadeOnDelete();
            });
        } catch (Throwable) {
            // FK sudah ada.
        }
    }
};
