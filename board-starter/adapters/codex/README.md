# Adapter opsional untuk Codex

Board dan role Markdown dapat digunakan tanpa adapter ini. Folder `.codex/`
di sini adalah contoh konfigurasi native; letaknya sengaja tidak berada di
root paket agar tidak otomatis menjadi konfigurasi seluruh project.

## Memasang jika dipilih

1. Gunakan root project tujuan yang memuat `AGENTS.md`, `KRU.md`, `HARNESS.md`,
   dan dokumen inti lain.
2. Salin `.codex/agents/` dari folder adapter ini ke `.codex/agents/` di root
   project tujuan. Gabungkan dengan konfigurasi yang sudah ada; jangan menimpa
   profil bernama sama tanpa memeriksanya.
3. Gabungkan pengaturan yang diperlukan dari `.codex/config.toml` adapter ke
   konfigurasi project yang sudah ada. Batas tiga sub-agent adalah batas
   maksimum konfigurasi, bukan perintah menjalankan semua role.
4. Gunakan mekanisme trust/reload yang didukung versi Codex yang dipakai.
   Jika profil tidak tersedia, gunakan role Markdown dan fallback `HARNESS.md`.

Jangan memasang adapter ini pada harness lain dengan menganggap schema TOML
tersebut universal. Untuk harness lain, muat dokumen inti melalui mekanisme
instruksi yang benar-benar tersedia.

Role tetap bersumber dari `KRU.md`; file TOML hanya memetakan nama, deskripsi,
dan instruksi role ke konfigurasi native. Saat aturan inti berubah, selaraskan
adapter yang dipakai agar tidak bertentangan. Instruksi inti mengarahkan agen
utama menjadi Luffy; file `luffy.toml` sendiri tidak otomatis memilih agen utama.

Tidak ada model, reasoning effort, provider, atau credential hardcoded.
Pengaturan model mengikuti pilihan pengguna dan resolusi konfigurasi harness.
Izin, sandbox, tool, batas penggunaan, dan dukungan multi-agent tetap milik
lingkungan; adapter tidak menambah izin atau menjalankan AI dari Board.

Format ini mengacu pada [dokumentasi resmi custom subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
