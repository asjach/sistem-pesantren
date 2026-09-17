<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Preset urut global per `table_key`: satu baris menyimpan DAFTAR opsi urut
     * (json) yang tampil di dropdown Urutkan halaman. Menggantikan hardcode
     * `opsiUrut` di frontend.
     */
    public function up(): void
    {
        Schema::create('urut_preset', function (Blueprint $table) {
            $table->id();
            $table->string('table_key', 60)->unique();
            $table->json('opsi');
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('urut_preset');
    }
};
