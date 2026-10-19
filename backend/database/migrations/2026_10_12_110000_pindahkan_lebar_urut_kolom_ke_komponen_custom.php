<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Memindahkan sisa peta `toolbar_preset.lebar` versi LAMA — kunci `urut` /
 * `kolom` (dan sufiksnya) yang dulu menyimpan ukuran komponen "Urutkan" &
 * "Kolom" — ke `komponen_custom`.
 *
 * Kunci barunya mengikuti `htmlFor` komponen yang sebenarnya di frontend:
 * `select_urut_<table_key>` dan `select_preset_kolom_<table_key>`, jadi ukuran
 * yang sudah diatur pengguna tetap berlaku (dan ikut ke perangkat lain).
 *
 * Sesudahnya `toolbar_preset.lebar` dibersihkan: isinya hanya milik tabel
 * (dan `lebar` pun sudah tak dipakai frontend — urutan & perataan saja yang
 * tersisa). Kunci `urut`/`kolom` juga ditolak lagi di
 * `ToolbarPresetController` supaya data mati tak terlahir kembali.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('toolbar_preset')->whereNotNull('lebar')->get(['table_key', 'lebar']) as $row) {
            $lebar = json_decode((string) $row->lebar, true);
            if (! is_array($lebar)) {
                continue;
            }

            $sisa = [];
            foreach ($lebar as $kunci => $nilai) {
                if (! preg_match('/^(urut|kolom)(\.(label|kontrol|expand|labeltransparan))?$/', (string) $kunci, $m)) {
                    $sisa[$kunci] = $nilai;

                    continue;
                }
                $komponen = $m[1] === 'urut'
                    ? "select_urut_{$row->table_key}"
                    : "select_preset_kolom_{$row->table_key}";
                $nama = match ($m[2] ?? '') {
                    '.label' => 'lebarLabel',
                    '.kontrol' => 'lebarKontrol',
                    '.expand' => 'expandLabel',
                    '.labeltransparan' => 'labelTransparan',
                    default => 'lebar',
                };
                $nilaiSetelan = ($nama === 'expandLabel' || $nama === 'labelTransparan')
                    ? ((int) $nilai === 1)
                    : (int) $nilai;

                $ada = DB::table('komponen_custom')
                    ->where('table_key', $row->table_key)
                    ->where('komponen', $komponen)
                    ->first();
                $gabungan = array_merge(
                    $ada === null ? [] : (json_decode((string) $ada->setelan, true) ?: []),
                    [$nama => $nilaiSetelan],
                );

                if ($ada === null) {
                    DB::table('komponen_custom')->insert([
                        'table_key' => $row->table_key,
                        'komponen' => $komponen,
                        'setelan' => json_encode($gabungan),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    continue;
                }
                DB::table('komponen_custom')
                    ->where('id', $ada->id)
                    ->update(['setelan' => json_encode($gabungan), 'updated_at' => now()]);
            }

            DB::table('toolbar_preset')
                ->where('table_key', $row->table_key)
                ->update(['lebar' => $sisa === [] ? null : json_encode($sisa), 'updated_at' => now()]);
        }
    }

    /**
     * Reverse the migrations.
     *
     * Tidak dikembalikan ke `toolbar_preset`: penulisan ke sana sudah ditutup
     * (kunci `urut`/`kolom` ditolak), jadi menghidupkan kembali jalur yang
     * tak terpakai. Setelan tetap bisa dikembalikan ke bawaan lewat `hapus`
     * endpoint `komponen-custom`.
     */
    public function down(): void
    {

    }
};
