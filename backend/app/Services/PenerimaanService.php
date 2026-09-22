<?php

namespace App\Services;

use App\Models\Kelas;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Penerimaan santri ke sebuah lembaga (satu pintu untuk semua jalur):
 * ACC PSB, dialog input riwayat, dan import riwayat.
 *
 * Membuat/mengaktifkan `lembaga_santri` (keanggotaan + NIS lokal) dan riwayat
 * perdana semester 1. Tanpa menyentuh kolom relasi di `santri` (buku induk).
 */
class PenerimaanService
{
    /**
     * Samakan NIS paket MI↔MD dua arah untuk satu santri: bila tepat satu sisi
     * (keanggotaan aktif) bernomor dan sisi lain kosong → salin. Kedua sisi
     * beda → laporkan tanpa menyentuh. Tabrakan (nomor dipakai santri lain di
     * sisi tujuan) → lewati + laporkan. Mode pratinjau: tanpa menulis.
     *
     * @return null|array{status: string, ...} null = tidak ada yang perlu dilakukan
     */
    public function samakanNisSatu(Santri $santri, string $miJenjang, string $mdJenjang, bool $eksekusi): ?array
    {
        return DB::transaction(function () use ($santri, $miJenjang, $mdJenjang, $eksekusi) {
            $anggota = LembagaSantri::where('santri_id', $santri->id)
                ->whereIn('jenjang', [$miJenjang, $mdJenjang])
                ->where('is_active_lembaga', LembagaSantri::YA)
                ->lockForUpdate()
                ->get()
                ->keyBy('jenjang');

            $mi = $anggota->get($miJenjang);
            $md = $anggota->get($mdJenjang);
            if (! $mi || ! $md) {
                return null;
            }

            $nisMi = trim((string) ($mi->nis_lokal ?? ''));
            $nisMd = trim((string) ($md->nis_lokal ?? ''));

            if ($nisMi !== '' && $nisMd === '') {
                return $this->salinNis($md, $nisMi, 'MI', 'MD', $eksekusi);
            }
            if ($nisMi === '' && $nisMd !== '') {
                return $this->salinNis($mi, $nisMd, 'MD', 'MI', $eksekusi);
            }
            if ($nisMi !== '' && $nisMd !== '' && $nisMi !== $nisMd) {
                return ['status' => 'beda', 'mi' => $nisMi, 'md' => $nisMd];
            }

            return null;
        });
    }

    /** @return array{status: string, ...} */
    protected function salinNis(LembagaSantri $tujuan, string $nis, string $dari, string $ke, bool $eksekusi): array
    {
        if (LembagaSantri::nisLokalDipakai($tujuan->jenjang, $nis, $tujuan->id)) {
            return ['status' => 'tabrakan', 'dari' => $dari, 'ke' => $ke, 'nis' => $nis];
        }
        if ($eksekusi) {
            $tujuan->update(['nis_lokal' => $nis]);
        }

        return ['status' => 'disamakan', 'dari' => $dari, 'ke' => $ke, 'nis' => $nis];
    }

