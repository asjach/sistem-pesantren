<?php

namespace App\Services;

use App\Models\KeaktifanPegawai;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Data profil pegawai untuk endpoint JSON profil.
 *
 * Berkas PDF tidak lagi dibangun dari service ini: sejak migrasi ke template,
 * tata letaknya ada di `DefinisiProfilPegawai` dan dirender `PerenderHtml`.
 * Yang tersisa di sini hanyalah pemuatan data, dipakai endpoint
 * `pegawai/{id}/profil`.
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
}
