<?php

namespace App\Http\Requests;

use App\Models\PsbCalonSantri;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class PsbDokumenUploadCalonRequest extends FormRequest
{
    /** Pemilik calon (wali) dipindah ke authorize() agar 403 sebelum 422. */
    public function authorize(): bool
    {
        $calon = $this->route('calon');
        $user = $this->user();

        return $calon instanceof PsbCalonSantri
            && $user instanceof User
            && $calon->milikWali($user);
    }

    public function rules(): array
    {
        return [
            'jenis_dokumen_santri' => ['required', 'string', 'max:50'],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'catatan' => ['nullable', 'string'],
        ];
    }
}
