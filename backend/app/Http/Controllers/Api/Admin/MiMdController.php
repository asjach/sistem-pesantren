<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\PenerimaanService;
use App\Services\SiklusSantriService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Halaman MI-MD: 3 tabel berdampingan (MI saja, MD semua, beda kelas).
 *
 * PENGECUALIAN TENANT SADAR: di endpoint ini, akses ke salah satu (MI/MD)
 * membuka kedua sisi. Hanya berlaku di sini — endpoint lain tetap normal.
 */
class MiMdController extends Controller
{
    use TenantGuard;

    public function __construct(
        private SiklusSantriService $siklusService,
        private PenerimaanService $penerimaanService,
    ) {}

    /** @return array{mi_id: string, md_id: string}|null */
    protected function resolvePasangan(): ?array
    {
        $miId = Lembaga::whereKey('MI')->value('jenjang');
        $mdId = Lembaga::whereKey('MD')->value('jenjang');

        return $miId && $mdId ? ['mi_id' => $miId, 'md_id' => $mdId] : null;
    }

    /** Pengecualian pasangan: boleh MI atau MD → kedua sisi terbuka di halaman ini. */
    protected function bolehPasangan(Request $request, string $miId, string $mdId): bool
    {
        $auth = $request->user();

        return $auth->canAccessLembaga($miId) || $auth->canAccessLembaga($mdId);
    }

    /** GET /api/admin/mi-md — tiga dataset halaman MI-MD. */
    public function index(Request $request): JsonResponse
    {
        $pasangan = $this->resolvePasangan();
        if (! $pasangan) {
            return response()->json(['pesan' => 'Lembaga MI/MD tidak ditemukan.'], 422);
        }
        ['mi_id' => $miId, 'md_id' => $mdId] = $pasangan;

        if (! $this->bolehPasangan($request, $miId, $mdId)) {
            return response()->json([
                'mi_only' => [], 'md_semua' => [], 'beda_kelas' => [],
                'lembaga' => ['mi_id' => $miId, 'md_id' => $mdId],
            ]);
        }

        // Keanggotaan aktif per sisi + santri + riwayat aktif terbaru + kelas.
        $anggota = LembagaSantri::whereIn('jenjang', [$miId, $mdId])
            ->where('is_active_lembaga', LembagaSantri::YA)
            ->with([
                'santri:id,nama_lengkap',
                'santri.riwayatAktif' => fn ($q) => $q->with('kelas:id,nama_kelas')->latest('id'),
            ])
            ->get()
            ->groupBy('santri_id');

        $kelasAktif = function ($santri, string $lembagaId): ?string {
            $riwayat = $santri->riwayatAktif
                ->where('jenjang', $lembagaId)
                ->sortByDesc('id')
                ->first();

            return $riwayat?->kelas?->nama_kelas;
        };

        $miOnly = [];
        $mdSemua = [];
        $bedaKelas = [];

        foreach ($anggota as $santriId => $baris) {
            $santri = $baris->first()->santri;
            if (! $santri) {
                continue;
            }
            $punyaMi = $baris->contains('jenjang', $miId);
            $punyaMd = $baris->contains('jenjang', $mdId);
            $nisMi = $baris->firstWhere('jenjang', $miId)?->nis_lokal;
            $nisMd = $baris->firstWhere('jenjang', $mdId)?->nis_lokal;

            if ($punyaMd) {
                $mdSemua[] = [
                    'santri_id' => (int) $santriId,
                    'nama' => $santri->nama_lengkap,
                    'nis_md' => $nisMd,
                    'kelas_md' => $kelasAktif($santri, $mdId),
                    'juga_mi' => $punyaMi,
                ];
            }
            if ($punyaMi && ! $punyaMd) {
                $miOnly[] = [
                    'santri_id' => (int) $santriId,
                    'nama' => $santri->nama_lengkap,
                    'nis_mi' => $nisMi,
                    'kelas_mi' => $kelasAktif($santri, $miId),
                ];
            }
            if ($punyaMi && $punyaMd) {
                $kelasMi = $kelasAktif($santri, $miId);
                $kelasMd = $kelasAktif($santri, $mdId);
                // Banding by-NAMA (id jelas beda antar lembaga); null = ''.
                $norm = fn (?string $n) => mb_strtolower(trim((string) ($n ?? '')));
                if ($norm($kelasMi) !== $norm($kelasMd)) {
                    $bedaKelas[] = [
                        'santri_id' => (int) $santriId,
                        'nama' => $santri->nama_lengkap,
                        'kelas_mi' => $kelasMi,
                        'kelas_md' => $kelasMd,
                    ];
                }
            }
        }

        $urutNama = fn (array $a, array $b) => strcmp((string) $a['nama'], (string) $b['nama']);
        usort($miOnly, $urutNama);
        usort($mdSemua, $urutNama);
        usort($bedaKelas, $urutNama);

        return response()->json([
            'lembaga' => ['mi_id' => $miId, 'md_id' => $mdId],
            'mi_only' => $miOnly,
            'md_semua' => $mdSemua,
            'beda_kelas' => $bedaKelas,
        ]);
    }

