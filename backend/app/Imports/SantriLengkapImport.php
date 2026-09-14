<?php

namespace App\Imports;

use App\Models\Kelas;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Validators\Failure;
use PhpOffice\PhpSpreadsheet\Shared\Date;

class SantriLengkapImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMultipleSheets, WithValidation
{
    protected ?int $tahunAjaranId;

    protected ?int $lembagaId;

    /** @var Failure[] */
    protected array $failures = [];

    /** Ringkasan baris (dipakai mode periksa/dry-run). */
    protected int $barisValid = 0;

    public function __construct(?int $tahunAjaranId, ?int $lembagaId = null)
    {
        $this->tahunAjaranId = $tahunAjaranId;
        $this->lembagaId = $lembagaId;
    }

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

    public function onUnknownSheet(string|int $sheetName): void
    {
        // Sheet tambahan (mis. "Referensi") diabaikan.
    }

    public function collection(Collection $rows): void
    {
        // Kunci konsistensi-03: import diasumsikan single-operator (satu admin satu file satu waktu).
        // Race dua admin import bersamaan bisa create ganda — terima sebagai batasan operasional.
        DB::transaction(function () use ($rows) {
            $dilihat = []; // guard duplikat intra-file: kunci nik|nama|tgl
            $no = 0;
            foreach ($rows as $row) {
                $no++;
                // Baris tanpa nama_lengkap dianggap baris kosong/pemisah, lewati
                if (empty($row['nama_lengkap'])) {
                    continue;
                }

                // Lembaga per baris (v1.10): kolom `lembaga_id` template menang;
                // null = legacy tanpa track (tanpa riwayat, status_global nonaktif).
                $lembagaRow = ! empty($row['lembaga_id']) ? (int) $row['lembaga_id'] : $this->lembagaId;

                // Kelas harus selembaga & setahun ajaran dengan baris (cegah penempatan silang).
                $kelasId = ! empty($row['kelas_id']) ? (int) $row['kelas_id'] : null;
                if ($kelasId !== null && $lembagaRow !== null) {
                    $kelas = Kelas::find($kelasId);
                    if (! $kelas || (int) $kelas->lembaga_id !== $lembagaRow) {
                        $this->failures[] = new Failure($no, 'kelas_id', ['Kelas tidak berada di lembaga baris ini.'], []);

                        continue;
                    }
                    if ($this->tahunAjaranId !== null && (int) $kelas->tahun_ajaran_id !== $this->tahunAjaranId) {
                        $this->failures[] = new Failure($no, 'kelas_id', ['Kelas bukan milik tahun ajaran import.'], []);

                        continue;
                    }
                }

                // TA file wajib se-lembaga dengan baris bila lembaga baris punya TA
                // sendiri (lembaga tanpa TA = boleh, diperbaiki setelah TA dibuat).
                if ($lembagaRow !== null && $this->tahunAjaranId !== null
                    && TahunAjaran::where('lembaga_id', $lembagaRow)->exists()
                    && ! TahunAjaran::where('id', $this->tahunAjaranId)->where('lembaga_id', $lembagaRow)->exists()
                ) {
                    $this->failures[] = new Failure($no, 'tahun_ajaran_id', ['Tahun ajaran bukan milik lembaga baris ini.'], []);

                    continue;
                }

                // NIS wajib unik: catat sebagai failure baris (bukan menggagalkan file)
                // bila sudah dipakai santri lain (master maupun arsip riwayat).
                $pastikanNisUnik = function (?int $santriId) use ($row, $no): bool {
                    $nis = $row['nis'] ?? null;
                    if ($nis === null || trim((string) $nis) === '' || ! Santri::nisDipakai((string) $nis, $santriId)) {
                        return true;
                    }
                    $this->failures[] = new Failure($no, 'nis', ['NIS sudah dipakai santri lain.'], []);

                    return false;
                };

                $dataSantri = [
                    'lembaga_id' => $lembagaRow,
                    'kelas_id' => $kelasId,
                    'nama_lengkap' => $row['nama_lengkap'],
                    'nama_singkat' => $row['nama_singkat'] ?? null,
                    'nisn' => $row['nisn'] ?? null,
                    'tmp_lahir' => $row['tmp_lahir'] ?? null,
                    'tgl_lahir' => $this->parseTanggal($row['tgl_lahir'] ?? null),
                    'jk' => $row['jk'] ?? null,
                    'anak_ke' => $row['anak_ke'] ?? null,
                    'j_saudara' => $row['j_saudara'] ?? null,
                    'agama' => $row['agama'] ?? 'Islam',
                    'cita_cita' => $row['cita_cita'] ?? null,
                    'hobi' => $row['hobi'] ?? null,
                    'kebutuhan_khusus' => $row['kebutuhan_khusus'] ?? null,
                    'nomor_kip' => $row['nomor_kip'] ?? null,

                    // Data Orang Tua & Wali
                    'ayah_nama' => $row['ayah_nama'] ?? null,
                    'ayah_nik' => $row['ayah_nik'] ?? null,
                    'ayah_tmp_lahir' => $row['ayah_tmp_lahir'] ?? null,
                    'ayah_tgl_lahir' => $this->parseTanggal($row['ayah_tgl_lahir'] ?? null),
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
                    'ibu_tgl_lahir' => $this->parseTanggal($row['ibu_tgl_lahir'] ?? null),
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
                    'wali_tgl_lahir' => $this->parseTanggal($row['wali_tgl_lahir'] ?? null),
                    'wali_status' => $row['wali_status'] ?? null,
                    'wali_pendidikan' => $row['wali_pendidikan'] ?? null,
                    'wali_pekerjaan' => $row['wali_pekerjaan'] ?? null,
                    'wali_penghasilan' => $row['wali_penghasilan'] ?? null,
                    'wali_telp' => $row['wali_telp'] ?? null,
                    'wali_alamat' => $row['wali_alamat'] ?? null,
                    'wali_status_tempat_tinggal' => $row['wali_status_tempat_tinggal'] ?? null,
                    'yang_membiayai' => $row['yang_membiayai'] ?? null,
                    'no_hp_santri' => $row['no_hp_santri'] ?? null,
                    'email_santri' => $row['email_santri'] ?? null,
                    'kebutuhan_disabilitas' => $row['kebutuhan_disabilitas'] ?? null,
                    'no_kk' => $row['no_kk'] ?? null,
                    'kewarganegaraan' => $row['kewarganegaraan'] ?: 'WNI',
                    'bahasa_sehari' => $row['bahasa_sehari'] ?? null,
                    'status_tempat_tinggal' => $row['status_tempat_tinggal'] ?? null,
                    'jarak_ke_pesantren' => $row['jarak_ke_pesantren'] ?? null,
                    'waktu_tempuh' => $row['waktu_tempuh'] ?? null,
                    'transportasi' => $row['transportasi'] ?? null,
                    'tanggal_masuk' => $this->parseTanggal($row['tanggal_masuk'] ?? null),
                    'rt' => $row['rt'] ?? null,
                    'rw' => $row['rw'] ?? null,

                    // Alamat
                    'provinsi' => $row['provinsi'] ?? null,
                    'kab_kota' => $row['kab_kota'] ?? null,
                    'kecamatan' => $row['kecamatan'] ?? null,
                    'desa_kelurahan' => $row['desa_kelurahan'] ?? null,
                    'alamat' => $row['alamat'] ?? null,
                    'kode_pos' => $row['kode_pos'] ?? null,
                    'nis' => $row['nis'] ?? null, // NIS aktif terakhir (kuitansi/rapor)
                    'tipe_santri' => in_array($row['tipe_santri'] ?? null, ['asrama', 'non_asrama'], true) ? $row['tipe_santri'] : 'non_asrama',
                    // status_global TIDAK di-hardcode (v1.10): dihitung turunan dari riwayat di bawah.
                ];

                // PENTING: hanya pakai updateOrCreate() saat NIK terisi.
                // Jika NIK kosong untuk beberapa baris, mencocokkan pada
                // 'nik' => null akan membuat SEMUA baris tanpa NIK menimpa
                // satu record yang sama — jadi baris tanpa NIK selalu di-create() baru.
                // NIS belakangan: NIK yang cocok dengan santri existing (mis. hasil
                // ACC PSB, nis null) -> update baris itu, bukan create ganda.
                if (! empty($row['nik'])) {
                    // Dedup identitas nik+nama+tgl_lahir (NIK boleh fiktif/ganda; nik sama nama/tgl beda = anak beda).
                    // Guard intra-file dulu (tanpa unique NIK, duplikat baris identik dalam file yang sama harus update, bukan create ganda).
                    $kunci = strtolower(trim((string) $row['nik'])).'|'.strtolower(trim((string) $dataSantri['nama_lengkap'])).'|'.(string) ($dataSantri['tgl_lahir'] ?? '');
                    if (isset($dilihat[$kunci])) {
                        if (! $pastikanNisUnik($dilihat[$kunci]->id)) {
                            continue;
                        }
                        $dilihat[$kunci]->update($dataSantri);
                        $santri = $dilihat[$kunci];
                    } else {
                        // Banding tanggal di PHP (format Y-m-d) agar berlaku MySQL+SQLite:
                        // ambil kandidat nik+nama lalu samakan tgl_lahir di PHP (termasuk null === null).
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
                        if (! $pastikanNisUnik($santri?->id)) {
                            continue;
                        }
                        if ($santri) {
                            $santri->update($dataSantri);
                        } else {
                            $santri = Santri::create(array_merge($dataSantri, [
                                'nik' => $row['nik'],
                            ]));
                        }
                        $dilihat[$kunci] = $santri;
                    }
                } else {
                    if (! $pastikanNisUnik(null)) {
                        continue;
                    }
                    $santri = Santri::create(array_merge($dataSantri, [
                        'nik' => null,
                    ]));
                }

                // 2. Riwayat perdana hanya bila baris punya lembaga + tahun ajaran;
                //    tanpa keduanya = legacy tanpa track (santri saja).
                if ($lembagaRow !== null && $this->tahunAjaranId !== null) {
                    RiwayatBelajar::updateOrCreate(
                        [
                            'santri_id' => $santri->id,
                            'tahun_ajaran_id' => $this->tahunAjaranId,
                            'lembaga_id' => $lembagaRow,
                            'semester' => '1',
                        ],
                        [
                            'kelas_id' => $kelasId,
                            'nis' => $row['nis'] ?? null,
                            'tingkat' => $row['tingkat'] ?? null,
                            'tgl_masuk' => $row['tanggal_masuk'] ?? null,
                            'no_absen' => $row['no_absen'] ?? null,
                            'status_awal' => 'santri_baru',
                            'status_akhir' => 'aktif',
                            'is_aktif' => true,
                        ]
                    );
                }

                // status_global turunan murni (v1.10): true iff ada riwayat aktif.
                $santri->update([
                    'status_global' => RiwayatBelajar::where('santri_id', $santri->id)->where('is_aktif', true)->exists(),
                ]);

                $this->barisValid++;
            }
        });
    }

