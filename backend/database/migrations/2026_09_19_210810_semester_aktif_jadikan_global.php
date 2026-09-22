<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Semester aktif = SATU nilai global pesantren (bukan per lembaga):
     * kolom lembaga dilepas; baris lama (bila ada) diringkas ke satu baris
     * global (ambil semester terbanyak, imbang = Ganjil).
     */
    public function up(): void
    {
        $ringkas = DB::table('semester_aktif')
            ->select('semester', DB::raw('COUNT(*) AS jml'))
            ->groupBy('semester')
            ->orderByDesc('jml')
            ->orderBy('semester')
            ->value('semester');

        Schema::table('semester_aktif', function (Blueprint $table) {
            $table->dropForeign(['jenjang']);
            $table->dropUnique(['jenjang']);
            $table->dropColumn('jenjang');
        });

        DB::table('semester_aktif')->delete();
        if ($ringkas !== null) {
            DB::table('semester_aktif')->insert([
                'semester' => $ringkas,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('semester_aktif', function (Blueprint $table) {
            $table->string('jenjang', 20)->nullable()->unique();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
        });
    }
};
