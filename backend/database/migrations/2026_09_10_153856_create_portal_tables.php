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
                Schema::create('wali_santri_relasi', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('user_id')->constrained('users')->cascadeOnDelete(); // akun login wali
                    $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
                    $table->enum('hubungan', ['ayah', 'ibu', 'wali'])->default('ayah');
                    $table->boolean('is_utama')->default(true);
                    $table->boolean('is_active')->default(true);
                    $table->timestamps();

                    $table->unique(['user_id', 'santri_id']);
                });

                Schema::create('wali_portal_logs', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                    $table->foreignId('santri_id')->nullable()->constrained('santri')->cascadeOnDelete();
                    $table->string('action'); // 'view_dashboard', 'download_rapor', 'bayar_spp'
                    $table->ipAddress('ip_address')->nullable();
                    $table->string('device_info')->nullable();
                    $table->timestamps();
                });

                Schema::create('pengajuan_biodata_santri', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
                    $table->foreignId('wali_user_id')->constrained('users')->cascadeOnDelete();
                    $table->json('perubahan_json'); // {field: {lama, baru}}; nama field SAMA PERSIS dengan kolom santri
                    $table->enum('status', ['diajukan', 'disetujui', 'ditolak', 'dibatalkan'])->default('diajukan');
                    $table->foreignId('diproses_oleh')->nullable()->constrained('users')->nullOnDelete();
                    $table->text('catatan_admin')->nullable();
                    $table->timestamp('cancelled_at')->nullable();
                    $table->timestamps();

                    $table->index(['santri_id', 'status']);
                });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pengajuan_biodata_santri');
        Schema::dropIfExists('wali_portal_logs');
        Schema::dropIfExists('wali_santri_relasi');
    }
};
