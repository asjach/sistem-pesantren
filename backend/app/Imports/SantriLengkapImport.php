<?php

namespace App\Imports;

use App\Models\Santri;
use App\Support\Tanggal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Validators\Failure;
use PhpOffice\PhpSpreadsheet\Shared\Date;

/**
 * Import BUKU INDUK: identitas santri saja (`santri`).
 *
 * Tidak menyentuh keanggotaan (`lembaga_santri`) maupun riwayat akademik
 * (`riwayat_belajar`) — keduanya lewat halaman/import masing-masing.
 * Kolom template = KOLOM_PROFIL (tanpa kolom penempatan/status).
 */
class SantriLengkapImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMapping, WithMultipleSheets, WithValidation
{
    /** @var Failure[] */
    protected array $failures = [];

    /**
     * Kolom teks yang rawan terbaca sebagai angka dari sel numerik Excel/CSV
     * (NISN `1234567890` tiba sebagai int → gagal rule `string`).
     */
    protected const KOLOM_TEKS = [
        'nik', 'nisn', 'no_kk', 'ayah_nik', 'ibu_nik', 'wali_nik',
        'rt', 'rw', 'kode_pos', 'no_hp_santri', 'ayah_telp', 'ibu_telp', 'wali_telp',
        'nomor_kip', 'nis_lokal', 'nis_kemenag', 'kode_lembaga',
    ];

    /** Kolom tanggal: serial number Excel → `Y-m-d` (string teks lolos apa adanya). */
    protected const KOLOM_TANGGAL = [
        'tgl_lahir', 'tanggal_masuk', 'ayah_tgl_lahir', 'ibu_tgl_lahir',
        'wali_tgl_lahir', 'tgl_masuk', 'tgl_selesai',
    ];

    /** Ringkasan baris (dipakai mode periksa/dry-run). */
    protected int $barisValid = 0;

    /** Ringkasan hasil pemrosesan file (baris gagal validasi tetap dihitung). */
    public function ringkasan(): array
    {
        return [
            'baris_diproses' => $this->barisValid + count($this->failures),
            'baris_valid' => $this->barisValid,
            'baris_gagal' => count($this->failures),
        ];
    }

    /** Hanya sheet pertama yang diimport (template memuat sheet "Referensi" tersembunyi). */
    public function sheets(): array
    {
        return [0 => $this];
    }

