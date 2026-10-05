<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dispensasi disederhanakan: satu paket (nama + TA + daftar santri penerima)
 * dengan N aturan per jenis tagihan (`dispensasi_aturan`, tiap baris punya
 * tipe/nilai sendiri). Kolom sasaran & nilai tunggal di `dispensasi`
 * (`jenis_id`, `paket`, `tingkat`, `kelas_id`, `tipe`, `nilai`, `prioritas`)
 * dihapus setelah dikonversi 1:1 menjadi baris aturan
 * (`jenis_id` null = berlaku semua jenis). Urutan akumulatif = urut id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispensasi_aturan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispensasi_id')->constrained('dispensasi')->cascadeOnDelete();
            $table->foreignId('jenis_id')->nullable()->constrained('jenis_tagihan')->nullOnDelete();
            $table->enum('tipe', ['persen', 'nominal', 'bebas'])->default('nominal');
            $table->unsignedInteger('nilai')->default(0);
            $table->timestamps();

            $table->unique(['dispensasi_id', 'jenis_id']);
            $table->index('jenis_id');
        });

        $sekarang = now()->toDateTimeString();
        DB::table('dispensasi')->orderBy('id')->chunkById(200, function ($baris) use ($sekarang) {
            $sisip = [];
            foreach ($baris as $d) {
                $sisip[] = [
                    'dispensasi_id' => (int) $d->id,
                    'jenis_id' => $d->jenis_id === null ? null : (int) $d->jenis_id,
                    'tipe' => in_array($d->tipe, ['persen', 'nominal', 'bebas'], true) ? $d->tipe : 'nominal',
                    'nilai' => max(0, (int) $d->nilai),
                    'created_at' => $sekarang,
                    'updated_at' => $sekarang,
                ];
            }
            if ($sisip !== []) {
                DB::table('dispensasi_aturan')->insert($sisip);
            }
        });

        Schema::table('dispensasi', function (Blueprint $table) {
            $table->dropForeign(['jenis_id']);
            $table->dropColumn(['jenis_id', 'paket', 'tingkat', 'kelas_id', 'tipe', 'nilai', 'prioritas']);
        });
    }

    public function down(): void
    {
        Schema::table('dispensasi', function (Blueprint $table) {
            $table->foreignId('jenis_id')->nullable()->after('tahun_ajaran')->constrained('jenis_tagihan')->nullOnDelete();
            $table->json('paket')->nullable()->after('jenis_id');
            $table->json('tingkat')->nullable()->after('paket');
            $table->json('kelas_id')->nullable()->after('tingkat');
            $table->enum('tipe', ['persen', 'nominal', 'bebas'])->default('nominal')->after('kelas_id');
            $table->unsignedInteger('nilai')->default(0)->after('tipe');
            $table->integer('prioritas')->default(0)->after('nilai');
        });

        // Kembalikan perkiraan: aturan pertama tiap dispensasi.
        $pulih = [];
        DB::table('dispensasi_aturan')->orderBy('id')->chunkById(500, function ($baris) use (&$pulih) {
            foreach ($baris as $a) {
                $id = (int) $a->dispensasi_id;
                if (isset($pulih[$id])) {
                    continue;
                }
                $pulih[$id] = true;
                DB::table('dispensasi')->where('id', $id)->update([
                    'jenis_id' => $a->jenis_id,
                    'tipe' => $a->tipe,
                    'nilai' => $a->nilai,
                ]);
            }
        });

        Schema::dropIfExists('dispensasi_aturan');
    }
};
