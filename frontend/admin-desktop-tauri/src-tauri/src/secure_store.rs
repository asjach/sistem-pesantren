use keyring::Entry;

const SERVICE: &str = "id.or.pesantren.simpes.admin";

fn entry_for(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| format!("keyring entry gagal: {e}"))
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
