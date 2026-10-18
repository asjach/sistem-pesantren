<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Setelan komponen CUSTOM per komponen (GLOBAL, tanpa `lembaga_id`,
     * seperti `toolbar_preset`).
     *
     * Berbeda dengan `toolbar_preset` yang menambah kolom tiap kali ada setelan
     * baru, tabel ini menyimpan SATU BARIS per komponen dengan `setelan` JSON,
     * jadi menambah kunci setelan cukup menambah aturan validasi — tanpa
     * migrasi baru.
     *
     * - `table_key` = tabel tempat komponen hidup (filter/dialog di dalam
     *   tabel); string KOSONG untuk komponen di luar tabel (dialog, form,
     *   popover) supaya tetap punya identitas.
     *   String kosong (bukan NULL) dipakai karena MySQL menganggap NULL
     *   berbeda pada indeks UNIQUE — `(NULL, 'x')` bisa terduplikasi.
     * - `komponen` = `htmlFor` komponen (snake_case, maks 60).
     * - `setelan` = peta kunci setelan → nilai; contoh `{"tipeKontrol":"nominal"}`.
     */
    public function up(): void
    {
        Schema::create('komponen_custom', function (Blueprint $table) {
            $table->id();
            $table->string('table_key', 60)->default('');
            $table->string('komponen', 60);
            $table->json('setelan')->nullable();
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['table_key', 'komponen']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('komponen_custom');
    }
};
