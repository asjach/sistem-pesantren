<?php

namespace App\Support;

use App\Services\PapanService;

/**
 * Penghasil markdown papan perkembangan proyek.
 *
 * Modul dihasilkan dari isi papan (modul -> sub-modul -> butir, lengkap
 * dengan status). Bagian "SEDANG DIKERJAKAN" dan "RINCIAN TEKNIS LAINNYA"
 * **bukan** data papan, jadi dipertahankan dari berkas lama.
 *
 * Dengan begitu `PETA-MODUL.md` selalu turunan yang setia: sekali
 * `papan:markdown` dijalankan, markdown tidak mungkin lagi basi.
 */
class PapanMarkdown
{
    /** Penanda awal bagian yang dihasilkan dari Board (per aplikasi). */
    public const PENANDA_AWAL = '# Aplikasi: ';

    /** Judul bagian pertama yang bukan data papan; sisanya dipertahankan. */
    public const PENANDA_EKOR = '# SEDANG DIKERJAKAN';

    /** Awal bagian rincian teknis yang dipertahankan dari berkas lama. */
    public const PENANDA_RINCIAN = '# RINCIAN TEKNIS LAINNYA';

    public function __construct(private readonly PapanService $papan) {}

    /**
     * Hasilkan markdown lengkap: kepala + modul dari papan + ekor lama.
     *
     * @param  string  $kepala  bagian sebelum "# A. " (header, cara baca, dst.)
     * @param  string  $ekor  bagian mulai "# SEDANG DIKERJAKAN" ke bawah
     */
    public function hasilkan(string $kepala, string $ekor): string
    {
        $potongan = [rtrim($this->normalisasiKepalaWorkflow($kepala)), '', $this->bagianModul(), $this->bagianSedang()];

        return implode("\n", $potongan).$this->ekorTanpaBagianSedang($ekor)."\n";
    }

    /**
     * Bagian "SEDANG DIKERJAKAN" dihasilkan dari sub-modul berstatus In Progress,
     * supaya tidak bisa lagi bilang "Kosong" padahal ada pekerjaan berjalan.
     */
    public function bagianSedang(): string
    {
        $sedang = [];

        foreach ($this->papan->semua() as $modul) {
            foreach ($modul['sub'] as $sub) {
                if ($sub['status'] === 'in_progress') {
                    $sedang[] = "- **{$sub['kode']} {$sub['nama']}** ({$modul['nama']})";
                }
            }
        }

        $isi = $sedang === []
            ? ['**Kosong.** Tidak ada sub-modul yang disetujui sebagai pekerjaan berjalan.']
            : ['Sub-modul yang sedang dikerjakan:', '', ...$sedang];

        return implode("\n", [self::PENANDA_EKOR, '', ...$isi, '', '---', '', '']);
    }

    /**
     * Buang bagian "SEDANG DIKERJAKAN" dari ekor lama, sisakan rincian teknis.
     *
     * @throws \RuntimeException bila penanda rincian tidak ada — lebih baik
     *                           gagal terang-terangan daripada membuang isinya
     *                           tanpa suara saat menulis ulang.
     */
    private function ekorTanpaBagianSedang(string $ekor): string
    {
        $awal = strpos($ekor, self::PENANDA_RINCIAN);

        if ($awal === false) {
            throw new \RuntimeException(
                'Bagian `'.self::PENANDA_RINCIAN.'` tidak ditemukan di ekor berkas peta; menulis ulang akan membuang isinya.'
            );
        }

        return rtrim(substr($ekor, $awal));
    }

    /** Markdown untuk seluruh aplikasi beserta modul, sub-modul, dan butirnya. */
    public function bagianModul(): string
    {
        $blok = [];

        foreach ($this->papan->semuaAplikasi() as $aplikasi) {
            if ($blok !== []) {
                $blok[] = '---';
                $blok[] = '';
            }

            $blok[] = self::PENANDA_AWAL.$aplikasi['nama'];

            if ($aplikasi['modul'] === []) {
                $blok[] = '';
                $blok[] = '- (kosong)';

                continue;
            }

            foreach ($aplikasi['modul'] as $modul) {
                $blok[] = '';
                $blok[] = '## '.$modul['kode'].'. '.$modul['nama'];

                if (is_string($modul['catatan'] ?? null) && trim($modul['catatan']) !== '') {
                    $blok[] = '';
                    $blok[] = trim($modul['catatan']);
                }

                foreach ($modul['sub'] as $sub) {
                    $blok[] = '';
                    $blok[] = $this->subModul($sub);
                }
            }
        }

        return implode("\n", $blok)."\n";
    }

