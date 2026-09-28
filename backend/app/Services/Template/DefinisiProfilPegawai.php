<?php

namespace App\Services\Template;

/**
 * Definisi template "Profil Pegawai" untuk template jenis 'html'.
 *
 * Halaman profil sebelumnya dirender dari Blade view yang tertanam. Sekarang
 * tata letaknya ditulis di sini supaya bisa diubah lewat desainer.
 *
 * Semua ukuran dalam milimeter mengikuti A4 210 x 297 dengan margin 20 mm.
 * Penempatan mengikuti urutan buku induk: kop, judul, tiga blok identitas,
 * lalu tiga tabel.
 */
final class DefinisiProfilPegawai
{
    public const KODE = 'profil-pegawai';

    public const NAMA = 'Profil Pegawai';

    public const KATEGORI = 'lainnya';

    /** Margin kiri dan kanan halaman A4. */
    private const KIRI = 20.0;

    private const LEBAR_ISI = 170.0;

    private const UKURAN_HALAMAN = ['lebar_mm' => 210.0, 'tinggi_mm' => 297.0];

    /**
     * Jumlah halaman. Isi profil tidak muat satu halaman A4, jadi kop dan
     * identitas di halaman pertama, tiga tabel di halaman kedua.
     */
    public const JUMLAH_HALAMAN = 2;

    /**
     * Definisi lengkap, siap disimpan ke kolom `definisi`.
     *
     * @return array{versi: int, medan: list<array<string, mixed>>}
     */
    public static function definisi(): array
    {
        $medan = self::medanKop();
        $medan = array_merge($medan, self::medanJudul());
        $medan = array_merge($medan, self::medanIdentitas());
        $medan = array_merge($medan, self::medanKepegawaian());
        $medan = array_merge($medan, self::medanHalamanDua(self::JUMLAH_HALAMAN));

        return ['versi' => 1, 'medan' => $medan];
    }

    /** @return array{lebar_mm: float, tinggi_mm: float} */
    public static function ukuranHalaman(): array
    {
        return self::UKURAN_HALAMAN;
    }

    /**
     * Medan teks satu baris.
     *
     * @param  array<string, mixed>  $gaya
     * @return array<string, mixed>
     */
    private static function teks(
        string $label,
        string $sumber,
        ?string $kunci,
        float $x,
        float $y,
        float $w,
        float $h = 6.0,
        array $gaya = [],
        int $halaman = 1,
        ?string $statis = null,
    ): array {
        return [
            'tipe' => 'teks',
            'label' => $label,
            'halaman' => $halaman,
            'x' => round($x, 2),
            'y' => round($y, 2),
            'w' => round($w, 2),
            'h' => round($h, 2),
            'sumber' => $sumber,
            'kunci' => $kunci,
            'teks_tetap' => $statis,
            'gaya' => $gaya + ['ukuran' => 9, 'tebal' => false, 'warna' => '#000000', 'rata' => 'kiri'],
        ];
    }

    /** Lebar tetap kolom label di dalam blok identitas, dalam milimeter. */
    private const LEBAR_LABEL = 30.0;

    /**
     * Satu pasangan label dan nilai pada blok identitas.
     *
     * Pemanggil hanya menentukan di mana kolom mulai dan seberapa lebar
     * seluruhnya; label dan nilai dibagi di dalam supaya nilai tidak menimpa
     * teks penjelasnya.
     *
     * @return array{0: string, 1: string, 2: string, 3: float, 4: float}
     */
    private static function sel(string $label, string $kunci, string $sumber, float $x, float $lebar): array
    {
        return [$label, $kunci, $sumber, $x, $lebar];
    }

    /**
     * Label tabel, tidak terikat sumber apa pun.
     *
     * @return array<string, mixed>
     */
    private static function label(string $teks, float $x, float $y, float $w, float $ukuran = 8.5, int $halaman = 1): array
    {
        return self::teks($teks, 'tetap', null, $x, $y, $w, 5.0, [
            'ukuran' => $ukuran,
            'tebal' => true,
            'warna' => '#333333',
        ], $halaman, $teks);
    }

