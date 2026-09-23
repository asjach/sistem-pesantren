<?php

namespace App\Imports;

use App\Models\Kelas;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Services\RefService;
use App\Support\Tanggal;
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

/**
 * Import arsip mutasi keluar multi-lembaga: tiap baris membawa `jenjang`
 * sendiri. Kunci santri: `nis_lokal` + `jenjang`. Baris yang sama (santri +
 * jenjang + tanggal) dilewati (`dilewati`) agar file boleh diimport ulang.
 *
 * Efek per baris valid MENIRU tombol "Proses mutasi": arsip ditulis; bila
 * santri masih punya riwayat aktif di jenjang itu, riwayat ditutup
 * (`pindah_keluar`, nonaktif) + keanggotaan ditutup + status global
 * dihitung ulang. Santri yang memang sudah nonaktif hanya menambah arsip.
 *
 * `kelas_terakhir` diisi nama rombel (id numerik tetap diterima) dalam
 * lingkup jenjang; `tahun_ajaran` opsional mempersempit pencarian nama —
 * wajib diisi bila nama yang sama ada di beberapa tahun ajaran. Kosong →
 * beku otomatis dari riwayat terakhir (pola live).
 *
 * Izin mengikuti akun per baris (pola import kelas) — baris di luar lingkup
 * gagal per baris, bukan 403.
 */
class MutasiKeluarImport implements SkipsOnFailure, SkipsUnknownSheets, ToCollection, WithHeadingRow, WithMapping, WithMultipleSheets, WithValidation
{
    /** @var Failure[] */
    protected array $failures = [];

    /** Nomor baris Excel global untuk atribusi kegagalan (1 = heading). */
    protected int $nomorBaris = 1;

    protected int $barisValid = 0;

    protected int $dibuat = 0;

    protected int $dilewati = 0;

    public function ringkasan(): array
    {
        return [
            'baris_diproses' => $this->barisValid + count($this->failures),
            'baris_valid' => $this->barisValid,
            'baris_gagal' => count($this->failures),
            'dibuat' => $this->dibuat,
            'dilewati' => $this->dilewati,
        ];
    }

    /** Hanya sheet pertama yang diimport. */
    public function sheets(): array
    {
        return [0 => $this];
    }

    public function onUnknownSheet(string|int $sheetName): void
    {
        // Sheet tambahan diabaikan.
    }

    /**
     * Normalisasi SEBELUM validasi: angka Excel → string (NIS ber-nol-depan
     * dan tanggal serial tetap terbaca; tanggal diparse via Tanggal::parse).
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public function map($row): array
    {
        $baris = (array) $row;
        foreach (['nis_lokal', 'jenjang', 'tanggal_mutasi', 'alasan_mutasi', 'kelas_terakhir', 'tahun_ajaran', 'no_surat', 'nama_sekolah_tujuan', 'npsn_sekolah_tujuan', 'nsm_sekolah_tujuan', 'alamat_sekolah_tujuan', 'keterangan'] as $kolom) {
            if (isset($baris[$kolom]) && (is_int($baris[$kolom]) || is_float($baris[$kolom]))) {
                $baris[$kolom] = fmod((float) $baris[$kolom], 1.0) === 0.0
                    ? (string) (int) $baris[$kolom]
                    : (string) $baris[$kolom];
            }
        }

        return $baris;
    }

    public function rules(): array
    {
        return [
            // Sel Excel/CSV bisa terbaca sebagai angka → hindari rule `string` ketat.
            // Tanggal TANPA rule `date` (serial Excel gagal rule itu) — diparse manual.
            'nis_lokal' => ['required'],
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tanggal_mutasi' => ['required'],
            'alasan_mutasi' => ['required', 'string', 'max:100'],
            'kelas_terakhir' => ['nullable'],
            'tahun_ajaran' => ['nullable', 'string', 'exists:tahun_ajaran,nama'],
            'no_surat' => ['nullable', 'string', 'max:50'],
            'nama_sekolah_tujuan' => ['nullable', 'string', 'max:255'],
            'npsn_sekolah_tujuan' => ['nullable', 'string', 'max:20'],
            'nsm_sekolah_tujuan' => ['nullable', 'string', 'max:30'],
            'alamat_sekolah_tujuan' => ['nullable'],
            'keterangan' => ['nullable'],
        ];
    }

    public function collection(Collection $rows): void
    {
        DB::transaction(function () use ($rows) {
            foreach ($rows as $row) {
                $this->nomorBaris++;
                $baris = $row instanceof Collection ? $row->toArray() : $row;
                $jenjang = trim((string) ($baris['jenjang'] ?? ''));

                $auth = auth()->user();
                if (! $auth || ! $auth->canAccessLembaga($jenjang)) {
                    $this->fail($this->nomorBaris, 'jenjang', 'Lembaga di luar lingkup akses Anda.');

                    continue;
                }

                $santri = $this->cariSantri($baris, $jenjang);
                if ($santri === null) {
                    continue;
                }

                $tanggal = Tanggal::parse($baris['tanggal_mutasi'] ?? null);
                if ($tanggal === null) {
                    $this->fail($this->nomorBaris, 'tanggal_mutasi', 'Tanggal mutasi tidak valid.');

                    continue;
                }

                $alasan = trim((string) ($baris['alasan_mutasi'] ?? ''));
                if (! in_array($alasan, RefService::kodeAktif('alasan_mutasi', $jenjang), true)) {
                    $this->fail($this->nomorBaris, 'alasan_mutasi', 'Alasan mutasi tidak aktif di lembaga ini.');

                    continue;
                }
                if (! in_array('pindah_keluar', RefService::kodeAktif('status_akhir', $jenjang), true)) {
                    $this->fail($this->nomorBaris, 'jenjang', 'Status pindah_keluar nonaktif di lembaga ini.');

                    continue;
                }

                $kelasId = $this->resolveKelas($baris, $santri->id, $jenjang);
                if ($kelasId === false) {
                    continue;
                }

                // Idempoten: baris yang sama (santri + jenjang + tanggal) dilewati.
                $sudahAda = MutasiKeluar::where('santri_id', $santri->id)
                    ->where('jenjang', $jenjang)
                    ->whereDate('tanggal_mutasi', $tanggal)
                    ->exists();
                if ($sudahAda) {
                    $this->dilewati++;
                    $this->barisValid++;

                    continue;
                }

                MutasiKeluar::create([
                    'santri_id' => $santri->id,
                    'jenjang' => $jenjang,
                    'kelas_terakhir_id' => $kelasId,
                    'tanggal_mutasi' => $tanggal,
                    'alasan_mutasi' => $alasan,
                    'no_surat' => $this->teks($baris, 'no_surat'),
                    'nama_sekolah_tujuan' => $this->teks($baris, 'nama_sekolah_tujuan'),
                    'npsn_sekolah_tujuan' => $this->teks($baris, 'npsn_sekolah_tujuan'),
                    'nsm_sekolah_tujuan' => $this->teks($baris, 'nsm_sekolah_tujuan'),
                    'alamat_sekolah_tujuan' => $this->teks($baris, 'alamat_sekolah_tujuan'),
                    'keterangan' => $this->teks($baris, 'keterangan'),
                ]);

                // Tiru "Proses mutasi": tutup riwayat + keanggotaan aktif bila ada.
                $ditutup = RiwayatBelajar::where('santri_id', $santri->id)
                    ->where('jenjang', $jenjang)
                    ->where('is_active_riwayat', RiwayatBelajar::YA)
                    ->update(['status_akhir' => 'pindah_keluar', 'is_active_riwayat' => RiwayatBelajar::TIDAK]);
                if ($ditutup > 0) {
                    LembagaSantri::where('santri_id', $santri->id)
                        ->where('jenjang', $jenjang)
                        ->where('is_active_lembaga', LembagaSantri::YA)
                        ->update(['is_active_lembaga' => LembagaSantri::TIDAK, 'tgl_selesai' => $tanggal]);
                    $santri->hitungUlangStatusGlobal();
                }

                $this->dibuat++;
                $this->barisValid++;
            }
        });
    }

    /** Cari santri via `nis_lokal` + lembaga (kunci tunggal). */
    protected function cariSantri(array $row, string $jenjang): ?Santri
    {
        $nisLokal = trim((string) ($row['nis_lokal'] ?? ''));
        if ($nisLokal !== '') {
            $ls = LembagaSantri::where('jenjang', $jenjang)->where('nis_lokal', $nisLokal)->first();
            if ($ls) {
                return Santri::find($ls->santri_id);
            }
        }

        $this->fail($this->nomorBaris, 'nis_lokal', 'Santri tidak ditemukan (cocokkan NIS lokal + lembaga).');

        return null;
    }

