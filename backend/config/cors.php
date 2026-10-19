<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_unique(array_merge(
        ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'],
        env('APP_ENV', 'production') === 'local' ? ['http://127.0.0.1:1420', 'http://localhost:1420'] : [],
        array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')))),
    ))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
