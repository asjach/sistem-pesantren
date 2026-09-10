<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Alumni;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Services\SiklusSantriService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// 102 Fase C: HTTP tipis di atas SiklusSantriService (Fase B, jangan diubah).
// Tenant AND ketat per aksi: canAccessLembaga(target) + riwayat aktif santri di target
// (keputusan: aksi per-lembaga, bukan per primer santri — admin sekunder paket sah memproses
// baris lembaganya). Routes di belakang middleware role:super_admin|admin.
class SiklusController extends Controller
{
    use TenantGuard;

    protected SiklusSantriService $siklusService;

    public function __construct(SiklusSantriService $siklusService)
    {
        $this->siklusService = $siklusService;
    }

    /**
     * Gerbang AND per-lembaga: actor boleh akses target + (full/super Admin
     * atau santri punya riwayat aktif di target). Primer santri tidak dipakai.
     */
    protected function authorizeAksiLembaga(Request $request, Santri $santri, int $target): void
    {
        $this->authorizeLembaga($request->user(), $target);
        $auth = $request->user();
        if ($auth->hasRole('super_admin') || $auth->isAdminFull()) {
            return;
        }
        $punya = RiwayatBelajar::where('santri_id', $santri->id)
            ->where('lembaga_id', $target)
            ->where('is_aktif', true)
            ->exists();
        if (! $punya) {
            abort(403, 'Akses ditolak.');
        }
    }

