<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Models\Lembaga;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Master lembaga (single-pesantren, 004).
 * Identitas pesantren = baris root (kode=PESANTREN, parent_id=null).
 * Tenant: index via scopeTenantScope; aksi via canAccessLembaga.
 */
class LembagaController extends Controller
{
    use TenantGuard;
    use UrutDaftar;

    private const SORT_PETA = [
        'kode' => ['lembaga.kode'],
        'nama' => ['lembaga.nama'],
        'induk' => ['induk.nama'],
        'kelompok' => ['lembaga.kelompok_psb'],
        'seleksi' => ['lembaga.is_seleksi'],
        'id' => ['lembaga.id'],
    ];

    private const SORT_NULLABLE = ['lembaga.kode', 'induk.nama'];

    public function index(Request $request)
    {
        $urut = $this->parseUrut($request, self::SORT_PETA);

        $query = Lembaga::tenantScope()->with('parent:id,nama,kode');

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(fn ($q) => $q->where('nama', 'like', "%{$s}%")->orWhere('kode', 'like', "%{$s}%"));
        }

        if ($urut !== null) {
            $query->select('lembaga.*')
                ->leftJoin('lembaga as induk', 'induk.id', '=', 'lembaga.parent_id');
        }
        $this->terapkanUrut($query, $urut, [['lembaga.nama', 'naik']], self::SORT_NULLABLE);

