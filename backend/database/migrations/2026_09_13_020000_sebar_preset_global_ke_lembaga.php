<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Preset global lama disalin ke tiap lembaga (lembaga bisa mengedit salinannya). */
    public function up(): void
    {
        $lembagaIds = DB::table('lembaga')->orderBy('id')->pluck('id');
        $globals = DB::table('preset_tabel')->whereNull('lembaga_id')->get();

        foreach ($globals as $global) {
            foreach ($lembagaIds as $lembagaId) {
                $ada = DB::table('preset_tabel')
                    ->where('lembaga_id', $lembagaId)
                    ->where('table_key', $global->table_key)
                    ->where('nama', $global->nama)
                    ->exists();
                if ($ada) {
                    continue;
                }
                DB::table('preset_tabel')->insert([
                    'lembaga_id' => $lembagaId,
                    'table_key' => $global->table_key,
                    'nama' => $global->nama,
                    'kolom' => $global->kolom,
                    'dibuat_oleh' => $global->dibuat_oleh,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            DB::table('preset_tabel')->where('id', $global->id)->delete();
        }
    }

    public function down(): void {}
};
