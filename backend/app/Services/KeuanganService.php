<?php

namespace App\Services;

use App\Models\AkunKas;
use App\Models\JurnalKas;
use App\Models\Lembaga;
use App\Models\Pembayaran;
use App\Models\PembayaranDetail;
use App\Models\PosKeuangan;
use App\Models\PsbBiayaLembaga;
use App\Models\PsbCalonSantri;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\TarifBiaya;
use App\Models\TarifKhususSantri;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * KeuanganService: 2 method PSB (100, JANGAN UBAH PERILAKU) + transaksi 103-B:
 * generateTagihanBulanan, bayarTagihan (Opsi B idempoten), voidPembayaran,
 * nomorKuitansiBerikutnya.
 */
class KeuanganService
{
    /**
     * Tagihan pendaftaran PSB (pos PSB_REG).
     *
     * Idempoten per calon: bila tagihan pendaftaran untuk calon+pos sudah ada,
     * kembalikan baris yang ada (skip, tanpa insert ganda).
     */
    public function createTagihanPendaftaranPsb(PsbCalonSantri $calon, float $nominal, int $tahunAjaranId): Tagihan
    {
        $pos = PosKeuangan::where('kode_pos', 'PSB_REG')->first();
        if (! $pos) {
            throw ValidationException::withMessages([
                'pos_keuangan' => 'Pos keuangan PSB_REG belum dibuat. Admin harus membuat pos pendaftaran terlebih dahulu.',
            ]);
        }

        return DB::transaction(function () use ($calon, $nominal, $tahunAjaranId, $pos) {
            $ada = Tagihan::where('psb_calon_santri_id', $calon->id)
                ->where('pos_keuangan_id', $pos->id)
                ->lockForUpdate()
                ->first();
            if ($ada) {
                return $ada;
            }

            $usaha = 0;
            while (true) {
                try {
                    $tagihan = Tagihan::create([
                        'no_tagihan' => $this->generateNoTagihan((int) $calon->lembaga_id),
                        'santri_id' => null,
                        'psb_calon_santri_id' => $calon->id,
                        'pos_keuangan_id' => $pos->id,
                        'tahun_ajaran_id' => $tahunAjaranId,
                        'lembaga_id' => $calon->lembaga_id,
                        'periode' => null,
                        'paket_kode' => $calon->isPaket() ? 'MI-MD' : null,
                        'nominal_total' => $nominal,
                        'nominal_terbayar' => 0,
                        'sisa_tagihan' => $nominal,
                        'status' => 'belum_bayar',
                    ]);

                    return $tagihan->fresh();
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                        throw $e;
                    }
                }
            }
        });
    }

    /**
     * Batalkan tagihan pendaftaran PSB (pos PSB_REG) milik calon.
     * Hanya untuk baris belum terbayar; ada pembayaran = tolak (rekonsiliasi kas).
     */
    public function batalkanTagihanPsb(PsbCalonSantri $calon): void
    {
        $pos = PosKeuangan::where('kode_pos', 'PSB_REG')->first();
        if (! $pos) {
            return;
        }
        $tagihan = Tagihan::where('psb_calon_santri_id', $calon->id)
            ->where('pos_keuangan_id', $pos->id)
            ->get();
        if ($tagihan->isEmpty()) {
            return;
        }
        if ($tagihan->contains(fn ($t) => (float) $t->nominal_terbayar > 0)) {
            throw ValidationException::withMessages([
                'tagihan' => 'Tagihan pendaftaran sudah memiliki pembayaran; selesaikan di Keuangan terlebih dahulu.',
            ]);
        }
        Tagihan::whereIn('id', $tagihan->pluck('id'))->update(['status' => 'dibatalkan']);
    }

    /** Pulihkan tagihan PSB_REG yang dibatalkan (saat calon di-restore). */
    public function aktifkanKembaliTagihanPsb(PsbCalonSantri $calon): void
    {
        $pos = PosKeuangan::where('kode_pos', 'PSB_REG')->first();
        if (! $pos) {
            return;
        }
        Tagihan::where('psb_calon_santri_id', $calon->id)
            ->where('pos_keuangan_id', $pos->id)
            ->where('status', 'dibatalkan')
            ->update(['status' => 'belum_bayar']);
    }

    /**
     * Tagihan masuk/daftar ulang PSB (pos DFR_ULANG) + tagihan asrama terpisah (pos ASRAMA).
     * Nominal dari psb_biaya_lembaga (bukan lagi per gelombang). Idempoten per santri+pos.
     */
    public function createTagihanMasukPsb(PsbCalonSantri $calon, Santri $santri): ?Tagihan
    {
        $pos = PosKeuangan::where('kode_pos', 'DFR_ULANG')->first();
        if (! $pos) {
            throw ValidationException::withMessages([
                'pos_keuangan' => 'Pos keuangan DFR_ULANG belum dibuat. Admin harus membuat pos daftar ulang terlebih dahulu.',
            ]);
        }

        $biaya = PsbBiayaLembaga::where('lembaga_id', $calon->lembaga_id)->first();
        $taMasuk = TahunAjaran::resolveUntukLembaga((int) $calon->lembaga_id, $calon->tahun_ajaran_id);
        $tagihanMasuk = $this->buatTagihanDaftarUlang(
            $calon,
            $santri,
            $pos,
            (float) ($biaya->biaya_masuk ?? 0),
            $calon->isPaket() ? 'MI-MD' : null,
            $taMasuk
        );

        if ($calon->tipe_santri === 'asrama') {
            $posAsrama = PosKeuangan::where('kode_pos', 'ASRAMA')->first();
            $biayaAsrama = (float) ($biaya->biaya_asrama ?? 0);
            if ($posAsrama && $biayaAsrama > 0) {
                $this->buatTagihanDaftarUlang($calon, $santri, $posAsrama, $biayaAsrama, null, $taMasuk);
            }
        }

        return $tagihanMasuk;
    }

    protected function buatTagihanDaftarUlang(PsbCalonSantri $calon, Santri $santri, PosKeuangan $pos, float $nominal, ?string $paketKode, ?int $tahunAjaranId = null): Tagihan
    {
        return DB::transaction(function () use ($calon, $santri, $pos, $nominal, $paketKode, $tahunAjaranId) {
            $ada = Tagihan::where('santri_id', $santri->id)
                ->where('pos_keuangan_id', $pos->id)
                ->whereNull('periode')
                ->lockForUpdate()
                ->first();
            if ($ada) {
                return $ada;
            }

            $usaha = 0;
            while (true) {
                try {
                    return Tagihan::create([
                        'no_tagihan' => $this->generateNoTagihan((int) $calon->lembaga_id),
                        'santri_id' => $santri->id,
                        'psb_calon_santri_id' => $calon->id,
                        'pos_keuangan_id' => $pos->id,
                        'tahun_ajaran_id' => $tahunAjaranId ?? $calon->tahun_ajaran_id,
                        'lembaga_id' => $calon->lembaga_id,
                        'periode' => null,
                        'paket_kode' => $paketKode,
                        'nominal_total' => $nominal,
                        'nominal_terbayar' => 0,
                        'sisa_tagihan' => $nominal,
                        'status' => 'belum_bayar',
                    ])->fresh();
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                        throw $e;
                    }
                }
            }
        });
    }

    /**
     * Format: TGH_{tahun}_{kodeLembaga}_{seq4}; seq reset per (lembaga, tahun).
     * Caller WAJIB catch QueryException 1062 lalu regenerate (maks 3x).
     */
    protected function generateNoTagihan(int $lembagaId): string
    {
        $lembaga = Lembaga::findOrFail($lembagaId);
        $kode = strtoupper((string) ($lembaga->kode ?: ($lembaga->jenjang ?: $lembagaId)));
        $tahun = date('Y');
        $seq = Tagihan::where('lembaga_id', $lembagaId)
            ->whereYear('created_at', $tahun)
            ->lockForUpdate()
            ->count() + 1;

        return sprintf('TGH_%s_%s_%04d', $tahun, $kode, $seq);
    }

    /**
     * 103-B: Generate Tagihan Bulanan — idempoten per (santri,pos,periode), per-item partial.
     * $lembagaId wajib (satu batch satu lembaga, konsisten 102). Paket MI-MD: 1 tagihan di primer.
     */
    public function generateTagihanBulanan(int $lembagaId, int $tahunAjaranId, string $periode)
    {
        $lembaga = Lembaga::where('id', $lembagaId)->firstOrFail();
        $posList = PosKeuangan::where('tipe', 'bulanan')->get();
        $ok = 0;
        $gagal = [];
        $lewat = 0;

        Santri::with(['lembaga', 'riwayatAktif.lembaga'])
            ->where('status_global', true)
            ->whereHas('riwayatAktif', fn ($q) => $q->where('lembaga_id', $lembagaId)->where('tahun_ajaran_id', $tahunAjaranId))
            ->chunkById(200, function ($santriList) use ($lembaga, $posList, $tahunAjaranId, $periode, &$ok, &$gagal, &$lewat) {
                foreach ($santriList as $santri) {
                    // Paket: riwayat aktif MI+MD tahun ini + non_asrama → tagih sekali di primer MI.
                    $kodeAktif = $santri->riwayatAktif->where('tahun_ajaran_id', $tahunAjaranId)
                        ->map(fn ($r) => $r->lembaga->kode ?? null)->filter()->all();
                    $isPaket = in_array('MI', $kodeAktif, true) && in_array('MD', $kodeAktif, true)
                        && $santri->tipe_santri === 'non_asrama';
                    // Baris MD paket: generate milik MI saja (dilewati_paket, bukan gagal).
                    if ($isPaket && $lembaga->kode === 'MD') {
                        $lewat++;

                        continue;
                    }

                    foreach ($posList as $pos) {
                        try {
                            $this->buatSatuTagihanBulanan($santri, $lembaga, $pos, $tahunAjaranId, $periode, $isPaket) && $ok++;
                        } catch (\Throwable $e) {
                            $gagal[] = ['santri_id' => $santri->id, 'pos_id' => $pos->id, 'pesan' => $e->getMessage()];
                        }
                    }
                }
            });

        return ['berhasil' => $ok, 'dilewati_paket' => $lewat, 'gagal' => $gagal];
    }

    protected function buatSatuTagihanBulanan(Santri $santri, Lembaga $lembaga, PosKeuangan $pos, int $tahunAjaranId, string $periode, bool $isPaket): bool
    {
        return DB::transaction(function () use ($santri, $lembaga, $pos, $tahunAjaranId, $periode, $isPaket) {
            $tarifKhusus = TarifKhususSantri::where('santri_id', $santri->id)->where('pos_keuangan_id', $pos->id)->first();
            if ($tarifKhusus) {
                $nominal = $tarifKhusus->nominal_akhir;
                $paketKode = null;
            } else {
                $tarif = TarifBiaya::where('pos_keuangan_id', $pos->id)->where('lembaga_id', $lembaga->id)
                    ->where('tahun_ajaran_id', $tahunAjaranId)
                    ->whereIn('tipe_santri', ['semua', $santri->tipe_santri])
                    ->orderByRaw('CASE WHEN tipe_santri = ? THEN 0 ELSE 1 END', [$santri->tipe_santri])
                    ->lockForUpdate()->first();
                if (! $tarif || (float) $tarif->nominal <= 0) {
                    return false;
                } // tanpa tarif = tidak ditagih (eksplisit, bukan 0 diam-diam)
                $nominal = (float) $tarif->nominal;
                $paketKode = null;
                if ($isPaket && $tarif->nominal_paket !== null && $lembaga->kode === 'MI') {
                    $nominal = (float) $tarif->nominal_paket;
                    $paketKode = 'MI-MD';
                }
            }
            // Idempoten: unique (santri,pos,periode) — race dobel generate ditangkap via unique-violation lalu re-read.
            // Return true hanya bila baris BARU dibuat (generate ulang = false, bukan gagal).
            try {
                $tagihan = Tagihan::firstOrCreate(
                    ['santri_id' => $santri->id, 'pos_keuangan_id' => $pos->id, 'periode' => $periode],
                    ['no_tagihan' => sprintf('TGH/%s/%d/%d', str_replace('-', '', $periode), $santri->id, $pos->id),
                        'lembaga_id' => $lembaga->id,
                        'tahun_ajaran_id' => $tahunAjaranId, 'paket_kode' => $paketKode,
                        'nominal_total' => $nominal, 'nominal_terbayar' => 0, 'sisa_tagihan' => $nominal, 'status' => 'belum_bayar']
                );
            } catch (QueryException $e) {
                if (($e->errorInfo[1] ?? null) !== 1062) {
                    throw $e;
                }
                Tagihan::where('santri_id', $santri->id)->where('pos_keuangan_id', $pos->id)->where('periode', $periode)->firstOrFail();

                return false;
            }

            return $tagihan->wasRecentlyCreated;
        });
    }

    /**
     * 103-B: Bayar kasir (cicil/lunas multi-tagihan) — lock per tagihan + nomor kuitansi anti-race.
     * $data: akun_kas_id, total_bayar, metode_pembayaran, items[{tagihan_id, nominal_dibayar}],
     *   tgl_pembayaran/catatan/santri_id/psb_calon_santri_id/user_id + client_op_id (Opsi B).
     * Tenant dicek di controller via canAccessLembaga (bukan pesantren_id).
     */
    public function bayarTagihan(array $data)
    {
        $sum = array_sum(array_column($data['items'], 'nominal_dibayar'));
        if (abs($sum - (float) $data['total_bayar']) > 0.01) {
            abort(422, 'Total bayar harus sama dengan jumlah item.');
        }

        return DB::transaction(function () use ($data) {
            $tenantLembagaIds = $data['tenant_lembaga_ids'] ?? null;

            // Opsi B: kunci idempoten terisi + pembayaran sudah ada → kembalikan existing, JANGAN buat baru.
            if (! empty($data['client_op_id'])) {
                $ada = $this->cariPembayaranIdempoten($data['client_op_id'], $tenantLembagaIds);
                if ($ada) {
                    return $ada->load('detail.tagihan.posKeuangan');
                }
                if (Pembayaran::where('client_op_id', $data['client_op_id'])->exists()) {
                    abort(422, 'client_op_id sudah dipakai pada transaksi lain.');
                }
            }

            $akunKas = AkunKas::where('id', $data['akun_kas_id'])->lockForUpdate()->firstOrFail();

            // Anti-race no_kuitansi (unique global): coba hingga 4x, catch 1062 → nomor baru.
            $pembayaran = null;
            for ($i = 0; $i < 4; $i++) {
                try {
                    $pembayaran = Pembayaran::create([
                        'no_kuitansi' => $this->nomorKuitansiBerikutnya($i),
                        'akun_kas_id' => $akunKas->id,
                        'user_id' => $data['user_id'] ?? null,
                        'santri_id' => $data['santri_id'] ?? null,
                        'psb_calon_santri_id' => $data['psb_calon_santri_id'] ?? null,
                        'tgl_pembayaran' => $data['tgl_pembayaran'] ?? now(),
                        'total_bayar' => $data['total_bayar'],
                        'metode_pembayaran' => $data['metode_pembayaran'],
                        'catatan' => $data['catatan'] ?? null,
                        'client_op_id' => $data['client_op_id'] ?? null,
                    ]);
                    break;
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062) {
                        throw $e;
                    }
                    // Race kunci sama: baca ulang existing daripada dobel catat (tetap ter-scope tenant).
                    if (! empty($data['client_op_id'])) {
                        $lomba = $this->cariPembayaranIdempoten($data['client_op_id'], $tenantLembagaIds);
                        if ($lomba) {
                            return $lomba->load('detail.tagihan.posKeuangan');
                        }
                        abort(422, 'client_op_id sudah dipakai pada transaksi lain.');
                    }
                    if ($i === 3) {
                        throw new \Exception('Gagal menerbitkan nomor kuitansi, coba lagi.');
                    }
                }
            }

            try {
                foreach ($data['items'] as $item) {
                    $tagihan = Tagihan::where('id', $item['tagihan_id'])->lockForUpdate()->firstOrFail();
                    if (! empty($data['santri_id']) && (int) $tagihan->santri_id !== (int) $data['santri_id']) {
                        abort(422, "Tagihan {$tagihan->no_tagihan} bukan milik santri yang dipilih.");
                    }
                    if (! empty($data['psb_calon_santri_id']) && (int) $tagihan->psb_calon_santri_id !== (int) $data['psb_calon_santri_id']) {
                        abort(422, "Tagihan {$tagihan->no_tagihan} bukan milik calon yang dipilih.");
                    }
                    if ($tagihan->status === 'dibatalkan') {
                        abort(409, "Tagihan {$tagihan->no_tagihan} sudah dibatalkan.");
                    }
                    if ($tagihan->status === 'lunas' || (float) $tagihan->sisa_tagihan <= 0) {
                        abort(409, "Tagihan {$tagihan->no_tagihan} sudah lunas.");
                    }
                    $bayar = (float) $item['nominal_dibayar'];
                    if ($bayar <= 0 || $bayar > (float) $tagihan->sisa_tagihan) {
                        abort(422, "Nominal melebihi sisa tagihan {$tagihan->no_tagihan}.");
                    }

                    PembayaranDetail::create(['pembayaran_id' => $pembayaran->id, 'tagihan_id' => $tagihan->id, 'nominal_dibayar' => $bayar]);
                    $sisa = (float) $tagihan->sisa_tagihan - $bayar;
                    $tagihan->update(['nominal_terbayar' => (float) $tagihan->nominal_terbayar + $bayar,
                        'sisa_tagihan' => $sisa, 'status' => $sisa <= 0 ? 'lunas' : 'mencicil']);
                }
                $akunKas->increment('saldo', $data['total_bayar']);
                JurnalKas::create(['akun_kas_id' => $akunKas->id,
                    'pembayaran_id' => $pembayaran->id, 'tgl_transaksi' => $pembayaran->tgl_pembayaran,
                    'jenis' => 'masuk', 'nominal' => $data['total_bayar'], 'kategori' => 'Penerimaan Tagihan Santri',
                    'keterangan' => "Pembayaran Kuitansi No: {$pembayaran->no_kuitansi}"]);
            } catch (\Throwable $e) {
                // Nomor kuitansi yang terlanjur dibuat ikut rollback (transaksi) — aman.
                throw $e;
            }

            return $pembayaran->load('detail.tagihan.posKeuangan');
        });
    }

    protected function cariPembayaranIdempoten(string $clientOpId, ?array $tenantLembagaIds): ?Pembayaran
    {
        return Pembayaran::where('client_op_id', $clientOpId)
            ->when($tenantLembagaIds !== null, function ($q) use ($tenantLembagaIds) {
                $q->whereHas('detail.tagihan', fn ($qq) => $qq->whereIn('lembaga_id', $tenantLembagaIds));
            })
            ->first();
    }

    /** Nomor KWT/{tahun}/{seq5} global per tahun — hitung dalam lock + retry duplikat. Unique no_kuitansi global. */
    protected function nomorKuitansiBerikutnya(int $usaha = 0): string
    {
        $tahun = date('Y');
        $seq = Pembayaran::whereYear('created_at', $tahun)
            ->lockForUpdate()->count() + 1 + $usaha;
        $no = sprintf('KWT/%s/%05d', $tahun, $seq);
        if (Pembayaran::where('no_kuitansi', $no)->exists()) {
            if ($usaha > 3) {
                throw new \Exception('Gagal menerbitkan nomor kuitansi, coba lagi.');
            }

            return $this->nomorKuitansiBerikutnya($usaha + 1);
        }

        return $no;
    }

    /**
     * 103-B: Void pembayaran (admin only — authorize di controller).
     * Kembalikan sisa tagihan, kurangi saldo kas, tulis jurnal lawan (info, bukan hapus).
     */
    public function voidPembayaran(Pembayaran $pembayaran, int $olehUserId, ?string $alasan = null)
    {
        return DB::transaction(function () use ($pembayaran, $olehUserId, $alasan) {
            $pembayaran = Pembayaran::where('id', $pembayaran->id)->lockForUpdate()->firstOrFail();
            if (JurnalKas::where('pembayaran_id', $pembayaran->id)->where('kategori', 'Void Pembayaran')->exists()) {
                abort(409, 'Pembayaran ini sudah di-void.');
            }
            foreach ($pembayaran->detail as $dt) {
                $tagihan = Tagihan::where('id', $dt->tagihan_id)->lockForUpdate()->firstOrFail();
                $tagihan->update(['nominal_terbayar' => max(0, (float) $tagihan->nominal_terbayar - (float) $dt->nominal_dibayar),
                    'sisa_tagihan' => (float) $tagihan->sisa_tagihan + (float) $dt->nominal_dibayar,
                    'status' => 'mencicil']);
                if ((float) $tagihan->sisa_tagihan >= (float) $tagihan->nominal_total) {
                    $tagihan->update(['status' => 'belum_bayar']);
                }
            }
            $akunKas = AkunKas::where('id', $pembayaran->akun_kas_id)->lockForUpdate()->firstOrFail();
            $akunKas->decrement('saldo', $pembayaran->total_bayar);
            JurnalKas::create(['akun_kas_id' => $akunKas->id,
                'pembayaran_id' => $pembayaran->id, 'tgl_transaksi' => now()->toDateString(), 'jenis' => 'keluar',
                'nominal' => $pembayaran->total_bayar, 'kategori' => 'Void Pembayaran',
                'keterangan' => "Void {$pembayaran->no_kuitansi} oleh {$olehUserId}: {$alasan}"]);
            $pembayaran->update(['catatan' => '[VOID] '.($alasan ?? '')]);

            return $pembayaran->fresh();
        });
    }
}
