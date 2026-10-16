<?php

namespace App\Services;

use App\Models\KkmKegiatan;
use App\Models\KomponenNilai;
use App\Models\NilaiKomponen;
use App\Models\NilaiSantri;
use App\Models\PeristiwaNilai;
use App\Models\RentangPredikat;
use App\Support\NilaiRapor;
use App\Support\TingkatJenjang;
use Illuminate\Support\Collection;

/**
 * Sumber tunggal aturan nilai modul Penilaian — dipakai controller (leger,
 * rapor) DAN layanan impor supaya keduanya tak bisa menyimpang.
 *
 *  Aturan:
 *  - komponen & bobot MILIK PERISTIWA;
 *  - komponen `rapor_otomatis` mengambil skor dari rata-rata rapor N tingkat
 *    sebelumnya (boleh ditimpa baris `nilai_komponen`);
 *  - nilai akhir = Σ skor×bobot, hanya bila SEMUA komponen berbobot terisi;
 *  - predikat dari `rentang_predikat` berjangkar KKM `AKHIR` per peristiwa.
 *
 *  Cache per-instans (satu request): konfigurasi peristiwa dibaca berulang
 *  untuk ratusan baris leger.
 */
class PenilaianService
{
    /** @var array<int, Collection<int, KomponenNilai>> */
    private array $komponen = [];

    /** @var array<int, float> */
    private array $kkmAkhir = [];

    /** @var array<int, list<array{predikat: string, offset_bawah: float|null}>> */
    private array $predikat = [];

    /** @return Collection<int, KomponenNilai> */
    public function komponenAktif(int $peristiwaId): Collection
    {
        return $this->komponen[$peristiwaId] ??= KomponenNilai::where('peristiwa_id', $peristiwaId)
            ->where('is_active', true)
            ->orderBy('urutan')->orderBy('nama')
            ->get();
    }

    public function kkmAkhir(int $peristiwaId): float
    {
        return $this->kkmAkhir[$peristiwaId] ??= (float) (KkmKegiatan::where('peristiwa_id', $peristiwaId)
            ->where('kegiatan', KkmKegiatan::AKHIR)
            ->value('kkm') ?? 0);
    }

    /** @return list<array{predikat: string, offset_bawah: float|null}> */
    public function rentangPredikat(int $peristiwaId): array
    {
        return $this->predikat[$peristiwaId] ??= RentangPredikat::where('peristiwa_id', $peristiwaId)
            ->get(['predikat', 'offset_bawah'])
            ->map(fn ($r) => ['predikat' => $r->predikat, 'offset_bawah' => $r->offset_bawah])
            ->all();
    }

    public function predikatUntuk(float $nilai, int $peristiwaId): ?string
    {
        return NilaiRapor::predikat($nilai, $this->kkmAkhir($peristiwaId), $this->rentangPredikat($peristiwaId));
    }

    /**
     * Rata-rata rapor satu MAPEL pada N tingkat sebelumnya (untuk komponen
     * `rapor_otomatis`, mis. UJIAN). Dihitung dari seluruh baris `nilai_santri`
     * santri+mapel pada tingkat-tingkat itu (semua peristiwa & semester),
     * lalu dirata-rata. null bila tak ada data.
     */
    public function rataRataRapor(int $santriId, string $jenjang, ?string $tingkat, int $mapelId, int $n): ?float
    {
        $tingkatList = TingkatJenjang::sebelumnya($jenjang, $tingkat, $n);
        if ($tingkatList === []) {
            return null;
        }

        $nilai = NilaiSantri::query()
            ->join('pengampu_mapel as pm', 'pm.id', '=', 'nilai_santri.pengampu_mapel_id')
            ->join('riwayat_belajar as rb', 'rb.santri_id', '=', 'nilai_santri.santri_id')
            ->where('nilai_santri.santri_id', $santriId)
            ->where('pm.mata_pelajaran_id', $mapelId)
            ->where('rb.jenjang', $jenjang)
            ->whereIn('rb.tingkat', $tingkatList)
            ->pluck('nilai_santri.nilai_akhir')
            ->map(fn ($v) => $v === null ? null : (float) $v)
            ->filter(fn ($v) => $v !== null)
            ->all();

        return $nilai === [] ? null : round(array_sum($nilai) / count($nilai), 2);
    }

