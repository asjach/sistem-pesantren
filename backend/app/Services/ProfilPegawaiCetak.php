<?php

namespace App\Services;

use App\Models\KeaktifanPegawai;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Data profil pegawai + penyusunannya untuk cetak PDF.
 *
 * `muat()` adalah satu-satunya sumber data profil (dipakai endpoint JSON
 * maupun PDF) agar keduanya tak pernah menyimpang; `tampilan()` mengubahnya
 * jadi blok/baris siap render Blade — dipisah supaya bisa diuji tanpa dompdf.
 */
class ProfilPegawaiCetak
{
    /**
     * Data profil mentah satu pegawai.
     *
     * @return array{pegawai: Pegawai, penempatan: Collection<int, LembagaPegawai>, keaktifan: Collection<int, KeaktifanPegawai>, akun: ?User}
     */
    public static function muat(Pegawai $pegawai): array
    {
        return [
            'pegawai' => $pegawai,
            'penempatan' => LembagaPegawai::where('pegawai_id', $pegawai->id)
                ->with('lembaga:jenjang,nama')
                ->orderBy('jenjang')
                ->get(),
            'keaktifan' => KeaktifanPegawai::where('pegawai_id', $pegawai->id)
                ->with('lembaga:jenjang,nama')
                ->orderByDesc('tahun_ajaran')
                ->orderBy('jenjang')
                ->get(),
            'akun' => $pegawai->akun?->load(['roles:id,name', 'lembagas:jenjang,nama']),
        ];
    }

    /** Lembaga untuk kop cetak: penempatan aktif pertama, else penempatan pertama. */
    public static function lembagaKop(Collection $penempatan): ?Lembaga
    {
        $pilih = $penempatan->firstWhere('is_active_lembaga', LembagaPegawai::YA) ?? $penempatan->first();

        return $pilih ? Lembaga::find($pilih->jenjang) : null;
    }

    /**
     * Payload siap render untuk `resources/views/pdf/profil-pegawai.blade.php`.
     *
     * @param  array{pegawai: Pegawai, penempatan: Collection<int, LembagaPegawai>, keaktifan: Collection<int, KeaktifanPegawai>, akun: ?User}  $data
     * @return array{kop: ?Lembaga, pegawai: Pegawai, identitas: array<int, mixed>, seksi: array<int, mixed>, tanggalCetak: string, pencetak: string}
     */
    public static function tampilan(array $data, ?Lembaga $kop, string $pencetak): array
    {
        return [
            'kop' => $kop,
            'pegawai' => $data['pegawai'],
            'identitas' => self::blokIdentitas($data['pegawai']),
            'seksi' => self::seksiProfil($data),
            'tanggalCetak' => Carbon::now()->locale('id')->translatedFormat('j F Y'),
            'pencetak' => $pencetak,
        ];
    }

    /** Nilai tampil: `null`/kosong → `$kosong` (biar tabel tetap rata). */
    private static function teks(mixed $nilai, string $kosong = ''): string
    {
        if ($nilai === null) {
            return $kosong;
        }
        $teks = trim((string) $nilai);

        return $teks === '' ? $kosong : $teks;
    }

    /** Tanggal tampil gaya Indonesia (dd/mm/yyyy). */
    private static function tglTampil(mixed $nilai): string
    {
        return $nilai === null ? '' : Carbon::parse($nilai)->format('d/m/Y');
    }

