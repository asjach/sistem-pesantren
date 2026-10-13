<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GrupCustomStoreRequest;
use App\Http\Requests\Admin\GrupCustomUpdateRequest;
use App\Models\GrupSantriCustom;
use App\Models\TahunAjaran;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Keuangan: grup santri custom — kelompok bentukan manual (mis. peserta
 * ekskul) yang dipakai opsi "Custom" pada dialog Buat Tagihan. Grup tidak
 * terikat lembaga; izin cukup `keuangan.*` di route.
 */
class GrupCustomController extends Controller
{
    private function muat(GrupSantriCustom $grup): GrupSantriCustom
    {
        return $grup->load(['santri:id,nama_lengkap,jk']);
    }

    public function indexGrup(Request $request)
    {
        $daftar = GrupSantriCustom::with('santri:id,nama_lengkap,jk')
            ->when($request->filled('jenjang'), fn ($q) => $q->whereIn('jenjang', (array) $request->query('jenjang')))
            ->when($request->filled('tahun_ajaran'), fn ($q) => $q->whereIn('tahun_ajaran', (array) $request->query('tahun_ajaran')))
            ->orderBy('nama')
            ->get();

        /* Pengayaan anggota butuh SATU TA: bila topBar multi-pilih, pakai TA
           aktif (riwayat per TA berbeda; gabungan multi-TA tidak bermakna). */
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
                /* Semester tertinggi menang; sesama semester MI didahulukan
                   (selaras aturan jenjang_utama keuangan). */
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
        $grup = GrupSantriCustom::create($request->validated());

        return response()->json($this->muat($grup), 201);
    }

    public function updateGrup(GrupCustomUpdateRequest $request, GrupSantriCustom $grup)
    {
        $grup->update($request->validated());

        return response()->json($this->muat($grup));
    }

    public function destroyGrup(GrupSantriCustom $grup)
    {
        $grup->delete();

        return response()->json(['pesan' => 'Grup dihapus.']);
    }

    /** Tambah anggota (idempotent: yang sudah masuk dilewati). */
    public function tambahAnggota(Request $request, GrupSantriCustom $grup)
    {
        $data = $request->validate([
            'santri_ids' => 'required|array|min:1',
            'santri_ids.*' => 'integer|exists:santri,id',
        ]);
        $grup->santri()->syncWithoutDetaching($data['santri_ids']);

        return response()->json($this->muat($grup->refresh()));
    }

    /** Keluarkan satu anggota. */
    public function hapusAnggota(GrupSantriCustom $grup, int $santri)
    {
        $grup->santri()->detach($santri);

        return response()->json($this->muat($grup->refresh()));
    }
}
