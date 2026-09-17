<?php

namespace App\Imports;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Support\Tanggal;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Validators\Failure;

/**
 * Import GABUNGAN siswa: identitas (`santri`) + keanggotaan (`lembaga_santri`)
 * dalam satu file. Urutan kolom: blok keanggotaan dulu, lalu seluruh
 * `Santri::KOLOM_PROFIL` — file ini juga bisa dipakai memutakhirkan data
 * (round-trip via kolom `santri_id` opsional).
 *
 * Pencocokan santri 4 lapis per baris:
 *  (a) `santri_id` eksak (bila diisi),
 *  (b) `nik|nama_lengkap|tgl_lahir` (dipakai ulang dari induk),
 *  (c) `nis_lokal + lembaga` (penting: tidak semua santri punya NIK),
 *  (d) create baru (wajib ada `nama_lengkap`).
 *
 * Keanggotaan: belum ada → create (`is_active` bawaan true); sudah ada baris
 * untuk pasangan santri+lembaga → update (hanya nilai non-kosong yang menimpa,
 * agar sel kosong di Excel tidak menghapus data lama).
 * Tanpa info lembaga (file identitas) → hanya identitas, tanpa keanggotaan.
 * Baris di luar lingkup tenant pengimport → gagal per baris (bukan 403).
 */
class SantriLembagaImport extends SantriLengkapImport
{
    /** Baris yang memutakhirkan santri/keanggotaan yang sudah ada. */
    protected int $barisUpdate = 0;

    /** Baris tanpa info lembaga → hanya identitas, tanpa keanggotaan. */
    protected int $barisTanpaAnggota = 0;

    /** @var array<int, int> */
    protected array $tersentuh = [];

    public function ringkasan(): array
    {
        return array_merge(parent::ringkasan(), [
            'baris_diperbarui' => $this->barisUpdate,
            'baris_tanpa_keanggotaan' => $this->barisTanpaAnggota,
        ]);
    }

    public function collection(Collection $rows): void
    {
        // Kunci konsistensi-03: import diasumsikan single-operator.
        DB::transaction(function () use ($rows) {
            $dilihatNik = [];
            $dilihatNis = [];
            $no = 0;
            foreach ($rows as $row) {
                $no++;
                $baris = $row instanceof Collection ? $row->toArray() : $row;
                // Baris tanpa kunci identitas apa pun dianggap kosong/pemisah.
                if (empty($baris['nama_lengkap']) && empty($baris['santri_id']) && empty($baris['nik']) && empty($baris['nis_lokal'])) {
                    continue;
                }

                if ($this->prosesBaris($baris, $no, $dilihatNik, $dilihatNis)) {
                    $this->barisValid++;
                }
            }

            foreach (array_unique($this->tersentuh) as $santriId) {
                Santri::find($santriId)?->hitungUlangStatusGlobal();
            }
        });
    }

    /**
     * @param  array<string, mixed>  $baris
     * @param  array<string, Santri>  $dilihatNik  guard intra-file kunci nik|nama|tgl
     * @param  array<string, Santri>  $dilihatNis  guard intra-file kunci lembaga|nis_lokal
     */
    protected function prosesBaris(array $baris, int $no, array &$dilihatNik, array &$dilihatNis): bool
    {
        // Tanpa info lembaga (kolom tak ada / nilai kosong) → santri saja.
        if (! $this->adaInfoLembaga($baris)) {
            $dataSantri = $this->buatDataSantri($baris);
            $santri = $this->cocokkanSantri($baris, $dataSantri, $no, null, $dilihatNik, $dilihatNis, $sudahAda);
            if ($santri === null) {
                return false;
            }
            if ($sudahAda) {
                $this->barisUpdate++;
            }
            $this->barisTanpaAnggota++;
            $this->tersentuh[] = (int) $santri->id;

            return true;
        }

        $lembagaId = $this->resolveLembagaId($baris, $no);
        if ($lembagaId === null) {
            return false;
        }

        $auth = auth()->user();
        if (! $auth || ! $auth->canAccessLembaga($lembagaId)) {
            $this->fail($no, 'kode_lembaga', 'Lembaga di luar lingkup akses Anda.');

            return false;
        }

        $dataSantri = $this->buatDataSantri($baris);
        $santri = $this->cocokkanSantri($baris, $dataSantri, $no, $lembagaId, $dilihatNik, $dilihatNis, $sudahAda);
        if ($santri === null) {
            return false;
        }

        if (! $this->simpanKeanggotaan($santri, $lembagaId, $baris, $no, $keanggotaanBaru)) {
            return false;
        }

        if ($sudahAda || ! $keanggotaanBaru) {
            $this->barisUpdate++;
        }
        $this->tersentuh[] = (int) $santri->id;

        return true;
    }

