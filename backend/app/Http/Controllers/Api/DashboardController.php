<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MutasiKeluar;
use App\Models\PsbCalonSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * FB-DASH-01: agregat ringan 1-call untuk dashboard desktop.
 * Bukan executive dashboard 504 — hitungan + konteks aktif, kini ditambah
 * statistik santri/PTK/keuangan/siklus/PSB dari data yang sudah ada.
 *
 * Setiap blok statistik digerbangi izin modulnya: akun tanpa izin menerima
 * `null` sehingga angka modul itu tidak bocor lewat dashboard.
 */
class DashboardController extends Controller
{
    public function ringkasan(Request $request)
    {
        $auth = auth()->user();

        $lembagaQuery = Lembaga::tenantScope();
        if ($request->filled('jenjang')) {
            if (! $auth->canAccessLembaga((string) $request->input('jenjang'))) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
            $lembagaQuery->where('jenjang', $request->input('jenjang'));
        }

        /** @var Collection<int, Lembaga> $daftarLembaga */
        $daftarLembaga = (clone $lembagaQuery)->orderBy('jenjang')->get(['jenjang', 'nama']);
        $lembagaIds = $daftarLembaga->pluck('jenjang')->values()->all();

        $taAktif = TahunAjaran::aktif(count($lembagaIds) === 1 ? $lembagaIds[0] : null);
        $tahunAktif = $taAktif
            ? collect([$taAktif->only(['nama', 'tanggal_mulai', 'tanggal_selesai', 'is_aktif'])])
            : collect();
        $taAktifNama = $taAktif?->nama;

        return response()->json([
            'lembaga' => count($lembagaIds),
            'pengguna' => (clone User::tenantScope())->count(),
            'tahun_ajaran_aktif' => $tahunAktif->count(),
            'kelas' => Kelas::whereIn('jenjang', $lembagaIds)->count(),
            'kelas_aktif' => $taAktifNama === null
                ? 0
                : Kelas::whereIn('jenjang', $lembagaIds)->where('tahun_ajaran', $taAktifNama)->count(),
            'tahun_aktif' => $tahunAktif,
            'santri' => $auth->hasPermissionTo('santri.lihat')
                ? $this->statistikSantri($lembagaIds, $daftarLembaga, $taAktifNama)
                : null,
            'pegawai' => $auth->hasPermissionTo('pegawai.lihat')
                ? $this->statistikPegawai($lembagaIds, $daftarLembaga, $taAktifNama)
                : null,
            'keuangan' => $auth->hasPermissionTo('keuangan.lihat')
                ? $this->statistikKeuangan($lembagaIds)
                : null,
            'siklus' => $auth->hasPermissionTo('santri.lihat')
                ? $this->statistikSiklus($lembagaIds, $taAktifNama)
                : null,
            'psb' => $auth->hasPermissionTo('psb.lihat')
                ? $this->statistikPsb($lembagaIds)
                : null,
        ]);
    }

    /**
     * Santri aktif = punya riwayat belajar aktif di lingkup lembaga.
     * Definisi ini setara `santri.is_active_pst` (turunan riwayat).
     *
     * @param  list<string>  $lembagaIds
     */
    private function santriAktifIds(array $lembagaIds): Builder
    {
        return RiwayatBelajar::query()
            ->select('santri_id')
            ->whereIn('jenjang', $lembagaIds)
            ->where('is_active_riwayat', RiwayatBelajar::YA)
            ->distinct();
    }

