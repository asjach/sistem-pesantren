<?php

namespace App\Services\Template;

use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\LembagaSantri;
use App\Models\Pegawai;
use App\Models\PsbCalonSantri;
use App\Models\Santri;
use App\Models\SemesterAktif;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Mengubah medan sebuah template menjadi nilai nyata dari database.
 *
 * Berkas template PDF hanya memuat desain; isi dokumen ditentukan di sini.
 * Satu medan pada template menulis `sumber` + `kunci` (dijelaskan pada
 * KatalogNilai), lalu kelas ini yang mencari nilainya.
 *
 * Empat tabel koleksi (nilai_santri, presensi_santri, pelanggaran_santri,
 * rekap_tahfiz_santri) belum punya model karena modulnya belum dibangun, jadi
 * diakses lewat query builder. Saat modulnya selesai, cukup ganti pemanggilan
 * di bawah menjadi model tanpa mengubah kontrak KatalogNilai.
 */
class PengisiNilai
{
    public function __construct(private readonly KonteksCetak $konteks) {}

    /**
     * Nilai untuk satu sumber skalar.
     *
     * @param  int|string|null  $id  id record, atau jenjang untuk sumber `lembaga`
     *                               yang berkunci utama string
     * @return array<string, mixed> kunci => nilai; kunci yang tidak berlaku
     *                              tetap dikembalikan sebagai null
     *                              supaya medan tidak error.
     */
    public function untuk(string $sumber, int|string|null $id = null): array
    {
        $mentah = match ($sumber) {
            'santri' => $this->santri($id),
            'keluarga_santri' => $this->keluarga($id),
            'penempatan_santri' => $this->penempatanSantri($id),
            'lembaga' => $this->lembaga($id),
            'pegawai' => $this->pegawai($id),
            'penempatan_pegawai' => $this->penempatanPegawai($id),
            'keaktifan_pegawai' => $this->keaktifanPegawai($id),
            'psb_calon' => $this->psbCalon($id),
            'tetap' => ['teks' => $this->konteks->tetap['teks'] ?? null, 'tanggal' => $this->konteks->tetap['tanggal'] ?? null],
            'sistem' => $this->sistem(),
            default => [],
        };

        $hasil = [];

        foreach (KatalogNilai::sumber()[$sumber]['medan'] ?? [] as $medan) {
            $kunci = $medan['kunci'];
            $nilai = $mentah[$kunci] ?? null;

            // Field bertanda `hitung` perlu bentuk turunan yang tidak ada di tabel.
            $hasil[$kunci] = $medan['hitung'] !== null && $nilai === null
                ? $this->hitung($medan['hitung'], $mentah)
                : $nilai;
        }

        return $hasil;
    }

    /**
     * Baris untuk tipe medan `baris_berulang`.
     *
     * @return list<array<string, mixed>>
     */
    public function koleksi(string $kunci, ?int $santriId = null): array
    {
        $baris = match ($kunci) {
            'daftar_santri_kelas' => $this->barisDaftarKelas(),
            'penempatan_pegawai' => $this->barisPenempatanPegawai(),
            'keaktifan_pegawai_riwayat' => $this->barisKeaktifanPegawai(),
            'akun_pegawai' => $this->barisAkunPegawai(),
            'nilai_santri' => $this->barisNilai($santriId),
            'presensi_santri' => $this->barisPresensi($santriId),
            'pelanggaran_santri' => $this->barisPelanggaran($santriId),
            'rekap_tahfiz' => $this->barisTahfiz($santriId),
            default => [],
        };

        $daftarKunci = array_column(KatalogNilai::koleksi()[$kunci]['medan'] ?? [], 'kunci');
        $hasil = [];

        foreach ($baris as $urut => $baris) {
            $isi = [];

            foreach ($daftarKunci as $k) {
                $isi[$k] = $baris[$k] ?? null;
            }

            // Nomor urut selalu mengikuti posisi baris, bukan kolom sumber:
            // kolom no_urut sengaja tidak diambil dari query.
            $isi['no_urut'] = $urut + 1;

            $hasil[] = $isi;
        }

        return $hasil;
    }