    /**
     * Skor tiap komponen (komponen_nilai_id => skor) — nilai tersimpan
     * menang; komponen `rapor_otomatis` yang belum diisi memakai hitungan
     * rata-rata rapor.
     *
     * @return array<int, float|null>
     */
    public function skorKomponen(
        int $santriId,
        int $pengampuId,
        int $mapelId,
        string $jenjang,
        ?string $tingkat,
        string $ta,
        string $semester,
        int $peristiwaId,
    ): array {
        $tersimpan = NilaiKomponen::where('santri_id', $santriId)
            ->where('pengampu_mapel_id', $pengampuId)
            ->where('tahun_ajaran', $ta)
            ->where('semester', $semester)
            ->whereIn('komponen_nilai_id', $this->komponenAktif($peristiwaId)->pluck('id'))
            ->pluck('skor', 'komponen_nilai_id');

        $hasil = [];
        foreach ($this->komponenAktif($peristiwaId) as $k) {
            $nilai = $tersimpan[$k->id] ?? null;
            if ($nilai === null && $k->otomatisDariRapor()) {
                $nilai = $this->rataRataRapor($santriId, $jenjang, $tingkat, $mapelId, (int) ($k->jumlah_tingkat_rapor ?? 0));
            }
            $hasil[$k->id] = $nilai === null ? null : (float) $nilai;
        }

        return $hasil;
    }

    /**
     * Hitung nilai akhir satu (santri × mapel × peristiwa).
     *
     * @return array{nilai: float|null, kurang: list<int>, skor: array<int, float|null>}
     */
    public function hitungAkhir(
        int $santriId,
        int $pengampuId,
        int $mapelId,
        string $jenjang,
        ?string $tingkat,
        string $ta,
        string $semester,
        int $peristiwaId,
    ): array {
        $skor = $this->skorKomponen($santriId, $pengampuId, $mapelId, $jenjang, $tingkat, $ta, $semester, $peristiwaId);
        $bobot = [];
        foreach ($this->komponenAktif($peristiwaId) as $k) {
            $bobot[$k->id] = (float) $k->bobot;
        }
        $hasil = NilaiRapor::nilaiAkhir($skor, $bobot);

        return ['nilai' => $hasil['nilai'], 'kurang' => $hasil['kurang'], 'skor' => $skor];
    }

    /** Simpan (upsert) nilai akhir satu baris; predikat dihitung bila nilainya ada. */
    public function simpanAkhir(
        int $santriId,
        int $pengampuId,
        string $ta,
        string $semester,
        int $peristiwaId,
        float $nilai,
        string $sumber,
    ): NilaiSantri {
        return NilaiSantri::updateOrCreate(
            [
                'santri_id' => $santriId,
                'pengampu_mapel_id' => $pengampuId,
                'tahun_ajaran' => $ta,
                'semester' => $semester,
                'peristiwa_id' => $peristiwaId,
            ],
            [
                'nilai_akhir' => $nilai,
                'predikat' => $this->predikatUntuk($nilai, $peristiwaId),
                'sumber' => $sumber,
            ],
        );
    }

    /** Saring daftar santri menurut cakupan peserta peristiwa (tingkat akhir). */
    public function tingkatCocokCakupan(PeristiwaNilai $peristiwa, ?string $tingkat): bool
    {
        return match ($peristiwa->cakupan) {
            PeristiwaNilai::CAKUPAN_TINGKAT_AKHIR => TingkatJenjang::adalahAkhir($peristiwa->jenjang, $tingkat),
            PeristiwaNilai::CAKUPAN_KECUALI_AKHIR => ! TingkatJenjang::adalahAkhir($peristiwa->jenjang, $tingkat),
            default => true,
        };
    }
}
