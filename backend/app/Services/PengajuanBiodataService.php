<?php

namespace App\Services;

use App\Models\Santri;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Revisi biodata santri oleh ortu (approve admin).
 *
 * Model PengajuanBiodataSantri belum ada di repo (fase lain), sehingga service
 * ini memakai query builder tabel pengajuan_biodata_santri secara langsung.
 * Kontrak perilaku mengikuti spec vault §c.
 */
class PengajuanBiodataService
{
    public const WHITELIST = ['nama_lengkap', 'nama_singkat', 'tmp_lahir', 'tgl_lahir', 'alamat', 'provinsi', 'kab_kota', 'kecamatan', 'desa_kelurahan', 'ayah_nama', 'ayah_telp', 'ibu_nama', 'ibu_telp', 'wali_nama', 'wali_telp', 'foto_url', 'nik'];

    public const HANYA_ADMIN_FULL = ['nik'];

    public function ajukan(int $santriId, int $waliId, array $diff, bool $isAdminFull): object
    {
        $ada = DB::table('pengajuan_biodata_santri')->where('santri_id', $santriId)->where('status', 'diajukan')->exists();
        if ($ada) {
            throw ValidationException::withMessages(['pengajuan' => 'Masih ada pengajuan menunggu. Batalkan dulu sebelum ajukan baru.']);
        }
        foreach (array_keys($diff) as $field) {
            if (! in_array($field, self::WHITELIST, true)) {
                throw ValidationException::withMessages([$field => 'Field tidak boleh diajukan ortu.']);
            }
            if (in_array($field, self::HANYA_ADMIN_FULL, true) && ! $isAdminFull) {
                // NIK diajukan tetap disimpan, tapi diproses wajib admin full (dicek di setujui)
            }
        }
        $santri = Santri::findOrFail($santriId);
        $payload = [];
        foreach ($diff as $field => $baru) {
            $payload[$field] = ['lama' => $santri->{$field}, 'baru' => $baru];
        }
        $id = DB::table('pengajuan_biodata_santri')->insertGetId([
            'santri_id' => $santriId,
            'wali_user_id' => $waliId,
            'perubahan_json' => json_encode($payload),
            'status' => 'diajukan',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::table('pengajuan_biodata_santri')->where('id', $id)->first();
    }

    public function setujui(int $id, int $adminId, bool $isAdminFull): void
    {
        DB::transaction(function () use ($id, $adminId, $isAdminFull) {
            $p = DB::table('pengajuan_biodata_santri')->where('id', $id)->lockForUpdate()->first();
            if (! $p) {
                abort(404, 'Pengajuan tidak ditemukan.');
            }
            if ($p->status !== 'diajukan') {
                throw ValidationException::withMessages(['status' => 'Hanya pengajuan aktif yang bisa diproses.']);
            }
            $perubahan = is_string($p->perubahan_json) ? json_decode($p->perubahan_json, true) : (array) $p->perubahan_json;
            $apply = [];
            foreach ((array) $perubahan as $field => $v) {
                if (in_array($field, self::HANYA_ADMIN_FULL, true) && ! $isAdminFull) {
                    throw ValidationException::withMessages([$field => 'Perubahan NIK wajib admin full.']);
                }
                if (in_array($field, self::WHITELIST, true)) {
                    $apply[$field] = is_array($v) ? ($v['baru'] ?? null) : $v;
                }
            }
            // NIK boleh fiktif/ganda (tanpa unique) — dedup identitas nik+nama+tgl_lahir, kecualikan diri sendiri.
            if (isset($apply['nik'])) {
                $s = Santri::findOrFail($p->santri_id);
                $namaBaru = $apply['nama_lengkap'] ?? $s->nama_lengkap;
                $tglBaru = $apply['tgl_lahir'] ?? $s->tgl_lahir;
                $dup = Santri::where('nik', $apply['nik'])
                    ->where('nama_lengkap', $namaBaru)->where('tgl_lahir', $tglBaru)
                    ->where('id', '<>', $p->santri_id)->exists();
                if ($dup) {
                    throw ValidationException::withMessages(['nik' => 'Identitas sama (nik+nama+tgl_lahir) sudah terdaftar.']);
                }
            }
            if ($apply) {
                Santri::where('id', $p->santri_id)->update($apply);
            }
            DB::table('pengajuan_biodata_santri')->where('id', $id)->update([
                'status' => 'disetujui',
                'diproses_oleh' => $adminId,
                'updated_at' => now(),
            ]);
        });
    }

    public function tolak(int $id, int $adminId, ?string $catatan = null): void
    {
        DB::transaction(function () use ($id, $adminId, $catatan) {
            $p = DB::table('pengajuan_biodata_santri')->where('id', $id)->lockForUpdate()->first();
            if (! $p) {
                abort(404, 'Pengajuan tidak ditemukan.');
            }
            if ($p->status !== 'diajukan') {
                throw ValidationException::withMessages(['status' => 'Hanya pengajuan aktif yang bisa diproses.']);
            }
            DB::table('pengajuan_biodata_santri')->where('id', $id)->update([
                'status' => 'ditolak',
                'diproses_oleh' => $adminId,
                'catatan_admin' => $catatan,
                'updated_at' => now(),
            ]);
        });
    }

    public function batalkan(int $id, int $waliId): void
    {
        $p = DB::table('pengajuan_biodata_santri')->where('id', $id)->first();
        if (! $p) {
            abort(404, 'Pengajuan tidak ditemukan.');
        }
        if ((int) $p->wali_user_id !== $waliId) {
            abort(403, 'Bukan pengajuan milik Anda.');
        }
        if ($p->status !== 'diajukan') {
            throw ValidationException::withMessages(['status' => 'Hanya yang diajukan yang bisa dibatalkan.']);
        }
        DB::table('pengajuan_biodata_santri')->where('id', $id)->update([
            'status' => 'dibatalkan',
            'cancelled_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