    /**
     * Kelas terakhir: nama (diutamakan) atau id, dalam lingkup jenjang
     * (+ tahun ajaran bila diisi). Kosong → beku dari riwayat terakhir
     * (pola live). false = gagal (failure sudah dicatat).
     */
    protected function resolveKelas(array $baris, int $santriId, string $jenjang): int|null|false
    {
        $teks = trim((string) ($baris['kelas_terakhir'] ?? ''));
        if ($teks === '') {
            return RiwayatBelajar::where('santri_id', $santriId)
                ->where('jenjang', $jenjang)
                ->latest('id')->value('kelas_id');
        }

        $ta = trim((string) ($baris['tahun_ajaran'] ?? ''));

        // Id numerik: harus ada di lingkup.
        if (ctype_digit($teks)) {
            $kelas = Kelas::whereKey((int) $teks)->where('jenjang', $jenjang)
                ->when($ta !== '', fn ($q) => $q->where('tahun_ajaran', $ta))
                ->first();
            if ($kelas === null) {
                $this->fail($this->nomorBaris, 'kelas_terakhir', "Kelas id \"{$teks}\" tidak ditemukan di lingkup ini.");
            }

            return $kelas?->id ?? false;
        }

        $cocok = Kelas::where('jenjang', $jenjang)
            ->when($ta !== '', fn ($q) => $q->where('tahun_ajaran', $ta))
            ->whereRaw('LOWER(nama_kelas) = ?', [mb_strtolower(Kelas::normalisasiNama($teks))])
            ->get();
        if ($cocok->isEmpty()) {
            $this->fail($this->nomorBaris, 'kelas_terakhir', "Kelas \"{$teks}\" tidak ditemukan di lembaga ini.");

            return false;
        }
        if ($ta === '' && $cocok->pluck('tahun_ajaran')->unique()->count() > 1) {
            $this->fail($this->nomorBaris, 'kelas_terakhir', "Nama kelas \"{$teks}\" ada di beberapa tahun ajaran — isi kolom tahun_ajaran.");

            return false;
        }

        return $cocok->first()->id;
    }

    protected function teks(array $baris, string $kolom): ?string
    {
        $nilai = trim((string) ($baris[$kolom] ?? ''));

        return $nilai === '' ? null : $nilai;
    }

    public function onFailure(Failure ...$failures): void
    {
        $this->failures = array_merge($this->failures, $failures);
    }

    /** @return Failure[] */
    public function failures(): array
    {
        return $this->failures;
    }

    protected function fail(int $no, string $kolom, string $pesan): void
    {
        $this->failures[] = new Failure($no, $kolom, [$pesan], []);
    }
}
