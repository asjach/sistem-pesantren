<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PsbGelombangStoreRequest;
use App\Http\Requests\Admin\PsbGelombangUpdateRequest;
use App\Http\Requests\Admin\PsbKegiatanStoreRequest;
use App\Http\Requests\Admin\PsbKegiatanUpdateRequest;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKegiatan;
use App\Services\PsbGelombangService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PsbKegiatanController extends Controller
{
    public function __construct(protected PsbGelombangService $gelombang) {}

    /** GET /api/admin/psb/kegiatan (kegiatan se-pesantren: terlihat semua admin). */
    public function index(): JsonResponse
    {
        $rows = PsbKegiatan::with('tahunAjaran:id,nama')
            ->withCount('gelombang')
            ->orderByDesc('id')
            ->get();

        return response()->json(['pesan' => 'Kegiatan PSB dimuat.', 'data' => $rows]);
    }

    /** POST /api/admin/psb/kegiatan */
    public function store(PsbKegiatanStoreRequest $request): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validated();

        $kegiatan = DB::transaction(function () use ($data) {
            if ((bool) ($data['is_aktif'] ?? false)) {
                PsbKegiatan::where('is_aktif', true)->update(['is_aktif' => false]);
            }

            return PsbKegiatan::create([
                'tahun_ajaran_id' => $data['tahun_ajaran_id'],
                'nama' => $data['nama'],
                'is_aktif' => (bool) ($data['is_aktif'] ?? false),
            ]);
        });

        return response()->json(['pesan' => 'Kegiatan PSB dibuat.', 'data' => $kegiatan->fresh('tahunAjaran')], 201);
    }

    /** PUT /api/admin/psb/kegiatan/{kegiatan} */
    public function update(PsbKegiatanUpdateRequest $request, PsbKegiatan $kegiatan): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validated();

        DB::transaction(function () use ($kegiatan, $data) {
            if (! empty($data['is_aktif'])) {
                PsbKegiatan::where('id', '!=', $kegiatan->id)->where('is_aktif', true)->update(['is_aktif' => false]);
            }
            $kegiatan->update(collect($data)->only(['tahun_ajaran_id', 'nama', 'is_aktif'])->filter(fn ($v) => $v !== null)->toArray());
        });

        return response()->json(['pesan' => 'Kegiatan PSB diubah.', 'data' => $kegiatan->fresh('tahunAjaran')]);
    }

    /** DELETE /api/admin/psb/kegiatan/{kegiatan} */
    public function destroy(PsbKegiatan $kegiatan): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $gelombangIds = $kegiatan->gelombang()->pluck('id');
        if (PsbCalonSantri::withTrashed()->whereIn('gelombang_id', $gelombangIds)->exists()) {
            throw ValidationException::withMessages(['kegiatan' => 'Kegiatan sudah memiliki pendaftar; tidak bisa dihapus.']);
        }
        $kegiatan->delete();

        return response()->json(['pesan' => 'Kegiatan PSB dihapus.']);
    }

    /** POST /api/admin/psb/gelombang */
    public function storeGelombang(PsbGelombangStoreRequest $request): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validated();

        $this->gelombang->validasiRentang(
            (int) $data['psb_kegiatan_id'],
            $data['tgl_buka'],
            $data['tgl_tutup'],
        );

        $nomor = (int) PsbGelombang::where('psb_kegiatan_id', $data['psb_kegiatan_id'])->max('nomor') + 1;
        $gelombang = PsbGelombang::create([
            'psb_kegiatan_id' => $data['psb_kegiatan_id'],
            'nomor' => $nomor,
            'nama' => $data['nama'],
            'tgl_buka' => $data['tgl_buka'],
            'tgl_tutup' => $data['tgl_tutup'],
        ]);

        return response()->json(['pesan' => 'Gelombang dibuat.', 'data' => $gelombang], 201);
    }

    /** PUT /api/admin/psb/gelombang/{gelombang} */
    public function updateGelombang(PsbGelombangUpdateRequest $request, PsbGelombang $gelombang): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validated();

        $buka = $data['tgl_buka'] ?? $gelombang->tgl_buka?->toDateString();
        $tutup = $data['tgl_tutup'] ?? $gelombang->tgl_tutup?->toDateString();
        $this->gelombang->validasiRentang((int) $gelombang->psb_kegiatan_id, $buka, $tutup, $gelombang->id);

        $gelombang->update(collect($data)->only(['nama', 'tgl_buka', 'tgl_tutup'])->filter(fn ($v) => $v !== null)->toArray());

        return response()->json(['pesan' => 'Gelombang diubah.', 'data' => $gelombang->fresh()]);
    }

    /** DELETE /api/admin/psb/gelombang/{gelombang} */
    public function destroyGelombang(PsbGelombang $gelombang): JsonResponse
    {
        $this->pastikanAdminPesantren();
        if (PsbCalonSantri::withTrashed()->where('gelombang_id', $gelombang->id)->exists()) {
            throw ValidationException::withMessages(['gelombang' => 'Gelombang sudah memiliki pendaftar; tidak bisa dihapus.']);
        }
        $gelombang->delete();

        return response()->json(['pesan' => 'Gelombang dihapus.']);
    }

    protected function pastikanAdminPesantren(): void
    {
        $u = auth()->user();
        if (! $u->bolehPesantren()) {
            abort(403, 'Kegiatan & gelombang PSB hanya dikelola admin pesantren.');
        }
    }
}
