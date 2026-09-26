<?php

namespace App\Services;

use App\Models\Pegawai;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Validator;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Import identitas Buku Induk Guru per baris (`pegawai` saja; tanpa
 * penempatan — penempatan via halaman Lembaga Pegawai).
 * Kunci: `pegawai_id` eksak → `nip` eksak → buat baru (wajib nama + JK).
 */
class PegawaiImporService extends ImporPotongan
{
    protected const KOLOM_TEKS = [
        'nip', 'nik', 'no_kk', 'nisn', 'no_hp', 'rt', 'rw', 'kode_pos',
        'no_bpjs', 'npwp', 'niat_npa',
    ];

    protected const KOLOM_TANGGAL = ['tanggal_lahir', 'tgl_mulai_kerja', 'tgl_sk_awal'];

    public static function rules(): array
    {
        return [
            'pegawai_id' => ['nullable', 'integer'],
            'nama_lengkap' => ['required_without:pegawai_id', 'nullable', 'string', 'max:255'],
            'jenis_kelamin' => ['required_without:pegawai_id', 'nullable', 'in:L,P'],
            'nip' => ['nullable', 'string', 'max:50'],
            'nik' => ['nullable', 'string', 'max:20'],
            'gelar_depan' => ['nullable', 'string', 'max:50'],
            'gelar_belakang' => ['nullable', 'string', 'max:50'],
            'tempat_lahir' => ['nullable', 'string', 'max:100'],
            'tanggal_lahir' => ['nullable', 'date'],
            'no_hp' => ['nullable', 'string', 'max:20'],
            'email_pribadi' => ['nullable', 'email', 'max:255'],
            'email_gws' => ['nullable', 'email', 'max:255'],
            'status_aktif' => ['nullable', 'in:aktif,cuti,keluar'],
            'tgl_mulai_kerja' => ['nullable', 'date'],
            'no_sk_awal' => ['nullable', 'string', 'max:100'],
            'tgl_sk_awal' => ['nullable', 'date'],
            'pendidikan_terakhir' => ['nullable', 'string', 'max:100'],
            'jenis_ptk' => ['nullable', 'string', 'max:100'],
            'status_pernikahan' => ['nullable', 'string', 'max:100'],
            'agama' => ['nullable', 'string', 'max:100'],
            'gol_darah' => ['nullable', 'string', 'max:10'],
            'npwp' => ['nullable', 'string', 'max:50'],
            'no_kk' => ['nullable', 'string', 'max:20'],
            'no_bpjs' => ['nullable', 'string', 'max:50'],
            'status_tempat_tinggal' => ['nullable', 'string', 'max:100'],
            'niat_npa' => ['nullable', 'string', 'max:100'],
            'jarak_ke_pesantren' => ['nullable', 'string', 'max:100'],
            'waktu_tempuh' => ['nullable', 'string', 'max:100'],
            'transportasi' => ['nullable', 'string', 'max:100'],
            'sertifikasi' => ['nullable', 'in:sudah,belum'],
            'provinsi' => ['nullable', 'string', 'max:100'],
            'kab_kota' => ['nullable', 'string', 'max:100'],
            'kecamatan' => ['nullable', 'string', 'max:100'],
            'desa_kelurahan' => ['nullable', 'string', 'max:100'],
            'rt' => ['nullable', 'string', 'max:3'],
            'rw' => ['nullable', 'string', 'max:3'],
            'kode_pos' => ['nullable', 'string', 'max:10'],
            'alamat' => ['nullable', 'string'],
        ];
    }

    /** @param  array<string, mixed>  $baris */
    public function normalisasiBaris(array $baris): array
    {
        $baris = $this->castTeks($baris, self::KOLOM_TEKS);
        $baris = $this->castTanggal($baris);
        foreach (self::KOLOM_TANGGAL as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                try {
                    $baris[$kolom] = ExcelDate::excelToDateTimeObject($baris[$kolom])->format('Y-m-d');
                } catch (\Throwable $e) {
                }
            }
        }

        return $baris;
    }

    /** @param  array<string, mixed>  $baris */
    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $nip = trim((string) ($baris['nip'] ?? ''));
        $this->kunciAktif = $nip !== '' ? $nip : (trim((string) ($baris['nama_lengkap'] ?? '')) ?: null);

        if (empty($baris['nama_lengkap']) && empty($baris['pegawai_id']) && empty($baris['nip']) && empty($baris['nik'])) {
            return;
        }

        $validator = Validator::make($baris, static::rules());
        if ($validator->fails()) {
            $kolom = (string) $validator->errors()->keys()[0];
            $this->fail($no, $kolom, (string) $validator->errors()->first($kolom));

            return;
        }

        try {
            $pegawai = null;
            $baru = false;
            if (! empty($baris['pegawai_id'])) {
                $pegawai = Pegawai::find((int) $baris['pegawai_id']);
                if (! $pegawai) {
                    $this->fail($no, 'pegawai_id', 'ID pegawai tidak ditemukan.');

                    return;
                }
            } elseif ($nip !== '') {
                $pegawai = Pegawai::where('nip', $nip)->first();
            }

            $data = [];
            foreach (['nama_lengkap', 'nip', 'nik', 'gelar_depan', 'gelar_belakang', 'jenis_kelamin',
                'tempat_lahir', 'tanggal_lahir', 'no_hp', 'email_pribadi', 'email_gws',
                'status_aktif', 'tgl_mulai_kerja', 'no_sk_awal', 'tgl_sk_awal', 'pendidikan_terakhir', 'jenis_ptk',
                'status_pernikahan', 'agama', 'gol_darah',
                'npwp', 'no_kk', 'no_bpjs', 'status_tempat_tinggal', 'niat_npa',
                'jarak_ke_pesantren', 'waktu_tempuh', 'transportasi', 'sertifikasi',
                'provinsi', 'kab_kota', 'kecamatan', 'desa_kelurahan', 'rt', 'rw', 'kode_pos', 'alamat'] as $kolom) {
                if (array_key_exists($kolom, $baris) && trim((string) $baris[$kolom]) !== '') {
                    $data[$kolom] = is_string($baris[$kolom]) ? trim($baris[$kolom]) : $baris[$kolom];
                }
            }

            if ($pegawai) {
                if (! $kering && $data !== []) {
                    $pegawai->update($data);
                }
                $this->diperbarui++;
            } else {
                if (! isset($data['nama_lengkap']) || ! isset($data['jenis_kelamin'])) {
                    $this->fail($no, 'nama_lengkap', 'Nama + JK wajib untuk pegawai baru.');

                    return;
                }
                if (! $kering) {
                    Pegawai::create($data);
                }
                $this->dibuat++;
            }
            $this->valid++;
        } catch (QueryException $e) {
            $this->fail($no, 'basis_data', 'Gagal menyimpan baris ini (kemungkinan NIP/NIK ganda).');
        }
    }
}
