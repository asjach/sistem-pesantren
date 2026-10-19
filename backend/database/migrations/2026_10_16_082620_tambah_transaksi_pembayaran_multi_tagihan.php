<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pembayaran multi-tagihan per transaksi (header–detail).
 *
 * - Baru `transaksi_pembayaran`: satu baris = satu kwitansi (nomor, total,
 *   metode/kas/penerima, status, catatan). Total = jumlah seluruh barisnya.
 * - `pembayaran` menjadi baris detail: tambah `transaksi_id`; kolom header
 *   (`metode`, `kas`, `no_kwitansi`, `diterima_oleh`, `catatan`) pindah ke
 *   transaksi (di-backfill 1 header per baris lama, lalu kolom lama dihapus).
 *
 * Semantik: batal = per transaksi (seluruh baris ikut batal agar kwitansi
 * utuh); hapus = per baris (koreksi) dengan total header dihitung ulang, dan
 * header tanpa baris ikut terhapus.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaksi_pembayaran', function (Blueprint $table) {
            $table->id();
            $table->string('no_kwitansi')->unique();
            $table->unsignedBigInteger('total');
            $table->enum('metode', ['tunai', 'transfer'])->default('tunai');
            $table->enum('kas', ['tunai_tu', 'bank_lembaga', 'bank_pesantren'])->default('tunai_tu');
            $table->foreignId('diterima_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['aktif', 'batal'])->default('aktif');
            $table->string('catatan')->nullable();
            $table->timestamps();
        });

        Schema::table('pembayaran', function (Blueprint $table) {
            $table->foreignId('transaksi_id')->nullable()->after('tagihan_id')
                ->constrained('transaksi_pembayaran');
        });

        DB::table('pembayaran')->orderBy('id')->chunk(500, function ($baris) {
            foreach ($baris as $b) {
                $no = $b->no_kwitansi ?? strtoupper(bin2hex(random_bytes(5)));
                $id = DB::table('transaksi_pembayaran')->insertGetId([
                    'no_kwitansi' => $no,
                    'total' => $b->jumlah,
                    'metode' => $b->metode,
                    'kas' => $b->kas,
                    'diterima_oleh' => $b->diterima_oleh,
                    'status' => $b->status,
                    'catatan' => $b->catatan,
                    'created_at' => $b->created_at,
                    'updated_at' => $b->updated_at,
                ]);
                DB::table('pembayaran')->where('id', $b->id)->update(['transaksi_id' => $id]);
            }
        });

        Schema::table('pembayaran', function (Blueprint $table) {

            $table->dropUnique(['no_kwitansi']);
            $table->dropForeign(['diterima_oleh']);
        });
        Schema::table('pembayaran', function (Blueprint $table) {

            $table->dropColumn(['metode', 'kas', 'no_kwitansi', 'diterima_oleh', 'catatan']);
        });
    }

    public function down(): void
    {
        Schema::table('pembayaran', function (Blueprint $table) {
            $table->enum('metode', ['tunai', 'transfer'])->default('tunai');
            $table->enum('kas', ['tunai_tu', 'bank_lembaga', 'bank_pesantren'])->default('tunai_tu');
            $table->string('no_kwitansi')->nullable()->unique();
            $table->foreignId('diterima_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->string('catatan')->nullable();
        });

        $dilihat = [];
        DB::table('pembayaran')->orderBy('id')->chunk(500, function ($baris) use (&$dilihat) {
            foreach ($baris as $b) {
                if ($b->transaksi_id === null) {
                    continue;
                }
                if (in_array($b->transaksi_id, $dilihat, true)) {
                    continue;
                }
                $dilihat[] = $b->transaksi_id;
                $trx = DB::table('transaksi_pembayaran')->where('id', $b->transaksi_id)->first();
                if ($trx === null) {
                    continue;
                }
                DB::table('pembayaran')->where('id', $b->id)->update([
                    'metode' => $trx->metode,
                    'kas' => $trx->kas,
                    'no_kwitansi' => $trx->no_kwitansi,
                    'diterima_oleh' => $trx->diterima_oleh,
                    'catatan' => $trx->catatan,
                ]);
            }
        });

        Schema::table('pembayaran', function (Blueprint $table) {
            $table->dropForeign(['transaksi_id']);
            $table->dropColumn('transaksi_id');
        });
        Schema::dropIfExists('transaksi_pembayaran');
    }
};
