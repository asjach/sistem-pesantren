<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\MataPelajaran;
use App\Models\StrukturKurikulum;
use App\Models\StrukturKurikulumPengaturan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Struktur kurikulum (REFERENSI): JP per minggu per mapel × tingkat untuk satu
 * jenjang + tahun ajaran, plus minggu efektif untuk hitungan JP per tahun.
 *
 * Tidak mengunci atau memvalidasi jadwal pelajaran.
 */
class StrukturKurikulumController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/kurikulum/struktur?jenjang=&tahun_ajaran= */
    public function index(Request $request): JsonResponse
    {
        [$jenjang, $ta] = $this->lingkup($request);

        return response()->json($this->data($jenjang, $ta));
    }

    /** PUT /api/admin/kurikulum/struktur */
    public function simpan(Request $request): JsonResponse
    {
        [$jenjang, $ta] = $this->lingkup($request);

        $data = $request->validate([
            'minggu_efektif' => ['required', 'integer', 'min:1', 'max:60'],
            'sel' => ['present', 'array'],
            'sel.*.mata_pelajaran_id' => ['required', 'integer'],
            'sel.*.tingkat' => ['required', 'string', 'max:20'],
            'sel.*.jp_per_minggu' => ['required', 'integer', 'min:0', 'max:60'],
        ]);

        $mapelAktif = MataPelajaran::where('jenjang', $jenjang)->where('is_active', true)
            ->pluck('id')->map(fn ($v): int => (int) $v)->all();
        $idMapel = array_flip($mapelAktif);
        $tingkat = $this->daftarTingkat($jenjang);
        $idTingkat = array_flip($tingkat);

        $baris = [];
        foreach ($data['sel'] as $s) {
            $mapelId = (int) $s['mata_pelajaran_id'];
            $tk = (string) $s['tingkat'];

            if (! isset($idMapel[$mapelId])) {
                throw ValidationException::withMessages(['sel' => 'Mapel tidak aktif di jenjang ini.']);
            }
            if ($tingkat !== [] && ! isset($idTingkat[$tk])) {
                throw ValidationException::withMessages(['sel' => "Tingkat {$tk} tidak dikenal untuk jenjang ini."]);
            }
            if ((int) $s['jp_per_minggu'] <= 0) {
                continue;
            }

            $baris[$mapelId.'|'.$tk] = [
                'jenjang' => $jenjang,
                'tahun_ajaran' => $ta,
                'tingkat' => $tk,
                'mata_pelajaran_id' => $mapelId,
                'jp_per_minggu' => (int) $s['jp_per_minggu'],
            ];
        }

        DB::transaction(function () use ($jenjang, $ta, $data, $baris): void {
            StrukturKurikulumPengaturan::updateOrCreate(
                ['jenjang' => $jenjang, 'tahun_ajaran' => $ta],
                ['minggu_efektif' => (int) $data['minggu_efektif']],
            );

            StrukturKurikulum::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)->delete();

            foreach ($baris as $b) {
                StrukturKurikulum::create($b);
            }
        });

        return response()->json($this->data($jenjang, $ta) + ['pesan' => 'Struktur kurikulum disimpan.']);
    }

    /** @return array{0:string,1:string} */
    private function lingkup(Request $request): array
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        return [$data['jenjang'], $data['tahun_ajaran']];
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
     * Data lengkap halaman: pengaturan, kolom tingkat, baris mapel, dan sel.
     *
     * @return array<string, mixed>
     */
    private function data(string $jenjang, string $ta): array
    {
        $pengaturan = StrukturKurikulumPengaturan::firstOrCreate(
            ['jenjang' => $jenjang, 'tahun_ajaran' => $ta],
            ['minggu_efektif' => 36],
        );

        $mapel = MataPelajaran::where('jenjang', $jenjang)->where('is_active', true)
            ->orderBy('urutan')->orderBy('nama_mapel')
            ->get(['id', 'nama_mapel', 'kelompok', 'urutan'])
            ->map(fn (MataPelajaran $m): array => [
                'id' => $m->id,
                'nama_mapel' => $m->nama_mapel,
                'kelompok' => $m->kelompok,
                'urutan' => $m->urutan,
            ])
            ->values();

        $sel = StrukturKurikulum::where('jenjang', $jenjang)->where('tahun_ajaran', $ta)
            ->get(['mata_pelajaran_id', 'tingkat', 'jp_per_minggu'])
            ->map(fn (StrukturKurikulum $s): array => [
                'mata_pelajaran_id' => (int) $s->mata_pelajaran_id,
                'tingkat' => $s->tingkat,
                'jp_per_minggu' => (int) $s->jp_per_minggu,
            ])
            ->values();

        return [
            'jenjang' => $jenjang,
            'tahun_ajaran' => $ta,
            'minggu_efektif' => $pengaturan->minggu_efektif,
            'tingkat' => $this->daftarTingkat($jenjang),
            'mapel' => $mapel,
            'sel' => $sel,
        ];
    }
}
