<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Lembaga;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKegiatan;
use App\Models\TahunAjaran;
use App\Services\PsbGelombangService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PsbKegiatanController extends Controller
{
    use TenantGuard;

    public function __construct(protected PsbGelombangService $gelombang) {}

    /** GET /api/admin/psb/kegiatan */
    public function index(): JsonResponse
    {
        $rows = PsbKegiatan::with('tahunAjaran:id,nama')
            ->withCount('gelombang')
            ->orderByDesc('id')
            ->get();

        return response()->json(['pesan' => 'Kegiatan PSB dimuat.', 'data' => $rows]);
    }

    /** POST /api/admin/psb/kegiatan */
    public function store(Request $request): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validate([
            'tahun_ajaran_id' => ['required', 'integer', 'exists:tahun_ajaran,id', 'unique:psb_kegiatan,tahun_ajaran_id'],
            'nama' => ['required', 'string', 'max:100'],
            'is_aktif' => ['nullable', 'boolean'],
        ], [
            'tahun_ajaran_id.unique' => 'Tahun ajaran ini sudah memiliki kegiatan PSB.',
        ]);
        // TA acuan periode harus milik lembaga operasional (bukan root pesantren).
        $indukTa = Lembaga::where('id', TahunAjaran::where('id', $data['tahun_ajaran_id'])->value('lembaga_id'))->value('parent_id');
        if ($indukTa === null) {
            throw ValidationException::withMessages(['tahun_ajaran_id' => 'Tahun ajaran harus milik lembaga operasional (bukan induk pesantren).']);
        }

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
    public function update(Request $request, PsbKegiatan $kegiatan): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validate([
            'tahun_ajaran_id' => ['sometimes', 'integer', 'exists:tahun_ajaran,id', Rule::unique('psb_kegiatan', 'tahun_ajaran_id')->ignore($kegiatan->id)],
            'nama' => ['sometimes', 'string', 'max:100'],
            'is_aktif' => ['nullable', 'boolean'],
        ], [
            'tahun_ajaran_id.unique' => 'Tahun ajaran ini sudah memiliki kegiatan PSB.',
        ]);
        if (array_key_exists('tahun_ajaran_id', $data)) {
            $indukTa = Lembaga::where('id', TahunAjaran::where('id', $data['tahun_ajaran_id'])->value('lembaga_id'))->value('parent_id');
            if ($indukTa === null) {
                throw ValidationException::withMessages(['tahun_ajaran_id' => 'Tahun ajaran harus milik lembaga operasional (bukan induk pesantren).']);
            }
        }

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
    public function storeGelombang(Request $request): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validate([
            'psb_kegiatan_id' => ['required', 'integer', 'exists:psb_kegiatan,id'],
            'nama' => ['required', 'string', 'max:100'],
            'tgl_buka' => ['required', 'date'],
            'tgl_tutup' => ['required', 'date'],
        ]);

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
    public function updateGelombang(Request $request, PsbGelombang $gelombang): JsonResponse
    {
        $this->pastikanAdminPesantren();
        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:100'],
            'tgl_buka' => ['sometimes', 'date'],
            'tgl_tutup' => ['sometimes', 'date'],
        ]);

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