    /**
     * Pastikan ada keanggotaan AKTIF santri di lembaga (buat baru bila belum ada).
     * Baris lama yang nonaktif tidak diaktifkan ulang — dibuat baris baru agar
     * jejak keanggotaan (tgl_masuk/tgl_selesai) tetap utuh. Bidang konteks
     * penerimaan (`tgl_masuk`, `tahaj_masuk`, `tingkat_masuk`, `no_urut`,
     * detail sekolah asal) mengisi yang masih kosong, tidak menimpa nilai lama.
     *
     * @param  array{nis_lokal?: ?string, tgl_masuk?: ?string, tahaj_masuk?: ?string,
     *               tingkat_masuk?: ?string, no_urut?: ?string, nama_sekolah_asal?: ?string,
     *               npsn_sekolah_asal?: ?string, nss_sekolah_asal?: ?string,
     *               alamat_sekolah_asal?: ?string}  $data
     */
    public function pastikanKeanggotaan(Santri $santri, string $jenjang, array $data = []): LembagaSantri
    {
        $nisLokal = $data['nis_lokal'] ?? null;
        $nisLokal = $nisLokal !== null ? trim((string) $nisLokal) : null;
        $nisLokal = $nisLokal === '' ? null : $nisLokal;

        // Bidang konteks penerimaan yang diisi (bukan null/kosong).
        $konteks = [];
        foreach (['tgl_masuk', 'tahaj_masuk', 'tingkat_masuk', 'no_urut', 'nama_sekolah_asal', 'npsn_sekolah_asal', 'nss_sekolah_asal', 'alamat_sekolah_asal'] as $kolom) {
            if (array_key_exists($kolom, $data) && $data[$kolom] !== null && $data[$kolom] !== '') {
                $konteks[$kolom] = $data[$kolom];
            }
        }

        $aktif = LembagaSantri::aktif($santri->id, $jenjang);

        if ($aktif !== null) {
            $ubah = [];
            if ($nisLokal !== null && $nisLokal !== $aktif->nis_lokal) {
                if (LembagaSantri::nisLokalDipakai($jenjang, $nisLokal, $aktif->id)) {
                    throw ValidationException::withMessages(['nis_lokal' => 'NIS lokal sudah dipakai santri lain di lembaga ini.']);
                }
                $ubah['nis_lokal'] = $nisLokal;
            }
            foreach ($konteks as $kolom => $nilai) {
                if ($aktif->{$kolom} === null) {
                    $ubah[$kolom] = $nilai;
                }
            }
            if ($ubah !== []) {
                $aktif->update($ubah);
            }

            return $aktif->fresh();
        }

        // Reaktivasi arsip sendiri: keluar lalu masuk lagi dengan NIS yang sama
        // (mis. X di halaman MI-MD lalu panah lagi) — aktifkan baris lamanya
        // agar tidak menabrak cek dipakai/unique di bawah.
        $arsip = LembagaSantri::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->where('is_active_lembaga', LembagaSantri::TIDAK)
            ->orderByDesc('id')
            ->first();
        if ($arsip && ($arsip->nis_lokal ?? null) === $nisLokal) {
            $ubah = ['is_active_lembaga' => LembagaSantri::YA, 'tgl_selesai' => null];
            foreach ($konteks as $kolom => $nilai) {
                $ubah[$kolom] = $nilai;
            }
            $arsip->update($ubah);

            return $arsip->fresh();
        }

        if ($nisLokal !== null && LembagaSantri::nisLokalDipakai($jenjang, $nisLokal)) {
            throw ValidationException::withMessages(['nis_lokal' => 'NIS lokal sudah dipakai santri lain di lembaga ini.']);
        }

        return LembagaSantri::create([
            'santri_id' => $santri->id,
            'jenjang' => $jenjang,
            'nis_lokal' => $nisLokal,
            'is_active_lembaga' => LembagaSantri::YA,
        ] + $konteks);
    }