    /**
     * Ada info lembaga bila salah satu kolom terisi (nilai). Kolom tak ada
     * (file identitas lama) juga berarti tidak ada.
     *
     * @param  array<string, mixed>  $baris
     */
    protected function adaInfoLembaga(array $baris): bool
    {
        return trim((string) ($baris['kode_lembaga'] ?? '')) !== ''
            || trim((string) ($baris['lembaga_id'] ?? '')) !== '';
    }

    /**
     * Lembaga dari `kode_lembaga` (kunci utama, case-insensitive) dengan
     * fallback `lembaga_id` numerik. Wajib operasional (parent_id not null).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function resolveLembagaId(array $baris, int $no): ?int
    {
        $kode = trim((string) ($baris['kode_lembaga'] ?? ''));
        if ($kode !== '') {
            $lembaga = Lembaga::whereRaw('UPPER(kode) = ?', [mb_strtoupper($kode)])->first();
            if (! $lembaga || $lembaga->parent_id === null) {
                $this->fail($no, 'kode_lembaga', "Kode lembaga \"{$kode}\" tidak ditemukan / bukan operasional.");

                return null;
            }

            return (int) $lembaga->id;
        }

        $id = (int) ($baris['lembaga_id'] ?? 0);
        if ($id === 0 || ! Lembaga::where('id', $id)->whereNotNull('parent_id')->exists()) {
            $this->fail($no, 'lembaga_id', 'Lembaga tidak valid (isi kode_lembaga atau lembaga_id operasional).');

            return null;
        }

        return $id;
    }

    /**
     * Cocokkan santri 4 lapis; $sudahAda true bila baris menimpa santri lama.
     * $lembagaId null (file identitas) → lapis (c) dilewati.
     *
     * @param  array<string, mixed>  $baris
     * @param  array<string, mixed>  $dataSantri
     * @param  array<string, Santri>  $dilihatNik
     * @param  array<string, Santri>  $dilihatNis
     */
    protected function cocokkanSantri(array $baris, array $dataSantri, int $no, ?int $lembagaId, array &$dilihatNik, array &$dilihatNis, ?bool &$sudahAda): ?Santri
    {
        $sudahAda = false;

        // (a) Kunci eksak santri_id.
        $santriId = trim((string) ($baris['santri_id'] ?? ''));
        if ($santriId !== '') {
            $santri = Santri::find((int) $santriId);
            if (! $santri) {
                $this->fail($no, 'santri_id', "Santri id {$santriId} tidak ditemukan.");

                return null;
            }
            if (empty($dataSantri['nama_lengkap'])) {
                $dataSantri['nama_lengkap'] = $santri->nama_lengkap;
            }
            // Baris parsial (hanya kunci + keanggotaan): sel kosong = pertahankan.
            $santri->update($this->tanpaKosong($dataSantri));
            $sudahAda = true;

            return $santri;
        }

        $nikTerisi = trim((string) ($baris['nik'] ?? '')) !== '';
        $nisTerisi = trim((string) ($baris['nis_lokal'] ?? '')) !== '';

        // (b) NIK via logika induk (membedakan update vs create).
        if ($nikTerisi) {
            $sebelum = Santri::where('nik', trim((string) $baris['nik']))->exists();
            $santri = $this->simpanDenganNik($baris, $dataSantri, $dilihatNik);
            $sudahAda = $sebelum;

            return $santri;
        }

        // (c) Fallback NIS lokal + lembaga (+ guard intra-file). Dilewati bila
        // file identitas (tanpa lembaga) — NIS tanpa lembaga tak bisa dicocokkan.
        if ($nisTerisi && $lembagaId !== null) {
            $nis = trim((string) $baris['nis_lokal']);
            $kunci = $lembagaId.'|'.mb_strtolower($nis);
            if (isset($dilihatNis[$kunci])) {
                $dilihatNis[$kunci]->update($this->tanpaKosong($dataSantri));
                $sudahAda = true;

                return $dilihatNis[$kunci];
            }
            $ls = LembagaSantri::where('lembaga_id', $lembagaId)->where('nis_lokal', $nis)->first();
            if ($ls && ($santri = Santri::find($ls->santri_id))) {
                $santri->update($this->tanpaKosong($dataSantri));
                $dilihatNis[$kunci] = $santri;
                $sudahAda = true;

                return $santri;
            }
            // NIS belum terdaftar → create baru di bawah (membawa nis_lokal).
        }

        // (d) Create baru — wajib ada nama.
        if (empty($dataSantri['nama_lengkap'])) {
            $this->fail($no, 'nama_lengkap', 'Nama wajib diisi untuk santri baru.');

            return null;
        }

        return Santri::create(array_merge($dataSantri, ['nik' => $nikTerisi ? trim((string) $baris['nik']) : null]));
    }