    /**
     * Nilai tanggal dari Excel bisa berupa serial number ATAU string
     * tanggal biasa (tergantung format cell di file sumber).
     */
    protected function parseTanggal($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        if (is_numeric($value)) {
            return Date::excelToDateTimeObject($value)->format('Y-m-d');
        }

        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }

    public function rules(): array
    {
        return [
            'nama_lengkap' => ['required', 'string', 'max:255'],
            'jk' => ['required', 'in:L,P'],
            'kelas_id' => ['nullable', 'integer', 'exists:kelas,id'],
            // Lembaga baris wajib operasional (bukan root pesantren).
            'lembaga_id' => ['nullable', 'integer', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'nik' => ['nullable', 'digits:16'],
            'nis' => ['nullable', 'string', 'max:10'],
            'tipe_santri' => ['nullable', 'in:asrama,non_asrama'],
            'nisn' => ['nullable', 'string', 'max:10'],
            // Kolom kamus: string bebas (tanpa exists)
            'agama' => ['nullable', 'string', 'max:50'],
            'hobi' => ['nullable', 'string', 'max:50'],
            'cita_cita' => ['nullable', 'string', 'max:50'],
            'kebutuhan_khusus' => ['nullable', 'string', 'max:50'],
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
            'kebutuhan_disabilitas' => ['nullable', 'string', 'max:50'],
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
     * NIS belakangan via import: jika NIK terisi dan cocok dengan santri existing
     * (misal hasil ACC PSB yang nis-nya masih null), UPDATE baris itu
     * (khususnya nis/kelas + riwayat) — jangan create ganda.
     * NIK kosong -> selalu create() baru (pitfall updateOrCreate null).
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
