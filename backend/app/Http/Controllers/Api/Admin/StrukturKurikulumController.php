<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\MataPelajaran;
use App\Models\StrukturKurikulum;
use App\Models\StrukturKurikulumPengaturan;
use App\Models\VarianJadwal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Struktur kurikulum (REFERENSI) per VARIAN jadwal: JP per minggu per mapel ×
 * tingkat, plus minggu efektif per jenjang + tahun ajaran.
 *
 * Varian dipilih eksplisit lewat `varian_id` — termasuk varian yang TIDAK aktif.
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

    /** PUT /api/admin/kurikulum/struktur */
    public function simpan(Request $request): JsonResponse
    {
        $varian = $this->varian($request);

        $data = $request->validate([
            'minggu_efektif' => ['required', 'integer', 'min:1', 'max:60'],
            'sel' => ['present', 'array'],
            'sel.*.mata_pelajaran_id' => ['required', 'integer'],
            'sel.*.tingkat' => ['required', 'string', 'max:20'],
            'sel.*.jp_per_minggu' => ['required', 'integer', 'min:0', 'max:60'],
        ]);

        $mapelAktif = MataPelajaran::where('jenjang', $varian->jenjang)->where('is_active', true)
            ->pluck('id')->map(fn ($v): int => (int) $v)->all();
        $idMapel = array_flip($mapelAktif);
        $tingkat = $this->daftarTingkat($varian->jenjang);
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
                'varian_jadwal_id' => $varian->id,
                'jenjang' => $varian->jenjang,
                'tahun_ajaran' => $varian->tahun_ajaran,
                'tingkat' => $tk,
                'mata_pelajaran_id' => $mapelId,
                'jp_per_minggu' => (int) $s['jp_per_minggu'],
            ];
        }

        DB::transaction(function () use ($varian, $data, $baris): void {
            StrukturKurikulumPengaturan::updateOrCreate(
                ['jenjang' => $varian->jenjang, 'tahun_ajaran' => $varian->tahun_ajaran],
                ['minggu_efektif' => (int) $data['minggu_efektif']],
            );

            StrukturKurikulum::where('varian_jadwal_id', $varian->id)->delete();

            foreach ($baris as $b) {
                StrukturKurikulum::create($b);
            }
        });

        return response()->json($this->data($varian) + ['pesan' => 'Struktur kurikulum disimpan.']);
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
     * Data lengkap halaman untuk satu varian: pengaturan minggu efektif,
     * daftar varian (untuk combobox), kolom tingkat, baris mapel, dan sel.
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

        $sel = StrukturKurikulum::where('varian_jadwal_id', $varian->id)
            ->get(['mata_pelajaran_id', 'tingkat', 'jp_per_minggu'])
            ->map(fn (StrukturKurikulum $s): array => [
                'mata_pelajaran_id' => (int) $s->mata_pelajaran_id,
                'tingkat' => $s->tingkat,
                'jp_per_minggu' => (int) $s->jp_per_minggu,
            ])
            ->values();

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
            'tingkat' => $this->daftarTingkat($varian->jenjang),
            'mapel' => $mapel,
            'sel' => $sel,
        ];
    }
}