    /**
     * @param  list<string>  $lembagaIds
     * @param  Collection<int, Lembaga>  $daftarLembaga
     * @return array<string, mixed>
     */
    private function statistikSantri(array $lembagaIds, Collection $daftarLembaga, ?string $taAktif): array
    {
        $total = Santri::query()->whereIn('id', $this->santriAktifIds($lembagaIds))->count();

        $komposisi = Santri::query()
            ->whereIn('id', $this->santriAktifIds($lembagaIds))
            ->selectRaw("SUM(CASE WHEN jk = 'L' THEN 1 ELSE 0 END) as laki_laki")
            ->selectRaw("SUM(CASE WHEN jk = 'P' THEN 1 ELSE 0 END) as perempuan")
            ->selectRaw("SUM(CASE WHEN tipe_santri = 'asrama' THEN 1 ELSE 0 END) as asrama")
            ->selectRaw("SUM(CASE WHEN tipe_santri = 'non_asrama' THEN 1 ELSE 0 END) as non_asrama")
            ->first();

        $perLembaga = RiwayatBelajar::query()
            ->whereIn('jenjang', $lembagaIds)
            ->where('is_active_riwayat', RiwayatBelajar::YA)
            ->selectRaw('jenjang, COUNT(DISTINCT santri_id) as jumlah')
            ->groupBy('jenjang')
            ->pluck('jumlah', 'jenjang');

        $perTingkat = $taAktif === null ? collect() : RiwayatBelajar::query()
            ->whereIn('jenjang', $lembagaIds)
            ->where('is_active_riwayat', RiwayatBelajar::YA)
            ->where('tahun_ajaran', $taAktif)
            ->selectRaw('jenjang, tingkat, COUNT(DISTINCT santri_id) as jumlah')
            ->groupBy('jenjang', 'tingkat')
            ->orderBy('jenjang')
            ->orderBy('tingkat')
            ->get();

        $baru = $taAktif === null ? 0 : RiwayatBelajar::query()
            ->whereIn('jenjang', $lembagaIds)
            ->where('tahun_ajaran', $taAktif)
            ->where('status_awal', 'santri_baru')
            ->distinct()
            ->count('santri_id');

        return [
            'total' => $total,
            'laki_laki' => (int) ($komposisi->laki_laki ?? 0),
            'perempuan' => (int) ($komposisi->perempuan ?? 0),
            'asrama' => (int) ($komposisi->asrama ?? 0),
            'non_asrama' => (int) ($komposisi->non_asrama ?? 0),
            'baru_ta_aktif' => $baru,
            'per_lembaga' => $daftarLembaga->map(fn (Lembaga $l): array => [
                'jenjang' => $l->jenjang,
                'nama' => $l->nama,
                'jumlah' => (int) ($perLembaga[$l->jenjang] ?? 0),
            ])->values()->all(),
            'per_tingkat' => $perTingkat->map(fn ($r): array => [
                'jenjang' => (string) $r->jenjang,
                'tingkat' => $r->tingkat === null ? null : (string) $r->tingkat,
                'jumlah' => (int) $r->jumlah,
            ])->all(),
        ];
    }

    /**
     * @param  list<string>  $lembagaIds
     * @param  Collection<int, Lembaga>  $daftarLembaga
     * @return array<string, mixed>
     */
    private function statistikPegawai(array $lembagaIds, Collection $daftarLembaga, ?string $taAktif): array
    {
        $total = DB::table('lembaga_pegawai')
            ->whereIn('jenjang', $lembagaIds)
            ->distinct()
            ->count('pegawai_id');

        $aktif = $taAktif === null ? 0 : DB::table('keaktifan_pegawai')
            ->whereIn('jenjang', $lembagaIds)
            ->where('tahun_ajaran', $taAktif)
            ->where('status_keaktifan', 'Ya')
            ->distinct()
            ->count('pegawai_id');

        $perLembaga = $taAktif === null ? collect() : DB::table('keaktifan_pegawai')
            ->whereIn('jenjang', $lembagaIds)
            ->where('tahun_ajaran', $taAktif)
            ->where('status_keaktifan', 'Ya')
            ->selectRaw('jenjang, COUNT(DISTINCT pegawai_id) as jumlah')
            ->groupBy('jenjang')
            ->pluck('jumlah', 'jenjang');

        return [
            'total' => $total,
            'aktif' => $aktif,
            'per_lembaga' => $daftarLembaga->map(fn (Lembaga $l): array => [
                'jenjang' => $l->jenjang,
                'nama' => $l->nama,
                'jumlah' => (int) ($perLembaga[$l->jenjang] ?? 0),
            ])->values()->all(),
        ];
    }

