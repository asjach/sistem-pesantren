<?php

namespace App\Services;

use App\Models\PengajuanBiodataSantri;
use App\Models\Santri;
use App\Support\NikFlag;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
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

    public const RULES = [
        'nama_lengkap' => ['required', 'string', 'max:100'],
        'nama_singkat' => ['required', 'string', 'max:50'],
        'tmp_lahir' => ['required', 'string', 'max:100'],
        'tgl_lahir' => ['required', 'date'],
        'alamat' => ['required', 'string', 'max:500'],
        'provinsi' => ['required', 'string', 'max:100'],
        'kab_kota' => ['required', 'string', 'max:100'],
        'kecamatan' => ['required', 'string', 'max:100'],
        'desa_kelurahan' => ['required', 'string', 'max:100'],
        'ayah_nama' => ['required', 'string', 'max:100'],
        'ayah_telp' => ['required', 'string', 'max:20'],
        'ibu_nama' => ['required', 'string', 'max:100'],
        'ibu_telp' => ['required', 'string', 'max:20'],
        'wali_nama' => ['required', 'string', 'max:100'],
        'wali_telp' => ['required', 'string', 'max:20'],
        'foto_url' => ['required', 'string', 'max:255'],
        'nik' => ['required', 'digits:16'],
    ];

    public function ajukan(int $santriId, int $waliId, array $diff, bool $isAdminFull): PengajuanBiodataSantri
    {
        $ada = PengajuanBiodataSantri::where('santri_id', $santriId)->where('status', 'diajukan')->exists();
        if ($ada) {
            throw ValidationException::withMessages(['pengajuan' => 'Masih ada pengajuan menunggu. Batalkan dulu sebelum ajukan baru.']);
        }
        $rules = [];
        foreach (array_keys($diff) as $field) {
            if (! in_array($field, self::WHITELIST, true)) {
                throw ValidationException::withMessages([$field => 'Field tidak boleh diajukan ortu.']);
            }
            $rules[$field] = self::RULES[$field] ?? ['nullable'];
        }
        $validator = Validator::make($diff, $rules);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $santri = Santri::findOrFail($santriId);
        $payload = [];
        foreach ($diff as $field => $baru) {
            $payload[$field] = ['lama' => $santri->{$field}, 'baru' => $baru];
        }

        return PengajuanBiodataSantri::create([
            'santri_id' => $santriId,
            'wali_user_id' => $waliId,
            'perubahan_json' => $payload,
            'status' => 'diajukan',
        ]);
    }

    public function setujui(int $id, int $adminId, bool $isAdminFull): void
    {
        DB::transaction(function () use ($id, $adminId, $isAdminFull) {
            $p = PengajuanBiodataSantri::where('id', $id)->lockForUpdate()->first();
            if (! $p) {
                abort(404, 'Pengajuan tidak ditemukan.');
            }
            if ($p->status !== 'diajukan') {
                throw ValidationException::withMessages(['status' => 'Hanya pengajuan aktif yang bisa diproses.']);
            }
            $perubahan = (array) ($p->perubahan_json ?? []);
            $apply = [];
            foreach ($perubahan as $field => $v) {
                if (in_array($field, self::HANYA_ADMIN_FULL, true) && ! $isAdminFull) {
                    throw ValidationException::withMessages([$field => 'Perubahan NIK wajib admin full.']);
                }
                if (in_array($field, self::WHITELIST, true)) {
                    $apply[$field] = is_array($v) ? ($v['baru'] ?? null) : $v;
                }
            }
            $santri = Santri::findOrFail($p->santri_id);
            // NIK boleh fiktif/ganda (tanpa unique) — dedup identitas nik+nama+tgl_lahir, kecualikan diri sendiri.
            if (isset($apply['nik'])) {
                $namaBaru = $apply['nama_lengkap'] ?? $santri->nama_lengkap;
                $tglBaru = $apply['tgl_lahir'] ?? $santri->tgl_lahir;
                $dup = Santri::where('nik', NikFlag::tandai($apply['nik']))
                    ->where('nama_lengkap', $namaBaru)->where('tgl_lahir', $tglBaru)
                    ->where('id', '<>', $p->santri_id)->exists();
                if ($dup) {
                    throw ValidationException::withMessages(['nik' => 'Identitas sama (nik+nama+tgl_lahir) sudah terdaftar.']);
                }
            }
            if ($apply) {
                $santri->fill($apply)->save();
            }
            $p->update([
                'status' => 'disetujui',
                'diproses_oleh' => $adminId,
            ]);
        });
    }

    public function tolak(int $id, int $adminId, ?string $catatan = null): void
    {
        DB::transaction(function () use ($id, $adminId, $catatan) {
            $p = PengajuanBiodataSantri::where('id', $id)->lockForUpdate()->first();
            if (! $p) {
                abort(404, 'Pengajuan tidak ditemukan.');
            }
            if ($p->status !== 'diajukan') {
                throw ValidationException::withMessages(['status' => 'Hanya pengajuan aktif yang bisa diproses.']);
            }
            $p->update([
                'status' => 'ditolak',
                'diproses_oleh' => $adminId,
                'catatan_admin' => $catatan,
            ]);
        });
    }

    public function batalkan(int $id, int $waliId): void
    {
        DB::transaction(function () use ($id, $waliId) {
            $p = PengajuanBiodataSantri::where('id', $id)->lockForUpdate()->first();
            if (! $p) {
                abort(404, 'Pengajuan tidak ditemukan.');
            }
            if ((int) $p->wali_user_id !== $waliId) {
                abort(403, 'Bukan pengajuan milik Anda.');
            }
            if ($p->status !== 'diajukan') {
                throw ValidationException::withMessages(['status' => 'Hanya yang diajukan yang bisa dibatalkan.']);
            }
            $p->update([
                'status' => 'dibatalkan',
                'cancelled_at' => now(),
            ]);
        });
    }
}