    /**
     * Buat/update keanggotaan pasangan santri+lembaga; $baru false bila menimpa.
     *
     * @param  array<string, mixed>  $baris
     */
    protected function simpanKeanggotaan(Santri $santri, int $lembagaId, array $baris, int $no, ?bool &$baru): bool
    {
        $baru = false;

        $nisLokal = trim((string) ($baris['nis_lokal'] ?? ''));
        $nisLokal = $nisLokal === '' ? null : $nisLokal;
        $nisKemenag = trim((string) ($baris['nis_kemenag'] ?? ''));
        $nisKemenag = $nisKemenag === '' ? null : $nisKemenag;
        $aktif = $this->parseAktif($baris['is_active'] ?? null, $no);
        if ($aktif === null && array_key_exists('is_active', $baris) && trim((string) $baris['is_active']) !== '') {
            return false; // failure sudah dicatat parseAktif
        }
        $tglMulai = Tanggal::parse($baris['tgl_mulai'] ?? null);
        $tglSelesai = Tanggal::parse($baris['tgl_selesai'] ?? null);

        $ada = LembagaSantri::where('santri_id', $santri->id)
            ->where('lembaga_id', $lembagaId)
            ->orderByDesc('id')
            ->first();

        if ($ada === null) {
            if ($nisLokal !== null && LembagaSantri::nisLokalDipakai($lembagaId, $nisLokal)) {
                $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                return false;
            }
            if ($nisKemenag !== null && LembagaSantri::nisKemenagDipakai($lembagaId, $nisKemenag)) {
                $this->fail($no, 'nis_kemenag', 'NIS Kemenag sudah dipakai santri lain di lembaga ini.');

                return false;
            }

            LembagaSantri::create([
                'santri_id' => $santri->id,
                'lembaga_id' => $lembagaId,
                'nis_lokal' => $nisLokal,
                'nis_kemenag' => $nisKemenag,
                'is_active' => $aktif ?? true,
                'tgl_mulai' => $tglMulai,
                'tgl_selesai' => $tglSelesai,
            ]);
            $baru = true;

            return true;
        }

        // Update: hanya nilai non-kosong yang menimpa (sel kosong = pertahankan).
        if ($nisLokal !== null && $nisLokal !== $ada->nis_lokal) {
            if (LembagaSantri::nisLokalDipakai($lembagaId, $nisLokal, $ada->id)) {
                $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                return false;
            }
        }
        if ($nisKemenag !== null && $nisKemenag !== $ada->nis_kemenag) {
            if (LembagaSantri::nisKemenagDipakai($lembagaId, $nisKemenag, $ada->id)) {
                $this->fail($no, 'nis_kemenag', 'NIS Kemenag sudah dipakai santri lain di lembaga ini.');

                return false;
            }
        }

        $ubah = [];
        if ($nisLokal !== null) {
            $ubah['nis_lokal'] = $nisLokal;
        }
        if ($nisKemenag !== null) {
            $ubah['nis_kemenag'] = $nisKemenag;
        }
        if ($aktif !== null) {
            $ubah['is_active'] = $aktif;
        }
        if ($tglMulai !== null) {
            $ubah['tgl_mulai'] = $tglMulai;
        }
        if ($tglSelesai !== null) {
            $ubah['tgl_selesai'] = $tglSelesai;
        }
        if ($ubah !== []) {
            $ada->update($ubah);
        }

        return true;
    }