    /**
     * Satu sub-modul: judul, lalu blok status berisi butirnya.
     *
     * @param  array<string, mixed>  $sub
     */
    private function subModul(array $sub): string
    {
        // Status sub-modul adalah TURUNAN dari poin-poinnya (lihat
        // PapanService::statusTurunan). Ditulis di judul supaya pembaca
        // markdown langsung tahu sampai mana sub-modul ini, tanpa harus
        // menghitung sendiri sebaran poin di bawahnya.
        $statusJudul = PapanService::LABEL_STATUS[$sub['status']] ?? $sub['status'];
        $petik = chr(96);
        $baris = ["### {$sub['kode']} {$sub['nama']} {$petik}{$statusJudul}{$petik}"];

        foreach (PapanService::STATUS as $status) {
            $butir = $this->butirBerstatus($sub, $status);

            $baris[] = '**'.(PapanService::LABEL_STATUS[$status] ?? $status).'**';

            if ($butir === []) {
                $baris[] = '- (kosong)';

                continue;
            }

            foreach ($butir as $b) {
                $baris[] = '- '.$b['deskripsi'];
                foreach ($b['subpoin'] ?? [] as $subpoin) {
                    $teks = is_array($subpoin) ? (string) ($subpoin['teks'] ?? '') : (string) $subpoin;
                    $selesai = is_array($subpoin) && (bool) ($subpoin['selesai'] ?? false);

                    if ($teks === '') {
                        continue;
                    }

                    $baris[] = '  - ['.($selesai ? 'x' : ' ').'] '.$teks;
                }
            }
        }

        return implode("\n", $baris);
    }

