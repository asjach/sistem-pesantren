<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GrupCustomStoreRequest;
use App\Http\Requests\Admin\GrupCustomUpdateRequest;
use App\Models\GrupSantriCustom;
use App\Models\Santri;
use App\Models\TahunAjaran;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Keuangan: grup santri custom — kelompok bentukan manual (mis. peserta
 * ekskul) yang dipakai opsi "Custom" pada dialog Buat Tagihan. Grup
 * terikat lembaga melalui `jenjang` dan izin `keuangan.*` di route.
 */
class GrupCustomController extends Controller
{
    use TenantGuard;

    private function authorizeGrup(GrupSantriCustom $grup): void
    {
        abort_unless(GrupSantriCustom::tenantScope()->whereKey($grup->id)->exists(), 403, 'Akses ditolak.');
    }

    private function muat(GrupSantriCustom $grup): GrupSantriCustom
    {
        return $grup->load(['santri' => fn ($s) => $s->tenantScope()->select('santri.id', 'nama_lengkap', 'jk')]);
    }

    public function indexGrup(Request $request)
    {
        $this->selectedLembaga($request, $request->user());
        $daftar = GrupSantriCustom::tenantScope()->with(['santri' => fn ($s) => $s->tenantScope()->select('santri.id', 'nama_lengkap', 'jk')])
            ->when($request->filled('jenjang'), fn ($q) => $q->whereIn('jenjang', (array) $request->query('jenjang')))
            ->when($request->filled('tahun_ajaran'), fn ($q) => $q->whereIn('tahun_ajaran', (array) $request->query('tahun_ajaran')))
            ->orderBy('nama')
            ->get();

        $diminta = $request->query('tahun_ajaran');
        $tunggal = is_array($diminta) ? (count($diminta) === 1 ? $diminta[0] : null) : $diminta;

        return response()->json($this->sertakanRiwayat($daftar, $tunggal ?: TahunAjaran::aktif()?->nama));
    }

    /**
     * Lengkapi tiap anggota dengan nis lokal, kelas & jenjang dari
     * riwayat_belajar pada TA terpilih (semester tertinggi menang, MI
     * didahulukan) — dipakai kolom tabel pivot halaman Santri Custom.
     *
     * @param  Collection<int, GrupSantriCustom>  $daftar
     */
    private function sertakanRiwayat($daftar, ?string $ta)
    {
        $ids = $daftar->flatMap(fn ($g) => $g->santri->pluck('id'))->unique()->values();
        $info = [];
        if ($ids->isNotEmpty() && $ta !== null) {
            $baris = DB::table('riwayat_belajar as rb')
                ->leftJoin('kelas as k', 'k.id', '=', 'rb.kelas_id')
                ->leftJoin('lembaga_santri as ls', function ($j) {
                    $j->on('ls.santri_id', '=', 'rb.santri_id')->on('ls.jenjang', '=', 'rb.jenjang');
                })
                ->where('rb.tahun_ajaran', $ta)
                ->whereIn('rb.santri_id', $ids)
                ->orderByDesc('rb.semester')
                ->get(['rb.santri_id', 'rb.jenjang', 'rb.semester', 'k.nama_kelas', 'ls.nis_lokal']);
            foreach ($baris as $b) {
                $id = (int) $b->santri_id;
                $lama = $info[$id] ?? null;

                if ($lama === null || ($lama['semester'] === $b->semester && $lama['jenjang'] !== 'MI' && $b->jenjang === 'MI')) {
                    $info[$id] = [
                        'semester' => $b->semester,
                        'jenjang' => $b->jenjang,
                        'kelas' => $b->nama_kelas,
                        'nis' => $b->nis_lokal,
                    ];
                }
            }
        }
        foreach ($daftar as $grup) {
            foreach ($grup->santri as $s) {
                $r = $info[(int) $s->id] ?? null;
                $s->nis = $r['nis'] ?? null;
                $s->kelas = $r['kelas'] ?? null;
                $s->jenjang = $r['jenjang'] ?? null;
            }
        }

        return $daftar;
    }

    public function storeGrup(GrupCustomStoreRequest $request)
    {
        $data = $request->validated();
        if (empty($data['jenjang']) && ! $request->user()->bolehPesantren()) {
            $ids = $request->user()->lembagaIds();
            abort_unless(count($ids) === 1, 422, 'Pilih satu lembaga untuk grup.');
            $data['jenjang'] = $ids[0];
        }
        if (! empty($data['jenjang'])) {
            $this->authorizeLembaga($request->user(), $data['jenjang']);
        }
        $grup = GrupSantriCustom::create($data);

        return response()->json($this->muat($grup), 201);
    }

    public function updateGrup(GrupCustomUpdateRequest $request, GrupSantriCustom $grup)
    {
        $this->authorizeGrup($grup);
        $data = $request->validated();
        $jenjang = array_key_exists('jenjang', $data) ? $data['jenjang'] : $grup->jenjang;
        if ($jenjang !== null) {
            $this->authorizeLembaga($request->user(), $jenjang);
        } else {
            abort_unless($request->user()->bolehPesantren(), 403, 'Grup global hanya dapat diubah admin pesantren.');
        }
        $grup->update($data);

        return response()->json($this->muat($grup));
    }

    public function destroyGrup(GrupSantriCustom $grup)
    {
        $this->authorizeGrup($grup);
        $grup->delete();

        return response()->json(['pesan' => 'Grup dihapus.']);
    }

    /** Tambah anggota (idempotent: yang sudah masuk dilewati). */
    public function tambahAnggota(Request $request, GrupSantriCustom $grup)
    {
        $this->authorizeGrup($grup);
        $data = $request->validate([
            'santri_ids' => 'required|array|min:1',
            'santri_ids.*' => 'integer|exists:santri,id',
        ]);
        $ids = array_unique($data['santri_ids']);
        abort_unless(Santri::tenantScope()->whereIn('id', $ids)->count() === count($ids), 403, 'Santri di luar lingkup lembaga Anda.');
        $grup->santri()->syncWithoutDetaching($ids);

        return response()->json($this->muat($grup->refresh()));
    }

    /** Keluarkan satu anggota. */
    public function hapusAnggota(GrupSantriCustom $grup, int $santri)
    {
        $this->authorizeGrup($grup);
        $grup->santri()->detach($santri);

        return response()->json($this->muat($grup->refresh()));
    }
}