    /** @return array<string, mixed> */
    private static function garis(float $x, float $y, float $w, float $tebal = 0.4, string $warna = '#000000', int $halaman = 1): array
    {
        return [
            'tipe' => 'garis',
            'label' => 'Garis',
            'halaman' => $halaman,
            'x' => round($x, 2),
            'y' => round($y, 2),
            'w' => round($w, 2),
            'h' => $tebal,
            'gaya' => ['tebal_mm' => $tebal, 'warna' => $warna],
        ];
    }

    /**
     * @param  array<string, mixed>  $gaya
     * @return array<string, mixed>
     */
    private static function kotak(float $x, float $y, float $w, float $h, array $gaya = [], int $halaman = 1): array
    {
        return [
            'tipe' => 'kotak',
            'label' => 'Kotak',
            'halaman' => $halaman,
            'x' => round($x, 2),
            'y' => round($y, 2),
            'w' => round($w, 2),
            'h' => round($h, 2),
            'gaya' => $gaya + ['tebal_mm' => 0.3, 'warna' => '#7a7a7a', 'isi' => null],
        ];
    }

    /**
     * Kolom satu tabel: label kepala dan satu sel per baris.
     *
     * @param  list<array{x: float, w: float, kunci: string, label: string, sumber: string}>  $kolom
     * @return list<array<string, mixed>>
     */
    private static function kepalaTabel(float $y, array $kolom, int $halaman): array
    {
        $medan = [];

        foreach ($kolom as $satu) {
            $medan[] = self::label($satu['label'], self::KIRI + $satu['x'], $y, $satu['w'], 8.5, $halaman);
        }

        return $medan;
    }

    /**
     * @param  list<array{x: float, w: float, kunci: string, label: string, sumber: string}>  $kolom
     * @return array<string, mixed>
     */
    private static function selTabel(
        float $y,
        float $tinggiBaris,
        array $kolom,
        string $sumber,
        int $jumlahBaris,
        int $halaman,
        float $lebarKeseluruhan = self::LEBAR_ISI,
    ): array {
        return [
            'tipe' => 'baris_berulang',
            'label' => 'Tabel',
            'halaman' => $halaman,
            'x' => self::KIRI,
            'y' => round($y, 2),
            'w' => $lebarKeseluruhan,
            'h' => round($tinggiBaris * $jumlahBaris, 2),
            'baris_berulang' => [
                'sumber' => $sumber,
                'jumlah' => $jumlahBaris,
                'tinggi_baris' => $tinggiBaris,
                'kolom' => array_map(fn (array $satu): array => [
                    'x' => $satu['x'],
                    'w' => $satu['w'],
                    'label' => $satu['label'],
                    'sumber' => $satu['sumber'],
                    'kunci' => $satu['kunci'],
                    'gaya' => ['ukuran' => 8.5, 'warna' => '#000000', 'rata' => 'kiri'],
                ], $kolom),
            ],
        ];
    }

    /** @return list<array<string, mixed>> */
    private static function medanKop(): array
    {
        $medan = [
            self::teks('Nama lembaga', 'lembaga', 'nama', self::KIRI, 14.0, 150.0, 7.0, [
                'ukuran' => 14,
                'tebal' => true,
                'huruf_besar' => true,
            ]),
            self::teks('Alamat', 'lembaga', 'alamat', self::KIRI, 21.5, 170.0, 5.0),
            self::teks('Desa', 'lembaga', 'desa', self::KIRI, 26.5, 170.0, 5.0, ['ukuran' => 8]),
            self::teks('Telepon', 'lembaga', 'telepon', self::KIRI, 31.5, 85.0, 5.0, ['ukuran' => 8]),
            self::teks('NPSN', 'lembaga', 'npsn', 110.0, 31.5, 80.0, 5.0, ['ukuran' => 8]),
        ];

        // Garis kop digambar dua lapis supayalau ttl seperti di buku induk.
        $medan[] = self::garis(self::KIRI, 37.5, self::LEBAR_ISI, 0.7);
        $medan[] = self::garis(self::KIRI, 39.0, self::LEBAR_ISI, 0.25);

        return $medan;
    }

