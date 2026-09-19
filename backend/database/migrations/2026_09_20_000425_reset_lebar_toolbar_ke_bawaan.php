<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Kembalikan lebar kontrol toolbar ke bawaan baru (100px seragam):
     * kosongkan peta `lebar` agar frontend memakai bawaan.
     * Visibilitas tidak disentuh.
     */
    public function up(): void
    {
        DB::table('toolbar_preset')->whereNotNull('lebar')->update(['lebar' => null]);
    }

    /**
     * Tak dapat mengembalikan nilai lama (data sudah diganti).
     */
    public function down(): void
    {
        //
    }
};