    /**
     * Normalisasi baris SEBELUM validasi (maatwebsite: map → validate → collection).
     * Berlaku untuk import identitas DAN gabungan (diwariskan).
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public function map($row): array
    {
        $baris = (array) $row;

        foreach (static::KOLOM_TEKS as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                // 26001.0 → '26001' (bukan '26001.0'); pecahan tak wajar dibiarkan string.
                $baris[$kolom] = fmod((float) $baris[$kolom], 1.0) === 0.0
                    ? (string) (int) $baris[$kolom]
                    : (string) $baris[$kolom];
            }
        }

        foreach (static::KOLOM_TANGGAL as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                try {
                    $baris[$kolom] = Date::excelToDateTimeObject($baris[$kolom])->format('Y-m-d');
                } catch (\Throwable $e) {
                    // Biarkan apa adanya agar validasi `date` menolak dengan pesan jelas.
                }
            }
        }

        return $baris;
    }

    public function onUnknownSheet(string|int $sheetName): void
    {
        // Sheet tambahan (mis. "Referensi") diabaikan.
    }

    public function collection(Collection $rows): void
    {
        // Kunci konsistensi-03: import diasumsikan single-operator (satu admin satu file satu waktu).
        DB::transaction(function () use ($rows) {
            $dilihat = []; // guard duplikat intra-file: kunci nik|nama|tgl
            $no = 0;
            foreach ($rows as $row) {
                $no++;
                $baris = $row instanceof Collection ? $row->toArray() : $row;
                // Baris tanpa nama_lengkap dianggap baris kosong/pemisah, lewati
                if (empty($baris['nama_lengkap'])) {
                    continue;
                }

                $this->simpanDenganNik($baris, $this->buatDataSantri($baris), $dilihat);

                $this->barisValid++;
            }
        });
    }

    /**
     * Bangun array kolom `santri` dari satu baris file (dipakai ulang import gabungan).
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    protected function buatDataSantri(array $row): array
    {
        return [
            'nama_lengkap' => $row['nama_lengkap'],
            'nama_singkat' => $row['nama_singkat'] ?? null,
            'nisn' => $row['nisn'] ?? null,
            'tmp_lahir' => $row['tmp_lahir'] ?? null,
            'tgl_lahir' => Tanggal::parse($row['tgl_lahir'] ?? null),
            'jk' => $row['jk'] ?? null,
            'anak_ke' => $row['anak_ke'] ?? null,
            'j_saudara' => $row['j_saudara'] ?? null,
            'tipe_santri' => in_array($row['tipe_santri'] ?? null, ['asrama', 'non_asrama'], true) ? $row['tipe_santri'] : 'non_asrama',
            'no_hp_santri' => $row['no_hp_santri'] ?? null,
            'email_santri' => $row['email_santri'] ?? null,
            'agama' => $row['agama'] ?? 'Islam',
            'cita_cita' => $row['cita_cita'] ?? null,
            'hobi' => $row['hobi'] ?? null,
            'kebutuhan_khusus' => $row['kebutuhan_khusus'] ?? null,
            'kebutuhan_disabilitas' => $row['kebutuhan_disabilitas'] ?? null,
            'nomor_kip' => $row['nomor_kip'] ?? null,
            'no_kk' => $row['no_kk'] ?? null,
            'kepala_keluarga' => $row['kepala_keluarga'] ?? null,
            'kewarganegaraan' => ($row['kewarganegaraan'] ?? null) ?: 'WNI',
            'bahasa_sehari' => $row['bahasa_sehari'] ?? null,
            'status_tempat_tinggal' => $row['status_tempat_tinggal'] ?? null,
            'jarak_ke_pesantren' => $row['jarak_ke_pesantren'] ?? null,
            'waktu_tempuh' => $row['waktu_tempuh'] ?? null,
            'transportasi' => $row['transportasi'] ?? null,
            'tanggal_masuk' => Tanggal::parse($row['tanggal_masuk'] ?? null),

            // Data Orang Tua & Wali
            'ayah_nama' => $row['ayah_nama'] ?? null,
            'ayah_nik' => $row['ayah_nik'] ?? null,
            'ayah_tmp_lahir' => $row['ayah_tmp_lahir'] ?? null,
            'ayah_tgl_lahir' => Tanggal::parse($row['ayah_tgl_lahir'] ?? null),
            'ayah_status' => $row['ayah_status'] ?? null,
            'ayah_pendidikan' => $row['ayah_pendidikan'] ?? null,
            'ayah_pekerjaan' => $row['ayah_pekerjaan'] ?? null,
            'ayah_penghasilan' => $row['ayah_penghasilan'] ?? null,
            'ayah_telp' => $row['ayah_telp'] ?? null,
            'ayah_alamat' => $row['ayah_alamat'] ?? null,
            'ayah_status_tempat_tinggal' => $row['ayah_status_tempat_tinggal'] ?? null,
            'ibu_nama' => $row['ibu_nama'] ?? null,
            'ibu_nik' => $row['ibu_nik'] ?? null,
            'ibu_tmp_lahir' => $row['ibu_tmp_lahir'] ?? null,
            'ibu_tgl_lahir' => Tanggal::parse($row['ibu_tgl_lahir'] ?? null),
            'ibu_status' => $row['ibu_status'] ?? null,
            'ibu_pendidikan' => $row['ibu_pendidikan'] ?? null,
            'ibu_pekerjaan' => $row['ibu_pekerjaan'] ?? null,
            'ibu_penghasilan' => $row['ibu_penghasilan'] ?? null,
            'ibu_telp' => $row['ibu_telp'] ?? null,
            'ibu_alamat' => $row['ibu_alamat'] ?? null,
            'ibu_status_tempat_tinggal' => $row['ibu_status_tempat_tinggal'] ?? null,
            'wali_nama' => $row['wali_nama'] ?? null,
            'wali_nik' => $row['wali_nik'] ?? null,
            'wali_tmp_lahir' => $row['wali_tmp_lahir'] ?? null,
            'wali_tgl_lahir' => Tanggal::parse($row['wali_tgl_lahir'] ?? null),
            'wali_status' => $row['wali_status'] ?? null,
            'wali_pendidikan' => $row['wali_pendidikan'] ?? null,
            'wali_pekerjaan' => $row['wali_pekerjaan'] ?? null,
            'wali_penghasilan' => $row['wali_penghasilan'] ?? null,
            'wali_telp' => $row['wali_telp'] ?? null,
            'wali_alamat' => $row['wali_alamat'] ?? null,
            'wali_status_tempat_tinggal' => $row['wali_status_tempat_tinggal'] ?? null,
            'yang_membiayai' => $row['yang_membiayai'] ?? null,

            // Alamat
            'provinsi' => $row['provinsi'] ?? null,
            'kab_kota' => $row['kab_kota'] ?? null,
            'kecamatan' => $row['kecamatan'] ?? null,
            'desa_kelurahan' => $row['desa_kelurahan'] ?? null,
            'rt' => $row['rt'] ?? null,
            'rw' => $row['rw'] ?? null,
            'alamat' => $row['alamat'] ?? null,
            'kode_pos' => $row['kode_pos'] ?? null,
        ];
    }

    /**
     * Upsert identitas via kunci NIK (dipakai ulang import gabungan).
     * NIK kosong → selalu create() baru (pitfall null = semua baris saling menimpa).
     *
     * @param  array<string, mixed>  $row
     * @param  array<string, mixed>  $dataSantri
     * @param  array<string, Santri>  $dilihat  guard duplikat intra-file (kunci nik|nama|tgl)
     */
    protected function simpanDenganNik(array $row, array $dataSantri, array &$dilihat): Santri
    {
        // PENTING: hanya pakai pencocokan NIK saat NIK terisi.
        if (! empty($row['nik'])) {
            // Dedup identitas nik+nama+tgl_lahir (NIK boleh fiktif/ganda).
            $kunci = strtolower(trim((string) $row['nik'])).'|'.strtolower(trim((string) $dataSantri['nama_lengkap'])).'|'.(string) ($dataSantri['tgl_lahir'] ?? '');
            if (isset($dilihat[$kunci])) {
                $dilihat[$kunci]->update($dataSantri);

                return $dilihat[$kunci];
            }
            // Banding tanggal di PHP (format Y-m-d) agar berlaku MySQL+SQLite.
            $tglBaru = ! empty($dataSantri['tgl_lahir'])
                ? Carbon::parse($dataSantri['tgl_lahir'])->format('Y-m-d')
                : null;
            $santri = Santri::where('nik', $row['nik'])
                ->where('nama_lengkap', $dataSantri['nama_lengkap'])
                ->get()
                ->first(function (Santri $s) use ($tglBaru) {
                    $tglLama = ! empty($s->tgl_lahir)
                        ? Carbon::parse($s->tgl_lahir)->format('Y-m-d')
                        : null;

                    return $tglLama === $tglBaru;
                });

            if ($santri) {
                $santri->update($dataSantri);
            } else {
                $santri = Santri::create(array_merge($dataSantri, ['nik' => $row['nik']]));
            }
            $dilihat[$kunci] = $santri;

            return $santri;
        }

        return Santri::create(array_merge($dataSantri, ['nik' => null]));
    }

