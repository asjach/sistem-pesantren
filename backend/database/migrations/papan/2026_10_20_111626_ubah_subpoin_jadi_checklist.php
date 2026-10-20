<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Ubah subpoin lama (daftar teks) menjadi checklist {teks, selesai}.
     *
     * Poin yang sudah berstatus `sudah` dianggap seluruh subpoinnya selesai
     * supaya gerbang status tetap konsisten setelah migrasi.
     */
    public function up(): void
    {
        DB::connection('papan')
            ->table('papan_butir')
            ->whereNotNull('subpoin')
            ->orderBy('id')
            ->chunkById(100, function ($daftar) {
                foreach ($daftar as $butir) {
                    $data = json_decode((string) $butir->subpoin, true);

                    if (! is_array($data) || $data === []) {
                        continue;
                    }

                    $baru = [];
                    $adaTeks = false;

                    foreach ($data as $item) {
                        if (is_string($item)) {
                            $baru[] = ['teks' => $item, 'selesai' => $butir->status === 'sudah'];
                            $adaTeks = true;

                            continue;
                        }

                        if (is_array($item)) {
                            $baru[] = [
                                'teks' => (string) ($item['teks'] ?? ''),
                                'selesai' => (bool) ($item['selesai'] ?? false),
                            ];
                        }
                    }

                    if ($adaTeks) {
                        DB::connection('papan')
                            ->table('papan_butir')
                            ->where('id', $butir->id)
                            ->update(['subpoin' => json_encode($baru)]);
                    }
                }
            });
    }

    /**
     * Kembalikan checklist menjadi daftar teks (status centang hilang).
     */
    public function down(): void
    {
        DB::connection('papan')
            ->table('papan_butir')
            ->whereNotNull('subpoin')
            ->orderBy('id')
            ->chunkById(100, function ($daftar) {
                foreach ($daftar as $butir) {
                    $data = json_decode((string) $butir->subpoin, true);

                    if (! is_array($data) || $data === []) {
                        continue;
                    }

                    $baru = [];
                    $adaObjek = false;

                    foreach ($data as $item) {
                        if (is_array($item)) {
                            $baru[] = (string) ($item['teks'] ?? '');
                            $adaObjek = true;

                            continue;
                        }

                        $baru[] = (string) $item;
                    }

                    if ($adaObjek) {
                        DB::connection('papan')
                            ->table('papan_butir')
                            ->where('id', $butir->id)
                            ->update(['subpoin' => json_encode($baru)]);
                    }
                }
            });
    }
};