    /** @return list<array<string, mixed>> */
    private static function medanJudul(): array
    {
        return [
            self::teks('Judul', 'tetap', null, self::KIRI, 46.0, self::LEBAR_ISI, 7.0, [
                'ukuran' => 13,
                'tebal' => true,
                'rata' => 'tengah',
            ], 1, 'PROFIL PEGAWAI'),
            self::teks('Subjudul', 'sistem', 'tanggal_hari_ini_tercantum', self::KIRI, 53.0, self::LEBAR_ISI, 5.0, [
                'ukuran' => 9,
                'rata' => 'tengah',
                'warna' => '#444444',
            ]),
        ];
    }

    /**
     * Blok label dan nilai. Satu blok punya judul berlatar dan deretan baris
     * berpasangan; tinggi tiap blok dihitung dari jumlah barisnya.
     *
     * @return list<array<string, mixed>>
     */
    private static function blok(string $judul, array $baris, float $y, float &$kursor, int $halaman = 1): array
    {
        $tinggiBaris = 7.0;
        $medan = [
            self::kotak(self::KIRI, $y, self::LEBAR_ISI, 5.5, [
                'warna' => '#7a7a7a',
                'isi' => '#e8e8e8',
            ], $halaman),
            self::label($judul, self::KIRI + 1.5, $y, self::LEBAR_ISI - 3, 9.5, $halaman),
        ];

        $barisKe = $y + 6.5;

        foreach ($baris as $satu) {
            foreach ($satu as $samping) {
                [$label, $kunci, $sumber, $x, $lebar] = $samping;
                $medan[] = self::label($label, $x, $barisKe, self::LEBAR_LABEL, 8.5, $halaman);
                $medan[] = self::teks($label, $sumber, $kunci, $x + self::LEBAR_LABEL + 1, $barisKe, $lebar - self::LEBAR_LABEL - 1, 6.0, [], $halaman);
            }

            $barisKe += $tinggiBaris;
        }

        $kursor = $barisKe + 2.0;

        return $medan;
    }

