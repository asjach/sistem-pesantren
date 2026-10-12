<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\KomponenCustomHapusRequest;
use App\Http\Requests\Admin\KomponenCustomIndexRequest;
use App\Http\Requests\Admin\KomponenCustomSimpanRequest;
use App\Models\KomponenCustom;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * Setelan komponen CUSTOM (LabeledCombobox, LabeledTextInput, dst) — satu
 * baris per komponen, kunci `table_key` + `komponen` (htmlFor). Terpisah dari
 * `toolbar_preset` karena setelan ini milik komponen, bukan milik tabel: satu
 * komponen yang sama di luar tabel (dialog/form) tetap punya setelannya.
 *
 * Baca & tulis terbuka untuk semua pengguna terautentikasi: setelannya
 * diatur langsung dari popover klik-kanan komponen (tipe input, dll).
 */
class KomponenCustomController extends Controller
{
    /**
     * Kunci setelan yang dikenal + validasinya. Daftar tipe input diselaraskan
     * dengan registry frontend `src/components/tipeInput.tsx`; kunci ukuran
     * dengan `ukuranKombo.ts`.
     */
    public const TIPE_INPUT = [
        'teks', 'teks_rahasia', 'angka', 'nominal', 'tanggal', 'bulan',
        'waktu', 'tanggal_waktu', 'email', 'pencarian', 'telepon', 'url',
    ];

    /**
     * Rentang ukuran kotak komponen (px) — WAJIB sama dengan popover
     * pengaturan (`ukuranKombo.ts`): tinggi 20–120, lebar total 80–1200
     * (di bawah 80px label + kontrol tak terbaca), lebar label 40–400,
     * lebar kontrol 40–1200.
     */
    public const BATAS_PX = [
        'tinggi' => [20, 120],
        'lebar' => [80, 1200],
        'lebarLabel' => [40, 400],
        'lebarKontrol' => [40, 1200],
    ];

    /**
     * Normalisasi peta setelan: kunci tak dikenal atau nilai tak sah ditolak
     * dengan pesan yang menyebut kuncinya (mis. `setelan.lebar`).
     *
     * Semua setelan milik komponen ini AWALNYA bercampur di `toolbar_preset`
     * (lebar/tinggi/nilai_default + sufiks `.label`/`.kontrol`/`.expand`/
     * `.labeltransparan`) atau di store perangkat; sekarang dikumpulkan di
     * sini supaya menambah setelan cukup menambah aturan validasi.
     *
     * @throws ValidationException
     */
    private static function normalisasiSetelan(array $setelan): array
    {
        $hasil = [];
        foreach ($setelan as $kunci => $nilai) {
            $kunci = (string) $kunci;

            if ($kunci === 'tipeKontrol') {
                $tipe = trim((string) $nilai);
                if (! in_array($tipe, self::TIPE_INPUT, true)) {
                    throw ValidationException::withMessages([
                        'setelan.tipeKontrol' => "Tipe input \"{$tipe}\" tidak dikenal.",
                    ]);
                }
                $hasil[$kunci] = $tipe;

                continue;
            }

            if ($kunci === 'nilaiDefault') {
                $teks = trim((string) $nilai);
                if ($teks === '') {
                    continue;
                }
                $hasil[$kunci] = mb_substr($teks, 0, 100);

                continue;
            }

            if ($kunci === 'expandLabel' || $kunci === 'labelTransparan') {
                if (! is_bool($nilai)) {
                    throw ValidationException::withMessages([
                        "setelan.{$kunci}" => "Penanda \"{$kunci}\" harus true atau false.",
                    ]);
                }
                $hasil[$kunci] = $nilai;

                continue;
            }

            if (isset(self::BATAS_PX[$kunci])) {
                [$min, $maks] = self::BATAS_PX[$kunci];
                $px = (int) $nilai;
                if ($px < $min || $px > $maks) {
                    throw ValidationException::withMessages([
                        "setelan.{$kunci}" => "{$kunci} harus {$min}–{$maks}px.",
                    ]);
                }
                $hasil[$kunci] = $px;

                continue;
            }

            throw ValidationException::withMessages([
                'setelan' => "Kunci setelan \"{$kunci}\" tidak dikenal.",
            ]);
        }

        return $hasil;
    }

    /**
     * GET /api/admin/komponen-custom[?table_key=santri]
     *
     * Tanpa `table_key` semua baris dikembalikan (muatan kecil: hanya
     * komponen yang benar-benar disetel). Peta = `table_key|komponen` →
     * setelan, supaya klien bisa melakukan cache satu kali untuk seluruh
     * tabel sekaligus.
     */
    public function index(KomponenCustomIndexRequest $request): JsonResponse
    {
        $data = $request->validated();

        $query = KomponenCustom::query();
        if (array_key_exists('table_key', $data)) {
            $query->where('table_key', $data['table_key']);
        }
        $baris = $query->get(['table_key', 'komponen', 'setelan']);

        $peta = [];
        foreach ($baris as $row) {
            $peta[$row->table_key.'|'.$row->komponen] = $row->setelan ?? [];
        }

        return response()->json([
            'pesan' => 'Setelan komponen dimuat.',
            'data' => ['peta' => $peta],
        ]);
    }

    /**
     * PUT /api/admin/komponen-custom — upsert satu komponen. `setelan` dikirim
     * LENGKAP untuk komponen itu (bukan digabung), jadi komponen yang tak ada
     * di payload kembali ke bawaan.
     */
    public function simpan(KomponenCustomSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();
        $tableKey = $data['table_key'] ?? '';

        $setelan = self::normalisasiSetelan($data['setelan']);
        if ($setelan === []) {
            throw ValidationException::withMessages([
                'setelan' => 'Kirim minimal satu setelan.',
            ]);
        }

        $row = KomponenCustom::firstOrNew([
            'table_key' => $tableKey,
            'komponen' => $data['komponen'],
        ]);
        $row->setelan = $setelan;
        $row->dibuat_oleh = $request->user()->id;
        $row->save();

        return response()->json(['pesan' => 'Setelan komponen disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/komponen-custom?table_key=&komponen= → kembali bawaan. */
    public function hapus(KomponenCustomHapusRequest $request): JsonResponse
    {
        $data = $request->validated();

        KomponenCustom::where('table_key', $data['table_key'] ?? '')
            ->where('komponen', $data['komponen'])
            ->delete();

        return response()->json(['pesan' => 'Setelan komponen dikembalikan ke bawaan.']);
    }
}
