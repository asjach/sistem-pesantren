<?php

namespace App\Http\Requests\Admin;

use App\Services\Template\KatalogNilai;
use App\Services\Template\KonteksCetak;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Formulir isian & cetak: memilih satu record (bila template membutuhkannya),
 * mengisi nilai tetap, lalu meminta dokumen jadi.
 */
class TemplateIsiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'id_santri' => ['nullable', 'integer', 'exists:santri,id'],
            'id_pegawai' => ['nullable', 'integer', 'exists:pegawai,id'],
            'id_psb_calon' => ['nullable', 'integer', 'exists:psb_calon_santri,id'],
            'kelas_id' => ['nullable', 'integer', 'exists:kelas,id'],
            'tahun_ajaran' => ['nullable', 'string', 'max:9', 'exists:tahun_ajaran,nama'],
            'semester' => ['nullable', 'string', Rule::in(['1', '2'])],
            'tanggal_absen' => ['nullable', 'date_format:Y-m-d'],
            'tetap' => ['nullable', 'array'],
            'tetap.teks' => ['nullable', 'string', 'max:2000'],
            'tetap.tanggal' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    public function messages(): array
    {
        return [
            'id_santri.integer' => 'Santri yang dipilih tidak valid.',
            'id_santri.exists' => 'Santri yang dipilih tidak ditemukan.',
            'id_pegawai.integer' => 'Pegawai yang dipilih tidak valid.',
            'id_pegawai.exists' => 'Pegawai yang dipilih tidak ditemukan.',
            'id_psb_calon.integer' => 'Pendaftar yang dipilih tidak valid.',
            'id_psb_calon.exists' => 'Pendaftar yang dipilih tidak ditemukan.',
            'kelas_id.integer' => 'Kelas yang dipilih tidak valid.',
            'kelas_id.exists' => 'Kelas yang dipilih tidak ditemukan.',
            'tahun_ajaran.string' => 'Tahun ajaran yang dipilih tidak valid.',
            'tahun_ajaran.max' => 'Tahun ajaran yang dipilih tidak valid.',
            'tahun_ajaran.exists' => 'Tahun ajaran tidak dikenal.',
            'semester.string' => 'Semester harus 1 (Ganjil) atau 2 (Genap).',
            'semester.in' => 'Semester harus 1 (Ganjil) atau 2 (Genap).',
            'tanggal_absen.date_format' => 'Tanggal absen harus ditulis dengan format YYYY-MM-DD.',
            'tetap.array' => 'Nilai tetap yang dikirim tidak valid.',
            'tetap.teks.string' => 'Nilai tetap teks harus berupa teks.',
            'tetap.teks.max' => 'Nilai tetap teks terlalu panjang.',
            'tetap.tanggal.date_format' => 'Nilai tetap tanggal harus format YYYY-MM-DD.',
        ];
    }

    /**
     * Konteks cetak yang siap dipakai PdfIsian. Nilai tetap apa pun selain
     * teks dan tanggal dibuang supaya tidak ada jalur tersembunyi.
     */
    public function konteks(string $jenjang): KonteksCetak
    {
        return new KonteksCetak(
            jenjang: $jenjang,
            tahunAjaran: $this->input('tahun_ajaran'),
            semester: $this->input('semester'),
            kelasId: $this->input('kelas_id') !== null ? (int) $this->input('kelas_id') : null,
            pencetak: $this->user(),
            tetap: [
                'teks' => (string) ($this->input('tetap.teks') ?? ''),
                'tanggal' => (string) ($this->input('tetap.tanggal') ?? ''),
            ],
            tanggalAbsen: $this->input('tanggal_absen'),
            idSantri: $this->input('id_santri') !== null ? (int) $this->input('id_santri') : null,
            idPegawai: $this->input('id_pegawai') !== null ? (int) $this->input('id_pegawai') : null,
            idPsbCalon: $this->input('id_psb_calon') !== null ? (int) $this->input('id_psb_calon') : null,
        );
    }

    /** @return list<string> sumber yang dipakai media pada template ini. */
    public function sumberDipakai(array $medan): array
    {
        $pakai = [];

        foreach ($medan as $satu) {
            foreach (['sumber', 'kunci'] as $kunci) {
                $nilai = $satu[$kunci] ?? null;

                if ($nilai !== null && $nilai !== '' && ! in_array($nilai, $pakai, true)) {
                    $pakai[] = (string) $nilai;
                }
            }

            foreach ($satu['baris_berulang']['kolom'] ?? [] as $kolom) {
                $nilai = $kolom['sumber'] ?? null;

                if ($nilai !== null && $nilai !== '' && ! in_array($nilai, $pakai, true)) {
                    $pakai[] = (string) $nilai;
                }
            }
        }

        return array_values(array_filter($pakai, fn (string $s) => KatalogNilai::dikenal($s)));
    }
}