    protected function fail(int $no, string $attribute, string $pesan): void
    {
        $this->failures[] = new Failure($no, $attribute, [$pesan], []);
    }

    /**
     * Nilai tanggal dari Excel bisa berupa serial number ATAU string
     * tanggal biasa (tergantung format cell di file sumber).
     */
    public function rules(): array
    {
        return [
            'nama_lengkap' => ['required', 'string', 'max:255'],
            'jk' => ['required', 'in:L,P'],
            'nik' => ['nullable', 'digits:16'],
            'nisn' => ['nullable', 'digits:10'],
            'tipe_santri' => ['nullable', 'in:asrama,non_asrama'],
            // Kolom kamus: string bebas (tanpa exists)
            'agama' => ['nullable', 'string', 'max:50'],
            'hobi' => ['nullable', 'string', 'max:50'],
            'cita_cita' => ['nullable', 'string', 'max:50'],
            'kebutuhan_khusus' => ['nullable', 'string', 'max:50'],
            'kebutuhan_disabilitas' => ['nullable', 'string', 'max:50'],
            'ayah_pekerjaan' => ['nullable', 'string', 'max:50'],
            'ayah_pendidikan' => ['nullable', 'string', 'max:50'],
            'ibu_pekerjaan' => ['nullable', 'string', 'max:50'],
            'ibu_pendidikan' => ['nullable', 'string', 'max:50'],
            'wali_pekerjaan' => ['nullable', 'string', 'max:50'],
            'wali_pendidikan' => ['nullable', 'string', 'max:50'],
            'wali_penghasilan' => ['nullable', 'string', 'max:50'],
            'wali_status' => ['nullable', 'string', 'max:50'],
            'wali_tmp_lahir' => ['nullable', 'string', 'max:50'],
            'wali_tgl_lahir' => ['nullable', 'date'],
            'wali_alamat' => ['nullable', 'string'],
            'wali_status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'ayah_penghasilan' => ['nullable', 'string', 'max:50'],
            'ibu_penghasilan' => ['nullable', 'string', 'max:50'],
            'ayah_status' => ['nullable', 'string', 'max:50'],
            'ibu_status' => ['nullable', 'string', 'max:50'],
            'ayah_tmp_lahir' => ['nullable', 'string', 'max:50'],
            'ibu_tmp_lahir' => ['nullable', 'string', 'max:50'],
            'ayah_tgl_lahir' => ['nullable', 'date'],
            'ibu_tgl_lahir' => ['nullable', 'date'],
            'ayah_alamat' => ['nullable', 'string'],
            'ibu_alamat' => ['nullable', 'string'],
            'ayah_status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'ibu_status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'tmp_lahir' => ['nullable', 'string', 'max:50'],
            'no_hp_santri' => ['nullable', 'string', 'max:20'],
            'email_santri' => ['nullable', 'email', 'max:255'],
            'no_kk' => ['nullable', 'digits:16'],
            'kewarganegaraan' => ['nullable', 'string', 'max:10'],
            'bahasa_sehari' => ['nullable', 'string', 'max:50'],
            'status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'jarak_ke_pesantren' => ['nullable', 'string', 'max:50'],
            'waktu_tempuh' => ['nullable', 'string', 'max:50'],
            'transportasi' => ['nullable', 'string', 'max:50'],
            'yang_membiayai' => ['nullable', 'string', 'max:50'],
            'tanggal_masuk' => ['nullable', 'date'],
            'rt' => ['nullable', 'string', 'max:3'],
            'rw' => ['nullable', 'string', 'max:3'],
            'provinsi' => ['nullable', 'string', 'max:50'],
            'kecamatan' => ['nullable', 'string', 'max:50'],
            'desa_kelurahan' => ['nullable', 'string', 'max:50'],
        ];
    }

    /**
     * NIK yang cocok dengan santri existing (mis. hasil ACC PSB) → UPDATE baris
     * itu, bukan create ganda. NIK kosong → selalu create() baru.
     */
    public function onFailure(Failure ...$failures): void
    {
        $this->failures = array_merge($this->failures, $failures);
    }

    public function failures(): array
    {
        return $this->failures;
    }
}