    /**
     * Buang nilai kosong (update parsial: sel kosong = pertahankan data lama).
     * Pengosongan sengaja tetap lewat UI.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function tanpaKosong(array $data): array
    {
        return array_filter($data, fn ($v) => $v !== null && $v !== '');
    }

    /**
     * Normalisasi is_active Excel: 1/0, true/false, aktif/nonaktif, ya/tidak.
     * null = sel kosong (ikut bawaan); failure dicatat bila tak dikenali.
     */
    protected function parseAktif(mixed $nilai, int $no): ?bool
    {
        $teks = trim((string) ($nilai ?? ''));
        if ($teks === '') {
            return null;
        }
        $t = mb_strtolower($teks);
        if (in_array($t, ['1', 'true', 'aktif', 'ya', 'y'], true)) {
            return true;
        }
        if (in_array($t, ['0', 'false', 'nonaktif', 'tidak', 't'], true)) {
            return false;
        }

        $this->fail($no, 'is_active', "Status aktif \"{$teks}\" tidak dikenali (isi 1/0).");

        return null;
    }

    public function rules(): array
    {
        return array_merge(parent::rules(), [
            // Update via santri_id boleh tanpa identitas (profil tak disentuh bila kosong).
            'nama_lengkap' => ['required_without:santri_id', 'nullable', 'string', 'max:255'],
            'jk' => ['required_without:santri_id', 'nullable', 'in:L,P'],
            // Identitas: minimal satu kunci (NIK tak selalu ada).
            // CATAT: sel Excel/CSV numerik terbaca sebagai angka (bukan string) —
            // hindari rule `string`/`max` ketat di kolom kunci (pola RiwayatBelajarImport).
            'nik' => ['required_without_all:nis_lokal,santri_id', 'nullable', 'digits:16'],
            'nis_lokal' => ['required_without_all:nik,santri_id', 'nullable'],
            // Blok keanggotaan: opsional. Tanpa info lembaga → santri saja
            // (file identitas lama tetap diterima endpoint gabungan).
            'santri_id' => ['nullable', 'integer'],
            'kode_lembaga' => ['nullable'],
            'lembaga_id' => ['nullable', 'integer'],
            'nis_kemenag' => ['nullable'],
            'is_active' => ['nullable'],
            'tgl_mulai' => ['nullable', 'date'],
            'tgl_selesai' => ['nullable', 'date'],
        ]);
    }

    public function onFailure(Failure ...$failures): void
    {
        $this->failures = array_merge($this->failures, $failures);
    }

    public function failures(): array
    {
        return $this->failures;
    }
}
