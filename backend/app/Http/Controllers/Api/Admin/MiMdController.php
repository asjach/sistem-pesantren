<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MiMdDaftarkanMdRequest;
use App\Http\Requests\Admin\MiMdHapusMdRequest;
use App\Http\Requests\Admin\MiMdSamakanKelasRequest;
use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\PenerimaanService;
use App\Services\SiklusSantriService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
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

        $lembagaDipilih = $this->nilaiFilter($request, 'jenjang');
        $this->authorizeLembagaMany($request->user(), $lembagaDipilih);
        if (! $this->bolehPasangan($request, $miId, $mdId)) {
            return response()->json([
                'mi_only' => [], 'md_semua' => [], 'beda_kelas' => [],
                'lembaga' => ['mi_id' => $miId, 'md_id' => $mdId],
            ]);
        }

        $lembagaIds = array_values(array_intersect(
            $lembagaDipilih === [] ? [$miId, $mdId] : $lembagaDipilih,
            [$miId, $mdId]
        ));
        $sideMi = in_array($miId, $lembagaIds, true);
        $sideMd = in_array($mdId, $lembagaIds, true);
        if (! $sideMi && ! $sideMd) {
            return response()->json([
                'lembaga' => ['mi_id' => $miId, 'md_id' => $mdId],
                'tahun_ajaran' => null,
                'mi_only' => [], 'md_semua' => [], 'beda_kelas' => [],
            ]);
        }

        $tahunIds = $this->nilaiFilter($request, 'tahun_ajaran');
        if ($tahunIds === []) {
            $default = TahunAjaran::aktif($miId)?->nama ?? TahunAjaran::aktif($mdId)?->nama;
            $tahunIds = $default === null ? [] : [$default];
        }
        $semesterIds = $this->nilaiFilter($request, 'semester');
        $tingkatIds = $this->nilaiFilter($request, 'tingkat');
        $kelasIds = array_map('intval', $this->nilaiFilter($request, 'kelas_id'));
        $filterRiwayat = function ($query) use ($lembagaIds, $tahunIds, $semesterIds, $tingkatIds, $kelasIds) {
            $query->whereIn('jenjang', $lembagaIds);
            if ($tahunIds !== []) {
                $query->whereIn('tahun_ajaran', $tahunIds);
            }
            if ($semesterIds !== []) {
                $query->whereIn('semester', $semesterIds);
            }
            if ($tingkatIds !== []) {
                $query->whereIn('tingkat', $tingkatIds);
            }
            if ($kelasIds !== []) {
                $query->whereIn('kelas_id', $kelasIds);
            }
        };

        $adaFilterLain = $semesterIds !== [] || $tingkatIds !== [] || $kelasIds !== [];
        $anggotaQuery = LembagaSantri::whereIn('jenjang', $lembagaIds)
            ->where('is_active_lembaga', LembagaSantri::YA);
        if ($tahunIds !== []) {
            $anggotaQuery->where(function ($query) use ($tahunIds, $adaFilterLain, $filterRiwayat) {
                if (! $adaFilterLain) {
                    $query->whereIn('tahaj_masuk', $tahunIds);
                }
                $query->orWhereHas('santri.riwayatBelajar', $filterRiwayat);
            });
        } elseif ($adaFilterLain) {
            $anggotaQuery->whereHas('santri.riwayatBelajar', $filterRiwayat);
        }
        $anggota = $anggotaQuery
            ->with(['santri:id,nama_lengkap,jk'])
            ->get()
            ->groupBy('santri_id');

        $riwayat = RiwayatBelajar::whereIn('santri_id', $anggota->keys()->all())
            ->whereIn('jenjang', $lembagaIds)
            ->when($tahunIds !== [], fn ($query) => $query->whereIn('tahun_ajaran', $tahunIds))
            ->when($semesterIds !== [], fn ($query) => $query->whereIn('semester', $semesterIds))
            ->when($tingkatIds !== [], fn ($query) => $query->whereIn('tingkat', $tingkatIds))
            ->when($kelasIds !== [], fn ($query) => $query->whereIn('kelas_id', $kelasIds))
            ->with('kelas:id,nama_kelas')
            ->orderBy('semester')->orderBy('id')
            ->get()
            ->groupBy('santri_id');

        $kelasAktif = function (int $santriId, string $lembagaId) use ($riwayat): ?string {
            $rows = $riwayat->get($santriId);
            if ($rows === null) {
                return null;
            }

            return $rows->where('jenjang', $lembagaId)->last()?->kelas?->nama_kelas;
        };

        $miOnly = [];
        $mdSemua = [];
        $bedaKelas = [];

        foreach ($anggota as $santriId => $baris) {
            $santri = $baris->first()->santri;
            if (! $santri) {
                continue;
            }
            $santriId = (int) $santriId;
            $punyaMiAktif = $baris->contains('jenjang', $miId);
            $punyaMdAktif = $baris->contains('jenjang', $mdId);
            $punyaMi = $sideMi && $punyaMiAktif;
            $punyaMd = $sideMd && $punyaMdAktif;
            $nisMi = $baris->firstWhere('jenjang', $miId)?->nis_lokal;
            $nisMd = $baris->firstWhere('jenjang', $mdId)?->nis_lokal;

            if ($punyaMd) {
                $mdSemua[] = [
                    'santri_id' => $santriId,
                    'nama' => $santri->nama_lengkap,
                    'jk' => $santri->jk,
                    'nis_md' => $nisMd,
                    'kelas_md' => $kelasAktif($santriId, $mdId),
                    'juga_mi' => $punyaMiAktif,
                ];
            }
            if ($punyaMi && ! $punyaMd) {
                $miOnly[] = [
                    'santri_id' => $santriId,
                    'nama' => $santri->nama_lengkap,
                    'jk' => $santri->jk,
                    'nis_mi' => $nisMi,
                    'kelas_mi' => $kelasAktif($santriId, $miId),
                ];
            }
            if ($punyaMi && $punyaMd) {
                $kelasMi = $kelasAktif($santriId, $miId);
                $kelasMd = $kelasAktif($santriId, $mdId);
                $norm = fn (?string $n) => mb_strtolower(trim((string) ($n ?? '')));
                $kelasMiNormal = $norm($kelasMi);
                $kelasMdNormal = $norm($kelasMd);
                if ($kelasMiNormal !== '' && $kelasMdNormal !== '' && $kelasMiNormal !== $kelasMdNormal) {
                    $bedaKelas[] = [
                        'santri_id' => $santriId,
                        'nama' => $santri->nama_lengkap,
                        'jk' => $santri->jk,
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
            'tahun_ajaran' => count($tahunIds) === 1 ? $tahunIds[0] : ($tahunIds ?: null),
            'mi_only' => $miOnly,
            'md_semua' => $mdSemua,
            'beda_kelas' => $bedaKelas,
        ]);
    }

    /** POST /api/admin/mi-md/samakan-kelas — sejajarkan kelas by-nama dua arah. */
    public function samakanKelas(MiMdSamakanKelasRequest $request): JsonResponse
    {
        $pasangan = $this->resolvePasangan();
        if (! $pasangan) {
            return response()->json(['pesan' => 'Lembaga MI/MD tidak ditemukan.'], 422);
        }
        ['mi_id' => $miId, 'md_id' => $mdId] = $pasangan;

        $data = $request->validated();

        $auth = $request->user();
        $berhasil = 0;
        $gagal = [];

        $items = $data['items'];
        $sepihak = $auth->canAccessLembaga($miId) || $auth->canAccessLembaga($mdId);
        $berpasangan = Lembaga::pasanganJenjang($miId) === $mdId;

        // Preload batch: satu query per jenis, bukan ~10 query per item.
        $idSantri = array_values(array_unique(array_map(
            static fn (array $i): int => (int) $i['santri_id'],
            $items,
        )));
        $petaSantri = Santri::whereIn('id', $idSantri)->get()->keyBy('id');

        $anggotaAktif = [];
        foreach (LembagaSantri::whereIn('santri_id', $idSantri)
            ->whereIn('jenjang', [$miId, $mdId])
            ->where('is_active_lembaga', LembagaSantri::YA)
            ->get(['santri_id', 'jenjang']) as $baris) {
            $anggotaAktif[(int) $baris->santri_id][(string) $baris->jenjang] = true;
        }

        /** @var array<int, array<string, RiwayatBelajar>> $riwayatAktif id terbesar menang. */
        $riwayatAktif = [];
        foreach (RiwayatBelajar::whereIn('santri_id', $idSantri)
            ->whereIn('jenjang', [$miId, $mdId])
            ->where('is_active_riwayat', RiwayatBelajar::YA)
            ->with('kelas:id,nama_kelas')
            ->orderBy('id')
            ->get() as $riwayat) {
            $riwayatAktif[(int) $riwayat->santri_id][(string) $riwayat->jenjang] = $riwayat;
        }

        // Kelas senama di sisi tujuan jarang berubah dalam satu request; memo per kunci.
        /** @var array<string, Kelas|null> $cacheKelasTujuan */
        $cacheKelasTujuan = [];
        $cariKelasTujuan = function (string $jenjang, string $tahun, string $nama) use (&$cacheKelasTujuan): ?Kelas {
            $kunci = $jenjang.'|'.$tahun.'|'.$nama;
            if (! array_key_exists($kunci, $cacheKelasTujuan)) {
                $cacheKelasTujuan[$kunci] = Kelas::where('jenjang', $jenjang)
                    ->where('tahun_ajaran', $tahun)
                    ->whereRaw('LOWER(nama_kelas) = ?', [$nama])
                    ->first();
            }

            return $cacheKelasTujuan[$kunci];
        };

        foreach ($items as $item) {
            try {
                $idSantriItem = (int) $item['santri_id'];
                $santri = $petaSantri->get($idSantriItem)
                    ?? throw (new ModelNotFoundException)->setModel(Santri::class, [$idSantriItem]);
                $keMi = $item['arah'] === 'ke_mi';
                $acuanId = $keMi ? $mdId : $miId;
                $tujuanId = $keMi ? $miId : $mdId;

                // Samakan kelas: pemegang salah satu pihak pasangan boleh
                // (cerminan daftarkan/hapus-md; tanpa pivot silang).
                if (! $sepihak || ! $berpasangan) {
                    throw ValidationException::withMessages([
                        'santri_id' => 'Akses ditolak.',
                    ]);
                }

                if (count($anggotaAktif[$idSantriItem] ?? []) !== 2) {
                    throw ValidationException::withMessages([
                        'santri_id' => 'Santri harus aktif di MI dan MD.',
                    ]);
                }

                $acuan = $riwayatAktif[$idSantriItem][$acuanId] ?? null;
                $namaAcuan = $acuan?->kelas?->nama_kelas;
                if ($namaAcuan === null || trim($namaAcuan) === '') {
                    throw ValidationException::withMessages([
                        'santri_id' => 'Sisi acuan belum ditempatkan di kelas.',
                    ]);
                }

                $tujuan = $riwayatAktif[$idSantriItem][$tujuanId] ?? null;
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
                    $kelasTujuan = $cariKelasTujuan($tujuanId, $taTujuan, $namaNormal);
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
                $kelasTujuan = $cariKelasTujuan($tujuanId, (string) $tujuan->tahun_ajaran, $namaNormal);
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
    public function daftarkanMd(MiMdDaftarkanMdRequest $request): JsonResponse
    {
        $pasangan = $this->resolvePasangan();
        if (! $pasangan) {
            return response()->json(['pesan' => 'Lembaga MI/MD tidak ditemukan.'], 422);
        }
        ['mi_id' => $miId, 'md_id' => $mdId] = $pasangan;

        $data = $request->validated();

        $auth = $request->user();
        $berhasil = 0;
        $gagal = [];

        $items = $data['items'];
        $sepihak = $auth->canAccessLembaga($miId) || $auth->canAccessLembaga($mdId);
        $berpasangan = Lembaga::pasanganJenjang($miId) === $mdId;

        // Preload batch: peta santri + keanggotaan MI aktif sekali untuk semua item.
        $idSantri = array_values(array_unique(array_map(
            static fn (array $i): int => (int) $i['santri_id'],
            $items,
        )));
        $petaSantri = Santri::whereIn('id', $idSantri)->get()->keyBy('id');

        $anggotaMi = [];
        foreach (LembagaSantri::whereIn('santri_id', $idSantri)
            ->where('jenjang', $miId)
            ->where('is_active_lembaga', LembagaSantri::YA)
            ->orderBy('id')
            ->get(['santri_id', 'nis_lokal']) as $baris) {
            $anggotaMi[(int) $baris->santri_id] ??= $baris;
        }

        foreach ($items as $item) {
            try {
                $idSantriItem = (int) $item['santri_id'];
                $santri = $petaSantri->get($idSantriItem)
                    ?? throw (new ModelNotFoundException)->setModel(Santri::class, [$idSantriItem]);

                // Tulis ke MD; baca MI via pengecualian pasangan. Pemegang salah
                // satu pihak boleh menulis ke pasangannya (tanpa pivot silang).
                if (! $sepihak || ! $berpasangan) {
                    throw ValidationException::withMessages(['santri_id' => 'Akses ditolak.']);
                }

                $mi = $anggotaMi[$idSantriItem] ?? null;
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
    public function hapusMd(MiMdHapusMdRequest $request): JsonResponse
    {
        $pasangan = $this->resolvePasangan();
        if (! $pasangan) {
            return response()->json(['pesan' => 'Lembaga MI/MD tidak ditemukan.'], 422);
        }
        ['mi_id' => $miId, 'md_id' => $mdId] = $pasangan;

        $data = $request->validated();

        $auth = $request->user();
        $berhasil = 0;
        $gagal = [];

        $items = $data['items'];
        $sepihak = $auth->canAccessLembaga($miId) || $auth->canAccessLembaga($mdId);
        $berpasangan = Lembaga::pasanganJenjang($miId) === $mdId;

        // Preload batch: peta santri, keanggotaan MI/MD, dan arsip MD sekali untuk semua item.
        $idSantri = array_values(array_unique(array_map(
            static fn (array $i): int => (int) $i['santri_id'],
            $items,
        )));
        $petaSantri = Santri::whereIn('id', $idSantri)->get()->keyBy('id');

        $miAktif = [];
        $mdAda = [];
        foreach (LembagaSantri::whereIn('santri_id', $idSantri)
            ->whereIn('jenjang', [$miId, $mdId])
            ->get(['santri_id', 'jenjang', 'is_active_lembaga']) as $baris) {
            $sid = (int) $baris->santri_id;
            if ((string) $baris->jenjang === $miId && $baris->is_active_lembaga === LembagaSantri::YA) {
                $miAktif[$sid] = true;
            }
            if ((string) $baris->jenjang === $mdId) {
                $mdAda[$sid] = true;
            }
        }
        $adaAlumni = Alumni::whereIn('santri_id', $idSantri)->where('lembaga_lulus', $mdId)->pluck('santri_id')->flip()->all();
        $adaMutasi = MutasiKeluar::whereIn('santri_id', $idSantri)->where('jenjang', $mdId)->pluck('santri_id')->flip()->all();

        foreach ($items as $item) {
            try {
                $idSantriItem = (int) $item['santri_id'];
                $santri = $petaSantri->get($idSantriItem)
                    ?? throw (new ModelNotFoundException)->setModel(Santri::class, [$idSantriItem]);

                // Hapus jejak MD: pemegang salah satu pihak pasangan boleh
                // (cerminan daftarkan-md; tanpa pivot silang).
                if (! $sepihak || ! $berpasangan) {
                    throw ValidationException::withMessages(['santri_id' => 'Akses ditolak.']);
                }

                // Hanya yang masih MI aktif (kembali menjadi MI Only).
                if (! isset($miAktif[$idSantriItem])) {
                    throw ValidationException::withMessages(['santri_id' => 'Bukan anggota aktif MI.']);
                }
                if (! isset($mdAda[$idSantriItem])) {
                    throw ValidationException::withMessages(['santri_id' => 'Tidak ada keanggotaan MD.']);
                }

                // Arsip resmi ada → lewat halaman mutasi, bukan X.
                if (isset($adaAlumni[$idSantriItem]) || isset($adaMutasi[$idSantriItem])) {
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
