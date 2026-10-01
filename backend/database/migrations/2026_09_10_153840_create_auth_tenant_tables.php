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
        Schema::create('user_lembaga', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            // Peran per lembaga; null = cakupan warisan (perilaku sebelum fitur role).
            // super_admin tetap peran global tanpa baris pivot.
            $table->string('role', 30)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'jenjang', 'role'], 'user_lembaga_user_jenjang_role_unique');
        });

        Schema::create('login_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('identifier'); // email/phone/username yang dicoba
            $table->ipAddress('ip')->nullable();
            $table->string('user_agent')->nullable();
            $table->boolean('sukses')->default(false);
            $table->timestamp('created_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('login_audits');
        Schema::dropIfExists('user_lembaga');
    }
};
