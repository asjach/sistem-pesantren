<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Setelan komponen yang tadinya bercampur di `toolbar_preset` dipindahkan ke
 * `komponen_custom` (tabel sendiri, satu baris per komponen).
 *
 * Yang dipindah hanya(setelan milik KOMPONEN — kunci `filter.<htmlFor>`):
 *  - `lebar`: lebar total kotak (`filter.<id>`), lebar label terkunci
 *    (`filter.<id>.label`), lebar kontrol terkunci (`filter.<id>.kontrol`),
 *    penanda sisi yang mengembang (`filter.<id>.expand`), penanda label
 *    transparan (`filter.<id>.labeltransparan`).
 *  - `tinggi`: tinggi kotak (`filter.<id>`).
 *  - `nilai_default`: nilai awal combobox (`filter.<id>`).
 *
 * Yang TETAP di `toolbar_preset`: `visibilitas`, `urutan`, `align` (memang
 * milik tabel), serta kunci `lebar` non-filter (`urut`, `kolom`).
 *
 * Sufiks diubah ke camelCase agar sama dengan kunci di frontend
 * (`ukuranKombo.ts`): `.label` → lebarLabel, `.kontrol` → lebarKontrol,
 * `.expand` → expandLabel, `.labeltransparan` → labelTransparan.
 */
return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('toolbar_preset')->get(['id', 'table_key', 'lebar', 'tinggi', 'nilai_default']);
        $disimpan = [];

        foreach ($rows as $row) {
            $lebar = $this->bacaJson($row->lebar);
            $tinggi = $this->bacaJson($row->tinggi);
            $nilaiDefault = $this->bacaJson($row->nilai_default);

            // Peta komponen → setelan (kunci frontend).
            $perKomponen = [];
            $sisaLebar = [];

            foreach ($lebar as $kunci => $nilai) {
                [$dasar, $sufiks] = self::pecahKunci((string) $kunci);
                if ($dasar === null) {
                    $sisaLebar[$kunci] = $nilai; // bukan komponen (mis. `urut`)

                    continue;
                }
                $nama = match ($sufiks) {
                    'label' => 'lebarLabel',
                    'kontrol' => 'lebarKontrol',
                    'expand' => 'expandLabel',
                    'labeltransparan' => 'labelTransparan',
                    default => 'lebar',
                };
                $perKomponen[$dasar][$nama] = $nama === 'expandLabel' || $nama === 'labelTransparan'
                    ? ((int) $nilai === 1)
                    : (int) $nilai;
            }

            $tinggiPerKomponen = [];
            foreach ($tinggi as $kunci => $nilai) {
                [$dasar] = self::pecahKunci((string) $kunci);
                if ($dasar === null) {
                    continue;
                }
                $tinggiPerKomponen[$dasar] = (int) $nilai;
            }

            $defaultPerKomponen = [];
            foreach ($nilaiDefault as $kunci => $nilai) {
                [$dasar] = self::pecahKunci((string) $kunci);
                if ($dasar === null) {
                    continue;
                }
                $teks = trim((string) $nilai);
                if ($teks !== '') {
                    $defaultPerKomponen[$dasar] = $teks;
                }
            }

            foreach ($perKomponen as $komponen => $setelan) {
                $disimpan[$row->table_key][$komponen] = array_merge(
                    $setelan,
                    isset($tinggiPerKomponen[$komponen]) ? ['tinggi' => $tinggiPerKomponen[$komponen]] : [],
                    isset($defaultPerKomponen[$komponen]) ? ['nilaiDefault' => $defaultPerKomponen[$komponen]] : [],
                );
            }

            // Bersihkan peta lama: komponen dihapus, sisanya (urut/kolom) disimpan.
            $baru = [
                'lebar' => $sisaLebar === [] ? null : json_encode($sisaLebar),
                'tinggi' => null,
                'nilai_default' => null,
            ];
            DB::table('toolbar_preset')->where('id', $row->id)->update($baru);
        }

        foreach ($disimpan as $tableKey => $perKomponen) {
            foreach ($perKomponen as $komponen => $setelan) {
                $ada = DB::table('komponen_custom')
                    ->where('table_key', $tableKey)
                    ->where('komponen', $komponen)
                    ->first();
                $payload = [
                    'setelan' => json_encode($setelan),
                    'updated_at' => now(),
                ];
                if ($ada === null) {
                    DB::table('komponen_custom')->insert([
                        'table_key' => $tableKey,
                        'komponen' => $komponen,
                        'setelan' => $payload['setelan'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    continue;
                }
                // Setelan yang sudah ada di `komponen_custom` (mis. tipe input)
                // tak ditimpa Whole oleh nilai lama.
                $gabungan = array_merge($this->bacaJson($ada->setelan) ?? [], $setelan);
                DB::table('komponen_custom')
                    ->where('id', $ada->id)
                    ->update(['setelan' => json_encode($gabungan), 'updated_at' => now()]);
            }
        }
    }

    /**
     * Reverse the migrations.
     *
     * Setelan komponen yang sudah dipindah TAK dikembalikan ke `toolbar_preset`
     * (formatnya berbeda: peta bersufiks vs baris per komponen) — mengembalikan
     * justru memunculkan dua sumber kebenaran. cukup `rollback` tabel
     * `komponen_custom`.
     */
    public function down(): void
    {
        //
    }

    /** @return array<string, mixed> */
    private function bacaJson(?string $nilai): array
    {
        if ($nilai === null || $nilai === '') {
            return [];
        }
        $hasil = json_decode($nilai, true);

        return is_array($hasil) ? $hasil : [];
    }

    /**
     * Pecah `filter.<htmlFor>[.sufiks]` → [htmlFor, sufiks]; null bila bukan
     * kunci komponen.
     *
     * @return array{0: ?string, 1: ?string}
     */
    private static function pecahKunci(string $kunci): array
    {
        if (preg_match('/^filter\.([a-z0-9_]{1,60})(\.(?:label|kontrol|expand|labeltransparan))?$/', $kunci, $m) !== 1) {
            return [null, null];
        }

        return [$m[1], ($m[2] ?? '') === '' ? null : substr($m[2], 1)];
    }
};
