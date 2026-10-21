<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pengaturan_pencarian', function (Blueprint $table) {
            $table->id();
            $table->string('page_key', 60)->unique();
            $table->boolean('aktif')->default(false);
            $table->foreignId('diubah_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $sekarang = now();
        foreach (['daftar_kelas', 'santri', 'pegawai', 'keuangan'] as $key) {
            DB::table('pengaturan_pencarian')->insert([
                'page_key' => $key,
                'aktif' => true,
                'created_at' => $sekarang,
                'updated_at' => $sekarang,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pengaturan_pencarian');
    }
};
