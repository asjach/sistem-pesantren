<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * NIS wajib unik (master santri). Duplikat lama dibersihkan lebih dulu:
 * NIS dipertahankan pada id terkecil, baris lain dikosongkan.
 */
return new class extends Migration
{
    public function up(): void
    {
        $dup = DB::table('santri')
            ->select('nis', DB::raw('MIN(id) as keep_id'))
            ->whereNotNull('nis')
            ->where('nis', '<>', '')
            ->groupBy('nis')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($dup as $row) {
            DB::table('santri')
                ->where('nis', $row->nis)
                ->where('id', '<>', $row->keep_id)
                ->update(['nis' => null]);
        }

        Schema::table('santri', function (Blueprint $table) {
            $table->unique('nis');
        });
    }

    public function down(): void
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->dropUnique(['nis']);
        });
    }
};