    /** Selaraskan bagian statis lama tanpa mengedit PETA-MODUL secara manual. */
    private function normalisasiKepalaWorkflow(string $kepala): string
    {
        $hasil = strtr($kepala, [
            "disusul To Do, Backlog, dan For Review; sub-modul menjadi Done hanya bila semua\n".
            'poinnya sudah Done.' => "disusul To Do, Backlog, dan For Review; sub-modul menjadi Done hanya bila semua\n".
                'poinnya sudah Done.',
            "Lima status workflow dipakai konsisten di seluruh berkas:\n\n".
            "- **Backlog** — belum siap dijadwalkan atau masih ditahan.\n".
            "- **To Do** — siap dikerjakan.\n".
            "- **In Progress** — sedang dikerjakan.\n".
            "- **For Review** — implementasi selesai dan menunggu peninjauan.\n".
            '- **Done** — pekerjaan dan seluruh subpoin sudah selesai.' => "Lima status alur kerja (workflow) dipakai konsisten di seluruh berkas:\n\n".
                "- **Backlog** — belum siap dijadwalkan atau masih ditahan.\n".
                "- **To Do** — siap dikerjakan.\n".
                "- **In Progress** — sedang dikerjakan.\n".
                "- **For Review** — implementasi selesai dan menunggu peninjauan.\n".
                '- **Done** — pekerjaan dan seluruh subpoin sudah selesai.',
            'kolom **Done** dan **To Do** bersamaan' => 'kolom **Done** dan **To Do** bersamaan',
            '**Status workflow:**' => '**Status alur kerja (workflow):**',
            'Workflow hanya menjadi rujukan' => 'Alur kerja (workflow) hanya menjadi rujukan',
            'status efektif = master + flag aplikasi' => 'status efektif = pengaturan utama (master) + penanda aplikasi (flag)',
            '(`backlog` | `todo` | `in_progress` | `for_review` | `done`)' => '(`backlog` | `todo` | `in_progress` | `for_review` | `done`)',
            "(`sudah` | `sedang` | `akan` | `ditunda`), dan status sub-modul **dihitung otomatis**\n".
            "dari poin-poinnya: ada poin `sedang` → sub-modul `sedang`; kalau tidak, ada poin\n".
            "`akan` → `akan`; semua `ditunda` → `ditunda`; selain itu (semua sudah) → `sudah`.\n".
            'Jadi satu poin yang belum selesai sudah cukup menahan sub-modul tetap `akan`.' => "(`backlog` | `todo` | `in_progress` | `for_review` | `done`), dan status\n".
                "sub-modul **dihitung otomatis** dari poin-poinnya. Pekerjaan aktif didahulukan,\n".
                "disusul To Do, Backlog, dan For Review; sub-modul menjadi Done hanya bila semua\n".
                'poinnya sudah Done.',
            "Empat status dipakai konsisten di seluruh berkas:\n\n".
            "- **SUDAH** — kode ada, terhubung, dipakai dari UI.\n".
            "- **SEDANG** — dikerjakan sekarang. Hanya boleh **satu** sub-modul bertanda ini.\n".
            "- **AKAN** — belum ada kode, sudah dirancang cukup untuk dikerjakan.\n".
            "- **DITUNDA** — belum dikerjakan dan sengaja ditunda; bisa karena masih rencana\n".
                '  awal atau menunggu pelaksanaan pasca production.' => "Lima status alur kerja (workflow) dipakai konsisten di seluruh berkas:\n\n".
                "- **Backlog** — belum siap dijadwalkan atau masih ditahan.\n".
                "- **To Do** — siap dikerjakan.\n".
                "- **In Progress** — sedang dikerjakan.\n".
                "- **For Review** — implementasi selesai dan menunggu peninjauan.\n".
                '- **Done** — pekerjaan dan seluruh subpoin sudah selesai.',
            '`sudah`' => '`done`',
            '`sedang`' => '`in_progress`',
            '`akan`' => '`todo`',
            '`ditunda`' => '`backlog`',
            'Empat status dipakai konsisten' => 'Lima status alur kerja (workflow) dipakai konsisten',
            '**SUDAH**' => '**Done**',
            '**SEDANG**' => '**In Progress**',
            '**AKAN**' => '**To Do**',
            '**DITUNDA**' => '**Backlog**',
            '**Status timeline:**' => '**Status alur kerja (workflow):**',
            'Timeline hanya menjadi rujukan' => 'Alur kerja (workflow) hanya menjadi rujukan',
            'papan:tandai E.3 128 sedang' => 'papan:tandai E.3 128 in_progress',
            'kolom **Sudah** dan **Akan** bersamaan' => 'kolom **Done** dan **To Do** bersamaan',
            'dan tandai SEDANG.' => 'dan pindahkan ke In Progress.',
        ]);

        return strtr($hasil, [
            'Belum dijadwalkan (Backlog)' => 'Backlog',
            'Siap dikerjakan (To Do)' => 'To Do',
            'Sedang dikerjakan (In Progress)' => 'In Progress',
            'Menunggu peninjauan (For Review)' => 'For Review',
            'Selesai (Done)' => 'Done',
            'belum dijadwalkan (Backlog)' => 'Backlog',
            'siap dikerjakan (To Do)' => 'To Do',
            'sedang dikerjakan (In Progress)' => 'In Progress',
            "menunggu\npeninjauan (For Review)" => 'For Review',
            'selesai (Done)' => 'Done',
            'belum dijadwalkan (`backlog`) | siap dikerjakan (`todo`) | sedang dikerjakan (`in_progress`) | menunggu peninjauan (`for_review`) | selesai (`done`)' => '`backlog` | `todo` | `in_progress` | `for_review` | `done`',
            '((`backlog` | `todo` | `in_progress` | `for_review` | `done`))' => '(`backlog` | `todo` | `in_progress` | `for_review` | `done`)',
        ]);
    }

    /**
     * Butir milik sebuah sub-modul dengan status tertentu.
     *
     * @param  array<string, mixed>  $sub
     * @return array<int, array<string, mixed>>
     */
    private function butirBerstatus(array $sub, string $status): array
    {
        return array_values(array_filter(
            $sub['butir'],
            fn (array $b) => $b['status'] === $status,
        ));
    }

    /**
     * Potong berkas markdown lama jadi kepala dan ekor.
     *
     * @return array{0: string, 1: string} [kepala sebelum "# A. ", ekor dari "# H. "]
     */
    public static function potong(string $isi): array
    {
        $awalModul = strpos($isi, self::PENANDA_AWAL);
        $awalEkor = strpos($isi, self::PENANDA_EKOR);

        if ($awalModul === false || $awalEkor === false || $awalEkor < $awalModul) {
            throw new \RuntimeException(
                'Berkas peta tidak memuat penanda \`'.self::PENANDA_AWAL.'\` dan \`'.self::PENANDA_EKOR.'\`; tidak bisa dipotong.'
            );
        }

        return [substr($isi, 0, $awalModul), substr($isi, $awalEkor)];
    }
}