    /**
     * Terima santri ke lembaga: keanggotaan aktif + riwayat perdana semester 1.
     *
     * @param  array{nis_lokal?: ?string, kelas_id?: ?int, tingkat?: ?string, no_absen?: ?int,
     *               status_awal?: ?string, tgl_masuk?: ?string, tahaj_masuk?: ?string,
     *               tingkat_masuk?: ?string, no_urut?: ?string, nama_sekolah_asal?: ?string,
     *               npsn_sekolah_asal?: ?string, nss_sekolah_asal?: ?string,
     *               alamat_sekolah_asal?: ?string}  $data
     */
    public function terima(Santri $santri, string $jenjang, string $tahunAjaran, array $data = []): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $jenjang, $tahunAjaran, $data) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();

            $tahun = TahunAjaran::find($tahunAjaran);
            if (! $tahun) {
                throw ValidationException::withMessages(['tahun_ajaran' => 'Tahun ajaran tidak ditemukan.']);
            }
            if (! TahunAjaran::efektif($jenjang)->contains('nama', $tahun->nama)) {
                throw ValidationException::withMessages(['tahun_ajaran' => 'Tahun ajaran tidak berlaku untuk lembaga ini.']);
            }

            $kelasId = ! empty($data['kelas_id']) ? (int) $data['kelas_id'] : null;
            $kelas = null;
            if ($kelasId !== null) {
                $kelas = Kelas::find($kelasId);
                if (! $kelas || $kelas->jenjang !== $jenjang) {
                    throw ValidationException::withMessages(['kelas_id' => 'Kelas bukan milik lembaga ini.']);
                }
                if ($kelas->tahun_ajaran !== $tahunAjaran) {
                    throw ValidationException::withMessages(['kelas_id' => 'Kelas bukan milik tahun ajaran ini.']);
                }
            }

            $adaAktif = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)
                ->where('is_active_riwayat', RiwayatBelajar::YA)
                ->lockForUpdate()
                ->exists();
            if ($adaAktif) {
                throw ValidationException::withMessages(['riwayat' => 'Santri sudah punya riwayat aktif di lembaga ini.']);
            }

            $statusAwal = $data['status_awal'] ?? 'santri_baru';
            $kamusAwal = RefService::kodeAktif('status_awal', $jenjang);
            if ($kamusAwal !== [] && ! in_array($statusAwal, $kamusAwal, true)) {
                throw ValidationException::withMessages(['status_awal' => "Status awal {$statusAwal} tidak aktif di lembaga ini."]);
            }

            $this->pastikanKeanggotaan($santri, $jenjang, [
                'nis_lokal' => $data['nis_lokal'] ?? null,
                'tgl_masuk' => $data['tgl_masuk'] ?? null,
                'tahaj_masuk' => $data['tahaj_masuk'] ?? null,
                'tingkat_masuk' => $data['tingkat_masuk'] ?? null,
                'no_urut' => $data['no_urut'] ?? null,
                'nama_sekolah_asal' => $data['nama_sekolah_asal'] ?? null,
                'npsn_sekolah_asal' => $data['npsn_sekolah_asal'] ?? null,
                'nss_sekolah_asal' => $data['nss_sekolah_asal'] ?? null,
                'alamat_sekolah_asal' => $data['alamat_sekolah_asal'] ?? null,
            ]);

            $noAbsen = isset($data['no_absen']) ? (int) $data['no_absen'] : null;
            if ($noAbsen !== null) {
                (new SiklusSantriService)->cekBentrokAbsen($kelasId, $tahunAjaran, '1', $noAbsen);
            }

            $baru = RiwayatBelajar::create([
                'santri_id' => $santri->id,
                'tahun_ajaran' => $tahunAjaran,
                'jenjang' => $jenjang,
                'kelas_id' => $kelasId,
                'semester' => '1',
                'tgl_masuk' => $data['tgl_masuk'] ?? null,
                'no_absen' => $noAbsen,
                // Tingkat mewarisi kelas bila tak diisi eksplisit.
                'tingkat' => $data['tingkat'] ?? $kelas?->tingkat,
                'status_awal' => $statusAwal,
                'status_akhir' => 'aktif',
                'is_active_riwayat' => RiwayatBelajar::YA,
            ]);

            $santri->hitungUlangStatusGlobal();

            return $baru;
        });
    }

    /** Cari tahun ajaran berikut (tanggal_mulai lebih besar) untuk kenaikan/mengulang. */
    public function tahunAjaranBerikut(string $jenjang, RiwayatBelajar $lama): ?TahunAjaran
    {
        $taLama = TahunAjaran::find($lama->tahun_ajaran);

        return TahunAjaran::efektif($jenjang)
            ->when($taLama?->tanggal_mulai, fn ($rows, $mulai) => $rows->filter(fn ($t) => ($t->tanggal_mulai ?? '') > $mulai))
            ->sortBy(fn ($t) => ($t->tanggal_mulai ?? '').'|'.$t->nama)
            ->first();
    }
}
