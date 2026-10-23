<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use JsonException;
use RuntimeException;

/**
 * Backup dan restore seluruh isi Board pada koneksi `papan`.
 *
 * Format file sengaja memakai ID dan timestamp asli agar restore benar-benar
 * mengembalikan keadaan saat backup, bukan membuat ulang data dengan ID baru.
 */
class PapanBackupService
{
    public const FORMAT = 'simpes-papan';

    public const VERSI = 1;

    public const DIREKTORI = 'papan';

    public const PREFIKS_KEAMANAN = 'papan-backup-sebelum-restore-';

    private const BATAS_BYTE = 10 * 1024 * 1024;

    private const SIMPAN_KEAMANAN = 10;

    /**
     * Susun backup dari tabel Board apa adanya.
     *
     * @return array<string, mixed>
     */
    public function ekspor(): array
    {
        $modul = DB::connection('papan')->table('papan_modul')->orderBy('id')->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'aplikasi' => (string) $r->aplikasi,
                'kode' => (string) $r->kode,
                'nama' => (string) $r->nama,
                'urutan' => (int) $r->urutan,
                'catatan' => $r->catatan === null ? null : (string) $r->catatan,
                'created_at' => (string) $r->created_at,
                'updated_at' => (string) $r->updated_at,
            ])->all();

        $item = DB::connection('papan')->table('papan_item')->orderBy('id')->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'modul_id' => (int) $r->modul_id,
                'kode' => (string) $r->kode,
                'nama' => (string) $r->nama,
                'rujukan' => $r->rujukan === null ? null : (string) $r->rujukan,
                'urutan' => (int) $r->urutan,
                'created_at' => (string) $r->created_at,
                'updated_at' => (string) $r->updated_at,
            ])->all();

        $butir = DB::connection('papan')->table('papan_butir')->orderBy('id')->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'item_id' => (int) $r->item_id,
                'status' => (string) $r->status,
                'deskripsi' => (string) $r->deskripsi,
                'urutan' => (int) $r->urutan,
                'keterangan' => $r->keterangan === null ? null : (string) $r->keterangan,
                'subpoin' => $this->bacaJson($r->subpoin),
                'catatan' => $this->bacaJson($r->catatan),
                'scope_versi' => $this->bacaJson($r->scope_versi),
                'created_at' => (string) $r->created_at,
                'updated_at' => (string) $r->updated_at,
            ])->all();

        $riwayat = DB::connection('papan')->table('papan_riwayat')->orderBy('id')->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'item_id' => (int) $r->item_id,
                'butir_id' => $r->butir_id === null ? null : (int) $r->butir_id,
                'dari_status' => $r->dari_status === null ? null : (string) $r->dari_status,
                'ke_status' => (string) $r->ke_status,
                'catatan' => $r->catatan === null ? null : (string) $r->catatan,
                'diubah_oleh' => (string) $r->diubah_oleh,
                'waktu' => (string) $r->waktu,
            ])->all();

        $pengaturan = DB::connection('papan')->table('papan_pengaturan')->orderBy('kunci')->get()
            ->map(fn ($r) => [
                'kunci' => (string) $r->kunci,
                'nilai' => $r->nilai === null ? null : (string) $r->nilai,
            ])->all();

        return [
            'format' => self::FORMAT,
            'versi' => self::VERSI,
            'dibuat_pada' => now()->toIso8601String(),
            'pengaturan' => $pengaturan,
            'modul' => $modul,
            'item' => $item,
            'butir' => $butir,
            'riwayat' => $riwayat,
        ];
    }

    public function eksporJson(): string
    {
        return json_encode(
            $this->ekspor(),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
        );
    }

    public function namaBerkas(): string
    {
        return 'papan-backup-'.now()->format('Ymd-His').'.json';
    }

    /**
     * Baca, validasi, dan normalisasi file backup sebelum menyentuh database.
     *
     * @return array<string, mixed>
     */
    public function urai(string $json): array
    {
        if (strlen($json) > self::BATAS_BYTE) {
            $this->gagal('File backup melebihi batas 10 MB.');
        }

        $bersih = str_starts_with($json, "\xEF\xBB\xBF") ? substr($json, 3) : $json;

        try {
            $data = json_decode($bersih, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            $this->gagal('File bukan JSON yang valid.');
        }

        if (! is_array($data)) {
            $this->gagal('Akar file backup harus berupa object JSON.');
        }

        $dikenal = ['format', 'versi', 'dibuat_pada', 'pengaturan', 'modul', 'item', 'butir', 'riwayat'];
        $hilang = array_diff($dikenal, array_keys($data));
        if ($hilang !== []) {
            $this->gagal('File backup tidak memuat field: '.implode(', ', $hilang).'.');
        }
        $lebih = array_diff(array_keys($data), $dikenal);
        if ($lebih !== []) {
            $this->gagal('File backup memuat field tidak dikenal: '.implode(', ', $lebih).'.');
        }

        $kunciPengaturan = [
            'workflow_aktif',
            ...array_map(fn (string $kode) => 'workflow_aktif:'.$kode, array_keys(PapanService::APLIKASI)),
        ];

        $aturan = [
            'format' => ['required', 'in:'.self::FORMAT],
            'versi' => ['required', 'integer', 'in:'.self::VERSI],
            'dibuat_pada' => ['required', 'date'],
            'pengaturan' => ['array', 'max:100'],
            'pengaturan.*' => ['array:kunci,nilai'],
            'pengaturan.*.kunci' => ['required', 'string', 'max:60', 'distinct', Rule::in($kunciPengaturan)],
            'pengaturan.*.nilai' => ['nullable', 'string', 'max:4000'],
            'modul' => ['array', 'max:200'],
            'modul.*' => ['array:id,aplikasi,kode,nama,urutan,catatan,created_at,updated_at'],
            'modul.*.id' => ['required', 'integer', 'min:1', 'distinct'],
            'modul.*.aplikasi' => ['required', 'string', Rule::in(array_keys(PapanService::APLIKASI))],
            'modul.*.kode' => ['required', 'string', 'max:10', 'distinct'],
            'modul.*.nama' => ['required', 'string', 'max:200'],
            'modul.*.urutan' => ['required', 'integer', 'min:0'],
            'modul.*.catatan' => ['nullable', 'string', 'max:4000'],
            'modul.*.created_at' => ['required', 'date'],
            'modul.*.updated_at' => ['required', 'date'],
            'item' => ['array', 'max:1000'],
            'item.*' => ['array:id,modul_id,kode,nama,rujukan,urutan,created_at,updated_at'],
            'item.*.id' => ['required', 'integer', 'min:1', 'distinct'],
            'item.*.modul_id' => ['required', 'integer', 'min:1'],
            'item.*.kode' => ['required', 'string', 'max:12'],
            'item.*.nama' => ['required', 'string', 'max:200'],
            'item.*.rujukan' => ['nullable', 'string', 'max:255'],
            'item.*.urutan' => ['required', 'integer', 'min:0'],
            'item.*.created_at' => ['required', 'date'],
            'item.*.updated_at' => ['required', 'date'],
            'butir' => ['array', 'max:5000'],
            'butir.*' => ['array:id,item_id,status,deskripsi,urutan,keterangan,subpoin,catatan,scope_versi,created_at,updated_at'],
            'butir.*.id' => ['required', 'integer', 'min:1', 'distinct'],
            'butir.*.item_id' => ['required', 'integer', 'min:1'],
            'butir.*.status' => ['required', 'string', Rule::in(PapanService::STATUS)],
            'butir.*.deskripsi' => ['required', 'string', 'max:2000'],
            'butir.*.urutan' => ['required', 'integer', 'min:0'],
            'butir.*.keterangan' => ['nullable', 'string', 'max:2000'],
            'butir.*.subpoin' => ['nullable', 'array', 'max:30'],
            'butir.*.subpoin.*' => ['array:teks,selesai'],
            'butir.*.subpoin.*.teks' => ['required', 'string', 'max:500'],
            'butir.*.subpoin.*.selesai' => ['required', 'boolean'],
            'butir.*.catatan' => ['nullable', 'array', 'max:500'],
            'butir.*.catatan.*' => ['array:jenis,teks,oleh,versi_scope,scope,waktu'],
            'butir.*.catatan.*.jenis' => ['required', 'string', Rule::in(['persetujuan', 'revisi', 'verifikasi', 'keputusan', 'catatan'])],
            'butir.*.catatan.*.teks' => ['required', 'string', 'max:4000'],
            'butir.*.catatan.*.oleh' => ['required', 'string', 'max:40'],
            'butir.*.catatan.*.versi_scope' => ['required', 'integer', 'min:0'],
            'butir.*.catatan.*.scope' => ['sometimes', 'nullable', 'array:deskripsi,subpoin'],
            'butir.*.catatan.*.scope.deskripsi' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'butir.*.catatan.*.scope.subpoin' => ['sometimes', 'nullable', 'array', 'max:30'],
            'butir.*.catatan.*.scope.subpoin.*' => ['string', 'max:500'],
            'butir.*.catatan.*.waktu' => ['required', 'date'],
            'butir.*.scope_versi' => ['nullable', 'array', 'max:500'],
            'butir.*.scope_versi.*' => ['array:versi,jenis,deskripsi,subpoin,persetujuan,alasan,oleh,waktu'],
            'butir.*.scope_versi.*.versi' => ['required', 'integer', 'min:1'],
            'butir.*.scope_versi.*.jenis' => ['required', 'string', Rule::in(['legacy', 'awal', 'perubahan'])],
            'butir.*.scope_versi.*.deskripsi' => ['required', 'string', 'max:2000'],
            'butir.*.scope_versi.*.subpoin' => ['present', 'array', 'max:30'],
            'butir.*.scope_versi.*.subpoin.*' => ['string', 'max:500'],
            'butir.*.scope_versi.*.persetujuan' => ['nullable', 'string', 'max:4000'],
            'butir.*.scope_versi.*.alasan' => ['nullable', 'string', 'max:4000'],
            'butir.*.scope_versi.*.oleh' => ['required', 'string', 'max:40'],
            'butir.*.scope_versi.*.waktu' => ['required', 'date'],
            'butir.*.created_at' => ['required', 'date'],
            'butir.*.updated_at' => ['required', 'date'],
            'riwayat' => ['array', 'max:20000'],
            'riwayat.*' => ['array:id,item_id,butir_id,dari_status,ke_status,catatan,diubah_oleh,waktu'],
            'riwayat.*.id' => ['required', 'integer', 'min:1', 'distinct'],
            'riwayat.*.item_id' => ['required', 'integer', 'min:1'],
            'riwayat.*.butir_id' => ['nullable', 'integer', 'min:1'],
            'riwayat.*.dari_status' => ['nullable', 'string', Rule::in(PapanService::STATUS)],
            'riwayat.*.ke_status' => ['required', 'string', Rule::in(PapanService::STATUS)],
            'riwayat.*.catatan' => ['nullable', 'string', 'max:4000'],
            'riwayat.*.diubah_oleh' => ['required', 'string', 'max:40'],
            'riwayat.*.waktu' => ['required', 'date'],
        ];

        $validator = Validator::make($data, $aturan, [
            'required' => 'Field :attribute wajib diisi.',
            'present' => 'Field :attribute wajib ada.',
            'array' => 'Field :attribute harus berupa array.',
            'integer' => 'Field :attribute harus berupa bilangan bulat.',
            'string' => 'Field :attribute harus berupa teks.',
            'boolean' => 'Field :attribute harus berupa boolean.',
            'date' => 'Field :attribute harus berupa tanggal yang sah.',
            'in' => 'Nilai :attribute tidak dikenal.',
            'distinct' => 'Nilai :attribute ganda.',
            'max' => 'Field :attribute melebihi batas.',
            'min' => 'Field :attribute di bawah batas.',
        ]);
        if ($validator->fails()) {
            $this->gagal('File backup tidak sah: '.$validator->errors()->first());
        }

        $bersih = $validator->validated();
        $this->pastikanRelasi($bersih);

        return $bersih;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function ringkasan(array $data): array
    {
        $status = array_fill_keys(PapanService::STATUS, 0);
        foreach ($data['butir'] as $butir) {
            $status[$butir['status']]++;
        }

        $nilai = [];
        foreach ($data['pengaturan'] as $baris) {
            $nilai[$baris['kunci']] = $baris['nilai'];
        }

        $master = ($nilai['workflow_aktif'] ?? null) === '1';
        $aplikasi = [];
        foreach (PapanService::APLIKASI as $kode => $nama) {
            $aktif = ($nilai['workflow_aktif:'.$kode] ?? null) === '1';
            $aplikasi[] = ['kode' => $kode, 'nama' => $nama, 'aktif' => $aktif, 'efektif' => $master && $aktif];
        }

        return [
            'dibuat_pada' => $data['dibuat_pada'],
            'versi' => $data['versi'],
            'modul' => count($data['modul']),
            'sub_modul' => count($data['item']),
            'butir' => count($data['butir']),
            'riwayat' => count($data['riwayat']),
            'status' => $status,
            'workflow' => ['master' => $master, 'aplikasi' => $aplikasi],
        ];
    }

    /**
     * Ganti seluruh isi Board dengan data yang sudah divalidasi.
     *
     * @return array{ringkasan: array<string, mixed>, backup_keamanan: string}
     */
    public function pulihkan(string $json): array
    {
        $data = $this->urai($json);
        $ringkasan = $this->ringkasan($data);
        $berkasKeamanan = $this->simpanBackupKeamanan();

        DB::connection('papan')->transaction(function () use ($data) {
            foreach (['papan_riwayat', 'papan_butir', 'papan_item', 'papan_modul', 'papan_pengaturan'] as $tabel) {
                DB::connection('papan')->table($tabel)->delete();
            }

            $this->sisip('papan_pengaturan', array_map(fn (array $r) => [
                'kunci' => $r['kunci'],
                'nilai' => $r['nilai'],
            ], $data['pengaturan']));

            $this->sisip('papan_modul', array_map(fn (array $r) => [
                'id' => (int) $r['id'],
                'aplikasi' => $r['aplikasi'],
                'kode' => $r['kode'],
                'nama' => $r['nama'],
                'urutan' => (int) $r['urutan'],
                'catatan' => $r['catatan'],
                'created_at' => $this->waktuDb($r['created_at']),
                'updated_at' => $this->waktuDb($r['updated_at']),
            ], $data['modul']));

            $this->sisip('papan_item', array_map(fn (array $r) => [
                'id' => (int) $r['id'],
                'modul_id' => (int) $r['modul_id'],
                'kode' => $r['kode'],
                'nama' => $r['nama'],
                'rujukan' => $r['rujukan'],
                'urutan' => (int) $r['urutan'],
                'created_at' => $this->waktuDb($r['created_at']),
                'updated_at' => $this->waktuDb($r['updated_at']),
            ], $data['item']));

            $this->sisip('papan_butir', array_map(fn (array $r) => [
                'id' => (int) $r['id'],
                'item_id' => (int) $r['item_id'],
                'status' => $r['status'],
                'deskripsi' => $r['deskripsi'],
                'urutan' => (int) $r['urutan'],
                'keterangan' => $r['keterangan'],
                'subpoin' => $this->tulisJson($r['subpoin']),
                'catatan' => $this->tulisJson($r['catatan']),
                'scope_versi' => $this->tulisJson($r['scope_versi']),
                'created_at' => $this->waktuDb($r['created_at']),
                'updated_at' => $this->waktuDb($r['updated_at']),
            ], $data['butir']));

            $this->sisip('papan_riwayat', array_map(fn (array $r) => [
                'id' => (int) $r['id'],
                'item_id' => (int) $r['item_id'],
                'butir_id' => $r['butir_id'] === null ? null : (int) $r['butir_id'],
                'dari_status' => $r['dari_status'],
                'ke_status' => $r['ke_status'],
                'catatan' => $r['catatan'],
                'diubah_oleh' => $r['diubah_oleh'],
                'waktu' => $this->waktuDb($r['waktu']),
            ], $data['riwayat']));
        });

        return ['ringkasan' => $ringkasan, 'backup_keamanan' => $berkasKeamanan];
    }

    public function pathBackupKeamanan(string $berkas): ?string
    {
        $nama = basename($berkas);
        if ($nama !== $berkas || preg_match('/^'.preg_quote(self::PREFIKS_KEAMANAN, '/').'\d{8}-\d{6}\.json$/', $nama) !== 1) {
            return null;
        }

        $path = self::DIREKTORI.'/'.$nama;

        return Storage::disk('local')->exists($path) ? $path : null;
    }

    /** @param array<string, mixed> $data */
    private function pastikanRelasi(array $data): void
    {
        $modulIds = array_fill_keys(array_map(fn (array $r) => (int) $r['id'], $data['modul']), true);
        $itemIds = array_fill_keys(array_map(fn (array $r) => (int) $r['id'], $data['item']), true);
        $butirItem = [];
        foreach ($data['butir'] as $butir) {
            $butirItem[(int) $butir['id']] = (int) $butir['item_id'];
        }

        $kodeItem = [];
        foreach ($data['item'] as $item) {
            $modulId = (int) $item['modul_id'];
            if (! isset($modulIds[$modulId])) {
                $this->gagal("Item `{$item['kode']}` merujuk modul #{$modulId} yang tidak ada di file.");
            }

            $kunci = $modulId.'|'.$item['kode'];
            if (isset($kodeItem[$kunci])) {
                $this->gagal("Kode sub-modul `{$item['kode']}` ganda di modul #{$modulId}.");
            }
            $kodeItem[$kunci] = true;
        }

        foreach ($data['butir'] as $butir) {
            $itemId = (int) $butir['item_id'];
            if (! isset($itemIds[$itemId])) {
                $this->gagal("Poin #{$butir['id']} merujuk sub-modul #{$itemId} yang tidak ada di file.");
            }
        }

        foreach ($data['riwayat'] as $riwayat) {
            $itemId = (int) $riwayat['item_id'];
            if (! isset($itemIds[$itemId])) {
                $this->gagal("Riwayat #{$riwayat['id']} merujuk sub-modul #{$itemId} yang tidak ada di file.");
            }

            if ($riwayat['butir_id'] === null) {
                continue;
            }

            $butirId = (int) $riwayat['butir_id'];
            if (! isset($butirItem[$butirId])) {
                $this->gagal("Riwayat #{$riwayat['id']} merujuk poin #{$butirId} yang tidak ada di file.");
            }

            if ($butirItem[$butirId] !== $itemId) {
                $this->gagal("Riwayat #{$riwayat['id']} merujuk poin yang bukan milik sub-modul #{$itemId}.");
            }
        }
    }

    private function simpanBackupKeamanan(): string
    {
        $disk = Storage::disk('local');
        $nama = self::PREFIKS_KEAMANAN.now()->format('Ymd-His').'.json';
        $path = self::DIREKTORI.'/'.$nama;

        if (! $disk->put($path, $this->eksporJson())) {
            throw new RuntimeException('Backup keamanan gagal dibuat; restore dibatalkan.');
        }

        $this->pangkasBackupKeamanan($disk);

        return $nama;
    }

    private function pangkasBackupKeamanan(FilesystemAdapter $disk): void
    {
        $berkas = collect($disk->files(self::DIREKTORI))
            ->filter(fn (string $path) => preg_match('/^'.preg_quote(self::PREFIKS_KEAMANAN, '/').'\d{8}-\d{6}\.json$/', basename($path)) === 1)
            ->sort()
            ->values();

        if ($berkas->count() > self::SIMPAN_KEAMANAN) {
            $disk->delete($berkas->take($berkas->count() - self::SIMPAN_KEAMANAN)->all());
        }
    }

    /** @param list<array<string, mixed>> $baris */
    private function sisip(string $tabel, array $baris): void
    {
        foreach (array_chunk($baris, 50) as $potong) {
            DB::connection('papan')->table($tabel)->insert($potong);
        }
    }

    private function bacaJson(?string $nilai): mixed
    {
        if ($nilai === null || trim($nilai) === '') {
            return null;
        }

        try {
            return json_decode($nilai, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('Data JSON Board tidak dapat dibaca: '.$e->getMessage());
        }
    }

    private function tulisJson(mixed $nilai): ?string
    {
        if ($nilai === null) {
            return null;
        }

        return json_encode($nilai, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function waktuDb(string $nilai): string
    {
        return CarbonImmutable::parse($nilai)->format('Y-m-d H:i:s');
    }

    private function gagal(string $pesan): never
    {
        throw ValidationException::withMessages(['berkas' => $pesan]);
    }
}
