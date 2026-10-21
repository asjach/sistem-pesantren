<?php

namespace App\Services;

use App\Models\Pegawai;
use App\Models\PengaturanPencarian;
use App\Models\Santri;
use App\Models\User;

/**
 * Pencarian global halaman non-Board.
 *
 * Hanya halaman yang diaktifkan di pengaturan yang ikut dicari. Setiap
 * hasil tetap diperiksa terhadap izin halaman pengguna.
 */
class PencarianGlobal
{
    /** Halaman yang sudah punya penyedia hasil data. */
    public const HALAMAN = [
        'daftar_kelas' => ['label' => 'Daftar Kelas', 'izin' => 'daftar_kelas.lihat'],
        'santri' => ['label' => 'Buku Induk Santri', 'izin' => 'santri.lihat'],
        'pegawai' => ['label' => 'Buku Induk Guru', 'izin' => 'pegawai.lihat'],
        'keuangan' => ['label' => 'Tagihan', 'izin' => 'keuangan.lihat'],
    ];

    /** Setelan semua halaman yang didukung; halaman tanpa baris = nonaktif. */
    public function setelan(): array
    {
        $baris = PengaturanPencarian::whereIn('page_key', array_keys(self::HALAMAN))
            ->get()
            ->keyBy('page_key');

        $hasil = [];
        foreach (self::HALAMAN as $key => $info) {
            $hasil[] = [
                'page_key' => $key,
                'label' => $info['label'],
                'aktif' => (bool) ($baris[$key]->aktif ?? false),
            ];
        }

        return $hasil;
    }

    /** @param array<string, bool> $aktif */
    public function simpan(array $aktif, int $userId): array
    {
        foreach (array_keys(self::HALAMAN) as $key) {
            if (! array_key_exists($key, $aktif)) {
                continue;
            }

            PengaturanPencarian::updateOrCreate(
                ['page_key' => $key],
                ['aktif' => (bool) $aktif[$key], 'diubah_oleh' => $userId],
            );
        }

        return $this->setelan();
    }

    /** @return array<int, array{halaman: string, label: string, hasil: array<int, array<string, mixed>>}> */
    public function cari(string $kueri, User $user): array
    {
        $q = trim($kueri);
        if (mb_strlen($q) < 2) {
            return [];
        }

        $aktif = collect($this->setelan())
            ->filter(fn (array $halaman) => $halaman['aktif'])
            ->pluck('page_key')
            ->all();

        $bolehSantri = in_array('santri', $aktif, true) && $user->can(self::HALAMAN['santri']['izin']);
        $bolehDaftarKelas = in_array('daftar_kelas', $aktif, true) && $user->can(self::HALAMAN['daftar_kelas']['izin']);
        $bolehKeuangan = in_array('keuangan', $aktif, true) && $user->can(self::HALAMAN['keuangan']['izin']);

        $hasil = [];

        if ($bolehSantri || $bolehDaftarKelas || $bolehKeuangan) {
            $santri = Santri::tenantScope()
                ->with(['lembagaAktif:id,santri_id,nis_lokal,nis_kemenag'])
                ->where(function ($sub) use ($q) {
                    $sub->where('nama_lengkap', 'like', "%{$q}%")
                        ->orWhere('nisn', 'like', "%{$q}%")
                        ->orWhereHas('lembagaSantri', fn ($ls) => $ls->where('nis_lokal', 'like', "%{$q}%"));
                })
                ->orderBy('nama_lengkap')
                ->limit(5)
                ->get();

            $itemsSantri = $santri->map(function (Santri $s) {
                $nisLokal = $s->lembagaAktif->first()?->nis_lokal;
                $identitas = array_values(array_filter([
                    $nisLokal ? "NIS {$nisLokal}" : null,
                    $s->nisn ? "NISN {$s->nisn}" : null,
                ]));

                return [
                    'id' => $s->id,
                    'judul' => $s->nama_lengkap,
                    'keterangan' => implode(' · ', $identitas),
                    'kueri' => $nisLokal ?: ($s->nisn ?: $s->nama_lengkap),
                ];
            })->all();

            if ($bolehSantri && $itemsSantri !== []) {
                $hasil[] = [
                    'halaman' => 'santri',
                    'label' => self::HALAMAN['santri']['label'],
                    'hasil' => array_map(fn (array $item) => [
                        ...$item,
                        'target' => '/santri/'.$item['id'].'/profil',
                    ], $itemsSantri),
                ];
            }

            if ($bolehDaftarKelas && $itemsSantri !== []) {
                $hasil[] = [
                    'halaman' => 'daftar_kelas',
                    'label' => self::HALAMAN['daftar_kelas']['label'],
                    'hasil' => array_map(fn (array $item) => [
                        ...$item,
                        'target' => '/daftar-kelas?'.http_build_query(['cari' => $item['kueri']]),
                    ], $itemsSantri),
                ];
            }

            if ($bolehKeuangan && $itemsSantri !== []) {
                $hasil[] = [
                    'halaman' => 'keuangan',
                    'label' => self::HALAMAN['keuangan']['label'],
                    'hasil' => array_map(fn (array $item) => [
                        ...$item,
                        'target' => '/keuangan?'.http_build_query(['tab' => 'tagihan', 'cari' => $item['kueri']]),
                    ], $itemsSantri),
                ];
            }
        }

        if (in_array('pegawai', $aktif, true) && $user->can(self::HALAMAN['pegawai']['izin'])) {
            $pegawai = Pegawai::tenantScope()
                ->where(function ($sub) use ($q) {
                    $sub->where('nama_lengkap', 'like', "%{$q}%")
                        ->orWhere('nip', 'like', "%{$q}%")
                        ->orWhere('nipp', 'like', "%{$q}%")
                        ->orWhere('nik', 'like', "%{$q}%");
                })
                ->orderBy('nama_lengkap')
                ->limit(5)
                ->get();

            if ($pegawai->isNotEmpty()) {
                $hasil[] = [
                    'halaman' => 'pegawai',
                    'label' => self::HALAMAN['pegawai']['label'],
                    'hasil' => $pegawai->map(function (Pegawai $p) {
                        $identitas = array_values(array_filter([
                            $p->nip ? "NIP {$p->nip}" : null,
                            $p->nipp ? "NIPP {$p->nipp}" : null,
                            $p->nik ? "NIK {$p->nik}" : null,
                        ]));
                        $kueri = $p->nip ?: ($p->nipp ?: ($p->nik ?: $p->nama_lengkap));

                        return [
                            'id' => $p->id,
                            'judul' => $p->nama_lengkap,
                            'keterangan' => implode(' · ', $identitas),
                            'kueri' => $kueri,
                            'target' => '/pegawai?'.http_build_query(['cari' => $kueri]),
                        ];
                    })->all(),
                ];
            }
        }

        return $hasil;
    }
}