    /**
     * Tagihan lingkup lembaga: nominal, terbayar, dan tunggakan (sisa yang
     * sudah lewat jatuh tempo — sama dengan `Tagihan::sisaTerlambat()`).
     *
     * @param  list<string>  $lembagaIds
     * @return array<string, int>
     */
    private function statistikKeuangan(array $lembagaIds): array
    {
        $agregat = Tagihan::query()
            ->whereIn('jenjang', $lembagaIds)
            ->selectRaw('COUNT(*) as jumlah')
            ->selectRaw('COALESCE(SUM(nominal), 0) as nominal')
            ->selectRaw('COALESCE(SUM(terbayar), 0) as terbayar')
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN (nominal - terbayar) > 0'
                .' AND (jatuh_tempo IS NULL OR jatuh_tempo < ?) THEN nominal - terbayar ELSE 0 END), 0) as tunggakan',
                [today()->toDateString()]
            )
            ->selectRaw("SUM(CASE WHEN status = 'lunas' THEN 1 ELSE 0 END) as lunas")
            ->selectRaw("SUM(CASE WHEN status = 'belum' THEN 1 ELSE 0 END) as belum")
            ->selectRaw("SUM(CASE WHEN status = 'sebagian' THEN 1 ELSE 0 END) as sebagian")
            ->first();

        return [
            'jumlah_tagihan' => (int) $agregat->jumlah,
            'nominal' => (int) $agregat->nominal,
            'terbayar' => (int) $agregat->terbayar,
            'tunggakan' => (int) $agregat->tunggakan,
            'lunas' => (int) $agregat->lunas,
            'belum' => (int) $agregat->belum,
            'sebagian' => (int) $agregat->sebagian,
        ];
    }

    /**
     * Siklus santri: arsip alumni + mutasi keluar beserta tren alumni per TA.
     *
     * @param  list<string>  $lembagaIds
     * @return array<string, mixed>
     */
    private function statistikSiklus(array $lembagaIds, ?string $taAktif): array
    {
        $tahunAwal = $taAktif === null ? null : (int) substr($taAktif, 0, 4);

        $alumniPerTa = Alumni::query()
            ->whereIn('lembaga_lulus', $lembagaIds)
            ->selectRaw('tahun_ajaran_lulus, COUNT(*) as jumlah')
            ->groupBy('tahun_ajaran_lulus')
            ->orderBy('tahun_ajaran_lulus')
            ->get()
            ->take(-8)
            ->map(fn ($r): array => [
                'tahun_ajaran' => (string) $r->tahun_ajaran_lulus,
                'jumlah' => (int) $r->jumlah,
            ])
            ->values()
            ->all();

        return [
            'alumni' => Alumni::query()->whereIn('lembaga_lulus', $lembagaIds)->count(),
            'alumni_ta_aktif' => $taAktif === null
                ? 0
                : Alumni::query()->whereIn('lembaga_lulus', $lembagaIds)->where('tahun_ajaran_lulus', $taAktif)->count(),
            'mutasi' => MutasiKeluar::query()->whereIn('jenjang', $lembagaIds)->count(),
            'mutasi_ta_aktif' => $tahunAwal === null
                ? 0
                : MutasiKeluar::query()->whereIn('jenjang', $lembagaIds)->whereYear('tanggal_mutasi', $tahunAwal)->count(),
            'alumni_per_ta' => $alumniPerTa,
        ];
    }

    /**
     * Antrean PSB: jumlah calon per status pendaftaran (tanpa soft delete).
     *
     * @param  list<string>  $lembagaIds
     * @return array<string, mixed>
     */
    private function statistikPsb(array $lembagaIds): array
    {
        $perStatus = PsbCalonSantri::query()
            ->whereIn('jenjang', $lembagaIds)
            ->selectRaw('status_pendaftaran, COUNT(*) as jumlah')
            ->groupBy('status_pendaftaran')
            ->pluck('jumlah', 'status_pendaftaran')
            ->map(fn ($n): int => (int) $n)
            ->all();

        return [
            'total' => array_sum($perStatus),
            'per_status' => $perStatus,
        ];
    }
}
