<?php

namespace App\Console\Commands;

use App\Services\PapanService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use JsonException;

#[Signature('papan:butir
    {aksi : tambah | hapus | ubah | naik | turun}
    {kode : Kode sub-modul, mis. E.3}
    {--id= : Id butir (wajib untuk hapus, ubah, naik, turun)}
    {--status= : Status: pending | backlog | todo | in_progress | for_review | done}
    {--instruksi-pending= : Instruksi langsung pengguna untuk perpindahan ke/dari Pending}
    {--deskripsi= : Isi butir (wajib untuk tambah, opsional untuk ubah)}
    {--catatan= : Alasan singkat bila status ikut berubah}
    {--file= : Payload JSON UTF-8 untuk tambah/ubah, tanpa menimpa field yang tidak dikirim}
    {--oleh=agent : Pencatat: agent atau pengguna}')]
#[Description('Tambah, ubah, geser, atau hapus butir di bawah sebuah sub-modul papan.')]
class PapanButir extends Command
{
    /** Jalankan aksi pada butir papan. */
    public function handle(PapanService $papan): int
    {
        $aksi = (string) $this->argument('aksi');
        $kode = (string) $this->argument('kode');

        try {
            return match ($aksi) {
                'tambah' => $this->tambah($papan, $kode),
                'ubah' => $this->ubah($papan, $kode),
                'naik' => $this->geser($papan, $kode, -1),
                'turun' => $this->geser($papan, $kode, 1),
                'hapus' => $this->hapus($papan, $kode),
                default => $this->aksiTidakDikenal($aksi),
            };
        } catch (ValidationException $e) {
            $this->error(implode(' ', array_merge(...array_values($e->errors()))));

            return self::FAILURE;
        } catch (InvalidArgumentException|JsonException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }

    /** Tambah butir baru berstatus tertentu. */
    private function tambah(PapanService $papan, string $kode): int
    {
        if ($this->option('file') !== null) {
            $data = $this->payload();
            if (! isset($data['deskripsi'])) {
                throw new InvalidArgumentException('Payload tambah memerlukan deskripsi.');
            }
            if (array_diff(array_keys($data), ['deskripsi', 'status', 'keterangan', 'subpoin', 'instruksi_pending']) !== []) {
                throw new InvalidArgumentException('Payload tambah hanya menerima deskripsi, status, keterangan, subpoin, dan instruksi_pending. Catatan ditambahkan melalui papan:catat.');
            }
            $this->pastikanJalurAgen($data['status'] ?? 'backlog');
            $butir = $papan->tambahButir($kode, $data['status'] ?? 'backlog', $data['deskripsi'], $data['subpoin'] ?? [], $data['keterangan'] ?? null,
                instruksiPending: $data['instruksi_pending'] ?? null);
            $this->line(json_encode($butir->toArray(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

            return self::SUCCESS;
        }
        $deskripsi = (string) $this->option('deskripsi');

        if (trim($deskripsi) === '') {
            $this->error('Opsi --deskripsi wajib diisi untuk aksi tambah.');

            return self::FAILURE;
        }

        $status = (string) ($this->option('status') ?: 'backlog');
        $this->pastikanJalurAgen($status);
        $butir = $papan->tambahButir($kode, $status, trim($deskripsi), instruksiPending: $this->option('instruksi-pending'));

        $labelStatus = PapanService::LABEL_STATUS[$butir->status] ?? $butir->status;
        $this->info("Butir #{$butir->id} ditambahkan ke {$kode} [{$labelStatus}].");

        return self::SUCCESS;
    }

    /**
     * Ubah teks dan/atau status sebuah butir.
     *
     * Hanya yang benar-benar disebut pengguna yang dikirim: tanpa --deskripsi
     * teksnya dibiarkan, tanpa --status statusnya dibiarkan. Opsi status di
     * sini sengaja TIDAK punya nilai bawaan, supaya "tidak disebut" bisa
     * dibedakan dari "disebut bernilai in_progress".
     */
    private function ubah(PapanService $papan, string $kode): int
    {
        $id = $this->option('id');

        if (! is_numeric($id)) {
            $this->error('Opsi --id wajib diisi (angka) untuk aksi ubah.');

            return self::FAILURE;
        }

        if ($this->option('file') !== null) {
            $data = $this->payload();
            $this->pastikanJalurAgen($data['status'] ?? null);
            $butir = $papan->ubahButir($kode, (int) $id,
                deskripsi: $data['deskripsi'] ?? null,
                status: $data['status'] ?? null,
                oleh: 'agent',
                catatan: $data['catatan'] ?? null,
                subpoin: $data['subpoin'] ?? null,
                keterangan: array_key_exists('keterangan', $data) ? (string) ($data['keterangan'] ?? '') : null,
                konfirmasiReopen: $data['konfirmasi_reopen'] ?? false,
                jenisPerubahan: $data['jenis_perubahan'] ?? null,
                persetujuanScope: $data['persetujuan_scope'] ?? null,
                instruksiPending: $data['instruksi_pending'] ?? null);
            $this->line(json_encode($butir->toArray(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

            return self::SUCCESS;
        }

        $deskripsi = trim((string) $this->option('deskripsi'));
        $status = $this->option('status');
        $this->pastikanJalurAgen($status);

        if ($deskripsi === '' && $status === null) {
            $this->error('Isi --deskripsi dan/atau --status untuk aksi ubah.');

            return self::FAILURE;
        }

        $butir = $papan->ubahButir(
            $kode,
            (int) $id,
            $deskripsi === '' ? null : $deskripsi,
            $status === null ? null : (string) $status,
            (string) ($this->option('oleh') ?: 'agent'),
            $this->option('catatan') === null ? null : (string) $this->option('catatan'),
            instruksiPending: $this->option('instruksi-pending'),
        );

        $labelStatus = PapanService::LABEL_STATUS[$butir->status] ?? $butir->status;
        $this->info("Butir #{$butir->id} diperbarui [{$labelStatus}].");

        return self::SUCCESS;
    }

    private function pastikanJalurAgen(?string $status): void
    {
        if ($status === 'done' || $this->option('oleh') !== 'agent') {
            throw new InvalidArgumentException('CLI adalah jalur agen. Done hanya ditetapkan pengguna melalui UI; --oleh tidak memberi kewenangan pengguna.');
        }
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        foreach (['status', 'deskripsi', 'catatan', 'instruksi-pending'] as $option) {
            if ($this->option($option) !== null) {
                throw new InvalidArgumentException('Jangan gabungkan --file dengan --status, --deskripsi, --catatan, atau --instruksi-pending.');
            }
        }
        $file = (string) $this->option('file');
        if (! is_file($file) || ! is_readable($file) || filesize($file) > 131072) {
            throw new InvalidArgumentException('Payload harus berupa file JSON UTF-8 yang terbaca, maksimal 128 KiB.');
        }
        $json = file_get_contents($file);
        $data = json_decode(str_starts_with($json, "\xEF\xBB\xBF") ? substr($json, 3) : $json, true, 64, JSON_THROW_ON_ERROR);
        $rules = [
            'deskripsi' => ['sometimes', 'required', 'string', 'max:500'],
            'status' => ['sometimes', 'required', 'in:'.implode(',', PapanService::STATUS)],
            'keterangan' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'subpoin' => ['sometimes', 'array', 'max:30'],
            'subpoin.*' => ['array:teks,selesai'],
            'subpoin.*.teks' => ['required', 'string', 'max:500'],
            'subpoin.*.selesai' => ['required', 'boolean'],
            'catatan' => ['sometimes', 'required', 'string', 'max:4000'],
            'konfirmasi_reopen' => ['sometimes', 'boolean'],
            'jenis_perubahan' => ['sometimes', 'in:scope,typo'],
            'persetujuan_scope' => ['sometimes', 'required', 'string', 'max:4000'],
            'instruksi_pending' => ['sometimes', 'required', 'string', 'max:4000'],
        ];
        $allowed = array_filter(array_keys($rules), fn ($key) => ! str_contains($key, '.'));
        if (! is_array($data) || $data === [] || array_diff(array_keys($data), $allowed) !== []) {
            throw new InvalidArgumentException('Payload harus object JSON dengan field Board yang dikenal.');
        }
        if (array_intersect(array_keys($data), ['deskripsi', 'status', 'keterangan', 'subpoin', 'catatan']) === []) {
            throw new InvalidArgumentException('Payload tidak berisi perubahan poin.');
        }

        return Validator::make($data, $rules)->validate();
    }

    /** Geser butir naik (-1) atau turun (1) satu langkah. */
    private function geser(PapanService $papan, string $kode, int $arah): int
    {
        $id = $this->option('id');

        if (! is_numeric($id)) {
            $this->error('Opsi --id wajib diisi (angka) untuk aksi ini.');

            return self::FAILURE;
        }

        if (! $papan->geserButir($kode, (int) $id, $arah)) {
            $this->error("Butir #{$id} sudah di ujung urutan (atau tidak ditemukan).");

            return self::FAILURE;
        }

        $arahTeks = $arah === -1 ? 'naik' : 'turun';
        $this->info("Butir #{$id} digeser {$arahTeks}.");

        return self::SUCCESS;
    }

    /** Hapus butir milik sebuah sub-modul. */
    private function hapus(PapanService $papan, string $kode): int
    {
        $id = $this->option('id');

        if (! is_numeric($id)) {
            $this->error('Opsi --id wajib diisi (angka) untuk aksi hapus.');

            return self::FAILURE;
        }

        if (! $papan->hapusButir($kode, (int) $id)) {
            $this->error("Butir #{$id} tidak ditemukan di {$kode}.");

            return self::FAILURE;
        }

        $this->info("Butir #{$id} dihapus dari {$kode}.");

        return self::SUCCESS;
    }

    /** Aksi di luar daftar yang dikenal. */
    private function aksiTidakDikenal(string $aksi): int
    {
        $this->error("Aksi `{$aksi}` tidak dikenal. Pakai: tambah, ubah, naik, turun, atau hapus.");

        return self::FAILURE;
    }
}