    /**
     * Nilai contoh dari katalog untuk pratinjau di editor, tanpa menyentuh
     * database. Dipakai juga `contoh()` sebagai sumber untuk isi tetap.
     *
     * @return array<string, mixed>
     */
    public function contoh(string $sumber): array
    {
        $hasil = [];

        foreach (KatalogNilai::sumber()[$sumber]['medan'] ?? [] as $medan) {
            $hasil[$medan['kunci']] = $medan['contoh'];
        }

        return $hasil;
    }

    /**
     * Bentuk turunan yang tidak bisa diambil apa adanya dari kolom.
     *
     * @param  array<string, mixed>  $mentah
     */
    private function hitung(string $jenis, array $mentah): mixed
    {
        return match ($jenis) {
            // Bentuk turunan yang tidak punya isian tetap mengembalikan null,
            // bukan tanda hubung, supaya dokumen tidak menampilkan placeholder
            // untuk hal yang memang belum diisi.
            'jk_tercantum' => $mentah['jk'] ?? null,
            'tipe_santri_tercantum' => match ($mentah['tipe_santri'] ?? null) {
                'asrama' => 'Asrama', 'non_asrama' => 'Non Asrama', default => null,
            },
            'tgl_lahir_umur' => $this->tanggalUmur($mentah['tgl_lahir'] ?? null),
            'alamat_lengkap' => $this->alamatLengkap($mentah),
            'alamat_ortu' => $this->alamatLengkap($mentah, 'ayah_', false),
            'kelas_lengkap' => $this->kelasLengkap($mentah),
            'foto' => $this->jalurGambar($mentah['foto_url'] ?? null),
            'tanggal_indonesia' => $this->tanggalIndonesia($mentah['tanggal_hari_ini'] ?? null),
            'nama_gelar' => $this->namaDenganGelar($mentah),
            'rt_rw' => $this->rtRw($mentah),
            'status_penempatan_tercantum' => $this->tercantum($mentah['is_active_lembaga'] ?? null, 'Ya'),
            'status_keaktifan_tercantum' => $this->tercantum($mentah['status_aktif'] ?? null, Pegawai::AKTIF),
            default => null,
        };
    }

    /** Terjemahkan kode status menjadi "Aktif" atau "Nonaktif", null bila kosong. */
    private function tercantum(?string $kode, string $nilaiAktif): ?string
    {
        if ($kode === null || $kode === '') {
            return null;
        }

        return $kode === $nilaiAktif ? 'Aktif' : 'Nonaktif';
    }

    /** Nama pegawai dengan gelar depan dan gelar belakang, seperti di buku induk. */
    private function namaDenganGelar(array $mentah): ?string
    {
        $nama = trim((string) ($mentah['nama_lengkap'] ?? ''));

        if ($nama === '') {
            return null;
        }

        $depan = trim((string) ($mentah['gelar_depan'] ?? ''));
        $belakang = trim((string) ($mentah['gelar_belakang'] ?? ''));

        // Gelar depan menempel di depan dan gelar belakang di belakang, dan
        // keduanya boleh ada bersamaan.
        return trim(
            ($depan !== '' ? $depan.' ' : '')
            .$nama
            .($belakang !== '' ? ', '.$belakang : ''),
        );
    }

    /** "RT 002 / RW 005", atau berantakan kalau salah satu kosong. */
    private function rtRw(array $mentah): ?string
    {
        $rt = trim((string) ($mentah['rt'] ?? ''));
        $rw = trim((string) ($mentah['rw'] ?? ''));
        $bagian = array_filter([
            $rt !== '' ? 'RT '.$rt : null,
            $rw !== '' ? 'RW '.$rw : null,
        ]);

        return $bagian === [] ? null : implode(' / ', $bagian);
    }

    /** @return array<string, mixed> */
    private function santri(?int $id): array
    {
        $santri = $id === null ? null : Santri::find($id);

        if ($santri === null) {
            return [];
        }

        $nilai = $santri->only([
            'nama_lengkap', 'nama_singkat', 'nik', 'nisn', 'jk', 'tmp_lahir', 'tgl_lahir', 'anak_ke',
            'j_saudara', 'agama', 'kewarganegaraan', 'bahasa_sehari', 'cita_cita', 'hobi', 'tipe_santri',
            'kebutuhan_khusus', 'kebutuhan_disabilitas', 'no_hp_santri', 'email_santri', 'alamat', 'kode_pos',
            'rt', 'rw', 'provinsi', 'kab_kota', 'kecamatan', 'desa_kelurahan', 'status_tempat_tinggal',
            'kepala_keluarga', 'no_kk', 'jarak_ke_pesantren', 'waktu_tempuh', 'transportasi', 'foto_url',
        ]);

        // Bentuk turunan sengaja tidak diisi di sini: kolom yang ditandai
        // `hitung` di katalog dihitung oleh hitung() dari data mentah.
        return $nilai;
    }

