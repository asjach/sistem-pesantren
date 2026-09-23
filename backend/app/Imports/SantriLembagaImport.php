<?php

namespace App\Imports;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\PenerimaanService;
use App\Support\NikFlag;
use App\Support\Tanggal;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
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
 * Keanggotaan WAJIB: tiap baris harus punya `jenjang` (minimal 1 lembaga).
 * Belum ada → create (`is_active_lembaga` bawaan true); sudah ada baris untuk
 * pasangan santri+lembaga → update (hanya nilai non-kosong yang menimpa, agar
 * sel kosong di Excel tidak menghapus data lama).
 * Baris di luar lingkup tenant pengimport → gagal per baris (bukan 403).
 */
class SantriLembagaImport extends SantriLengkapImport
{
    /** Baris yang memutakhirkan santri/keanggotaan yang sudah ada. */
    protected int $barisUpdate = 0;

    /** Riwayat belajar perdana yang dibuat dari `tahaj_masuk` + `tingkat_masuk`. */
    protected int $barisRiwayat = 0;

    /** @var array<int, int> */
    protected array $tersentuh = [];

    public function ringkasan(): array
    {
        return array_merge(parent::ringkasan(), [
            'baris_diperbarui' => $this->barisUpdate,
            'baris_riwayat_dibuat' => $this->barisRiwayat,
        ]);
    }

    /** Guard duplikat intra-file lintas chunk: kunci nik|nama|tgl. */
    protected array $dilihatNik = [];

    /** Guard duplikat intra-file lintas chunk: kunci lembaga|nis_lokal. */
    protected array $dilihatNis = [];

    public function collection(Collection $rows): void
    {
        // Kunci konsistensi-03: import diasumsikan single-operator.
        // Dipanggil sekali per chunk; transaksi per chunk (bukan per file).
        DB::transaction(function () use ($rows) {
            foreach ($rows as $row) {
                $this->nomorBaris++;
                $baris = $row instanceof Collection ? $row->toArray() : $row;
                // Baris tanpa kunci identitas apa pun dianggap kosong/pemisah.
                if (empty($baris['nama_lengkap']) && empty($baris['santri_id']) && empty($baris['nik']) && empty($baris['nis_lokal'])) {
                    continue;
                }

                if ($this->prosesBaris($baris)) {
                    $this->barisValid++;
                }
            }

            foreach (array_unique($this->tersentuh) as $santriId) {
                Santri::find($santriId)?->hitungUlangStatusGlobal();
            }
            $this->tersentuh = [];
        });
    }

    /**
     * @param  array<string, mixed>  $baris
     */
    protected function prosesBaris(array $baris): bool
    {
        $no = $this->nomorBaris;

        // Keanggotaan wajib: baris tanpa `jenjang` ditolak.
        $jenjang = $this->resolveLembagaId($baris, $no);
        if ($jenjang === null) {
            return false;
        }

        $auth = auth()->user();
        if (! $auth || ! $auth->canAccessLembaga($jenjang)) {
            $this->fail($no, 'jenjang', 'Lembaga di luar lingkup akses Anda.');

            return false;
        }

        // Riwayat perdana (opsional): `tahaj_masuk` harus tahun ajaran yang ada.
        $tahunAjaranMasuk = trim((string) ($baris['tahaj_masuk'] ?? ''));
        if ($tahunAjaranMasuk !== '' && ! TahunAjaran::whereKey($tahunAjaranMasuk)->exists()) {
            $this->fail($no, 'tahaj_masuk', "Tahun ajaran \"{$tahunAjaranMasuk}\" tidak ditemukan.");

            return false;
        }

        $dataSantri = $this->buatDataSantri($baris);
        // Jaring pengaman: kegagalan tulis DB (mis. bentrok unik) dicatat per
        // baris, bukan 500 yang membatalkan seluruh file.
        try {
            $santri = $this->cocokkanSantri($baris, $dataSantri, $no, $jenjang, $this->dilihatNik, $this->dilihatNis, $sudahAda);
            if ($santri === null) {
                return false;
            }

            if (! $this->simpanKeanggotaan($santri, $jenjang, $baris, $no, $keanggotaanBaru)) {
                return false;
            }
        } catch (QueryException $e) {
            $this->fail($no, 'basis_data', 'Gagal menyimpan baris ini ke database.');

            return false;
        }

        if ($tahunAjaranMasuk !== '') {
            $this->catatRiwayatPerdana($santri, $jenjang, $tahunAjaranMasuk, $baris, $no);
        }

        if ($sudahAda || ! $keanggotaanBaru) {
            $this->barisUpdate++;
        }
        $this->tersentuh[] = (int) $santri->id;

        return true;
    }

