<?php

namespace App\Services;

use App\Models\Lembaga;
use App\Models\TahunAjaran;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class HapusMasterService
{
    public function hapusLembaga(string $jenjang): void
    {
        try {
            DB::transaction(function () use ($jenjang): void {
                Lembaga::query()->whereKey($jenjang)->lockForUpdate()->firstOrFail();
                $referensi = $this->referensi('lembaga', 'jenjang', ['jenjang', 'lembaga', 'lembaga_lulus']);
                $penggunaan = $this->penggunaan($referensi, $jenjang);
                if ($penggunaan !== []) {
                    $this->tolakLembaga($penggunaan);
                }
                $hapus = Lembaga::query()->whereKey($jenjang);
                foreach ($referensi as $rujukan) {
                    $hapus->whereNotExists(fn (Builder $query) => $this->cocokkan($query, $rujukan, $jenjang));
                }
                if ($hapus->delete() !== 1) {
                    $this->tolakLembaga($this->penggunaan($referensi, $jenjang));
                }
            });
        } catch (QueryException $e) {
            if (! $this->galatForeignKey($e)) {
                throw $e;
            }
            $this->tolakLembaga([]);
        }
    }

    public function hapusTahunAjaran(string $nama): void
    {
        try {
            DB::transaction(function () use ($nama): void {
                $tahun = TahunAjaran::query()->whereKey($nama)->lockForUpdate()->firstOrFail();
                if ($tahun->is_aktif) {
                    throw ValidationException::withMessages(['nama' => 'Tahun ajaran aktif tidak boleh dihapus.']);
                }
                $referensi = $this->referensi('tahun_ajaran', 'nama', ['tahun_ajaran', 'tahun_ajaran_lulus', 'tahaj_masuk'], ['lembaga_tahun_ajaran'], ['tagihan' => ['periode']]);
                $penggunaan = $this->penggunaan($referensi, $nama);
                if ($penggunaan !== []) {
                    $this->tolakTahunAjaran($penggunaan);
                }

                // Ulangi syarat pada statement DELETE agar reference teks yang
                // masuk sesudah precheck tidak lolos melalui celah check/delete.
                $hapus = TahunAjaran::query()->whereKey($nama)->where('is_aktif', false);
                foreach ($referensi as $rujukan) {
                    $hapus->whereNotExists(fn (Builder $query) => $this->cocokkan($query, $rujukan, $nama));
                }
                if ($hapus->delete() !== 1) {
                    $this->tolakTahunAjaran($this->penggunaan($referensi, $nama));
                }
            });
        } catch (QueryException $e) {
            if (! $this->galatForeignKey($e)) {
                throw $e;
            }
            $this->tolakTahunAjaran([]);
        }
    }

    /**
     * FK dibaca dari skema aktual; reference teks bisnis ditambahkan eksplisit.
     * Tidak memakai tenant scope: master global harus memeriksa semua lembaga.
     *
     * @param  list<string>  $kolomTeks
     * @param  list<string>  $abaikan
     * @param  array<string, list<string>>  $tambahan
     * @return list<array{tabel: string, kolom: list<string>}>
     */
    private function referensi(string $master, string $kunci, array $kolomTeks, array $abaikan = [], array $tambahan = []): array
    {
        $referensi = [];
        foreach (Schema::getTables() as $tabel) {
            $nama = $tabel['name'];
            if ($nama === $master || in_array($nama, $abaikan, true)) {
                continue;
            }
            $kolom = array_intersect(Schema::getColumnListing($nama), [...$kolomTeks, ...($tambahan[$nama] ?? [])]);
            foreach (Schema::getForeignKeys($nama) as $fk) {
                if ($fk['foreign_table'] !== $master) {
                    continue;
                }
                foreach ($fk['foreign_columns'] as $i => $kolomMaster) {
                    if ($kolomMaster === $kunci) {
                        $kolom[] = $fk['columns'][$i];
                    }
                }
            }
            if ($kolom !== []) {
                $referensi[] = ['tabel' => $nama, 'kolom' => array_values(array_unique($kolom))];
            }
        }

        return $referensi;
    }

    /** @param array{tabel: string, kolom: list<string>} $referensi */
    private function cocokkan(Builder $query, array $referensi, string $nilai): void
    {
        $query->selectRaw('1')->from($referensi['tabel'])->where(function (Builder $query) use ($referensi, $nilai): void {
            foreach ($referensi['kolom'] as $kolom) {
                $query->orWhere($referensi['tabel'].'.'.$kolom, $nilai);
            }
        });
    }

    /**
     * @param  list<array{tabel: string, kolom: list<string>}>  $referensi
     * @return list<string>
     */
    private function penggunaan(array $referensi, string $nilai): array
    {
        $penggunaan = [];
        foreach ($referensi as $rujukan) {
            $query = DB::query();
            $this->cocokkan($query, $rujukan, $nilai);
            if ($query->lockForUpdate()->exists()) {
                $penggunaan[] = $this->kategori($rujukan['tabel']);
            }
        }

        return array_values(array_unique($penggunaan));
    }

    private function kategori(string $tabel): string
    {
        return match ($tabel) {
            'lembaga_santri' => 'keanggotaan santri',
            'lembaga_pegawai' => 'penempatan pegawai',
            'user_lembaga' => 'akses pengguna',
            default => str_starts_with($tabel, 'ref_')
                ? 'kamus referensi '.str_replace('_', ' ', substr($tabel, 4))
                : str_replace('_', ' ', $tabel),
        };
    }

    /** @param list<string> $penggunaan */
    private function tolakTahunAjaran(array $penggunaan): never
    {
        $detail = $penggunaan === [] ? 'data terkait' : implode(', ', $penggunaan);
        throw ValidationException::withMessages([
            'nama' => 'Tahun ajaran tidak dapat dihapus karena masih digunakan oleh '.$detail.'. Gunakan Sembunyikan untuk mengatur tampilannya pada lembaga terkait.',
        ]);
    }

    /** @param list<string> $penggunaan */
    private function tolakLembaga(array $penggunaan): never
    {
        $detail = $penggunaan === [] ? 'data terkait' : implode(', ', $penggunaan);
        throw ValidationException::withMessages([
            'jenjang' => 'Lembaga tidak dapat dihapus karena masih digunakan oleh '.$detail.'. Nonaktifkan lembaga melalui editor jika sudah tidak digunakan.',
        ]);
    }

    private function galatForeignKey(QueryException $exception): bool
    {
        $kode = (int) ($exception->errorInfo[1] ?? 0);

        return $kode === 1451 || (in_array($kode, [19, 787], true)
            && str_contains(strtolower((string) ($exception->errorInfo[2] ?? '')), 'foreign key constraint'));
    }
}
