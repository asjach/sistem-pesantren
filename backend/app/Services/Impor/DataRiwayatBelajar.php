<?php

namespace App\Services\Impor;

use App\Exports\RiwayatBelajarTemplateExport;
use App\Models\RiwayatBelajar;
use App\Services\RefService;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Penyedia data riwayat belajar existing untuk dialog import (backend hanya
 * mengirim data; berkas Excel disusun di browser). Kolom SAMA PERSIS dengan
 * template import; kunci baris: NIS lokal + jenjang + tahun ajaran + semester.
 *
 * `status_awal`/`status_akhir` dikirim sebagai LABEL (import memetakan label →
 * kode, kode lama tetap diterima). Query langsung ke tabel ref (bukan cache
 * `RefService`) agar data tidak bergantung cache lama.
 */
class DataRiwayatBelajar
{
    /** @param  list<string>  $jenjang  lembaga yang boleh diakses (sudah disaring) */
    public function __construct(private array $jenjang) {}

    /** @return list<string> */
    public function kolom(): array
    {
        return RiwayatBelajarTemplateExport::KOLOM;
    }

    /** @return list<string> */
    public function wajib(): array
    {
        return ['nis_lokal', 'jenjang', 'tahun_ajaran', 'semester'];
    }

    /** @return list<list<string>> */
    public function baris(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        $label = $this->labelStatus();

        return $this->query()->get()->map(fn (RiwayatBelajar $r) => [
            (string) ($r->nis_lokal ?? ''),
            (string) $r->santri_id,
            (string) ($r->nama_lengkap ?? ''),
            (string) $r->jenjang,
            (string) $r->tahun_ajaran,
            (string) ($r->nama_kelas ?? ''),
            (string) $r->semester,
            $this->teks($r->tgl_masuk),
            $r->no_absen === null ? '' : (string) $r->no_absen,
            (string) ($r->tingkat ?? ''),
            $label['status_awal'][$r->status_awal] ?? (string) ($r->status_awal ?? ''),
            $label['status_akhir'][$r->status_akhir] ?? (string) ($r->status_akhir ?? ''),
        ])->all();
    }

    protected function query(): Builder
    {
        return RiwayatBelajar::query()
            ->leftJoin('lembaga_santri', function ($j) {
                $j->on('lembaga_santri.santri_id', '=', 'riwayat_belajar.santri_id')
                    ->on('lembaga_santri.jenjang', '=', 'riwayat_belajar.jenjang');
            })
            ->leftJoin('kelas', 'kelas.id', '=', 'riwayat_belajar.kelas_id')
            ->leftJoin('santri', 'santri.id', '=', 'riwayat_belajar.santri_id')
            ->whereIn('riwayat_belajar.jenjang', $this->jenjang)
            ->select('riwayat_belajar.*', 'lembaga_santri.nis_lokal', 'kelas.nama_kelas', 'santri.nama_lengkap')
            ->orderBy('riwayat_belajar.jenjang')
            ->orderBy('riwayat_belajar.tahun_ajaran')
            ->orderBy('riwayat_belajar.semester')
            ->orderBy('riwayat_belajar.santri_id');
    }

    /**
     * Kode → label status (label = nilai yang tampil di dropdown template).
     *
     * @return array<string, array<string, string>>
     */
    protected function labelStatus(): array
    {
        $petakan = function (string $tipe): array {
            $kunci = RefService::KEY[$tipe];
            $map = [];
            $baris = DB::table(RefService::table($tipe))
                ->where('is_active', true)
                ->orderBy('urutan')
                ->orderBy('nama')
                ->get();
            foreach ($baris as $r) {
                $map[(string) $r->{$kunci}] ??= (string) $r->nama;
            }

            return $map;
        };

        return ['status_awal' => $petakan('status_awal'), 'status_akhir' => $petakan('status_akhir')];
    }

    protected function teks(mixed $nilai): string
    {
        if ($nilai === null) {
            return '';
        }
        if ($nilai instanceof DateTimeInterface) {
            return $nilai->format('Y-m-d');
        }

        return (string) $nilai;
    }
}
