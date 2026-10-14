<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PengaturanGlobalSimpanRequest;
use App\Models\PengaturanGlobal;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * Standar tampilan GLOBAL (key-value) untuk semua pengguna — diatur
 * super_admin, dibaca bebas agar semua peramban merender sama.
 *
 * Nilai di sini adalah LAPISAN BAWAH: pengguna tetap boleh menimpanya di
 * perangkatnya sendiri, jadi tabel ini tidak mengunci preferensi siapa pun.
 */
class PengaturanGlobalController extends Controller
{
    /**
     * Kunci yang boleh disimpan + batasnya. WAJIB selaras dengan
     * `KUNCI_GLOBAL` di `src/components/GridPrefs.tsx`.
     *
     * Sengaja sempit: hanya setelan yang bermakna sebagai standar bersama.
     * Setelan yang mengikuti ukuran layar (lebar sidebar, mode navigasi)
     * TIDAK masuk sini karena memaksanya sama membuat salah satu perangkat
     * tidak nyaman.
     */
    public const KUNCI = [
        'tinggi_baris' => ['min' => 20, 'maks' => 200],
        'tinggi_header' => ['min' => 20, 'maks' => 120],
        // Jumlah baris per halaman: HARUS salah satu opsi PER_PAGE_OPTIONS di
        // frontend (10/50/100/500, 0 = semua). Karena itu dijaga sebagai DAFTAR
        // nilai sah, bukan rentang min-max.
        'baris_per_halaman' => ['pilihan' => [0, 10, 50, 100, 500]],
    ];

    /** GET /api/admin/pengaturan-global — peta kunci → nilai. */
    public function index(): JsonResponse
    {
        $peta = [];
        foreach (PengaturanGlobal::all(['kunci', 'nilai']) as $row) {
            $peta[$row->kunci] = $row->nilai;
        }

        return response()->json([
            'pesan' => 'Pengaturan global dimuat.',
            'data' => ['peta' => $peta],
        ]);
    }

    /** PUT /api/admin/pengaturan-global — upsert satu kunci. */
    public function simpan(PengaturanGlobalSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();
        $kunci = $data['kunci'];

        if (! array_key_exists($kunci, self::KUNCI)) {
            throw ValidationException::withMessages([
                'kunci' => "Setelan global \"{$kunci}\" tidak dikenal.",
            ]);
        }

        $row = PengaturanGlobal::firstOrNew(['kunci' => $kunci]);
        $row->nilai = $this->normalisasi($kunci, $data['nilai'] ?? null);
        $row->diubah_oleh = $request->user()->id;
        $row->save();

        return response()->json([
            'pesan' => 'Pengaturan global disimpan.',
            'data' => ['kunci' => $row->kunci, 'nilai' => $row->nilai],
        ]);
    }

    /** DELETE /api/admin/pengaturan-global?kunci=tinggi_baris → hapus standar. */
    public function hapus(): JsonResponse
    {
        $kunci = (string) request()->query('kunci', '');
        if (! array_key_exists($kunci, self::KUNCI)) {
            throw ValidationException::withMessages([
                'kunci' => "Setelan global \"{$kunci}\" tidak dikenal.",
            ]);
        }

        PengaturanGlobal::where('kunci', $kunci)->delete();

        return response()->json(['pesan' => 'Standar global dihapus (kembali ke bawaan).']);
    }

    /**
     * Normalisasi nilai: `null` = hapus standar (kembali ke bawaan kode),
     * selain itu dijepit ke rentang kunci tersebut.
     *
     * @throws ValidationException
     */
    private function normalisasi(string $kunci, mixed $nilai): ?int
    {
        if ($nilai === null || $nilai === '') {
            return null;
        }

        if (! is_numeric($nilai)) {
            throw ValidationException::withMessages([
                'nilai' => 'Nilai harus angka atau kosong (kembali ke bawaan).',
            ]);
        }

        $batas = self::KUNCI[$kunci];
        $angka = (int) round((float) $nilai);

        // Dua bentuk batas: DAFTAR nilai sah (pilihan) atau rentang angka.
        if (isset($batas['pilihan'])) {
            if (! in_array($angka, $batas['pilihan'], true)) {
                throw ValidationException::withMessages([
                    'nilai' => "{$kunci} harus salah satu: ".implode(', ', $batas['pilihan']).'.',
                ]);
            }

            return $angka;
        }

        if ($angka < $batas['min'] || $angka > $batas['maks']) {
            throw ValidationException::withMessages([
                'nilai' => "{$kunci} harus {$batas['min']}–{$batas['maks']}.",
            ]);
        }

        return $angka;
    }
}
