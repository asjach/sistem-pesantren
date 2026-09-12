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
                Schema::create('pos_keuangan', function (Blueprint $table) {
                    $table->id();
                    $table->string('kode_pos'); // SPP, SRGM, PSB_REG, DFR_ULANG
                    $table->string('nama_pos');
                    $table->enum('tipe', ['bulanan', 'sekali_bayar', 'semesteran', 'tahunan']);
                    $table->text('keterangan')->nullable();
                    $table->timestamps();

                    $table->unique('kode_pos'); // UNIK GLOBAL (single-pesantren)
                });

                Schema::create('tarif_biaya', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('pos_keuangan_id')->constrained('pos_keuangan')->cascadeOnDelete();
                    $table->foreignId('lembaga_id')->constrained('lembaga')->cascadeOnDelete();
                    $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->cascadeOnDelete();
                    $table->enum('tipe_santri', ['semua', 'asrama', 'non_asrama'])->default('semua');
                    $table->decimal('nominal', 12, 2)->default(0);
                    // Harga paket MI-MD (di baris primer MI); null = pos ini ditagih terpisah per lembaga. Satu tagihan paket per pos per periode.
                    $table->decimal('nominal_paket', 12, 2)->nullable();
                    $table->timestamps();

                    $table->unique(['pos_keuangan_id', 'lembaga_id', 'tahun_ajaran_id', 'tipe_santri'], 'uq_tarif_biaya_pltt'); // nama pendek: auto-name 73 char > limit MySQL 64
                });

                Schema::create('tarif_khusus_santri', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
                    $table->foreignId('pos_keuangan_id')->constrained('pos_keuangan')->cascadeOnDelete();
                    $table->decimal('nominal_diskon', 12, 2)->default(0);
                    $table->decimal('nominal_akhir', 12, 2)->default(0);
                    $table->text('catatan')->nullable();
                    $table->timestamps();

                    $table->unique(['santri_id', 'pos_keuangan_id']);
                });

                Schema::create('tagihan', function (Blueprint $table) {
                    $table->id();
                    $table->string('no_tagihan');
                    $table->foreignId('santri_id')->nullable()->constrained('santri')->nullOnDelete();
                    $table->foreignId('psb_calon_santri_id')->nullable()->constrained('psb_calon_santri')->nullOnDelete();
                    $table->foreignId('pos_keuangan_id')->constrained('pos_keuangan')->cascadeOnDelete();
                    $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->cascadeOnDelete();
                    // Lembaga pemilik tagihan (Q8): santri primer / calon.lembaga / paket=primer. Otorisasi kasir (lembaganya).
                    $table->foreignId('lembaga_id')->nullable()->constrained('lembaga')->nullOnDelete();
                    $table->string('periode')->nullable(); // 'YYYY-MM'
                    $table->string('paket_kode', 20)->nullable(); // penanda kuitansi paket, misal 'MI-MD'; null = tagihan biasa
                    $table->decimal('nominal_total', 12, 2)->default(0);
                    $table->decimal('nominal_terbayar', 12, 2)->default(0);
                    $table->decimal('sisa_tagihan', 12, 2)->default(0);
                    // Tanpa jatuh tempo/denda (Q6 drop).
                    $table->enum('status', ['belum_bayar', 'mencicil', 'lunas', 'dibatalkan'])->default('belum_bayar');
                    $table->timestamps();

                    $table->unique('no_tagihan');
                    // Idempotensi generate bulanan (Q3): 1 santri + 1 pos + 1 periode.
                    $table->unique(['santri_id', 'pos_keuangan_id', 'periode']);
                });

                Schema::create('akun_kas', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('lembaga_id')->nullable()->constrained('lembaga')->nullOnDelete();
                    $table->string('nama_kas');
                    $table->string('kode_kas')->nullable();
                    $table->decimal('saldo', 12, 2)->default(0);
                    $table->timestamps();

                    $table->unique(['lembaga_id', 'kode_kas']);
                });

                Schema::create('pembayaran', function (Blueprint $table) {
                    $table->id();
                    $table->string('no_kuitansi');
                    $table->foreignId('akun_kas_id')->constrained('akun_kas')->cascadeOnDelete();
                    $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete(); // kasir
                    $table->foreignId('santri_id')->nullable()->constrained('santri')->nullOnDelete();
                    $table->foreignId('psb_calon_santri_id')->nullable()->constrained('psb_calon_santri')->nullOnDelete();
                    $table->timestamp('tgl_pembayaran')->nullable();
                    $table->decimal('total_bayar', 12, 2)->default(0);
                    $table->string('metode_pembayaran')->default('tunai'); // ref_metode_pembayaran (dulu enum tunai/transfer; string agar VA/QRIS bisa tambah via kamus)
                    $table->text('catatan')->nullable();
                    // Idempotensi Opsi B (root PRD OFF-07): kirim ulang dengan kunci sama
                    // mengembalikan pembayaran existing, bukan catat dobel.
                    $table->string('client_op_id', 64)->nullable()->unique();
                    $table->timestamps();

                    // Unik global: barikade duplikat no_kuitansi (belt tambahan anti race condition)
                    $table->unique('no_kuitansi');
                });

                Schema::create('pembayaran_detail', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('pembayaran_id')->constrained('pembayaran')->cascadeOnDelete();
                    $table->foreignId('tagihan_id')->constrained('tagihan')->cascadeOnDelete();
                    $table->decimal('nominal_dibayar', 12, 2)->default(0);
                    $table->timestamps();
                });

                Schema::create('jurnal_kas', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('akun_kas_id')->constrained('akun_kas')->cascadeOnDelete();
                    $table->foreignId('pembayaran_id')->nullable()->constrained('pembayaran')->nullOnDelete();
                    $table->date('tgl_transaksi')->nullable();
                    $table->enum('jenis', ['masuk', 'keluar'])->default('masuk');
                    $table->decimal('nominal', 12, 2)->default(0);
                    $table->string('kategori')->nullable(); // ref_kategori_kas
                    $table->text('keterangan')->nullable();
                    $table->timestamps();
                });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jurnal_kas');
        Schema::dropIfExists('pembayaran_detail');
        Schema::dropIfExists('pembayaran');
        Schema::dropIfExists('akun_kas');
        Schema::dropIfExists('tagihan');
        Schema::dropIfExists('tarif_khusus_santri');
        Schema::dropIfExists('tarif_biaya');
        Schema::dropIfExists('pos_keuangan');
    }
};
