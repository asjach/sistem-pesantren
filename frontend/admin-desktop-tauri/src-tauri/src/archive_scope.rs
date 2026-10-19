use std::path::{Component, PathBuf};
use tauri::Manager;
use tauri_plugin_fs::FsExt;
use tauri_plugin_store::StoreExt;

/// Hanya akar preferensi arsip dan folder `sudah` dari berkas pilihan dialog.
#[tauri::command]
pub fn siapkan_akses_arsip(app: tauri::AppHandle, sumber: Option<String>) -> Result<(), String> {
    let scope = app.fs_scope();
    if let Some(sumber) = sumber {
        let path = PathBuf::from(sumber);
        if !path.is_absolute()
            || path.components().any(|c| c == Component::ParentDir)
            || !scope.is_allowed(&path)
            || !path.is_file()
        {
            return Err("Pilih berkas sumber melalui dialog terlebih dahulu.".into());
        }
        let parent = path.parent().ok_or("Folder sumber tidak valid.")?;
        return scope
            .allow_directory(parent.join("sudah"), true)
            .map_err(|_| "Folder tujuan berkas sumber tidak dapat diakses.".into());
    }

    let home = app.path().home_dir().map_err(|_| "Folder pengguna tidak tersedia.")?;
    let store = app.store("simpes.dat").map_err(|_| "Preferensi arsip tidak dapat dibaca.")?;
    for key in ["simpes_folder_arsip", "simpes_folder_arsip_test"] {
        if let Some(value) = store.get(key) {
            if let Some(raw) = value.as_str().filter(|v| !v.trim().is_empty()) {
                let path = PathBuf::from(raw);
                let efektif = path.canonicalize().unwrap_or_else(|_| path.clone());
                if !path.is_absolute()
                    || path.components().any(|c| c == Component::ParentDir)
                    || path.parent().is_none()
                    || home.starts_with(&efektif)
                {
                    return Err("Pilih subfolder khusus arsip, bukan akar drive atau folder pengguna.".into());
                }
                scope.allow_directory(&path, true)
                    .map_err(|_| "Folder arsip tidak dapat diakses.".to_string())?;
            }
        }
    }
    Ok(())
}