    /** @return list<array<string, mixed>> */
    private static function medanIdentitas(): array
    {
        $kursor = 62.0;
        $medan = [];

        $medan = array_merge($medan, self::blok('Identitas diri', [
            [self::sel('Nama lengkap', 'nama', 'pegawai', 20.0, 150.0)],
            [self::sel('NIP', 'nip', 'pegawai', 20.0, 70.0), self::sel('NIPP', 'nipp', 'pegawai', 110.0, 60.0)],
            [self::sel('NIK', 'nik', 'pegawai', 20.0, 70.0), self::sel('Jenis kelamin', 'jenis_kelamin_tercantum', 'pegawai', 110.0, 60.0)],
            [self::sel('Tempat lahir', 'tempat_lahir', 'pegawai', 20.0, 70.0), self::sel('Tanggal lahir', 'tanggal_lahir', 'pegawai', 110.0, 60.0)],
            [self::sel('Agama', 'agama', 'pegawai', 20.0, 70.0), self::sel('Golongan darah', 'gol_darah', 'pegawai', 110.0, 60.0)],
            [self::sel('Status pernikahan', 'status_pernikahan', 'pegawai', 20.0, 70.0), self::sel('NIAT/NPA', 'niat_npa', 'pegawai', 110.0, 60.0)],
            [self::sel('NPWP', 'npwp', 'pegawai', 20.0, 70.0), self::sel('No. KK', 'no_kk', 'pegawai', 110.0, 60.0)],
            [self::sel('No. BPJS', 'no_bpjs', 'pegawai', 20.0, 70.0)],
        ], $kursor, $kursor));

        $medan = array_merge($medan, self::blok('Domisili & kontak', [
            [self::sel('Alamat', 'alamat', 'pegawai', 20.0, 150.0)],
            [self::sel('RT/RW', 'rt_rw', 'pegawai', 20.0, 70.0), self::sel('Kode pos', 'kode_pos', 'pegawai', 110.0, 60.0)],
            [self::sel('Desa/Kelurahan', 'desa_kelurahan', 'pegawai', 20.0, 70.0), self::sel('Kecamatan', 'kecamatan', 'pegawai', 110.0, 60.0)],
            [self::sel('Kabupaten/Kota', 'kab_kota', 'pegawai', 20.0, 70.0), self::sel('Provinsi', 'provinsi', 'pegawai', 110.0, 60.0)],
            [self::sel('No. HP', 'no_hp', 'pegawai', 20.0, 70.0), self::sel('Status tempat tinggal', 'status_tempat_tinggal', 'pegawai', 110.0, 60.0)],
            [self::sel('Email pribadi', 'email_pribadi', 'pegawai', 20.0, 70.0), self::sel('Email GWS', 'email_gws', 'pegawai', 110.0, 60.0)],
            [self::sel('Jarak ke pesantren', 'jarak_ke_pesantren', 'pegawai', 20.0, 70.0), self::sel('Waktu tempuh', 'waktu_tempuh', 'pegawai', 110.0, 60.0)],
            [self::sel('Transportasi', 'transportasi', 'pegawai', 20.0, 70.0)],
        ], $kursor, $kursor));

        return $medan;
    }

    /** @return list<array<string, mixed>> */
    private static function medanKepegawaian(): array
    {
        $kursor = 0.0;
        $medan = self::blok('Kepegawaian', [
            [self::sel('Status kepegawaian', 'status_keaktifan_tercantum', 'pegawai', 20.0, 70.0), self::sel('Mulai kerja', 'tgl_mulai_kerja', 'pegawai', 110.0, 60.0)],
            [self::sel('No. SK awal', 'no_sk_awal', 'pegawai', 20.0, 70.0), self::sel('Tanggal SK awal', 'tgl_sk_awal', 'pegawai', 110.0, 60.0)],
            [self::sel('Pendidikan terakhir', 'pendidikan_terakhir', 'pegawai', 20.0, 70.0), self::sel('Jenis PTK', 'jenis_ptk', 'pegawai', 110.0, 60.0)],
            [self::sel('Sertifikasi', 'sertifikasi', 'pegawai', 20.0, 150.0)],
        ], 208.0, $kursor);

        return $medan;
    }

