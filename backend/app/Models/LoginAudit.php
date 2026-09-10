<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoginAudit extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'identifier', 'ip', 'user_agent', 'sukses',
    ];

    protected function casts(): array
    {
        return ['sukses' => 'boolean'];
    }
}
