<?php

namespace App\Services\Impor;

use App\Exports\KeaktifanTemplateExport;
use App\Models\KeaktifanPegawai;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Penyedia data riwayat keaktifan existing untuk dialog import (backend hanya
 * mengirim data; berkas Excel disusun di browser). Kolom SAMA PERSIS dengan
 * template import; kunci baris: pegawai/nipp + jenjang + tahun ajaran.
 *
 * `status_keaktifan` dikirim sebagai nilai kanonis ('Ya'/'Tidak') — import
 * juga menerima alias (Aktif/Inaktif/1/0). Baris posisional sejajar `kolom`.
 */
class DataKeaktifan
{
    /** @param  list<string>  $jenjang  lembaga yang boleh diakses (sudah disaring) */
    public function __construct(private array $jenjang) {}

    /** @return list<string> */
    public function kolom(): array
    {
        return KeaktifanTemplateExport::kolom();
    }

    /** @return list<string> */
    public function wajib(): array
    {
        return ['jenjang', 'tahun_ajaran'];
    }

    /** @return list<list<string>> */
    public function baris(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        return $this->query()->get()->map(fn (KeaktifanPegawai $r) => [
            (string) $r->pegawai_id,
            (string) ($r->pegawai?->nipp ?? ''),
            (string) ($r->pegawai?->nama_lengkap ?? ''),
            (string) $r->jenjang,
            (string) $r->tahun_ajaran,
            (string) ($r->tugas_utama ?? ''),
            $r->status_keaktifan === KeaktifanPegawai::INAKTIF ? 'Tidak' : 'Ya',
            (string) ($r->no_sk ?? ''),
            $this->teks($r->tgl_sk),
        ])->all();
    }

    protected function query(): Builder
    {
        return KeaktifanPegawai::query()
            ->with('pegawai:id,nipp,nama_lengkap')
            ->whereIn('jenjang', $this->jenjang)
            ->orderBy('jenjang')
            ->orderBy('tahun_ajaran')
            ->orderBy('pegawai_id');
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
