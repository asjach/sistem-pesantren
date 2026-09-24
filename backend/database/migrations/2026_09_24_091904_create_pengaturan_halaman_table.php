<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Visibilitas filter topBar per halaman (global per `page_key`): peta
     * filter → boolean. Kunci absen = bawaan kode halaman; baris absen =
     * seluruh filter ikut bawaan kode. Satu baris per halaman.
     */
    public function up(): void
    {
        Schema::create('pengaturan_halaman', function (Blueprint $table) {
            $table->id();
            $table->string('page_key', 60)->unique();
            $table->json('filter');
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pengaturan_halaman');
    }
};
