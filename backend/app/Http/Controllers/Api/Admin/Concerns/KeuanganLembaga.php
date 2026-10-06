<?php

namespace App\Http\Controllers\Api\Admin\Concerns;

use Illuminate\Support\Facades\DB;

/**
 * Helper bersama controller keuangan: lingkup lembaga + peta santri per TA.
 * Dipakai JenisTarifController, DispensasiController, TagihanController,
 * dan PembayaranController.
 */
trait KeuanganLembaga
{
    /** Tingkat akhir per jenjang (sinkron peta TINGKAT_AKHIR halaman Kelulusan). */
    private const TINGKAT_AKHIR = ['MI' => '6', 'MD' => '6', 'MTS' => '9', 'MLN' => '12'];

    private function canLembaga($actor, string $jenjang): bool
    {
        return $actor->canAccessLembaga($jenjang);
    }

    /**
     * Peta santri dari riwayat_belajar pada satu TA.
     *
     * Patokan keaktifan (sengaja): `status_akhir` bukan `pindah_keluar`.
     * Flag `is_active_riwayat` maupun `santri.is_active_pst` TIDAK dipakai —
     * supaya status `lulus`/`naik`/`lanjut` (santri yang sudah naik jenjang
     * atau lulus di TA tsb) tetap bisa digenerate tagihan, misalnya untuk
     * penagihan tunggakan TA sebelumnya.
     *
     * Baris semester 2 menang sebagai baris tampilan.
     *
     * @param  list<int>  $santriIds
     * @return array<int, array{santri_id:int, nama_lengkap:string, jk:?string, nisn:?string, nis_lokal:?string, per_jenjang:array<string, array{semester:?string, tingkat:?string, kelas:?string, kelas_id:?int, status:?string}>, jenjang_utama:string, tingkat:?string, kelas:?string, kelas_id:?int, status_akhir:?string, kelas_akhir:bool}>
     */
    private function petaSantriGenerate(string $ta, array $santriIds = [], ?string $cari = null): array
    {
        $baris = DB::table('riwayat_belajar as rb')
            ->join('santri as s', 's.id', '=', 'rb.santri_id')
            ->leftJoin('kelas as k', 'k.id', '=', 'rb.kelas_id')
            ->leftJoin('lembaga_santri as ls', function ($j) {
                $j->on('ls.santri_id', '=', 'rb.santri_id')->on('ls.jenjang', '=', 'rb.jenjang');
            })
            ->where('rb.tahun_ajaran', $ta)
            ->where('rb.status_akhir', '!=', 'pindah_keluar')
            ->when($santriIds !== [], fn ($q) => $q->whereIn('rb.santri_id', $santriIds))
            ->when($cari !== null && $cari !== '', fn ($q) => $q->whereIn('rb.santri_id', DB::table('santri as s2')
                ->leftJoin('lembaga_santri as ls2', 'ls2.santri_id', '=', 's2.id')
                ->where(fn ($w) => $w
                    ->where('s2.nama_lengkap', 'like', '%'.$cari.'%')
                    ->orWhere('s2.nisn', 'like', '%'.$cari.'%')
                    ->orWhere('ls2.nis_lokal', 'like', '%'.$cari.'%'))
                ->select('s2.id')))
            ->orderBy('s.nama_lengkap')
            ->get(['rb.santri_id', 'rb.jenjang', 'rb.tingkat', 'rb.kelas_id', 'rb.semester', 'rb.status_akhir', 's.nama_lengkap', 's.nisn', 's.jk', 'ls.nis_lokal', 'k.nama_kelas']);

        $peta = [];
        foreach ($baris as $b) {
            $id = (int) $b->santri_id;
            $peta[$id] ??= [
                'santri_id' => $id,
                'nama_lengkap' => (string) $b->nama_lengkap,
                'jk' => $b->jk,
                'nisn' => $b->nisn,
                'nis_lokal' => $b->nis_lokal,
                'per_jenjang' => [],
            ];
            $lama = $peta[$id]['per_jenjang'][$b->jenjang] ?? null;
            if ($lama === null || ($lama['semester'] !== '2' && $b->semester === '2')) {
                $peta[$id]['per_jenjang'][$b->jenjang] = [
                    'semester' => $b->semester,
                    'tingkat' => $b->tingkat,
                    'kelas' => $b->nama_kelas,
                    'kelas_id' => $b->kelas_id === null ? null : (int) $b->kelas_id,
                    'status' => $b->status_akhir,
                ];
            }
        }

        foreach ($peta as &$info) {
            $jenjangs = array_keys($info['per_jenjang']);
            $has = fn (string $j) => in_array($j, $jenjangs, true);
            $info['jenjang_utama'] = $has('MI') ? 'MI' : ($has('MD') ? 'MD' : ($jenjangs[0] ?? ''));
            $utama = $info['per_jenjang'][$info['jenjang_utama']] ?? null;
            $info['tingkat'] = $utama['tingkat'] ?? null;
            $info['kelas'] = $utama['kelas'] ?? null;
            $info['kelas_id'] = $utama['kelas_id'] ?? null;
            $info['status_akhir'] = $utama['status'] ?? null;
            $info['kelas_akhir'] = false;
            foreach ($info['per_jenjang'] as $jenjang => $row) {
                if ($row['tingkat'] !== null && (self::TINGKAT_AKHIR[$jenjang] ?? null) === $row['tingkat']) {
                    $info['kelas_akhir'] = true;
                }
            }
        }
        unset($info);

        return $peta;
    }
}
