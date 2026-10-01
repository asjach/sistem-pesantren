<?php

namespace App\Services\Impor;

use App\Exports\PenempatanPegawaiTemplateExport;
use App\Models\LembagaPegawai;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Penyedia data penempatan pegawai existing untuk dialog import (backend
 * hanya mengirim data; berkas Excel disusun di browser). Kolom SAMA PERSIS
 * dengan template import; kunci baris: pegawai/nipp + jenjang.
 *
 * `is_active_lembaga` dikirim sebagai nilai kanonis ('Ya'/'Tidak') — import
 * juga menerima alias (Aktif/Inaktif/1/0). Baris posisional sejajar `kolom`.
 */
class DataPenempatanPegawai
{
    /** @param  list<string>  $jenjang  lembaga yang boleh diakses (sudah disaring) */
    public function __construct(private array $jenjang) {}

    /** @return list<string> */
    public function kolom(): array
    {
        return PenempatanPegawaiTemplateExport::kolom();
    }

    /** @return list<string> */
    public function wajib(): array
    {
        return ['jenjang'];
    }

    /** @return list<list<string>> */
    public function baris(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        return $this->query()->get()->map(fn (LembagaPegawai $r) => [
            (string) $r->pegawai_id,
            (string) ($r->pegawai?->nipp ?? ''),
            (string) ($r->pegawai?->nama_lengkap ?? ''),
            (string) $r->jenjang,
            (string) ($r->tugas_utama ?? ''),
            $r->is_active_lembaga === LembagaPegawai::TIDAK ? 'Tidak' : 'Ya',
            $this->teks($r->tgl_masuk),
            $this->teks($r->tgl_selesai),
            (string) ($r->tahaj_masuk ?? ''),
            (string) ($r->no_sk_awal_ptk ?? ''),
            $this->teks($r->tgl_sk_awal_ptk),
        ])->all();
    }

    protected function query(): Builder
    {
        return LembagaPegawai::query()
            ->with('pegawai:id,nipp,nama_lengkap')
            ->whereIn('jenjang', $this->jenjang)
            ->orderBy('jenjang')
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