    /**
     * Buat riwayat belajar perdana (semester 1) dari `tahaj_masuk` +
     * `tingkat_masuk` untuk SEMUA baris import yang valid — bukan hanya yang
     * keanggotaannya sudah aktif (`terima()` mengaktifkan keanggotaan bila
     * perlu). Dilewati bila baris eksplisit ditandai nonaktif, santri sudah
     * punya riwayat aktif di lembaga ini, ATAU sudah punya baris (santri,
     * tahun ajaran, jenjang, semester 1) — menjaga unique constraint &
     * idempoten saat re-import. Kegagalan dicatat per baris (tidak
     * membatalkan seluruh import).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function catatRiwayatPerdana(Santri $santri, string $jenjang, string $tahunAjaran, array $baris, int $no): void
    {
        // Baris yang eksplisit ditandai nonaktif tidak dibuatkan riwayat
        // berjalan — `terima()` di bawah justru akan mengaktifkan ulang
        // keanggotaannya bila dipaksakan.
        if (in_array(mb_strtolower(trim((string) ($baris['is_active_lembaga'] ?? ''))), ['0', 'false', 'nonaktif', 'tidak', 't'], true)) {
            return;
        }

        // Lewati bila sudah ada riwayat aktif di jenjang ini (santri sedang berjalan)
        // atau baris perdana identik sudah ada (termasuk yang sudah diarsipkan).
        $sudahAda = RiwayatBelajar::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->where(fn ($q) => $q
                ->where('is_active_riwayat', RiwayatBelajar::YA)
                ->orWhere(fn ($q2) => $q2
                    ->where('tahun_ajaran', $tahunAjaran)
                    ->where('semester', '1')))
            ->exists();
        if ($sudahAda) {
            return;
        }

        $tingkat = trim((string) ($baris['tingkat_masuk'] ?? ''));

        try {
            app(PenerimaanService::class)->terima($santri, $jenjang, $tahunAjaran, [
                'tingkat' => $tingkat === '' ? null : $tingkat,
                'tgl_masuk' => Tanggal::parse($baris['tgl_masuk'] ?? null),
            ]);
            $this->barisRiwayat++;
        } catch (ValidationException $e) {
            $pesan = (string) (collect($e->errors())->flatten()->first() ?? 'Riwayat belajar gagal dibuat.');
            $this->fail($no, 'riwayat_belajar', $pesan);
        } catch (QueryException $e) {
            // Bentrok unique (mis. balapan) → catat per baris, jangan batalkan import.
            $this->fail($no, 'riwayat_belajar', 'Riwayat belajar bentrok dengan data yang ada.');
        }
    }

    /**
     * Lembaga dari `jenjang` (case-insensitive).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function resolveLembagaId(array $baris, int $no): ?string
    {
        $kode = trim((string) ($baris['jenjang'] ?? ''));
        if ($kode === '') {
            $this->fail($no, 'jenjang', 'Isi jenjang lembaga (mis. MI/MD).');

            return null;
        }

        $lembaga = Lembaga::whereRaw('UPPER(jenjang) = ?', [mb_strtoupper($kode)])->first();
        if (! $lembaga) {
            $this->fail($no, 'jenjang', "Lembaga \"{$kode}\" tidak ditemukan.");

            return null;
        }

        return $lembaga->jenjang;
    }

    /**
     * Cocokkan santri 4 lapis; $sudahAda true bila baris menimpa santri lama.
     *
     * @param  array<string, mixed>  $baris
     * @param  array<string, mixed>  $dataSantri
     * @param  array<string, Santri>  $dilihatNik
     * @param  array<string, Santri>  $dilihatNis
     */
    protected function cocokkanSantri(array $baris, array $dataSantri, int $no, string $jenjang, array &$dilihatNik, array &$dilihatNis, ?bool &$sudahAda): ?Santri
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
            $sebelum = Santri::where('nik', NikFlag::tandai(trim((string) $baris['nik'])))->exists();
            $santri = $this->simpanDenganNik($baris, $dataSantri, $this->dilihatNik);
            $sudahAda = $sebelum;

