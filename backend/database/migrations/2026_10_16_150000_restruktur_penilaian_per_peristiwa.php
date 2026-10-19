<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Restrukturisasi modul Penilaian: nilai diikat ke PERISTIWA.
 *
 *  Model domain (dikonfirmasi pengguna 2026-10-16):
 *  - ASAS  : semua santri, semua tingkat → komponen harian/tugas/PTS/sumatif
 *  - ASAT  : semua kecuali tingkat akhir → komponen seperti ASAS
 *  - UJIAN : tingkat akhir jenjang Kemenag (bukan MD) → nilai UM + rata-rata
 *            rapor N tingkat sebelumnya; keluaran = nilai ujian/ijazah
 *  - UAP   : tingkat akhir (termasuk MD) → komponen seperti ASAS/ASAT
 *
 *  Peristiwa dikaitkan ke (jenjang, tahun ajaran) — TIDAK ke semester
 *  (permintaan pengguna). Semester tetap ada di `nilai_santri` sebagai dimensi
 *  instans pencatatan skor.
 *
 *  Rapor/leger kini PER PERISTIWA (satu nilai akhir per peristiwa, bukan satu
 *  nilai per semester).
 *
 *  Dua jalur nilai tetap: HITUNG (komponen × bobot) dan IMPOR (nilai akhir
 *  langsung). Tabel konfigurasi lama dibuat ulang dengan bentuk baru; isinya
 *  (komponen, bobot, KKM, predikat) DIPINDAHKAN ke peristiwa ASAS agar tidak
 *  hilang. `nilai_santri`/`nilai_komponen` kosong saat migrasi ini dibuat,
 *  jadi tak ada nilai yang perlu dipindahkan.
 *
 *  Lintas-DB (tes memakai SQLite in-memory): hanya DDL lewat Schema builder,
 *  tanpa SQL mentah MySQL.
 */
