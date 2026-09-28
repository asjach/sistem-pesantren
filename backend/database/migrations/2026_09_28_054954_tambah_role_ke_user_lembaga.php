<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pemetaan peran per lembaga: `user_lembaga.role` (nullable).
 * - Baris (user, jenjang, role) = peran itu berlaku di lembaga itu
 *   (mis. admin di MI, guru di MLN).
 * - `role = null` = cakupan data warisan (perilaku seperti sebelum fitur ini).
 * - `super_admin` tetap peran global (tanpa baris pivot).
 *
 * Idempoten terhadap DB drift (kolom sudah ada tanpa migrasi): tiap langkah
 * memeriksa keberadaan dulu.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('user_lembaga', 'role')) {
            Schema::table('user_lembaga', function (Blueprint $table) {
                $table->string('role', 30)->nullable()->after('jenjang');
            });
        }

        $indeks = collect(Schema::getIndexes('user_lembaga'))->map(fn ($i) => $i['name']);
        Schema::table('user_lembaga', function (Blueprint $table) use ($indeks) {
            // Urutan penting: unique baru dulu (masih berawalan user_id
            // sehingga FK user_id tetap terpenuhi), baru lepas yang lama.
            if (! $indeks->contains('user_lembaga_user_jenjang_role_unique')) {
                $table->unique(['user_id', 'jenjang', 'role'], 'user_lembaga_user_jenjang_role_unique');
            }
            if ($indeks->contains('user_lembaga_user_id_jenjang_unique')) {
                $table->dropUnique('user_lembaga_user_id_jenjang_unique');
            }
        });

        // Reklasifikasi baris warisan yang dulu ditulis otomatis untuk akun
        // guru (penempatan aktif + akun tertaut) → role 'guru'. Baris cakupan
        // manual (tanpa penempatan aktif yang cocok) tetap null.
        $pasangan = DB::table('lembaga_pegawai as lp')
            ->join('pegawai as p', 'p.id', '=', 'lp.pegawai_id')
            ->whereNotNull('p.user_id')
            ->where('lp.is_active_lembaga', 'Ya')
            ->select('p.user_id as user_id', 'lp.jenjang as jenjang')
            ->get();
        foreach ($pasangan as $ps) {
            DB::table('user_lembaga')
                ->where('user_id', $ps->user_id)
                ->where('jenjang', $ps->jenjang)
                ->whereNull('role')
                ->update(['role' => 'guru', 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        // Rapatkan dulu ke 1 baris per (user, jenjang) — utamakan baris
        // warisan (role null) — agar unique lama bisa dipulihkan.
        $baris = DB::table('user_lembaga')->orderBy('id')->get(['id', 'user_id', 'jenjang', 'role']);
        $lihat = [];
        $hapus = [];
        foreach ($baris as $b) {
            $kunci = $b->user_id.'|'.$b->jenjang;
            if (! isset($lihat[$kunci])) {
                $lihat[$kunci] = $b;

                continue;
            }
            if ($lihat[$kunci]->role !== null && $b->role === null) {
                $hapus[] = $lihat[$kunci]->id;
                $lihat[$kunci] = $b;
            } else {
                $hapus[] = $b->id;
            }
        }
        foreach (array_chunk($hapus, 500) as $potong) {
            DB::table('user_lembaga')->whereIn('id', $potong)->delete();
        }

        $indeks = collect(Schema::getIndexes('user_lembaga'))->map(fn ($i) => $i['name']);
        Schema::table('user_lembaga', function (Blueprint $table) use ($indeks) {
            // Urutan penting (kebalikan up): unique lama dulu agar FK
            // user_id tetap terpenuhi saat unique baru dilepas.
            if (! $indeks->contains('user_lembaga_user_id_jenjang_unique')) {
                $table->unique(['user_id', 'jenjang'], 'user_lembaga_user_id_jenjang_unique');
            }
            if ($indeks->contains('user_lembaga_user_jenjang_role_unique')) {
                $table->dropUnique('user_lembaga_user_jenjang_role_unique');
            }
            if (Schema::hasColumn('user_lembaga', 'role')) {
                $table->dropColumn('role');
            }
        });
    }
};
