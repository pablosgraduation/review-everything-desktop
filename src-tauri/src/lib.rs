mod commands;
mod config;
mod difft;
mod git;
mod integrity;

mod processor;
mod review;
mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::preflight_check,
            commands::get_git_root,
            commands::get_log,
            commands::get_compare_items,
            commands::get_compare_old_items,
            commands::load_diff,
            commands::mark_reviewed,
            commands::unmark_reviewed,
            commands::get_review_status,
            commands::clear_all_reviews,
            commands::build_tree,
            commands::set_repo,
            commands::get_app_config,
            commands::remove_recent,
            commands::get_home_dir,
            commands::list_dirs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