        return response()->json($query->paginate($this->perPage($request)));
    }

    public function store(Request $request)
    {
        $auth = auth()->user();
        // Tambah lembaga hanya super_admin (Lampiran E v1.9.2).
        if (! $auth->bolehSuperAdmin()) {
            return response()->json(['message' => 'Hanya super_admin yang dapat menambah lembaga.'], 403);
        }

        $data = $request->validate([
            'parent_id' => ['nullable', 'exists:lembaga,id'],
            'nama' => ['required', 'string', 'max:100'],
            'nama_singkat' => ['nullable', 'string', 'max:50'],
            'kode' => ['nullable', 'string', 'max:20', Rule::unique('lembaga', 'kode')],
            'mudir_am' => ['nullable', 'string', 'max:100'],
            'jenjang' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'in:negeri,swasta'],
            'npsn' => ['nullable', 'string', 'max:20', Rule::unique('lembaga', 'npsn')],
            'nsm' => ['nullable', 'string', 'max:30', Rule::unique('lembaga', 'nsm')],
            'npwp' => ['nullable', 'string', 'max:30'],
            'no_izin_operasional' => ['nullable', 'string', 'max:100'],
            'tgl_izin' => ['nullable', 'date'],
            'no_sk_pendirian' => ['nullable', 'string', 'max:100'],
            'tgl_sk_pendirian' => ['nullable', 'date'],
            'tahun_berdiri' => ['nullable', 'integer', 'min:1800', 'max:2100'],
            'no_sk_kemenkumham' => ['nullable', 'string', 'max:100'],
            'akreditasi' => ['nullable', 'in:A,B,C,belum'],
            'tgl_akreditasi' => ['nullable', 'date'],
            'penyelenggara' => ['nullable', 'string', 'max:100'],
            'provinsi' => ['nullable', 'string', 'max:100'],
            'kab_kota' => ['nullable', 'string', 'max:100'],
            'kecamatan' => ['nullable', 'string', 'max:100'],
            'desa' => ['nullable', 'string', 'max:100'],
            'rt' => ['nullable', 'string', 'max:3'],
            'rw' => ['nullable', 'string', 'max:3'],
            'kode_pos' => ['nullable', 'string', 'max:10'],
            'alamat' => ['nullable', 'string'],
            'lintang' => ['nullable', 'numeric', 'between:-90,90'],
            'bujur' => ['nullable', 'numeric', 'between:-180,180'],
            'telepon' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:100'],
            'website' => ['nullable', 'string', 'max:100'],
            'logo_url' => ['nullable', 'string', 'max:255'],
            'waktu_belajar' => ['nullable', 'in:pagi,siang,pagi_siang'],
            'mode_rapor' => ['nullable', 'in:terpisah,digabung'],
            'template_rapor' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
            'kelompok_psb' => ['nullable', 'in:combo_mi_md,eksklusif'],
            'is_seleksi' => ['nullable', 'boolean'],
        ]);
        $this->pastikanKelompokSesuaiKode($data['kode'] ?? null, $data['kelompok_psb'] ?? null);

        if (! empty($data['parent_id'])) {
            $this->authorizeLembaga($auth, (int) $data['parent_id']);
        }

        $lembaga = Lembaga::create($data);

        return response()->json($lembaga->load('parent:id,nama,kode'), 201);
    }

    public function update(Request $request, Lembaga $lembaga)
    {
        $this->authorizeLembaga(auth()->user(), $lembaga->id);

        $data = $request->validate([
            'parent_id' => ['nullable', 'exists:lembaga,id'],
            'nama' => ['sometimes', 'string', 'max:100'],
            'nama_singkat' => ['nullable', 'string', 'max:50'],
            'kode' => ['nullable', 'string', 'max:20', Rule::unique('lembaga', 'kode')->ignore($lembaga->id)],
            'mudir_am' => ['nullable', 'string', 'max:100'],
            'jenjang' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'in:negeri,swasta'],
            'npsn' => ['nullable', 'string', 'max:20', Rule::unique('lembaga', 'npsn')->ignore($lembaga->id)],
            'nsm' => ['nullable', 'string', 'max:30', Rule::unique('lembaga', 'nsm')->ignore($lembaga->id)],
            'npwp' => ['nullable', 'string', 'max:30'],
            'no_izin_operasional' => ['nullable', 'string', 'max:100'],
            'tgl_izin' => ['nullable', 'date'],
            'no_sk_pendirian' => ['nullable', 'string', 'max:100'],
            'tgl_sk_pendirian' => ['nullable', 'date'],
            'tahun_berdiri' => ['nullable', 'integer', 'min:1800', 'max:2100'],
            'no_sk_kemenkumham' => ['nullable', 'string', 'max:100'],
            'akreditasi' => ['nullable', 'in:A,B,C,belum'],
            'tgl_akreditasi' => ['nullable', 'date'],
            'penyelenggara' => ['nullable', 'string', 'max:100'],
            'provinsi' => ['nullable', 'string', 'max:100'],
            'kab_kota' => ['nullable', 'string', 'max:100'],
            'kecamatan' => ['nullable', 'string', 'max:100'],
            'desa' => ['nullable', 'string', 'max:100'],
            'rt' => ['nullable', 'string', 'max:3'],
            'rw' => ['nullable', 'string', 'max:3'],
            'kode_pos' => ['nullable', 'string', 'max:10'],
            'alamat' => ['nullable', 'string'],
            'lintang' => ['nullable', 'numeric', 'between:-90,90'],
            'bujur' => ['nullable', 'numeric', 'between:-180,180'],
            'telepon' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:100'],
            'website' => ['nullable', 'string', 'max:100'],
            'logo_url' => ['nullable', 'string', 'max:255'],
            'waktu_belajar' => ['nullable', 'in:pagi,siang,pagi_siang'],
            'mode_rapor' => ['nullable', 'in:terpisah,digabung'],
            'template_rapor' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
            'kelompok_psb' => ['nullable', 'in:combo_mi_md,eksklusif'],
            'is_seleksi' => ['nullable', 'boolean'],
        ]);
        $this->pastikanKelompokSesuaiKode($data['kode'] ?? $lembaga->kode, $data['kelompok_psb'] ?? null);

        if (! empty($data['parent_id'])) {
            $this->authorizeLembaga(auth()->user(), (int) $data['parent_id']);
        }

        $lembaga->update($data);

        return response()->json($lembaga);
    }

    /** Combo MI-MD hanya untuk lembaga berkode MI/MD; selain itu eksklusif. */
    protected function pastikanKelompokSesuaiKode(?string $kode, ?string $kelompok): void
    {
        if ($kelompok !== 'combo_mi_md') {
            return;
        }
        if (! in_array(strtoupper((string) $kode), ['MI', 'MD'], true)) {
            throw ValidationException::withMessages([
                'kelompok_psb' => 'Combo MI-MD hanya untuk lembaga berkode MI atau MD.',
            ]);
        }
    }

    public function destroy(Lembaga $lembaga)
    {
        $auth = auth()->user();
        if (! $auth->can('lembaga.hapus')) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }
        $this->authorizeLembaga($auth, $lembaga->id);

        $lembaga->delete();

        return response()->json(['message' => 'Lembaga dihapus.']);
    }
}