    /** @return array<string, mixed> */
    private function keluarga(?int $id): array
    {
        $santri = $id === null ? null : Santri::find($id);

        if ($santri === null) {
            return [];
        }

        $nilai = $santri->only([
            'ayah_nama', 'ayah_nik', 'ayah_tmp_lahir', 'ayah_tgl_lahir', 'ayah_status', 'ayah_pendidikan',
            'ayah_pekerjaan', 'ayah_penghasilan', 'ayah_telp', 'ayah_alamat',
            'ibu_nama', 'ibu_nik', 'ibu_tmp_lahir', 'ibu_tgl_lahir', 'ibu_status', 'ibu_pendidikan',
            'ibu_pekerjaan', 'ibu_penghasilan', 'ibu_telp', 'ibu_alamat',
            'wali_nama', 'wali_nik', 'wali_tmp_lahir', 'wali_tgl_lahir', 'wali_status', 'wali_pendidikan',
            'wali_pekerjaan', 'wali_penghasilan', 'wali_telp', 'wali_alamat',
            'yang_membiayai', 'rt', 'rw', 'desa_kelurahan', 'kecamatan', 'kab_kota', 'kode_pos',
        ]);

        $nilai['alamat_ortu'] = $this->alamatLengkap($nilai, 'ayah_', false);

        return $nilai;
    }

    /** @return array<string, mixed> */
    private function penempatanSantri(?int $id): array
    {
        $santri = $id === null ? null : Santri::find($id);

        if ($santri === null) {
            return [];
        }

        $jenjang = $this->konteks->jenjang;
        $lembagaSantri = $jenjang === null
            ? null
            : LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $jenjang)->first();

        $riwayat = $this->riwayatAktif($santri->id);
        $kelas = $riwayat?->kelas;

