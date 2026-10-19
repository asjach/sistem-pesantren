<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Preset kolom tabel (per lembaga, null = global admin pesantren) + pilihan
     * terakhir per user.
     *
     * Menggabungkan alter lama:
     *  - `preset_tabel_aktif.kolom` (dulu migrasi `2026_10_02_130000`) ikut di
     *    sini; susunan "Lengkap kustom" per user per tabel disimpan saat
     *    `preset_id` null, tanpa membuat preset bernama baru.
     *  - `preset_tabel.label` dan `preset_tabel_aktif.label` TIDAK ada di sini:
     *    keduanya sempat ditambahkan lalu dijatuhkan (`2026_10_16_110000`)
     *    karena nama header kolom kini satu sumber di `toolbar_preset.label`.
     *    Yang netto nol tidak dipertahankan.
     */
    public function up(): void
    {
        Schema::create('preset_tabel', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('table_key', 60);
            $table->string('nama', 50);
            $table->json('kolom');

            $table->boolean('is_default')->default(false);
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['jenjang', 'table_key']);
        });

        Schema::create('preset_tabel_aktif', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('table_key', 60);
            $table->foreignId('preset_id')->nullable()->constrained('preset_tabel')->cascadeOnDelete();

            $table->json('kolom')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'table_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('preset_tabel_aktif');
        Schema::dropIfExists('preset_tabel');
    }
};