    /**
     * Blok identitas siap cetak: tiap baris sudah berupa sel siap render
     * `[label, nilai]` atau `[label, nilai, colspan]` untuk isian panjang.
     * Urutan mengikuti Buku Induk agar mudah dicocokkan dengan berkas fisik.
     *
     * @return array<int, array{judul: string, baris: array<int, array<int, string|int>>}>
     */
    private static function blokIdentitas(Pegawai $p): array
    {
        $nama = trim(($p->gelar_depan ? $p->gelar_depan.' ' : '').$p->nama_lengkap.($p->gelar_belakang ? ', '.$p->gelar_belakang : ''));
        $jk = match ($p->jenis_kelamin) {
            'L' => 'Laki-laki',
            'P' => 'Perempuan',
            default => self::teks($p->jenis_kelamin),
        };
        $rtRw = trim(($p->rt ? 'RT '.$p->rt : '').($p->rw ? ' / RW '.$p->rw : ''));

        return [
            [
                'judul' => 'Identitas diri',
                'baris' => [
                    [['Nama lengkap', $nama, 3]],
                    [['NIP', self::teks($p->nip)], ['NIPP', self::teks($p->nipp)]],
                    [['NIK', self::teks($p->nik)], ['Jenis kelamin', $jk]],
                    [['Tempat lahir', self::teks($p->tempat_lahir)], ['Tanggal lahir', self::tglTampil($p->tanggal_lahir)]],
                    [['Agama', self::teks($p->agama)], ['Golongan darah', self::teks($p->gol_darah)]],
                    [['Status pernikahan', self::teks($p->status_pernikahan)], ['NIAT/NPA', self::teks($p->niat_npa)]],
                    [['NPWP', self::teks($p->npwp)], ['No. KK', self::teks($p->no_kk)]],
                    [['No. BPJS', self::teks($p->no_bpjs)], ['', '']],
                ],
            ],
            [
                'judul' => 'Domisili & kontak',
                'baris' => [
                    [['Alamat', self::teks($p->alamat), 3]],
                    [['RT/RW', $rtRw], ['Kode pos', self::teks($p->kode_pos)]],
                    [['Desa/Kelurahan', self::teks($p->desa_kelurahan)], ['Kecamatan', self::teks($p->kecamatan)]],
                    [['Kabupaten/Kota', self::teks($p->kab_kota)], ['Provinsi', self::teks($p->provinsi)]],
                    [['No. HP', self::teks($p->no_hp)], ['Status tempat tinggal', self::teks($p->status_tempat_tinggal)]],
                    [['Email pribadi', self::teks($p->email_pribadi)], ['Email GWS', self::teks($p->email_gws)]],
                    [['Jarak ke pesantren', self::teks($p->jarak_ke_pesantren)], ['Waktu tempuh', self::teks($p->waktu_tempuh)]],
                    [['Transportasi', self::teks($p->transportasi)], ['', '']],
                ],
            ],
            [
                'judul' => 'Kepegawaian',
                'baris' => [
                    [['Status kepegawaian', $p->status_aktif === Pegawai::AKTIF ? 'Aktif' : 'Nonaktif'], ['Mulai kerja', self::tglTampil($p->tgl_mulai_kerja)]],
                    [['No. SK awal', self::teks($p->no_sk_awal)], ['Tanggal SK awal', self::tglTampil($p->tgl_sk_awal)]],
                    [['Pendidikan terakhir', self::teks($p->pendidikan_terakhir)], ['Jenis PTK', self::teks($p->jenis_ptk)]],
                    [['Sertifikasi', self::teks($p->sertifikasi)], ['', '']],
                ],
            ],
        ];
    }

    /**
     * Seksi tabel siap cetak (penempatan, keaktifan per TA, akun tertaut).
     *
     * @param  array{pegawai: Pegawai, penempatan: mixed, keaktifan: mixed, akun: ?User}  $data
     * @return array<int, array{judul: string, kolom: string[], baris: array<int, string[]>}>
     */
    private static function seksiProfil(array $data): array
    {
        $akun = $data['akun'];

        return [
            [
                'judul' => 'Penempatan lembaga',
                'kolom' => ['Lembaga', 'Tugas utama', 'Status', 'Masuk', 'Keluar', 'No. SK PTK', 'Tgl. SK PTK'],
                'baris' => $data['penempatan']->map(fn (LembagaPegawai $p) => [
                    self::teks($p->lembaga?->nama, $p->jenjang).' ('.$p->jenjang.')',
                    self::teks($p->tugas_utama),
                    $p->is_active_lembaga === LembagaPegawai::YA ? 'Aktif' : 'Nonaktif',
                    self::tglTampil($p->tgl_masuk),
                    self::tglTampil($p->tgl_selesai),
                    self::teks($p->no_sk_awal_ptk),
                    self::tglTampil($p->tgl_sk_awal_ptk),
                ])->all(),
            ],
            [
                'judul' => 'Keaktifan per tahun ajaran',
                'kolom' => ['Tahun ajaran', 'Lembaga', 'Tugas utama', 'Status', 'No. SK', 'Tgl. SK'],
                'baris' => $data['keaktifan']->map(fn (KeaktifanPegawai $k) => [
                    self::teks($k->tahun_ajaran),
                    self::teks($k->lembaga?->nama, $k->jenjang).' ('.$k->jenjang.')',
                    self::teks($k->tugas_utama),
                    $k->status_keaktifan === KeaktifanPegawai::AKTIF ? 'Aktif' : 'Nonaktif',
                    self::teks($k->no_sk),
                    self::tglTampil($k->tgl_sk),
                ])->all(),
            ],
            [
                'judul' => 'Akun login tertaut',
                'kolom' => ['Nama akun', 'Login', 'No. HP', 'Peran', 'Akses lembaga'],
                'baris' => $akun === null ? [] : [[
                    self::teks($akun->name),
                    self::teks($akun->email ?: $akun->username),
                    self::teks($akun->phone),
                    $akun->roles->pluck('name')->map(fn (string $r) => Str::headline($r))->implode(', '),
                    $akun->lembagas->map(fn (Lembaga $l) => $l->jenjang.($l->pivot->role ? ' ('.Str::headline((string) $l->pivot->role).')' : ''))->implode(', '),
                ]],
            ],
        ];
    }
}
