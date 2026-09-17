<?php

namespace App\Http\Requests\Admin;

use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

class RiwayatImportRequest extends FormRequest
{
    /** Cermin authorize('viewAny') controller agar 403 tetap sebelum validasi. */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('viewAny', Santri::class);
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ];
    }
}
