<?php

namespace App\Services;

use App\Models\KegiatanEvaluatif;
use App\Models\PengaturanNomorPeserta;
use App\Models\PesertaKegiatanEvaluatif;
use App\Models\Santri;
use App\Support\TingkatJenjang;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class NomorPesertaService
{
    public const TEMPLATE_BAWAAN = '{ta_awal_2}.{ta_akhir_2}.{kode_kegiatan_evaluatif}.{tingkat_2}.{nomor_4}';

    /** @return list<array{token: string, label: string, contoh: string}> */
    public function tokenTersedia(): array
    {
        return [
            ['token' => '{ta_awal_2}', 'label' => '2 digit awal tahun ajaran', 'contoh' => '26'],
            ['token' => '{ta_akhir_2}', 'label' => '2 digit akhir tahun ajaran', 'contoh' => '27'],
            ['token' => '{kode_kegiatan_evaluatif}', 'label' => 'Kode kegiatan evaluatif', 'contoh' => 'ASAS'],
            ['token' => '{semester}', 'label' => 'Semester', 'contoh' => '1'],
            ['token' => '{tingkat}', 'label' => 'Tingkat', 'contoh' => '1'],
            ['token' => '{tingkat_2}', 'label' => 'Tingkat 2 karakter', 'contoh' => '01'],
            ['token' => '{nomor_3}', 'label' => 'Nomor urut 3 digit', 'contoh' => '001'],
            ['token' => '{nomor_4}', 'label' => 'Nomor urut 4 digit', 'contoh' => '0001'],
            ['token' => '{nomor_5}', 'label' => 'Nomor urut 5 digit', 'contoh' => '00001'],
        ];
    }

    /** @return array{template: string, mode_urutan: string} */
    public function pengaturan(KegiatanEvaluatif $kegiatanEvaluatif, string $semester): array
    {
        $pengaturan = PengaturanNomorPeserta::query()
            ->where('kegiatan_evaluatif_id', $kegiatanEvaluatif->id)
            ->where('semester', $semester)
            ->first();

        return [
            'template' => $pengaturan?->template ?? self::TEMPLATE_BAWAAN,
            'mode_urutan' => $pengaturan?->mode_urutan ?? PengaturanNomorPeserta::PER_TINGKAT,
        ];
    }

    /**
     * @param  list<int>  $kelasIds
     * @param  list<string>  $tingkat
     */
    public function daftar(
        KegiatanEvaluatif $kegiatanEvaluatif,
        string $semester,
        array $kelasIds = [],
        array $tingkat = [],
        string $pencarian = '',
    ): Collection {
        $query = $this->queryPeserta($kegiatanEvaluatif, $semester);

        if ($kelasIds !== []) {
            $query->whereIn('rb.kelas_id', $kelasIds);
        }
        if ($tingkat !== []) {
            $query->whereIn('rb.tingkat', $tingkat);
        }
        if ($pencarian !== '') {
            $query->where(function (Builder $where) use ($pencarian) {
                $where->where('santri.nama_lengkap', 'like', "%{$pencarian}%")
                    ->orWhere('ls.nis_lokal', 'like', "%{$pencarian}%")
                    ->orWhere('ppn.nomor_peserta', 'like', "%{$pencarian}%");
            });
        }

        return $query->get();
    }

    public function simpanPengaturan(
        KegiatanEvaluatif $kegiatanEvaluatif,
        string $semester,
        string $template,
        string $modeUrutan,
    ): PengaturanNomorPeserta {
        $this->pastikanTemplateValid($template, $modeUrutan);

        return PengaturanNomorPeserta::query()->updateOrCreate(
            ['kegiatan_evaluatif_id' => $kegiatanEvaluatif->id, 'semester' => $semester],
            ['template' => trim($template), 'mode_urutan' => $modeUrutan],
        );
    }

    public function simpanManual(
        KegiatanEvaluatif $kegiatanEvaluatif,
        Santri $santri,
        string $semester,
        ?string $nomor,
    ): ?PesertaKegiatanEvaluatif {
        if (! $this->queryPeserta($kegiatanEvaluatif, $semester)->where('rb.santri_id', $santri->id)->exists()) {
            throw ValidationException::withMessages([
                'santri_id' => 'Santri tidak termasuk peserta kegiatanEvaluatif pada semester ini.',
            ]);
        }

        $nomor = trim((string) $nomor);
        if ($nomor === '') {
            PesertaKegiatanEvaluatif::query()
                ->where('kegiatan_evaluatif_id', $kegiatanEvaluatif->id)
                ->where('semester', $semester)
                ->where('santri_id', $santri->id)
                ->delete();

            return null;
        }

        $sudahDipakai = PesertaKegiatanEvaluatif::query()
            ->where('kegiatan_evaluatif_id', $kegiatanEvaluatif->id)
            ->where('semester', $semester)
            ->where('nomor_peserta', $nomor)
            ->where('santri_id', '!=', $santri->id)
            ->exists();
        if ($sudahDipakai) {
            throw ValidationException::withMessages([
                'nomor_peserta' => 'Nomor peserta sudah dipakai santri lain pada kegiatanEvaluatif dan semester ini.',
            ]);
        }

        return PesertaKegiatanEvaluatif::query()->updateOrCreate(
            ['kegiatan_evaluatif_id' => $kegiatanEvaluatif->id, 'semester' => $semester, 'santri_id' => $santri->id],
            ['nomor_peserta' => $nomor, 'sumber_nomor' => PesertaKegiatanEvaluatif::MANUAL],
        );
    }

    /** @return array{dibuat: int, dipertahankan_manual: int, dipertahankan_otomatis: int, total_peserta: int} */
    public function buatNomor(
        KegiatanEvaluatif $kegiatanEvaluatif,
        string $semester,
        string $template,
        string $modeUrutan,
        bool $buatUlangOtomatis = false,
    ): array {
        $this->pastikanTemplateValid($template, $modeUrutan);

        return DB::transaction(function () use ($kegiatanEvaluatif, $semester, $template, $modeUrutan, $buatUlangOtomatis) {
            KegiatanEvaluatif::query()->whereKey($kegiatanEvaluatif->id)->lockForUpdate()->firstOrFail();
            $this->simpanPengaturan($kegiatanEvaluatif, $semester, $template, $modeUrutan);

            $peserta = $this->queryPeserta($kegiatanEvaluatif, $semester)->get();
            $santriPeserta = $peserta->pluck('santri_id')->map(fn ($id) => (int) $id)->all();
            $tersimpan = PesertaKegiatanEvaluatif::query()
                ->where('kegiatan_evaluatif_id', $kegiatanEvaluatif->id)
                ->where('semester', $semester)
                ->lockForUpdate()
                ->get()
                ->keyBy('santri_id');

            $nomorTerpakai = [];
            foreach ($tersimpan as $baris) {
                $diCakupan = in_array((int) $baris->santri_id, $santriPeserta, true);
                $bolehDiganti = $diCakupan
                    && $buatUlangOtomatis
                    && $baris->sumber_nomor === PesertaKegiatanEvaluatif::OTOMATIS;
                if ($baris->nomor_peserta !== null && ! $bolehDiganti) {
                    $nomorTerpakai[$baris->nomor_peserta] = true;
                }
            }

            $urutan = [];
            $hasil = [
                'dibuat' => 0,
                'dipertahankan_manual' => 0,
                'dipertahankan_otomatis' => 0,
                'total_peserta' => $peserta->count(),
            ];

            foreach ($peserta as $baris) {
                $kunciUrutan = $modeUrutan === PengaturanNomorPeserta::PER_TINGKAT
                    ? (string) ($baris->tingkat ?? '')
                    : 'semua';
                $urutan[$kunciUrutan] = ($urutan[$kunciUrutan] ?? 0) + 1;

                $lama = $tersimpan->get($baris->santri_id);
                if ($lama?->sumber_nomor === PesertaKegiatanEvaluatif::MANUAL && $lama->nomor_peserta !== null) {
                    $hasil['dipertahankan_manual']++;

                    continue;
                }
                if (! $buatUlangOtomatis && $lama?->sumber_nomor === PesertaKegiatanEvaluatif::OTOMATIS && $lama->nomor_peserta !== null) {
                    $hasil['dipertahankan_otomatis']++;

                    continue;
                }

                $nomor = $this->formatNomor(
                    $template,
                    $kegiatanEvaluatif,
                    $semester,
                    $baris->tingkat === null ? null : (string) $baris->tingkat,
                    $urutan[$kunciUrutan],
                );
                if (isset($nomorTerpakai[$nomor])) {
                    throw ValidationException::withMessages([
                        'template' => "Pola menghasilkan nomor ganda: {$nomor}. Tambahkan pembeda seperti tingkat atau perbesar nomor urut.",
                    ]);
                }
                $nomorTerpakai[$nomor] = true;

                PesertaKegiatanEvaluatif::query()->updateOrCreate(
                    ['kegiatan_evaluatif_id' => $kegiatanEvaluatif->id, 'semester' => $semester, 'santri_id' => $baris->santri_id],
                    ['nomor_peserta' => $nomor, 'sumber_nomor' => PesertaKegiatanEvaluatif::OTOMATIS],
                );
                $hasil['dibuat']++;
            }

            return $hasil;
        });
    }

    public function formatNomor(
        string $template,
        KegiatanEvaluatif $kegiatanEvaluatif,
        string $semester,
        ?string $tingkat,
        int $urutan,
    ): string {
        [$tahunAwal, $tahunAkhir] = array_pad(explode('/', $kegiatanEvaluatif->tahun_ajaran, 2), 2, '');
        $tingkat = $tingkat ?? '';

        $nilai = [
            '{ta_awal_2}' => substr($tahunAwal, -2),
            '{ta_akhir_2}' => substr($tahunAkhir, -2),
            '{kode_kegiatan_evaluatif}' => (string) $kegiatanEvaluatif->kode,
            '{semester}' => $semester,
            '{tingkat}' => $tingkat,
            '{tingkat_2}' => str_pad($tingkat, 2, '0', STR_PAD_LEFT),
            '{nomor_3}' => str_pad((string) $urutan, 3, '0', STR_PAD_LEFT),
            '{nomor_4}' => str_pad((string) $urutan, 4, '0', STR_PAD_LEFT),
            '{nomor_5}' => str_pad((string) $urutan, 5, '0', STR_PAD_LEFT),
        ];

        return strtr(trim($template), $nilai);
    }

    private function pastikanTemplateValid(string $template, string $modeUrutan): void
    {
        $template = trim($template);
        preg_match_all('/\{[^{}]+\}/', $template, $cocok);
        $dikenal = array_column($this->tokenTersedia(), 'token');
        $tidakDikenal = array_values(array_diff($cocok[0], $dikenal));
        if ($tidakDikenal !== [] || str_contains(preg_replace('/\{[^{}]+\}/', '', $template), '{') || str_contains(preg_replace('/\{[^{}]+\}/', '', $template), '}')) {
            throw ValidationException::withMessages([
                'template' => 'Pola memuat token yang tidak dikenali atau tanda kurung yang belum lengkap.',
            ]);
        }
        if (! preg_match('/\{nomor_[345]\}/', $template)) {
            throw ValidationException::withMessages([
                'template' => 'Pola wajib memuat salah satu token nomor urut.',
            ]);
        }
        if ($modeUrutan === PengaturanNomorPeserta::PER_TINGKAT
            && ! str_contains($template, '{tingkat}')
            && ! str_contains($template, '{tingkat_2}')) {
            throw ValidationException::withMessages([
                'template' => 'Mode reset per tingkat membutuhkan token tingkat agar nomor tidak ganda.',
            ]);
        }
    }

    private function queryPeserta(KegiatanEvaluatif $kegiatanEvaluatif, string $semester): Builder
    {
        $akhir = TingkatJenjang::akhir($kegiatanEvaluatif->jenjang);
        $query = DB::table('riwayat_belajar as rb')
            ->join('santri', 'santri.id', '=', 'rb.santri_id')
            ->leftJoin('kelas', 'kelas.id', '=', 'rb.kelas_id')
            ->leftJoin('lembaga_santri as ls', function ($join) {
                $join->on('ls.santri_id', '=', 'rb.santri_id')
                    ->on('ls.jenjang', '=', 'rb.jenjang');
            })
            ->leftJoin('peserta_kegiatan_evaluatif as ppn', function ($join) use ($kegiatanEvaluatif, $semester) {
                $join->on('ppn.santri_id', '=', 'rb.santri_id')
                    ->where('ppn.kegiatan_evaluatif_id', '=', $kegiatanEvaluatif->id)
                    ->where('ppn.semester', '=', $semester);
            })
            ->where('rb.jenjang', $kegiatanEvaluatif->jenjang)
            ->where('rb.tahun_ajaran', $kegiatanEvaluatif->tahun_ajaran)
            ->where('rb.semester', $semester)
            ->where('rb.status_akhir', '!=', 'pindah_keluar')
            ->select(
                'rb.santri_id', 'santri.nama_lengkap as nama', 'santri.jk', 'santri.foto_url',
                'ls.nis_lokal', 'rb.kelas_id', 'kelas.nama_kelas as kelas', 'rb.tingkat', 'rb.no_absen',
                'ppn.nomor_peserta', 'ppn.sumber_nomor',
            )
            ->orderBy('rb.tingkat')
            ->orderBy('kelas.nama_kelas')
            ->orderBy('rb.no_absen')
            ->orderBy('santri.nama_lengkap')
            ->orderBy('rb.santri_id');

        if ($akhir !== null) {
            if ($kegiatanEvaluatif->cakupan === KegiatanEvaluatif::CAKUPAN_TINGKAT_AKHIR) {
                $query->where('rb.tingkat', $akhir);
            } elseif ($kegiatanEvaluatif->cakupan === KegiatanEvaluatif::CAKUPAN_KECUALI_AKHIR) {
                $query->where(function (Builder $where) use ($akhir) {
                    $where->whereNull('rb.tingkat')->orWhere('rb.tingkat', '!=', $akhir);
                });
            }
        }

        return $query;
    }
}
