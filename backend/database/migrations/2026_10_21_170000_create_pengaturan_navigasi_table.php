<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pengaturan_navigasi', function (Blueprint $table) {
            $table->id();
            $table->json('tersembunyi')->nullable();
            $table->foreignId('diubah_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $sekarang = now();
        DB::table('pengaturan_navigasi')->insert([
            'tersembunyi' => json_encode([]),
            'created_at' => $sekarang,
            'updated_at' => $sekarang,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('pengaturan_navigasi');
    }
};
