<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\KeuanganLembaga;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\JenisStoreRequest;
use App\Http\Requests\Admin\JenisUpdateRequest;
use App\Http\Requests\Admin\TarifStoreRequest;
use App\Http\Requests\Admin\TarifUpdateRequest;
use App\Models\JenisTagihan;
use App\Models\Tagihan;
use App\Models\TarifTagihan;
use App\Services\UrutKatalog;
use Illuminate\Http\Request;

/** Keuangan: jenis tagihan dan tarif. */
class JenisTarifController extends Controller
{
    use KeuanganLembaga;
    use TenantGuard;
    use UrutDaftar;

    public function indexJenis(Request $request)
    {
        $actor = $request->user();
        $urut = $this->parseUrut($request, UrutKatalog::peta('keuangan_jenis'));
        $q = JenisTagihan::query();
        $lembagaIds = $this->nilaiFilter($request, 'jenjang');
        $this->authorizeLembagaMany($actor, $lembagaIds);
        if ($lembagaIds !== []) {
            // Global (null) selalu ikut + khusus lembaga yang diminta.
            $q->where(fn ($w) => $w->whereNull('jenjang')->orWhereIn('jenjang', $lembagaIds));
        } elseif (! $actor->bolehPesantren()) {
            $milik = $actor->lembagaIds();
            $q->where(fn ($w) => $w->whereNull('jenjang')->orWhereIn('jenjang', $milik));
        }
        if ($urut === null) {
            $q->orderBy('nama');
        } else {
            $this->terapkanUrut($q, $urut, [['jenis_tagihan.nama', 'naik']]);
        }

        return response()->json($q->get());
    }

    public function storeJenis(JenisStoreRequest $request)
    {
        $actor = $request->user();
        $data = $request->validated();
        if (! empty($data['jenjang'])) {
            $this->authorizeLembaga($actor, $data['jenjang']);
        } elseif (! $actor->bolehSuperAdmin()) {
            abort(403, 'Jenis global hanya boleh dibuat super_admin.');
        }

        return response()->json(JenisTagihan::create(['nama' => $data['nama'], 'tipe' => $data['tipe'] ?? 'non_bulanan', 'jenjang' => $data['jenjang'] ?? null, 'is_active' => true]), 201);
    }

    public function updateJenis(JenisUpdateRequest $request, JenisTagihan $jenis)
    {
        $actor = $request->user();
        $data = $request->validated();
        $jenjangBaru = array_key_exists('jenjang', $data) ? $data['jenjang'] : $jenis->jenjang;
        if (! empty($jenjangBaru)) {
            $this->authorizeLembaga($actor, $jenjangBaru);
        } elseif (! $actor->bolehSuperAdmin()) {
            abort(403, 'Jenis global hanya boleh diubah super_admin.');
        }
        $jenis->update($data);

        return response()->json($jenis);
    }

    public function indexTarif(Request $request)
    {
        $urut = $this->parseUrut($request, UrutKatalog::peta('keuangan_tarif'));
        $q = TarifTagihan::with('jenis');
        // Filter global (boleh banyak nilai): `jenjang[]` dan `tahun_ajaran[]`.
        $this->applyFilter($q, $request, 'jenjang', 'jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tahun_ajaran');
        if ($urut === null) {
            $q->orderBy('jenjang')->orderBy('tahun_ajaran');
        } else {
            $q->select('tarif_tagihan.*')
                ->leftJoin('jenis_tagihan', 'jenis_tagihan.id', '=', 'tarif_tagihan.jenis_id');
            $this->terapkanUrut($q, $urut, [['tarif_tagihan.jenjang', 'naik'], ['tarif_tagihan.tahun_ajaran', 'naik']]);
        }

        return response()->json($q->get());
    }

    public function storeTarif(TarifStoreRequest $request)
    {
        $data = $request->validated();
        $this->canLembaga($request->user(), $data['jenjang']) || abort(403);

        return response()->json(TarifTagihan::create($data + ['is_active' => true]), 201);
    }

    public function updateTarif(TarifUpdateRequest $request, TarifTagihan $tarif)
    {
        $data = $request->validated();
        $this->canLembaga($request->user(), $tarif->jenjang) || abort(403);
        $tarif->update($data);

        return response()->json($tarif);
    }

    public function destroyTarif(Request $request, TarifTagihan $tarif)
    {
        $this->canLembaga($request->user(), $tarif->jenjang) || abort(403);

        // Tarif yang sudah dipakai generate tagihan tidak boleh dihapus
        // (kombinasi inilah yang disalin ke baris tagihan).
        $dipakai = Tagihan::where('jenjang', $tarif->jenjang)
            ->where('tahun_ajaran', $tarif->tahun_ajaran)
            ->where('jenis_id', $tarif->jenis_id)
            ->exists();
        if ($dipakai) {
            abort(422, 'Tarif tidak bisa dihapus karena sudah dipakai pada tagihan. Nonaktifkan saja bila tidak ingin dipakai lagi.');
        }

        $tarif->delete();

        return response()->json(['pesan' => 'Tarif dihapus.']);
    }
}