        return [
            'nis_lokal' => $lembagaSantri?->nis_lokal,
            'nis_kemenag' => $lembagaSantri?->nis_kemenag,
            'no_urut' => $lembagaSantri?->no_urut,
            'nama_kelas' => $kelas?->nama_kelas,
            'tingkat' => $kelas?->tingkat,
            'tahun_ajaran' => $riwayat?->tahun_ajaran ?? $this->konteks->tahunAjaran,
            'semester' => $this->labelSemester($riwayat?->semester ?? $this->konteks->semester),
            'no_absen' => $riwayat?->no_absen,
            'tgl_masuk' => $riwayat?->tgl_masuk,
            'nama_sekolah_asal' => $lembagaSantri?->nama_sekolah_asal,
            'npsn_sekolah_asal' => $lembagaSantri?->npsn_sekolah_asal,
        ];
    }

    /**
     * Lembaga berkunci utama string `jenjang`, jadi parameternya boleh berupa
     * jenjang maupun null (berarti pakai lembaga aktif dari konteks).
     *
     * @return array<string, mixed>
     */
    private function lembaga(int|string|null $id): array
    {
        $jenjang = is_string($id) && $id !== '' ? $id : $this->konteks->jenjang;

        $lembaga = $jenjang === null ? null : Lembaga::find($jenjang);

        if ($lembaga === null) {
            return [];
        }

        $nilai = $lembaga->only([
            'nama', 'nama_singkat', 'jenjang', 'npsn', 'nsm', 'akreditasi', 'mudir_am', 'alamat', 'provinsi',
            'kab_kota', 'kecamatan', 'desa', 'kode_pos', 'telepon', 'email', 'website', 'logo_url',
        ]);

        $nilai['alamat_lengkap'] = $this->alamatLengkap($nilai);
        $nilai['foto'] = $this->jalurGambar($lembaga->logo_url);

        return $nilai;
    }

    /** @return array<string, mixed> */
    private function pegawai(?int $id): array
    {
        $pegawai = $id === null ? null : Pegawai::find($id);

        if ($pegawai === null) {
            return [];
        }

        $nilai = $pegawai->only([
            'nama_lengkap', 'gelar_depan', 'gelar_belakang', 'nip', 'nipp', 'nik', 'jenis_kelamin',
            'tempat_lahir', 'tanggal_lahir', 'agama', 'gol_darah', 'pendidikan_terakhir', 'jenis_ptk',
            'niat_npa', 'sertifikasi', 'status_pernikahan', 'npwp', 'no_kk', 'no_bpjs', 'no_hp',
            'email_pribadi', 'email_gws', 'alamat', 'kode_pos', 'rt', 'rw', 'desa_kelurahan',
            'kecamatan', 'kab_kota', 'provinsi', 'status_tempat_tinggal', 'jarak_ke_pesantren',
            'waktu_tempuh', 'transportasi', 'tgl_mulai_kerja', 'no_sk_awal', 'tgl_sk_awal',
            'status_aktif', 'foto_url',
        ]);

        // Medianya berbeda nama dengan Santri (jenis_kelamin, bukan jk),
        // jadi diterjemahkan agar hitung() untuk jk_tercantum tetap bekerja.
        $nilai['jk'] = $pegawai->jenis_kelamin;

        return $nilai;
    }

    /** @return array<string, mixed> */
    private function penempatanPegawai(?int $id): array
    {
        $pegawai = $id === null ? null : Pegawai::find($id);

        if ($pegawai === null) {
            return [];
        }

        $jenjang = $this->konteks->jenjang;
        $penempatan = $jenjang === null
            ? null
            : LembagaPegawai::where('pegawai_id', $pegawai->id)->where('jenjang', $jenjang)->first();

        $keaktifan = null;

        if ($this->konteks->tahunAjaran !== null) {
            $keaktifan = $pegawai->keaktifan()
                ->where('tahun_ajaran', $this->konteks->tahunAjaran)
                ->when($jenjang !== null, fn ($q) => $q->where('jenjang', $jenjang))
                ->first();
        }

        return [
            'tugas_utama' => $keaktifan?->tugas_utama ?? $penempatan?->tugas_utama,
            'jenjang' => $penempatan?->jenjang ?? $jenjang,
            'tahun_ajaran' => $this->konteks->tahunAjaran,
            'status_keaktifan' => $keaktifan?->status_keaktifan,
            'no_sk' => $keaktifan?->no_sk,
            'tgl_sk' => $keaktifan?->tgl_sk,
            'tgl_masuk' => $penempatan?->tgl_masuk,
            'tgl_selesai' => $penempatan?->tgl_selesai,
            'is_active_lembaga' => $penempatan?->is_active_lembaga,
            'no_sk_awal_ptk' => $penempatan?->no_sk_awal_ptk,
            'tgl_sk_awal_ptk' => $penempatan?->tgl_sk_awal_ptk,
        ];
    }

    /**
     * Keaktifan pegawai pada tahun ajaran dan jenjang terpilih, terpisah dari
     * penempatan supaya surat yang hanya butuh tugas utama tidak ikut menarik
     * riwayat keaktifan.
     *
     * @return array<string, mixed>
     */
    private function keaktifanPegawai(?int $id): array
    {
        $pegawai = $id === null ? null : Pegawai::find($id);

        if ($pegawai === null) {
            return [];
        }

        $jenjang = $this->konteks->jenjang;
        $keaktifan = $this->konteks->tahunAjaran === null
            ? null
            : $pegawai->keaktifan()
                ->where('tahun_ajaran', $this->konteks->tahunAjaran)
                ->when($jenjang !== null, fn ($q) => $q->where('jenjang', $jenjang))
                ->first();

        return [
            'tahun_ajaran' => $keaktifan?->tahun_ajaran ?? $this->konteks->tahunAjaran,
            'jenjang' => $keaktifan?->jenjang ?? $jenjang,
            'tugas_utama' => $keaktifan?->tugas_utama,
            'status_keaktifan' => $keaktifan?->status_keaktifan,
            'no_sk' => $keaktifan?->no_sk,
            'tgl_sk' => $keaktifan?->tgl_sk,
        ];
    }

    /** @return array<string, mixed> */
    private function psbCalon(?int $id): array
    {
        $calon = $id === null ? null : PsbCalonSantri::find($id);

        if ($calon === null) {
            return [];
        }

        return $calon->only([
            'no_pendaftaran', 'nama_lengkap', 'jk', 'tanggal_daftar', 'tanggal_masuk',
            'status_pendaftaran', 'jenjang', 'telp_ortu', 'email_ortu', 'catatan',
        ]);
    }

    /** @return array<string, mixed> */
    private function sistem(): array
    {
        $hariIni = Carbon::now()->format('Y-m-d');

        return [
            'tanggal_hari_ini' => $hariIni,
            // tanggal_hari_ini_tercantum sengaja tidak diisi: bentuk Indonesia-nya
            // dihitung oleh hitung('tanggal_indonesia').
            'nama_aplikasi' => (string) config('app.name', 'SIMPES'),
            'pencetak' => $this->konteks->pencetak?->name,
        ];
    }

    /** Riwayat belajar aktif Santri pada jenjang & tahun ajaran konteks. */
    private function riwayatAktif(int $santriId): ?object
    {
        $riwayat = Santri::find($santriId)?->riwayatBelajar()
            ->where('is_active_riwayat', 'Ya')
            ->when($this->konteks->jenjang !== null, fn ($q) => $q->where('jenjang', $this->konteks->jenjang))
            ->when($this->konteks->tahunAjaran !== null, fn ($q) => $q->where('tahun_ajaran', $this->konteks->tahunAjaran))
            ->when($this->konteks->semester !== null, fn ($q) => $q->where('semester', $this->konteks->semester))
            ->first();

        return $riwayat?->loadMissing('kelas');
    }

    private function labelSemester(?string $semester): ?string
    {
        return $semester === null || trim($semester) === ''
            ? null
            : SemesterAktif::label($semester);
    }

    private function tanggalUmur(mixed $tanggal): ?string
    {
        if ($this->kosong($tanggal)) {
            return null;
        }

        $carbon = Carbon::parse($tanggal);

        return $carbon->locale('id')->translatedFormat('j F Y').' ('.$carbon->age.' tahun)';
    }

    private function tanggalIndonesia(mixed $tanggal): ?string
    {
        if ($this->kosong($tanggal)) {
            return null;
        }

        return Carbon::parse($tanggal)->locale('id')->translatedFormat('j F Y');
    }

    /**
     * Susun alamat satu baris dari bagian-bagiannya, melewati yang kosong.
     * $awalan dipakai untuk alamat orang tua (ayah_alamat, ayah_rt, ...).
     * $sertaRtRw dimatikan untuk alamat orang tua karena tabel Santri hanya
     * menyimpan satu pasang RT/RW milik Santri; memakainya untuk alamat orang
     * tua berarti mengarang detail yang tidak tercatat.
     *
     * @param  array<string, mixed>  $data
     */
    private function alamatLengkap(array $data, string $awalan = '', bool $sertaRtRw = true): ?string
    {
        $bagian = array_filter([
            $data[$awalan.'alamat'] ?? null,
            $sertaRtRw ? $this->gabungRtRw($data) : null,
            $data['desa_kelurahan'] ?? null,
            $data['kecamatan'] ?? null,
            $data['kab_kota'] ?? null,
            $data['kode_pos'] ?? null,
        ], fn ($nilai) => ! $this->kosong($nilai));

        return $bagian === [] ? null : implode(', ', $bagian);
    }

    /** @param  array<string, mixed>  $data */
    private function gabungRtRw(array $data): ?string
    {
        $rt = trim((string) ($data['rt'] ?? ''));
        $rw = trim((string) ($data['rw'] ?? ''));

        if ($rt === '' && $rw === '') {
            return null;
        }

        return 'RT '.($rt !== '' ? str_pad($rt, 3, '0', STR_PAD_LEFT) : '000').' / RW '.($rw !== '' ? str_pad($rw, 3, '0', STR_PAD_LEFT) : '000');
    }

    /** @param  array<string, mixed>  $data */
    private function kelasLengkap(array $data): ?string
    {
        $nama = $data['nama_kelas'] ?? null;

        if ($this->kosong($nama)) {
            return null;
        }

        $tingkat = $data['tingkat'] ?? null;

        return $this->kosong($tingkat) ? (string) $nama : 'Kelas '.$tingkat.' '.$nama;
    }

    /**
     * Path absolut gambar di disk lokal, atau null bila kosong atau berupa URL.
     * URL tidak bisa dipakai karena akses remote dimatikan, dan dokumen hasil
     * cetak harus mandiri tanpa berkas luar.
     */
    private function jalurGambar(?string $path): ?string
    {
        if ($this->kosong($path) || str_starts_with((string) $path, 'http')) {
            return null;
        }

        $penuh = Storage::disk('local')->path($path);

        return is_file($penuh) ? $penuh : null;
    }

    /** @return list<array<string, mixed>> */
    /**
     * Semua lembaga tempat pegawai yang dipilih ditempatkan.
     *
     * Nama lembaga diambil lewat relasi supaya tidak perlu join; jumlahnya
     * sedikit dan relasi sudah dimuat bersama.
     *
     * @return list<array<string, mixed>>
     */
    private function barisPenempatanPegawai(): array
    {
        $pegawai = $this->konteks->idPegawai === null ? null : Pegawai::find($this->konteks->idPegawai);

        if ($pegawai === null) {
            return [];
        }

        // jenjang ikut dipilih karena itu kunci relasinya; memuat nama saja
        // membuat eager load tidak bisa mencocokkan barisnya.
        return $pegawai->penempatan()
            ->with('lembaga:jenjang,nama')
            ->orderBy('jenjang')
            ->get()
            ->map(fn (LembagaPegawai $p): array => [
                'lembaga' => $this->namaLembaga($p->lembaga?->nama, $p->jenjang),
                'tugas_utama' => $p->tugas_utama,
                'status' => $p->is_active_lembaga === LembagaPegawai::YA ? 'Aktif' : 'Nonaktif',
                'tgl_masuk' => $p->tgl_masuk,
                'tgl_selesai' => $p->tgl_selesai,
                'no_sk_awal_ptk' => $p->no_sk_awal_ptk,
                'tgl_sk_awal_ptk' => $p->tgl_sk_awal_ptk,
            ])->all();
    }

    /**
     * Riwayat keaktifan pegawai, terbaru lebih dulu.
     *
     * @return list<array<string, mixed>>
     */
    private function barisKeaktifanPegawai(): array
    {
        $pegawai = $this->konteks->idPegawai === null ? null : Pegawai::find($this->konteks->idPegawai);

        if ($pegawai === null) {
            return [];
        }

        return $pegawai->keaktifan()
            ->with('lembaga:jenjang,nama')
            ->orderByDesc('tahun_ajaran')
            ->orderBy('jenjang')
            ->get()
            ->map(fn (KeaktifanPegawai $k): array => [
                'tahun_ajaran' => $k->tahun_ajaran,
                'lembaga' => $this->namaLembaga($k->lembaga?->nama, $k->jenjang),
                'tugas_utama' => $k->tugas_utama,
                'status' => $k->status_keaktifan === KeaktifanPegawai::AKTIF ? 'Aktif' : 'Nonaktif',
                'no_sk' => $k->no_sk,
                'tgl_sk' => $k->tgl_sk,
            ])->all();
    }

    /**
     * Akun sistem yang tertaut ke pegawai. Paling banyak satu, jadi tabelnya
     * biasanya berisi nol atau satu baris.
     *
     * @return list<array<string, mixed>>
     */
    private function barisAkunPegawai(): array
    {
        $pegawai = $this->konteks->idPegawai === null ? null : Pegawai::find($this->konteks->idPegawai);
        $akun = $pegawai?->akun;

        if ($akun === null) {
            return [];
        }

        $akun->loadMissing(['roles:id,name', 'lembagas:jenjang,nama']);

        return [[
            'nama' => $akun->name,
            'login' => $akun->email ?: $akun->username,
            'no_hp' => $akun->phone,
            'peran' => $akun->roles->pluck('name')->map(fn (string $r): string => Str::headline($r))->implode(', '),
            'akses_lembaga' => $akun->lembagas
                ->map(fn (Lembaga $l): string => $l->jenjang.($l->pivot->role ? ' ('.Str::headline((string) $l->pivot->role).')' : ''))
                ->implode(', '),
        ]];
    }

    /** "Nama (JENJANG)", jatuh ke jenjang saja bila nama lembaga kosong. */
    private function namaLembaga(?string $nama, ?string $jenjang): string
    {
        $nama = trim((string) $nama);
        $jenjang = (string) $jenjang;

        if ($nama === '') {
            return $jenjang;
        }

        return $jenjang === '' ? $nama : $nama.' ('.$jenjang.')';
    }

    private function barisDaftarKelas(): array
    {
        if ($this->konteks->kelasId === null) {
            return [];
        }

        $tanggal = $this->konteks->tanggalAbsen ?? Carbon::now()->format('Y-m-d');

        // LEFT JOIN ke presensi pada tanggal terpilih: kolom "hadir" sengaja
        // dikosongkan bila belum ada catatan, bukan diasumsikan hadir.
        return DB::table('riwayat_belajar as rb')
            ->join('santri as s', 's.id', '=', 'rb.santri_id')
            ->leftJoin('lembaga_santri as ls', function ($j) {
                $j->on('ls.santri_id', '=', 's.id')
                    ->on('ls.jenjang', '=', 'rb.jenjang')
                    ->where('ls.is_active_lembaga', 'Ya');
            })
            ->leftJoin('presensi_santri as p', function ($j) use ($tanggal) {
                $j->on('p.santri_id', '=', 's.id')->where('p.tanggal', '=', $tanggal);
            })
            ->where('rb.kelas_id', $this->konteks->kelasId)
            ->where('rb.is_active_riwayat', 'Ya')
            ->when($this->konteks->tahunAjaran !== null, fn ($q) => $q->where('rb.tahun_ajaran', $this->konteks->tahunAjaran))
            ->when($this->konteks->semester !== null, fn ($q) => $q->where('rb.semester', $this->konteks->semester))
            ->orderBy('rb.no_absen')
            ->get([
                'rb.no_absen', 'ls.nis_lokal', 's.nisn', 's.nama_lengkap', 's.jk', 'p.status as hadir',
            ])
            ->map(fn ($b) => (array) $b)
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function barisNilai(?int $santriId): array
    {
        if ($santriId === null) {
            return [];
        }

        return DB::table('nilai_santri as n')
            ->leftJoin('pengampu_mapel as pm', 'pm.id', '=', 'n.pengampu_mapel_id')
            ->leftJoin('mata_pelajaran as mp', 'mp.id', '=', 'pm.mata_pelajaran_id')
            ->where('n.santri_id', $santriId)
            ->when($this->konteks->tahunAjaran !== null, fn ($q) => $q->where('n.tahun_ajaran', $this->konteks->tahunAjaran))
            ->when($this->konteks->semester !== null, fn ($q) => $q->where('n.semester', $this->konteks->semester))
            ->orderBy('n.id')
            ->get(['mp.nama_mapel as mata_pelajaran', 'n.nilai_formatif', 'n.nilai_sumatif', 'n.nilai_akhir', 'n.predikat'])
            ->map(fn ($b) => (array) $b)
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function barisPresensi(?int $santriId): array
    {
        if ($santriId === null) {
            return [];
        }

        return DB::table('presensi_santri')
            ->where('santri_id', $santriId)
            ->orderBy('tanggal')
            ->get(['tanggal', 'status', 'keterangan'])
            ->map(fn ($b) => (array) $b)
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function barisPelanggaran(?int $santriId): array
    {
        if ($santriId === null) {
            return [];
        }

        return DB::table('pelanggaran_santri')
            ->where('santri_id', $santriId)
            ->orderBy('tanggal')
            ->get(['tanggal', 'tipe_pelanggaran', 'deskripsi', 'poin'])
            ->map(fn ($b) => (array) $b)
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function barisTahfiz(?int $santriId): array
    {
        if ($santriId === null) {
            return [[]];
        }

        $rekap = DB::table('rekap_tahfiz_santri')->where('santri_id', $santriId)->first();

        if ($rekap === null) {
            return [[]];
        }

        return [[
            'juz_mutqin' => $rekap->total_juz_mutqin,
            'juz_ziyadah' => $rekap->total_juz_ziyadah,
            'ayat_terakhir' => $rekap->ayat_terakhir,
        ]];
    }

    private function kosong(mixed $nilai): bool
    {
        return $nilai === null || trim((string) $nilai) === '';
    }
}