return new class extends Migration
{
    public function up(): void
    {

        $komponenLama = Schema::hasTable('komponen_nilai') ? DB::table('komponen_nilai')->get() : collect();
        $bobotLama = Schema::hasTable('komponen_nilai_bobot') ? DB::table('komponen_nilai_bobot')->get() : collect();
        $kkmLama = Schema::hasTable('kkm_kegiatan') ? DB::table('kkm_kegiatan')->get() : collect();
        $predikatLama = Schema::hasTable('rentang_predikat') ? DB::table('rentang_predikat')->get() : collect();

        Schema::dropIfExists('nilai_komponen');
        Schema::dropIfExists('nilai_santri');
        Schema::dropIfExists('komponen_nilai_bobot');
        Schema::dropIfExists('kkm_kegiatan');
        Schema::dropIfExists('rentang_predikat');
        Schema::dropIfExists('komponen_nilai');

        Schema::create('peristiwa_nilai', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();

            $table->string('kode', 20);
            $table->string('nama', 100);
            $table->enum('cakupan', ['semua', 'kecuali_akhir', 'tingkat_akhir'])->default('semua');
            $table->enum('kurikulum', ['kemenag', 'pesantren', 'keduanya'])->default('keduanya');
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['jenjang', 'tahun_ajaran', 'kode'], 'uq_peristiwa_nilai');
        });

        Schema::create('komponen_nilai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('peristiwa_id')->constrained('peristiwa_nilai')->cascadeOnDelete();
            $table->string('nama');
            $table->string('kode', 20)->nullable();
            $table->decimal('bobot', 5, 2)->default(0);
            $table->enum('sumber', ['manual', 'rapor_otomatis'])->default('manual');

            $table->unsignedTinyInteger('jumlah_tingkat_rapor')->nullable();
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['peristiwa_id', 'nama'], 'uq_komponen_peristiwa');
        });

        Schema::create('kkm_kegiatan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('peristiwa_id')->constrained('peristiwa_nilai')->cascadeOnDelete();
            $table->string('kegiatan', 50);
            $table->decimal('kkm', 5, 2)->default(0);
            $table->timestamps();

            $table->unique(['peristiwa_id', 'kegiatan'], 'uq_kkm_peristiwa');
        });

        Schema::create('rentang_predikat', function (Blueprint $table) {
            $table->id();
            $table->foreignId('peristiwa_id')->constrained('peristiwa_nilai')->cascadeOnDelete();
            $table->string('predikat', 2);
            $table->decimal('offset_bawah', 5, 2)->nullable();
            $table->string('keterangan')->nullable();
            $table->timestamps();

            $table->unique(['peristiwa_id', 'predikat'], 'uq_predikat_peristiwa');
        });

        Schema::create('nilai_komponen', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->foreignId('pengampu_mapel_id')->constrained('pengampu_mapel')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('semester', 2);
            $table->foreignId('komponen_nilai_id')->constrained('komponen_nilai')->cascadeOnDelete();
            $table->decimal('skor', 5, 2)->nullable();
            $table->timestamps();

            $table->unique([
                'santri_id', 'pengampu_mapel_id', 'tahun_ajaran', 'semester', 'komponen_nilai_id',
            ], 'uq_nilai_komponen');
        });

        Schema::create('nilai_santri', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->foreignId('pengampu_mapel_id')->constrained('pengampu_mapel')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('semester', 2);
            $table->foreignId('peristiwa_id')->constrained('peristiwa_nilai')->cascadeOnDelete();

            $table->decimal('nilai_formatif', 5, 2)->default(0);
            $table->decimal('nilai_sumatif', 5, 2)->default(0);
            $table->decimal('nilai_akhir', 5, 2)->default(0);
            $table->string('sumber', 10)->default('hitung');
            $table->string('predikat', 2)->nullable();
            $table->text('catatan_capaian')->nullable();
            $table->timestamps();

            $table->unique([
                'santri_id', 'pengampu_mapel_id', 'tahun_ajaran', 'semester', 'peristiwa_id',
            ], 'uq_nilai_santri_peristiwa');
        });

        $pasangan = [];
        foreach ($komponenLama as $k) {
            foreach ($bobotLama->where('komponen_nilai_id', $k->id) as $b) {
                $pasangan[$k->jenjang.'|'.$b->tahun_ajaran] = [$k->jenjang, $b->tahun_ajaran];
            }
        }
        foreach ($kkmLama as $k) {
            $pasangan[$k->jenjang.'|'.$k->tahun_ajaran] = [$k->jenjang, $k->tahun_ajaran];
        }

        $taFallback = DB::table('tahun_ajaran')->orderByDesc('is_aktif')->orderBy('nama')->value('nama');
        foreach ($komponenLama as $k) {
            $punya = false;
            foreach ($pasangan as $p) {
                if ($p[0] === $k->jenjang) {
                    $punya = true;
                    break;
                }
            }
            if (! $punya && $taFallback !== null) {
                $pasangan[$k->jenjang.'|'.$taFallback] = [$k->jenjang, $taFallback];
            }
        }

        $peristiwaAsas = [];
        foreach ($pasangan as [$jenjang, $ta]) {
            $peristiwaAsas[$jenjang.'|'.$ta] = DB::table('peristiwa_nilai')->insertGetId([
                'jenjang' => $jenjang,
                'tahun_ajaran' => $ta,
                'kode' => 'ASAS',
                'nama' => 'Asesmen Sumatif Akhir Semester',
                'cakupan' => 'semua',
                'kurikulum' => 'keduanya',
                'urutan' => 1,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $petaKomponenBaru = [];
        foreach ($komponenLama as $k) {
            $ta = $bobotLama->where('komponen_nilai_id', $k->id)->first()->tahun_ajaran ?? $taFallback;
            $peristiwaId = $peristiwaAsas[$k->jenjang.'|'.$ta] ?? null;
            if ($peristiwaId === null) {
                continue;
            }
            $bobot = (float) ($bobotLama->where('komponen_nilai_id', $k->id)->first()->bobot ?? 0);
            $petaKomponenBaru[$k->id] = DB::table('komponen_nilai')->insertGetId([
                'peristiwa_id' => $peristiwaId,
                'nama' => $k->nama,
                'kode' => $k->kode,
                'bobot' => $bobot,
                'sumber' => 'manual',
                'jumlah_tingkat_rapor' => null,
                'urutan' => $k->urutan,
                'is_active' => $k->is_active,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($kkmLama as $k) {
            $peristiwaId = $peristiwaAsas[$k->jenjang.'|'.$k->tahun_ajaran] ?? null;
            if ($peristiwaId === null) {
                continue;
            }
            DB::table('kkm_kegiatan')->insert([
                'peristiwa_id' => $peristiwaId,
                'kegiatan' => $k->kegiatan,
                'kkm' => $k->kkm,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($predikatLama as $p) {
            $peristiwaId = $peristiwaAsas[$p->jenjang.'|'.$p->tahun_ajaran] ?? null;
            if ($peristiwaId === null) {
                continue;
            }
            DB::table('rentang_predikat')->insert([
                'peristiwa_id' => $peristiwaId,
                'predikat' => $p->predikat,
                'offset_bawah' => $p->offset_bawah,
                'keterangan' => $p->keterangan,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {

        Schema::dropIfExists('nilai_komponen');
        Schema::dropIfExists('nilai_santri');
        Schema::dropIfExists('kkm_kegiatan');
        Schema::dropIfExists('rentang_predikat');
        Schema::dropIfExists('komponen_nilai');
        Schema::dropIfExists('peristiwa_nilai');

        Schema::create('komponen_nilai', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nama');
            $table->string('kode', 20)->nullable();
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['jenjang', 'nama']);
        });

        Schema::create('komponen_nilai_bobot', function (Blueprint $table) {
            $table->id();
            $table->foreignId('komponen_nilai_id')->constrained('komponen_nilai')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->decimal('bobot', 5, 2)->default(0);
            $table->timestamps();

            $table->unique(['komponen_nilai_id', 'tahun_ajaran'], 'uq_komponen_bobot');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('kkm_kegiatan', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->foreignId('komponen_nilai_id')->nullable()->constrained('komponen_nilai')->cascadeOnDelete();
            $table->string('kegiatan', 50);
            $table->decimal('kkm', 5, 2)->default(0);
            $table->timestamps();

            $table->unique(['jenjang', 'tahun_ajaran', 'kegiatan'], 'uq_kkm_kegiatan');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('rentang_predikat', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->string('predikat', 2);
            $table->decimal('offset_bawah', 5, 2)->nullable();
            $table->string('keterangan')->nullable();
            $table->timestamps();

            $table->unique(['jenjang', 'tahun_ajaran', 'predikat'], 'uq_rentang_predikat');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('nilai_komponen', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->foreignId('pengampu_mapel_id')->constrained('pengampu_mapel')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->string('semester', 2);
            $table->foreignId('komponen_nilai_id')->constrained('komponen_nilai')->cascadeOnDelete();
            $table->decimal('skor', 5, 2)->nullable();
            $table->timestamps();

            $table->unique([
                'santri_id', 'pengampu_mapel_id', 'tahun_ajaran', 'semester', 'komponen_nilai_id',
            ], 'uq_nilai_komponen');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('nilai_santri', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->foreignId('pengampu_mapel_id')->constrained('pengampu_mapel')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->string('semester', 2);
            $table->decimal('nilai_formatif', 5, 2)->default(0);
            $table->decimal('nilai_sumatif', 5, 2)->default(0);
            $table->decimal('nilai_akhir', 5, 2)->default(0);
            $table->string('sumber', 10)->default('hitung');
            $table->string('predikat', 2)->nullable();
            $table->text('catatan_capaian')->nullable();
            $table->timestamps();

            $table->unique(['santri_id', 'pengampu_mapel_id', 'tahun_ajaran', 'semester'], 'unique_nilai_santri');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });
    }
};