    /** POST /api/admin/mi-md/samakan-kelas — sejajarkan kelas by-nama dua arah. */
    public function samakanKelas(Request $request): JsonResponse
    {
        $pasangan = $this->resolvePasangan();
        if (! $pasangan) {
            return response()->json(['pesan' => 'Lembaga MI/MD tidak ditemukan.'], 422);
        }
        ['mi_id' => $miId, 'md_id' => $mdId] = $pasangan;

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.santri_id' => ['required', 'integer', 'exists:santri,id'],
            'items.*.arah' => ['required', 'in:ke_mi,ke_md'],
        ]);

        $auth = $request->user();
        $berhasil = 0;
        $gagal = [];

        foreach ($data['items'] as $item) {
            try {
                $santri = Santri::findOrFail((int) $item['santri_id']);
                $keMi = $item['arah'] === 'ke_mi';
                $acuanId = $keMi ? $mdId : $miId;
                $tujuanId = $keMi ? $miId : $mdId;

                // Samakan kelas: pemegang salah satu pihak pasangan boleh
                // (cerminan daftarkan/hapus-md; tanpa pivot silang).
                $sepihak = $auth->canAccessLembaga($miId) || $auth->canAccessLembaga($mdId);
                if (! $sepihak || Lembaga::pasanganJenjang($miId) !== $mdId) {
                    throw ValidationException::withMessages([
                        'santri_id' => 'Akses ditolak.',
                    ]);
                }

                $acuan = RiwayatBelajar::where('santri_id', $santri->id)
                    ->where('jenjang', $acuanId)
                    ->where('is_active_riwayat', RiwayatBelajar::YA)
                    ->with('kelas:id,nama_kelas')
                    ->latest('id')
                    ->first();
                $namaAcuan = $acuan?->kelas?->nama_kelas;
                if ($namaAcuan === null || trim($namaAcuan) === '') {
                    throw ValidationException::withMessages([
                        'santri_id' => 'Sisi acuan belum ditempatkan di kelas.',
                    ]);
                }

                $tujuan = RiwayatBelajar::where('santri_id', $santri->id)
                    ->where('jenjang', $tujuanId)
                    ->where('is_active_riwayat', RiwayatBelajar::YA)
                    ->latest('id')
                    ->first();
                if (! $tujuan) {
                    // Sisi tujuan belum punya riwayat: buatkan (kelas senama
                    // acuan), bukan gagal. TA mengikuti acuan bila berlaku di
                    // sisi tujuan, else TA aktif sisi tujuan.
                    $taTujuan = TahunAjaran::efektif($tujuanId)->contains('nama', $acuan->tahun_ajaran)
                        ? $acuan->tahun_ajaran
                        : TahunAjaran::aktif($tujuanId)?->nama;
                    if ($taTujuan === null) {
                        throw ValidationException::withMessages([
                            'santri_id' => 'Tidak ada tahun ajaran aktif di sisi tujuan.',
                        ]);
                    }
                    $namaNormal = mb_strtolower(preg_replace('/\s+/u', ' ', trim($namaAcuan)) ?? $namaAcuan);
                    $kelasTujuan = Kelas::where('jenjang', $tujuanId)
                        ->where('tahun_ajaran', $taTujuan)
                        ->whereRaw('LOWER(nama_kelas) = ?', [$namaNormal])
                        ->first();
                    if (! $kelasTujuan) {
                        throw ValidationException::withMessages([
                            'santri_id' => "Kelas \"{$namaAcuan}\" tidak ada di sisi tujuan.",
                        ]);
                    }
                    $this->penerimaanService->terima($santri, $tujuanId, $taTujuan, [
                        'kelas_id' => $kelasTujuan->id,
                        'tgl_masuk' => now()->format('Y-m-d'),
                    ]);
                    $berhasil++;

                    continue;
                }

                // Kelas senama di lembaga + TA berjalan sisi tujuan.
                $namaNormal = mb_strtolower(preg_replace('/\s+/u', ' ', trim($namaAcuan)) ?? $namaAcuan);
                $kelasTujuan = Kelas::where('jenjang', $tujuanId)
                    ->where('tahun_ajaran', $tujuan->tahun_ajaran)
                    ->whereRaw('LOWER(nama_kelas) = ?', [$namaNormal])
                    ->first();
                if (! $kelasTujuan) {
                    throw ValidationException::withMessages([
                        'santri_id' => "Kelas \"{$namaAcuan}\" tidak ada di sisi tujuan.",
                    ]);
                }

                $this->siklusService->pindahKelas($tujuan, (int) $kelasTujuan->id);
                $berhasil++;
            } catch (ValidationException $e) {
                $gagal[] = [
                    'santri_id' => (int) ($item['santri_id'] ?? 0),
                    'pesan' => collect($e->errors())->flatten()->first(),
                ];
            }
        }

        return response()->json([
            'pesan' => "Penyamaan selesai: {$berhasil} berhasil, ".count($gagal).' gagal.',
            'berhasil' => $berhasil,
            'gagal' => $gagal,
        ]);
    }

    /** POST /api/admin/mi-md/daftarkan-md — input santri MI Only ke keanggotaan MD. */
    public function daftarkanMd(Request $request): JsonResponse
    {
        $pasangan = $this->resolvePasangan();
        if (! $pasangan) {
            return response()->json(['pesan' => 'Lembaga MI/MD tidak ditemukan.'], 422);
        }
        ['mi_id' => $miId, 'md_id' => $mdId] = $pasangan;

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.santri_id' => ['required', 'integer', 'exists:santri,id'],
        ]);

        $auth = $request->user();
        $berhasil = 0;
        $gagal = [];

        foreach ($data['items'] as $item) {
            try {
                $santri = Santri::findOrFail((int) $item['santri_id']);

                // Tulis ke MD; baca MI via pengecualian pasangan. Pemegang salah
                // satu pihak boleh menulis ke pasangannya (tanpa pivot silang).
                $punyaMi = $auth->canAccessLembaga($miId);
                $punyaMd = $auth->canAccessLembaga($mdId);
                $sepihak = $punyaMi || $punyaMd;
                $berpasangan = Lembaga::pasanganJenjang($miId) === $mdId;
                if (! $sepihak || ! $berpasangan) {
                    throw ValidationException::withMessages(['santri_id' => 'Akses ditolak.']);
                }

                $mi = LembagaSantri::where('santri_id', $santri->id)
                    ->where('jenjang', $miId)
                    ->where('is_active_lembaga', LembagaSantri::YA)
                    ->first();
                if (! $mi) {
                    throw ValidationException::withMessages(['santri_id' => 'Bukan anggota aktif MI.']);
                }

                // NIS mewarisi MI (kebijakan satu nomor); tgl_masuk hari ini.
                $this->penerimaanService->pastikanKeanggotaan($santri, $mdId, [
                    'nis_lokal' => $mi->nis_lokal,
                    'tgl_masuk' => now()->format('Y-m-d'),
                ]);
                $berhasil++;
            } catch (ValidationException $e) {
                $gagal[] = [
                    'santri_id' => (int) ($item['santri_id'] ?? 0),
                    'pesan' => collect($e->errors())->flatten()->first(),
                ];
            }
        }

        return response()->json([
            'pesan' => "Pendaftaran ke MD selesai: {$berhasil} berhasil, ".count($gagal).' gagal.',
            'berhasil' => $berhasil,
            'gagal' => $gagal,
        ]);
    }

    /** POST /api/admin/mi-md/hapus-md — hapus FISIK jejak MD (anggota + riwayat).
     *  Halaman ini khusus tambah/hapus tanpa histori; pengarsipan ranah mutasi.
     *  Ditolak bila sudah ada arsip alumni/mutasi MD (pakai halaman mutasi). */
    public function hapusMd(Request $request): JsonResponse
    {
        $pasangan = $this->resolvePasangan();
        if (! $pasangan) {
            return response()->json(['pesan' => 'Lembaga MI/MD tidak ditemukan.'], 422);
        }
        ['mi_id' => $miId, 'md_id' => $mdId] = $pasangan;

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.santri_id' => ['required', 'integer', 'exists:santri,id'],
        ]);

        $auth = $request->user();
        $berhasil = 0;
        $gagal = [];

        foreach ($data['items'] as $item) {
            try {
                $santri = Santri::findOrFail((int) $item['santri_id']);

                // Hapus jejak MD: pemegang salah satu pihak pasangan boleh
                // (cerminan daftarkan-md; tanpa pivot silang).
                $sepihak = $auth->canAccessLembaga($miId) || $auth->canAccessLembaga($mdId);
                if (! $sepihak || Lembaga::pasanganJenjang($miId) !== $mdId) {
                    throw ValidationException::withMessages(['santri_id' => 'Akses ditolak.']);
                }

                // Hanya yang masih MI aktif (kembali menjadi MI Only).
                $miAktif = LembagaSantri::where('santri_id', $santri->id)
                    ->where('jenjang', $miId)
                    ->where('is_active_lembaga', LembagaSantri::YA)
                    ->exists();
                if (! $miAktif) {
                    throw ValidationException::withMessages(['santri_id' => 'Bukan anggota aktif MI.']);
                }
                if (! LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $mdId)->exists()) {
                    throw ValidationException::withMessages(['santri_id' => 'Tidak ada keanggotaan MD.']);
                }

                // Arsip resmi ada → lewat halaman mutasi, bukan X.
                $adaArsip = $santri->alumni()->where('lembaga_lulus', $mdId)->exists()
                    || $santri->mutasiKeluar()->where('jenjang', $mdId)->exists();
                if ($adaArsip) {
                    throw ValidationException::withMessages(['santri_id' => 'Sudah ada arsip MD — hapus via mutasi.']);
                }

                DB::transaction(function () use ($santri, $mdId) {
                    RiwayatBelajar::where('santri_id', $santri->id)->where('jenjang', $mdId)->delete();
                    LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $mdId)->delete();
                    $santri->hitungUlangStatusGlobal();
                });
                $berhasil++;
            } catch (ValidationException $e) {
                $gagal[] = [
                    'santri_id' => (int) ($item['santri_id'] ?? 0),
                    'pesan' => collect($e->errors())->flatten()->first(),
                ];
            }
        }

        return response()->json([
            'pesan' => "Hapus dari MD selesai: {$berhasil} berhasil, ".count($gagal).' gagal.',
            'berhasil' => $berhasil,
            'gagal' => $gagal,
        ]);
    }
}
