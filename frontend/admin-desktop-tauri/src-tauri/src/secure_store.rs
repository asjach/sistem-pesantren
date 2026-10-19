use keyring::Entry;

const SERVICE: &str = "id.or.pesantren.simpes.admin";

fn entry_for(key: &str) -> Result<Entry, String> {
    if key != "simpes_token" {
        return Err("Kunci penyimpanan aman tidak didukung.".into());
    }
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        Entry::new(SERVICE, key).map_err(|e| format!("keyring entry gagal: {e}"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Penyimpanan aman persisten belum tersedia pada sistem ini.".into())
    }
}

#[tauri::command]
pub fn secure_get(key: String) -> Result<Option<String>, String> {
    match entry_for(&key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("secure_get gagal: {e}")),
    }
}

#[tauri::command]
pub fn secure_set(key: String, value: String) -> Result<(), String> {
    if value.is_empty() || value.len() > 4096 {
        return Err("Token penyimpanan aman tidak valid.".into());
    }
    entry_for(&key)?
        .set_password(&value)
        .map_err(|e| format!("secure_set gagal: {e}"))
}

#[tauri::command]
pub fn secure_delete(key: String) -> Result<(), String> {
    match entry_for(&key)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("secure_delete gagal: {e}")),
    }
}
