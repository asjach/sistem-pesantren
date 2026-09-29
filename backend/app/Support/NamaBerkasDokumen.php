<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Template penamaan berkas dokumen: `nama_jenis_catatan_timestamp.ext`.
 *
 * Menggantikan nama acak bawaan `store()` agar isi storage bisa dikenali
 * manusia (mis. `ahmad_santri_kartu_keluarga_20260115_093012.pdf`). Segmen
 * kosong dilewati, tabrakan diatasi akhiran `-2`, `-3`, … Dipakai simpan +
 * unggah dokumen (santri/guru/lembaga); nama unduhan (`nama_file`) tetap
 * nama asli dari pengunggah, dan file lama tidak diubah.
 */
class NamaBerkasDokumen
{
    /** Panjang maksimum tiap segmen agar total jauh di bawah batas 255. */
    private const PANJANG_SEGMEN = 50;

    /**
     * Slug satu segmen: huruf kecil, non-alfanumerik jadi `_`.
     * Aman untuk nama file (tanpa `/`, tanpa `..`, tanpa spasi).
     */
    public static function slug(string $teks): string
    {
        return substr(Str::slug($teks, '_'), 0, self::PANJANG_SEGMEN);
    }

    /**
     * Susun nama dasar tanpa cek tabrakan.
     */
    public static function buat(string $nama, string $jenis, ?string $catatan, string $ekstensi, ?\DateTimeInterface $waktu = null): string
    {
        $segmen = array_values(array_filter([
            self::slug($nama),
            self::slug($jenis),
            self::slug((string) ($catatan ?? '')),
        ]));
        $segmen[] = ($waktu ?? now())->format('Ymd_His');
        $ekstensi = strtolower(ltrim($ekstensi, '.'));

        return implode('_', $segmen).'.'.$ekstensi;
    }

    /**
     * Cari nama unik di direktori disk (tambah `-2`, `-3`, … sebelum ekstensi).
     */
    public static function unik(string $disk, string $direktori, string $nama): string
    {
        $direktori = trim($direktori, '/');
        $titik = strrpos($nama, '.');
        $dasar = $titik === false ? $nama : substr($nama, 0, $titik);
        $ekstensi = $titik === false ? '' : substr($nama, $titik);
        $calon = $nama;
        $nomor = 1;
        while (Storage::disk($disk)->exists("{$direktori}/{$calon}")) {
            $nomor++;
            $calon = "{$dasar}-{$nomor}{$ekstensi}";
        }

        return $calon;
    }

    /**
     * Simpan berkas memakai template; kembalikan path relatif storage.
     */
    public static function simpan(UploadedFile $berkas, string $disk, string $direktori, string $nama, string $jenis, ?string $catatan): string
    {
        $namaBerkas = self::unik($disk, $direktori, self::buat(
            $nama, $jenis, $catatan, $berkas->getClientOriginalExtension(),
        ));

        return $berkas->storeAs(trim($direktori, '/'), $namaBerkas, $disk);
    }
}
