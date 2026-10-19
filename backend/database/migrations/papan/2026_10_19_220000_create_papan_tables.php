<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Skema papan perkembangan proyek (koneksi `papan`, SQLite terpisah).
 *
 * Empat tabel: modul -> item (sub-modul) -> butir, plus riwayat perpindahan
 * status untuk melacak perkembangan. Tidak menyentuh data pesantren.
 *
 * Kolom status memakai empat nilai tetap: sudah | sedang | akan | ditunda.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('papan')->create('papan_modul', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 4)->unique();
            $table->string('nama');
            $table->integer('urutan')->default(0);
            $table->text('catatan')->nullable();
            $table->timestamps();
        });

        Schema::connection('papan')->create('papan_item', function (Blueprint $table) {
            $table->id();
            $table->foreignId('modul_id')->constrained('papan_modul')->cascadeOnDelete();
            $table->string('kode', 12);
            $table->string('nama');
            $table->string('status', 10)->default('akan');
            $table->string('rujukan')->nullable();
            $table->integer('urutan')->default(0);
            $table->timestamps();

            $table->unique(['modul_id', 'kode']);
            $table->index('status');
        });

        Schema::connection('papan')->create('papan_butir', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('papan_item')->cascadeOnDelete();
            $table->string('status', 10)->default('sudah');
            $table->text('deskripsi');
            $table->integer('urutan')->default(0);
            $table->timestamps();

            $table->index(['item_id', 'status']);
        });

        Schema::connection('papan')->create('papan_riwayat', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('papan_item')->cascadeOnDelete();
            $table->string('dari_status', 10)->nullable();
            $table->string('ke_status', 10);
            $table->string('catatan')->nullable();
            $table->string('diubah_oleh')->default('agent');
            $table->timestamp('waktu')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::connection('papan')->dropIfExists('papan_riwayat');
        Schema::connection('papan')->dropIfExists('papan_butir');
        Schema::connection('papan')->dropIfExists('papan_item');
        Schema::connection('papan')->dropIfExists('papan_modul');
    }
};
