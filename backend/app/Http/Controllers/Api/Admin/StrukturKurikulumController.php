<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Kelas;
use App\Models\MataPelajaran;
use App\Models\StrukturKurikulumPengaturan;
use App\Models\VarianJadwal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Struktur kurikulum (REFERENSI) per VARIAN jadwal.
 *
 * JP per minggu DIHITUNG dari snapshot varian terpilih: jumlah sel jadwal tiap
 * mapel per tingkat. Bila satu tingkat punya beberapa kelas, dipakai jumlah
 * terbanyak. JP per tahun = JP/minggu × minggu efektif (per jenjang + TA).
 *
 * Tidak mengunci atau memvalidasi jadwal pelajaran.
 */
class StrukturKurikulumController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/kurikulum/struktur?varian_id= */
    public function index(Request $request): JsonResponse
    {
        return response()->json($this->data($this->varian($request)));
    }

    /**
     * PUT /api/admin/kurikulum/struktur
     * Hanya menyimpan minggu efektif; sel JP selalu dihitung dari snapshot.
     */
    public function simpan(Request $request): JsonResponse
    {
        $varian = $this->varian($request);

        $data = $request->validate([
            'minggu_efektif' => ['required', 'integer', 'min:1', 'max:60'],
        ]);

        StrukturKurikulumPengaturan::updateOrCreate(
            ['jenjang' => $varian->jenjang, 'tahun_ajaran' => $varian->tahun_ajaran],
            ['minggu_efektif' => (int) $data['minggu_efektif']],
        );

        return response()->json($this->data($varian) + ['pesan' => 'Minggu efektif disimpan.']);
    }

    /** Varian yang diminta (wajib) + otorisasi lembaganya. */
    private function varian(Request $request): VarianJadwal
    {
        $data = $request->validate([
            'varian_id' => ['required', 'integer', 'exists:varian_jadwal,id'],
        ]);
        $varian = VarianJadwal::findOrFail($data['varian_id']);
        $this->authorizeLembaga($request->user(), $varian->jenjang);

        return $varian;
    }

    /**
     * Kolom tingkat: ref_tingkat aktif jenjang; bila kosong, pakai tingkat
     * yang benar-benar ada di kelas TA itu.
     *
     * @return list<string>
     */
    private function daftarTingkat(string $jenjang): array
    {
        $daftar = DB::table('ref_tingkat')
            ->where('jenjang', $jenjang)
            ->where('is_active', true)
            ->orderBy('urutan')
            ->orderBy('nama')
            ->pluck('nama')
            ->map(fn ($v): string => (string) $v)
            ->values()
            ->all();

        if ($daftar !== []) {
            return $daftar;
        }

        return DB::table('kelas')
            ->where('jenjang', $jenjang)
            ->whereNotNull('tingkat')
            ->distinct()
            ->orderBy('tingkat')
            ->pluck('tingkat')
            ->map(fn ($v): string => (string) $v)
            ->values()
            ->all();
    }

    /**
     * Hitung JP per minggu per mapel × tingkat dari snapshot varian.
     *
     * @param  list<int>  $mapelIds
     * @param  list<string>  $tingkat
     * @return list<array{mata_pelajaran_id:int, tingkat:string, jp_per_minggu:int}>
     */
    private function selDariVarian(VarianJadwal $varian, array $mapelIds, array $tingkat): array
    {
        $petaKelas = Kelas::where('jenjang', $varian->jenjang)
            ->where('tahun_ajaran', $varian->tahun_ajaran)
            ->get()
            ->keyBy(fn (Kelas $k): string => Kelas::normalisasiNama($k->nama_kelas));

        $idMapel = array_flip($mapelIds);
        $idTingkat = array_flip($tingkat);
        $maks = [];

        foreach ($varian->snapshot['kelas'] ?? [] as $data) {
            $nama = (string) ($data['nama'] ?? '');
            $kelas = $petaKelas->get(Kelas::normalisasiNama($nama));
            $tk = $kelas?->tingkat;

            // Cadangan: nama kelas diawali angka tingkat (mis. "1A").
            if (($tk === null || $tk === '') && preg_match('/^\s*(\d+)/', $nama, $m) === 1) {
                $tk = $m[1];
            }

            if ($tk === null || $tk === '') {
                continue;
            }

            $tk = (string) $tk;

            if (! isset($idTingkat[$tk])) {
                continue;
            }

            $hitung = [];

            foreach ($data['jadwal'] ?? [] as $j) {
                $mapelId = (int) ($j['mata_pelajaran_id'] ?? 0);

                if ($mapelId <= 0 || ! isset($idMapel[$mapelId])) {
                    continue;
                }

                $hitung[$mapelId] = ($hitung[$mapelId] ?? 0) + 1;
            }

            foreach ($hitung as $mapelId => $n) {
                $k = $mapelId.'|'.$tk;
                $maks[$k] = max($maks[$k] ?? 0, $n);
            }
        }

        $hasil = [];

        foreach ($maks as $k => $n) {
            [$mapelId, $tk] = explode('|', $k);
            $hasil[] = [
                'mata_pelajaran_id' => (int) $mapelId,
                'tingkat' => $tk,
                'jp_per_minggu' => (int) $n,
            ];
        }

        return $hasil;
    }

    /**
     * Data lengkap halaman untuk satu varian: pengaturan minggu efektif,
     * daftar varian (untuk combobox), kolom tingkat, baris mapel, dan sel
     * hasil hitung dari snapshot.
     *
     * @return array<string, mixed>
     */
    private function data(VarianJadwal $varian): array
    {
        $pengaturan = StrukturKurikulumPengaturan::firstOrCreate(
            ['jenjang' => $varian->jenjang, 'tahun_ajaran' => $varian->tahun_ajaran],
            ['minggu_efektif' => 36],
        );

        $mapel = MataPelajaran::where('jenjang', $varian->jenjang)->where('is_active', true)
            ->orderBy('urutan')->orderBy('nama_mapel')
            ->get(['id', 'nama_mapel', 'kelompok', 'urutan'])
            ->map(fn (MataPelajaran $m): array => [
                'id' => $m->id,
                'nama_mapel' => $m->nama_mapel,
                'kelompok' => $m->kelompok,
                'urutan' => $m->urutan,
            ])
            ->values();

        $tingkat = $this->daftarTingkat($varian->jenjang);

        $opsi = VarianJadwal::where('jenjang', $varian->jenjang)
            ->where('tahun_ajaran', $varian->tahun_ajaran)
            ->orderByDesc('is_active')
            ->orderByDesc('created_at')
            ->get(['id', 'nama', 'is_active', 'created_at'])
            ->map(fn (VarianJadwal $v): array => [
                'id' => $v->id,
                'nama' => $v->nama,
                'is_active' => $v->is_active,
                'dibuat_pada' => $v->created_at?->format('Y-m-d H:i'),
            ])
            ->values();

        return [
            'jenjang' => $varian->jenjang,
            'tahun_ajaran' => $varian->tahun_ajaran,
            'varian' => ['id' => $varian->id, 'nama' => $varian->nama, 'is_active' => $varian->is_active],
            'varian_opsi' => $opsi,
            'minggu_efektif' => $pengaturan->minggu_efektif,
            'tingkat' => $tingkat,
            'mapel' => $mapel,
            'sel' => $this->selDariVarian($varian, $mapel->pluck('id')->all(), $tingkat),
            'catatan' => 'JP per minggu dihitung dari snapshot varian terpilih; bila satu tingkat punya beberapa kelas, dipakai jumlah JP terbanyak.',
        ];
    }
}
