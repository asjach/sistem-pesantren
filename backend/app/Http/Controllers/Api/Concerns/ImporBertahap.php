<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\ImportSesi;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Alur import bertahap (potongan JSON 1000 baris/panggilan) yang dipakai
 * semua fitur: sesi `import_sesi` milik pengguna, akumulator offset +
 * hitungan, galat ditulis ke CSV sesi, mode `periksa` berjalan kering
 * (tanpa menulis) lalu `eksekusi` menulis per potongan.
 *
 * Kontrak respons tidak berubah per fitur (santri/riwayat/kel CFR):
 * `sesi_id`, `offset`, `total`, `selesai`, `ringkasan`, `galat_baru`,
 * `galat_contoh`, `galat_unduh`.
 *
 * Layanan per-fitur kontrak minimum: `normalisasiBaris(array): array`,
 * `prosesPotongan(array, int, bool): void`, dan properti publik
 * `gagal`, `dibuat`, `diperbarui`. Penghitung tambahan (mis.
 * `riwayat_dibuat`) lewat closure `$tambahSesi`.
 */
trait ImporBertahap
{
    /**
     * POST <prefix>/import-potong — satu potongan baris (maks 1000) dari
     * browser. Panggilan pertama tanpa `sesi_id` membuat sesi (wajib
     * `mode` + `total`); berikutnya wajib `sesi_id` milik sendiri dengan
     * mode sama. Frontend mengirim SEMUA baris berurutan agar nomor galat
     * absolut selaras nomor file (1 = heading).
     */
    protected function jalankanImporSesi(
        Request $request,
        string $tipe,
        object $layanan,
        string $slugGalat = 'import',
        ?Closure $tambahSesi = null,
    ): JsonResponse {
        $data = $request->validated();
        $pengguna = $request->user();

        $this->buangSesiBasi();

        if (! empty($data['sesi_id'])) {
            $sesi = ImportSesi::whereKey($data['sesi_id'])->where('user_id', $pengguna->id)->first();
            if ($sesi === null) {
                return response()->json(['message' => 'Sesi import tidak ditemukan.'], 404);
            }
            if ($sesi->status !== ImportSesi::JALAN) {
                return response()->json(['message' => 'Sesi sudah selesai atau dibatalkan.'], 422);
            }
            if ($sesi->mode !== $data['mode']) {
                return response()->json(['message' => 'Mode potongan berbeda dari sesi.'], 422);
            }
        } else {
            $sesi = ImportSesi::create([
                'user_id' => $pengguna->id,
                'tipe' => $tipe,
                'mode' => $data['mode'],
                'total' => $data['total'],
            ]);
        }

        $kering = $sesi->mode === 'periksa';
        $normal = array_map(fn ($baris) => $layanan->normalisasiBaris((array) $baris), $data['baris']);
        $layanan->prosesPotongan($normal, $sesi->offset + 1, $kering);

        $baru = $layanan->gagal;
        if ($baru !== []) {
            $this->tambahGalatSesi($sesi, $baru);
        }
        $sesi->offset += count($data['baris']);
        $sesi->dibuat += $layanan->dibuat;
        $sesi->diperbarui += $layanan->diperbarui;
        $sesi->gagal += count($baru);
        if ($tambahSesi !== null) {
            $tambahSesi($sesi, $layanan);
        }

        $selesai = $request->boolean('terakhir') || $sesi->offset >= $sesi->total;
        if ($selesai) {
            $sesi->status = ImportSesi::SELESAI;
        }
        $sesi->save();

        return response()->json([
            'sesi_id' => $sesi->id,
            'offset' => $sesi->offset,
            'total' => $sesi->total,
            'selesai' => $selesai,
            'ringkasan' => $sesi->ringkasan(),
            'galat_baru' => count($baru),
            'galat_contoh' => array_slice($sesi->galat_contoh ?? [], 0, 10),
            'galat_unduh' => $selesai && $sesi->gagal > 0,
        ]);
    }

    /** POST <prefix>/import-potong/{sesi}/batal. */
    protected function batalImporSesi(Request $request, ImportSesi $sesi): JsonResponse
    {
        if ($sesi->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Sesi import tidak ditemukan.'], 404);
        }
        $this->hapusBerkasGalat($sesi);
        $sesi->update(['status' => ImportSesi::BATAL]);

        return response()->json(['pesan' => 'Sesi import dibatalkan.']);
    }

    /** GET <prefix>/import-potong/{sesi}/galat — unduh CSV galat sesi sendiri. */
    protected function unduhGalatImpor(Request $request, ImportSesi $sesi, string $namaBerkas = 'galat-import.csv'): BinaryFileResponse
    {
        if ($sesi->user_id !== $request->user()->id || $sesi->galat_file === null) {
            abort(404);
        }
        $path = storage_path('app/'.$sesi->galat_file);
        if (! is_file($path)) {
            abort(404);
        }

        return response()->download($path, $namaBerkas, ['Content-Type' => 'text/csv']);
    }

    /** Tambah galat potongan ke berkas CSV sesi + contoh (maks 200). */
    protected function tambahGalatSesi(ImportSesi $sesi, array $baru): void
    {
        $relatif = $sesi->galat_file ?? "imports/galat-{$sesi->id}.csv";
        $path = storage_path('app/'.$relatif);
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }
        $baruBerkas = ! is_file($path);
        $tulis = fopen($path, 'ab');
        if ($baruBerkas) {
            fputcsv($tulis, ['baris', 'nis_lokal', 'kolom', 'pesan']);
        }
        foreach ($baru as $galat) {
            fputcsv($tulis, [$galat['baris'], $galat['nis_lokal'] ?? '', $galat['kolom'], $galat['pesan']]);
        }
        fclose($tulis);

        $contoh = $sesi->galat_contoh ?? [];
        foreach ($baru as $galat) {
            if (count($contoh) >= 200) {
                break;
            }
            $contoh[] = $galat;
        }
        $sesi->galat_file = $relatif;
        $sesi->galat_contoh = $contoh;
    }

    protected function hapusBerkasGalat(ImportSesi $sesi): void
    {
        if ($sesi->galat_file !== null) {
            $path = storage_path('app/'.$sesi->galat_file);
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }

    /** Bersihkan sesi basi (melewati TTL) beserta berkas galatnya. */
    protected function buangSesiBasi(): void
    {
        ImportSesi::where('created_at', '<', now()->subHours(ImportSesi::TTL_JAM))
            ->chunkById(100, function ($daftar) {
                foreach ($daftar as $sesi) {
                    $this->hapusBerkasGalat($sesi);
                    $sesi->delete();
                }
            });
    }
}