    // POST /api/admin/akademik/naik-kelas — satu batch = 1 lembaga + 1 tahun + 1 tingkat.
    // Per-item partial: gagal satu tidak menggagalkan lainnya.
    public function naikKelasMassal(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validate([
            'lembaga_id' => 'required|exists:lembaga,id',
            'tahun_ajaran_baru_id' => 'required|exists:tahun_ajaran,id',
            'tingkat' => 'required|string',
            'siswa' => 'required|array|min:1',
            'siswa.*.santri_id' => 'required|exists:santri,id',
            'siswa.*.nis' => 'nullable|string',
            'siswa.*.status' => 'required|in:naik,tidak_naik',
        ]);

        $lembagaId = (int) $data['lembaga_id'];
        $tahunBaruId = (int) $data['tahun_ajaran_baru_id'];
        $tingkat = (string) $data['tingkat'];

        $ok = 0;
        $gagal = [];
        foreach ($data['siswa'] as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id']);
                $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                $this->siklusService->prosesKenaikanPerSantri(
                    $santri,
                    $lembagaId,
                    $tahunBaruId,
                    $tingkat,
                    $item['status'],
                    $item['nis'] ?? null
                );
                $ok++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $item['santri_id'] ?? null, 'pesan' => $e->getMessage()];
            }
        }

        return response()->json(['pesan' => 'Proses kenaikan selesai.', 'berhasil' => $ok, 'gagal' => $gagal]);
    }

    // POST /api/admin/riwayat/{riwayat}/pindah-kelas — Body {"kelas_baru_id":6}.
    public function pindahKelas(Request $request, RiwayatBelajar $riwayat): JsonResponse
    {
        $this->authorizeAksiLembaga($request, $riwayat->santri, (int) $riwayat->lembaga_id);

        $data = $request->validate(['kelas_baru_id' => 'required|exists:kelas,id']);

        return response()->json([
            'pesan' => 'Santri berhasil dipindah kelas.',
            'data' => $this->siklusService->pindahKelas($riwayat, (int) $data['kelas_baru_id']),
        ]);
    }

    // POST /api/admin/riwayat/{riwayat}/set-kelas — Body {"kelas_id":6} (penempatan menyusul).
    public function setKelas(Request $request, RiwayatBelajar $riwayat): JsonResponse
    {
        $this->authorizeAksiLembaga($request, $riwayat->santri, (int) $riwayat->lembaga_id);

        $data = $request->validate(['kelas_id' => 'required|exists:kelas,id']);

        return response()->json([
            'pesan' => 'Kelas berhasil ditetapkan.',
            'data' => $this->siklusService->setKelas($riwayat, (int) $data['kelas_id']),
        ]);
    }

    // POST /api/admin/santri/{santri}/berhenti-jenjang — Body {"lembaga_id":3}.
    public function berhentiJenjang(Request $request, Santri $santri): JsonResponse
    {
        $data = $request->validate(['lembaga_id' => 'required|exists:lembaga,id']);

        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $this->siklusService->nonAktifkanRiwayat($santri, (int) $data['lembaga_id']);

        return response()->json(['pesan' => 'Riwayat jenjang dinonaktifkan.', 'data' => $santri->fresh()]);
    }

    // POST /api/admin/santri/{santri}/mutasi — mutasi keluar per lembaga.
    public function mutasiKeluar(Request $request, Santri $santri): JsonResponse
    {
        $data = $request->validate([
            'lembaga_id' => 'required|exists:lembaga,id',
            'kelas_terakhir_id' => 'required|exists:kelas,id',
            'tanggal_mutasi' => 'required|date',
            'alasan_mutasi' => 'required|string|max:50',
            'no_surat' => 'nullable|string|max:50',
            'nama_sekolah_tujuan' => 'nullable|string|max:255',
            'npsn_sekolah_tujuan' => 'nullable|string|max:20',
            'nsm_sekolah_tujuan' => 'nullable|string|max:30',
            'alamat_sekolah_tujuan' => 'nullable|string',
            'keterangan' => 'nullable|string',
        ]);

        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $mutasi = $this->siklusService->prosesMutasiPerLembaga($santri, (int) $data['lembaga_id'], $data);

        return response()->json([
            'pesan' => 'Santri berhasil dimutasi keluar.',
            'data' => $mutasi,
        ]);
    }

    // POST /api/admin/santri/{santri}/lulus — kelulusan per lembaga + baris alumni.
    public function lulus(Request $request, Santri $santri): JsonResponse
    {
        $data = $request->validate([
            'lembaga_id' => 'required|exists:lembaga,id',
            'tahun_ajaran_lulus_id' => 'required|exists:tahun_ajaran,id',
            'tanggal_lulus' => 'required|date',
            'nomor_ijazah' => 'nullable|string',
            'no_surat_ijazah' => 'nullable|string|max:50',
            'kegiatan_setelah_lulus' => 'nullable|string',
            'penyerahan_ijazah' => 'nullable|in:sudah,belum',
            'melanjutkan' => 'nullable|in:ya,tidak',
        ]);

        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $alumni = $this->siklusService->prosesLulusPerLembaga($santri, (int) $data['lembaga_id'], $data);

        return response()->json([
            'pesan' => 'Santri berhasil diproses lulus dan masuk ke data Alumni.',
            'data' => $alumni,
        ]);
    }

    // GET /api/admin/mutasi-keluar — terskop tenant lembaga via scopeTenantScope.
    public function getMutasiKeluar(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $mutasi = MutasiKeluar::tenantScope()
            ->with(['santri', 'lembaga', 'kelasTerakhir'])
            ->when($request->filled('lembaga_id'), fn ($q) => $q->where('lembaga_id', $request->input('lembaga_id')))
            ->latest('id')
            ->paginate($this->perPage($request));

        return response()->json($mutasi);
    }

    // GET /api/admin/alumni — terskop tenant lembaga via scopeTenantScope (kolom lembaga_lulus_id).
    public function getAlumni(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $alumni = Alumni::tenantScope()
            ->with(['santri', 'lembagaLulus', 'tahunAjaranLulus'])
            ->when($request->filled('tahun_ajaran_lulus_id'), fn ($q) => $q->where('tahun_ajaran_lulus_id', $request->input('tahun_ajaran_lulus_id')))
            ->latest('id')
            ->paginate($this->perPage($request));

        return response()->json($alumni);
    }
}
