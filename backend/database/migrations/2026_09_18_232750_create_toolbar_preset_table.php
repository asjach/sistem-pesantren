<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Visibilitas kontrol toolbar generik, GLOBAL per `table_key`: satu baris
     * menyimpan peta kontrol → boolean (json). Absen/false selain false =
     * tampil; hanya `false` yang menyembunyikan. Dikelola super_admin untuk
     * seluruh lembaga (tanpa `lembaga_id`, seperti `urut_preset`).
     */
    public function up(): void
    {
        Schema::create('toolbar_preset', function (Blueprint $table) {
            $table->id();
            $table->string('table_key', 60)->unique();
            $table->json('visibilitas');
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('toolbar_preset');
    }
};