    /**
     * Tiga tabel pada halaman kedua, disusun berurutan dari kursor.
     *
     * Setiap tabel punya kepala, garis atas, sel berulang, dan garis bawah.
     * Jumlah baris dibatasi karena baris di luar batas tidak punya tempat di
     * halaman tetap.
     *
     * @return list<array<string, mixed>>
     */
    private static function medanHalamanDua(int $halaman): array
    {
        $kursor = 20.0;
        $medan = [];

        $tabel = function (string $judul, array $kolom, string $sumber, int $jumlahBaris) use (&$kursor, $halaman): array {
            $medan = [self::teks($judul, 'tetap', null, self::KIRI, $kursor, self::LEBAR_ISI, 5.0, [
                'ukuran' => 9.5,
                'tebal' => true,
                'warna' => '#333333',
            ], $halaman, $judul)];
            $kursor += 6.0;

            $medan = array_merge($medan, self::kepalaTabel($kursor, $kolom, $halaman));
            $kursor += 5.0;
            $medan[] = self::garis(self::KIRI, $kursor, self::LEBAR_ISI, 0.3, '#7a7a7a', $halaman);
            $kursor += 0.5;

            $medan[] = self::selTabel($kursor, 6.0, $kolom, $sumber, $jumlahBaris, $halaman);
            $kursor += 6.0 * $jumlahBaris;

            $medan[] = self::garis(self::KIRI, $kursor, self::LEBAR_ISI, 0.3, '#7a7a7a', $halaman);
            $kursor += 5.0;

            return $medan;
        };

        $medan = array_merge($medan, $tabel('Penempatan lembaga', [
            ['x' => 0.0, 'w' => 46.0, 'kunci' => 'lembaga', 'label' => 'Lembaga', 'sumber' => 'baris'],
            ['x' => 46.0, 'w' => 30.0, 'kunci' => 'tugas_utama', 'label' => 'Tugas', 'sumber' => 'baris'],
            ['x' => 76.0, 'w' => 18.0, 'kunci' => 'status', 'label' => 'Status', 'sumber' => 'baris'],
            ['x' => 94.0, 'w' => 19.0, 'kunci' => 'tgl_masuk', 'label' => 'Masuk', 'sumber' => 'baris'],
            ['x' => 113.0, 'w' => 19.0, 'kunci' => 'tgl_selesai', 'label' => 'Keluar', 'sumber' => 'baris'],
            ['x' => 132.0, 'w' => 24.0, 'kunci' => 'no_sk_awal_ptk', 'label' => 'No. SK', 'sumber' => 'baris'],
            ['x' => 156.0, 'w' => 14.0, 'kunci' => 'tgl_sk_awal_ptk', 'label' => 'Tgl. SK', 'sumber' => 'baris'],
        ], 'penempatan_pegawai', 4));

        $medan = array_merge($medan, $tabel('Keaktifan per tahun ajaran', [
            ['x' => 0.0, 'w' => 30.0, 'kunci' => 'tahun_ajaran', 'label' => 'Tahun Ajaran', 'sumber' => 'baris'],
            ['x' => 30.0, 'w' => 46.0, 'kunci' => 'lembaga', 'label' => 'Lembaga', 'sumber' => 'baris'],
            ['x' => 76.0, 'w' => 32.0, 'kunci' => 'tugas_utama', 'label' => 'Tugas', 'sumber' => 'baris'],
            ['x' => 108.0, 'w' => 20.0, 'kunci' => 'status', 'label' => 'Status', 'sumber' => 'baris'],
            ['x' => 128.0, 'w' => 26.0, 'kunci' => 'no_sk', 'label' => 'No. SK', 'sumber' => 'baris'],
            ['x' => 154.0, 'w' => 16.0, 'kunci' => 'tgl_sk', 'label' => 'Tgl. SK', 'sumber' => 'baris'],
        ], 'keaktifan_pegawai_riwayat', 4));

        $medan = array_merge($medan, $tabel('Akun login tertaut', [
            ['x' => 0.0, 'w' => 40.0, 'kunci' => 'nama', 'label' => 'Nama Akun', 'sumber' => 'baris'],
            ['x' => 40.0, 'w' => 45.0, 'kunci' => 'login', 'label' => 'Login', 'sumber' => 'baris'],
            ['x' => 85.0, 'w' => 30.0, 'kunci' => 'no_hp', 'label' => 'No. HP', 'sumber' => 'baris'],
            ['x' => 115.0, 'w' => 25.0, 'kunci' => 'peran', 'label' => 'Peran', 'sumber' => 'baris'],
            ['x' => 140.0, 'w' => 30.0, 'kunci' => 'akses_lembaga', 'label' => 'Akses', 'sumber' => 'baris'],
        ], 'akun_pegawai', 1));

        $medan[] = self::garis(self::KIRI, 282.0, self::LEBAR_ISI, 0.25, '#999999', $halaman);
        $medan[] = self::teks('Footer', 'sistem', 'nama_aplikasi', self::KIRI, 284.0, self::LEBAR_ISI, 5.0, [
            'ukuran' => 8,
            'warna' => '#444444',
        ], $halaman);

        return $medan;
    }
}
