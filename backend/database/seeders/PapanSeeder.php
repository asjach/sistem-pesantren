<?php

namespace Database\Seeders;

use App\Models\Papan\PapanButir;
use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Models\Papan\PapanRiwayat;
use App\Services\PapanService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Bangun ulang papan perkembangan proyek dari cetak biru per aplikasi.
 *
 * Seeder ini BERSIFAT DESTRUKTIF: seluruh modul, sub-modul, poin, dan riwayat
 * di koneksi `papan` dihapus lalu dibuat ulang dari
 * `database/seeders/papan/blueprint.php`. Status workflow dikembalikan ke Draf.
 *
 *     backup dulu: cp database/papan.sqlite /tmp/papan.sqlite.bak
 *     php artisan migrate --path=database/migrations/papan --database=papan
 *     php artisan db:seed --class=PapanSeeder
 */
class PapanSeeder extends Seeder
{
    /** Status yang dipakai berulang; diurutkan sesuai tampilan papan. */
    private const URUTAN_STATUS = ['backlog', 'todo', 'in_progress', 'for_review', 'done'];

    public function run(): void
    {
        $koneksi = DB::connection('papan');
        /** @var array<string, array<int, array<string, mixed>>> $blueprint */
        $blueprint = require database_path('seeders/papan/blueprint.php');

        $koneksi->transaction(function () use ($blueprint) {
            PapanRiwayat::query()->delete();
            PapanButir::query()->delete();
            PapanItem::query()->delete();
            PapanModul::query()->delete();

            foreach (PapanService::APLIKASI as $aplikasi => $namaAplikasi) {
                foreach ($blueprint[$aplikasi] ?? [] as $urutanModul => $modul) {
                    $barisModul = PapanModul::create([
                        'aplikasi' => $aplikasi,
                        'kode' => $modul['kode'],
                        'nama' => $modul['nama'],
                        'urutan' => $urutanModul + 1,
                    ]);

                    foreach ($modul['sub'] as $urutanItem => $sub) {
                        $item = PapanItem::create([
                            'modul_id' => $barisModul->id,
                            'kode' => $sub['kode'],
                            'nama' => $sub['nama'],
                            'urutan' => $urutanItem + 1,
                        ]);

                        $urutanButir = 0;

                        foreach (self::URUTAN_STATUS as $status) {
                            foreach ($sub['butir'][$status] ?? [] as $poin) {
                                [$deskripsi, $subpoin] = $poin;

                                PapanButir::create([
                                    'item_id' => $item->id,
                                    'status' => $status,
                                    'deskripsi' => $deskripsi,
                                    'subpoin' => array_map(
                                        fn (string $teks): array => [
                                            'teks' => $teks,
                                            'selesai' => $status === 'done',
                                        ],
                                        $subpoin,
                                    ),
                                    'urutan' => ++$urutanButir,
                                ]);
                            }
                        }
                    }
                }
            }

            DB::connection('papan')->table('papan_pengaturan')
                ->where('kunci', 'like', 'workflow_aktif:%')
                ->delete();

            DB::connection('papan')->table('papan_pengaturan')->updateOrInsert(
                ['kunci' => 'workflow_aktif'],
                ['nilai' => '0'],
            );

            $this->command?->info('Workflow direset ke Draf.');
        });

        $jumlah = 'Aplikasi: '.count(PapanService::APLIKASI).
            ' | Modul: '.PapanModul::count().
            ' | Sub-modul: '.PapanItem::count().
            ' | Butir: '.PapanButir::count();

        $this->command?->info("PapanSeeder: {$jumlah} (koneksi {$koneksi->getName()}).");
    }
}
