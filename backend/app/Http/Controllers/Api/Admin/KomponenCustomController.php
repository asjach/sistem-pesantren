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
     * dengan registry frontend `src/components/tipeInput.tsx`.
     */
    public const TIPE_INPUT = [
        'teks', 'teks_rahasia', 'angka', 'nominal', 'tanggal', 'bulan',
        'waktu', 'tanggal_waktu', 'email', 'pencarian', 'telepon', 'url',
    ];

    /**
     * Normalisasi peta setelan: kunci tak dikenal atau nilai tak sah ditolak
     * dengan pesan yang menyebut kuncinya (mis. `setelan.tipeKontrol`).
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