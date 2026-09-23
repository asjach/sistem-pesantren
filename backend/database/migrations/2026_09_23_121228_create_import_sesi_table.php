<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('import_sesi', function (Blueprint $table) {
            // Sesi import bertahap (potongan JSON dari browser): satu sesi =
            // satu file; frontend mengirim potongan berurutan, backend
            // mengakumulasi hitungan + galat. Baris basi dibersihkan (TTL).
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('tipe', 20)->default('riwayat');
            $table->string('mode', 10); // periksa|eksekusi
            $table->unsignedInteger('total')->default(0);
            $table->unsignedInteger('offset')->default(0);
            $table->unsignedInteger('dibuat')->default(0);
            $table->unsignedInteger('diperbarui')->default(0);
            $table->unsignedInteger('gagal')->default(0);
            $table->json('galat_contoh')->nullable(); // maks 200 pertama
            $table->string('galat_file')->nullable(); // path relatif storage/app
            $table->string('status', 10)->default('jalan'); // jalan|selesai|batal
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('import_sesi');
    }
};