            return $santri;
        }

        // (c) Fallback NIS lokal + lembaga (+ guard intra-file).
        if ($nisTerisi) {
            $nis = trim((string) $baris['nis_lokal']);
            $kunci = $jenjang.'|'.mb_strtolower($nis);
            if (isset($dilihatNis[$kunci])) {
                $dilihatNis[$kunci]->update($this->tanpaKosong($dataSantri));
                $sudahAda = true;

                return $dilihatNis[$kunci];
            }
            $ls = LembagaSantri::where('jenjang', $jenjang)->where('nis_lokal', $nis)->first();
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
    protected function simpanKeanggotaan(Santri $santri, string $jenjang, array $baris, int $no, ?bool &$baru): bool
    {
        $baru = false;

        $nisLokal = trim((string) ($baris['nis_lokal'] ?? ''));
        $nisLokal = $nisLokal === '' ? null : $nisLokal;
        $nisKemenag = trim((string) ($baris['nis_kemenag'] ?? ''));
        $nisKemenag = $nisKemenag === '' ? null : $nisKemenag;
        $aktif = $this->parseAktif($baris['is_active_lembaga'] ?? null, $no);
        if ($aktif === null && array_key_exists('is_active_lembaga', $baris) && trim((string) $baris['is_active_lembaga']) !== '') {
            return false; // failure sudah dicatat parseAktif
        }
        $tglMasuk = Tanggal::parse($baris['tgl_masuk'] ?? null);
        $tglSelesai = Tanggal::parse($baris['tgl_selesai'] ?? null);
        $teksKolom = function (string $kunci) use ($baris): ?string {
            $nilai = trim((string) ($baris[$kunci] ?? ''));

            return $nilai === '' ? null : $nilai;
        };
        $noUrut = $teksKolom('no_urut');
        $konteks = [
            'tahaj_masuk' => $teksKolom('tahaj_masuk'),
            'tingkat_masuk' => $teksKolom('tingkat_masuk'),
            // String bebas (mis. `706x` untuk data ganda historis).
            'no_urut' => $noUrut,
            'nama_sekolah_asal' => $teksKolom('nama_sekolah_asal'),
            'npsn_sekolah_asal' => $teksKolom('npsn_sekolah_asal'),
            'nss_sekolah_asal' => $teksKolom('nss_sekolah_asal'),
            'alamat_sekolah_asal' => $teksKolom('alamat_sekolah_asal'),
        ];

        $ada = LembagaSantri::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->orderByDesc('id')
            ->first();

        if ($ada === null) {
            if ($nisLokal !== null && LembagaSantri::nisLokalDipakai($jenjang, $nisLokal)) {
                $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                return false;
            }
            // NIS Kemenag bebas duplikat (hasil generate; bisa digenerate ulang).

            LembagaSantri::create([
                'santri_id' => $santri->id,
                'jenjang' => $jenjang,
                'nis_lokal' => $nisLokal,
                'nis_kemenag' => $nisKemenag,
                'is_active_lembaga' => $aktif ?? LembagaSantri::YA,
                'tgl_masuk' => $tglMasuk,
                'tgl_selesai' => $tglSelesai,
            ] + array_filter($konteks, fn ($v) => $v !== null));
            $baru = true;

            return true;
        }

        // Baris sendiri ber-NIS sama diutamakan (idempoten saat import ulang;
        // santri boleh punya >1 baris per lembaga).
        if ($nisLokal !== null) {
            $seNis = LembagaSantri::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)
                ->where('nis_lokal', $nisLokal)
                ->orderByDesc('id')
                ->first();
            if ($seNis !== null) {
                $ada = $seNis;
            }
        }

        // Masuk lagi setelah keluar = periode BARU (NIS baru): arsip lama
        // dipertahankan, buat baris baru. Koreksi NIS hanya untuk baris aktif.
        if ($ada->is_active_lembaga === LembagaSantri::TIDAK
            && $nisLokal !== null && $nisLokal !== $ada->nis_lokal
        ) {
            if (LembagaSantri::nisLokalDipakaiSantriLain($jenjang, $nisLokal, $santri->id)) {
                $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

                return false;
            }

            LembagaSantri::create([
                'santri_id' => $santri->id,
                'jenjang' => $jenjang,
                'nis_lokal' => $nisLokal,
                'nis_kemenag' => $nisKemenag,
                'is_active_lembaga' => $aktif ?? LembagaSantri::YA,
                'tgl_masuk' => $tglMasuk,
                'tgl_selesai' => $tglSelesai,
            ] + array_filter($konteks, fn ($v) => $v !== null));
            $baru = true;

            return true;
        }

        // Update: hanya nilai non-kosong yang menimpa (sel kosong = pertahankan).
        // NIS lokal wajib unik; NIS Kemenag bebas duplikat.
        if ($nisLokal !== null && $nisLokal !== $ada->nis_lokal) {
            if (LembagaSantri::nisLokalDipakaiSantriLain($jenjang, $nisLokal, $santri->id)) {
                $this->fail($no, 'nis_lokal', 'NIS lokal sudah dipakai santri lain di lembaga ini.');

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
            $ubah['is_active_lembaga'] = $aktif;
        }
        if ($tglMasuk !== null) {
            $ubah['tgl_masuk'] = $tglMasuk;
        }
        if ($tglSelesai !== null) {
            $ubah['tgl_selesai'] = $tglSelesai;
        }
        foreach ($konteks as $kolom => $nilai) {
            if ($nilai !== null) {
                $ubah[$kolom] = $nilai;
            }
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
     * Normalisasi keaktifan Excel → 'Ya'/'Tidak'.
     * null = sel kosong (ikut bawaan); failure dicatat bila tak dikenali.
     */
    protected function parseAktif(mixed $nilai, int $no): ?string
    {
        $teks = trim((string) ($nilai ?? ''));
        if ($teks === '') {
            return null;
        }
        $t = mb_strtolower($teks);
        if (in_array($t, ['1', 'true', 'aktif', 'ya', 'y'], true)) {
            return LembagaSantri::YA;
        }
        if (in_array($t, ['0', 'false', 'nonaktif', 'tidak', 't'], true)) {
            return LembagaSantri::TIDAK;
        }

        $this->fail($no, 'is_active_lembaga', "Status aktif \"{$teks}\" tidak dikenali (isi Ya/Tidak).");

        return null;
    }

    public function rules(): array
    {
        return array_merge(parent::rules(), [
            // Update via santri_id boleh tanpa identitas (profil tak disentuh bila kosong).
            'nama_lengkap' => ['required_without:santri_id', 'nullable', 'string', 'max:255'],
            'jk' => ['required_without:santri_id', 'nullable', 'in:L,P'],
            // Identitas: minimal satu kunci (NIK tak selalu ada).
            // Sel numerik Excel sudah dinormalisasi jadi string di `map()`,
            // sehingga rule `string`/`max` aman dipakai.
            'nik' => ['required_without_all:nis_lokal,santri_id', 'nullable', 'string', 'max:20'],
            // Blok keanggotaan WAJIB: tiap santri minimal terdaftar di 1 jenjang.
            // Batas `max` mengikuti panjang kolom DB agar kelebihan ditolak per
            // baris (bukan 500 dari database).
            'santri_id' => ['nullable', 'integer'],
            'jenjang' => ['required', 'string'],
            'nis_lokal' => ['required_without_all:nik,santri_id', 'nullable', 'string', 'max:20'],
            'nis_kemenag' => ['nullable', 'string', 'max:20'],
            'tahaj_masuk' => ['nullable', 'string', 'max:50'],
            'tingkat_masuk' => ['nullable', 'string', 'max:20'],
            'no_urut' => ['nullable', 'string', 'max:20'],
            'nama_sekolah_asal' => ['nullable', 'string', 'max:255'],
            'npsn_sekolah_asal' => ['nullable', 'string', 'max:20'],
            'nss_sekolah_asal' => ['nullable', 'string', 'max:30'],
            'alamat_sekolah_asal' => ['nullable', 'string'],
            'is_active_lembaga' => ['nullable'],
            'tgl_masuk' => ['nullable', 'date'],
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
