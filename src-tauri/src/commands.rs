//! Tauri IPC command handlers: expose git/diff/review logic to the frontend.

use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use serde::Serialize;

use crate::config;
use crate::difft;
use crate::git;
use crate::integrity;
use crate::processor;
use crate::review;
use crate::types::{DisplayFile, FileStatus};

// --- IPC response types ---

#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub full_hash: String,
    pub short_hash: String,
    pub date: String,
    pub subject: String,
}

impl From<git::LogEntry> for LogEntry {
    fn from(e: git::LogEntry) -> Self {
        Self {
            full_hash: e.full_hash,
            short_hash: e.short_hash,
            date: e.date,
            subject: e.subject,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LogItem {
    pub kind: String, // "working_tree", "staged", "separator", "commit"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry: Option<LogEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffContext {
    pub left: String,
    pub right: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffResult {
    pub files: Vec<DisplayFile>,
    pub scope: String,
    pub context: DiffContext,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReviewState {
    pub reviewed_indices: Vec<usize>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompareItem {
    pub rev: String,
    pub label: String,
    pub is_special: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_idx: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<FileStatus>,
    pub additions: u32,
    pub deletions: u32,
    pub children: Vec<TreeNode>,
    pub expanded: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub moved_from: Option<String>,
}

// --- Commands ---

/// Pre-flight check: verify git repo and difft are available.
#[tauri::command]
pub fn preflight_check() -> Result<(), String> {
    git::git_root().map_err(|e| format!("Not a git repository: {e}"))?;

    let output = std::process::Command::new(difft_path())
        .arg("--version")
        .output()
        .map_err(|_| "difft binary not found. The app may not be installed correctly.".to_string())?;

    if !output.status.success() {
        return Err("difft --version failed. The app may not be installed correctly.".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_git_root() -> Result<String, String> {
    git::git_root().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_log() -> Result<Vec<LogItem>, String> {
    let entries = git::git_log(200)?;
    let has_unstaged = git::has_unstaged_changes();
    let has_staged = git::has_staged_changes();

    let mut items = Vec::new();
    if has_unstaged {
        items.push(LogItem { kind: "working_tree".into(), entry: None });
    }
    if has_staged {
        items.push(LogItem { kind: "staged".into(), entry: None });
    }
    if has_unstaged || has_staged {
        items.push(LogItem { kind: "separator".into(), entry: None });
    }
    for e in entries {
        items.push(LogItem {
            kind: "commit".into(),
            entry: Some(e.into()),
        });
    }
    Ok(items)
}

#[tauri::command]
pub fn get_compare_items() -> Vec<CompareItem> {
    let mut items = Vec::new();
    if git::has_unstaged_changes() {
        items.push(CompareItem {
            rev: "--working-tree".into(),
            label: "Working Tree".into(),
            is_special: true,
            short_hash: None, date: None, subject: None,
        });
    }
    if git::has_staged_changes() {
        items.push(CompareItem {
            rev: "--staged".into(),
            label: "Staged".into(),
            is_special: true,
            short_hash: None, date: None, subject: None,
        });
    }
    if let Ok(entries) = git::git_log(200) {
        for e in entries {
            items.push(CompareItem {
                rev: e.full_hash.clone(),
                label: format!("{} {} {}", e.short_hash, e.date, truncate(&e.subject, 30)),
                is_special: false,
                short_hash: Some(e.short_hash),
                date: Some(e.date),
                subject: Some(e.subject),
            });
        }
    }
    items
}

#[tauri::command]
pub fn get_compare_old_items(new_rev: String) -> Vec<CompareItem> {
    let mut items = Vec::new();
    if new_rev == "--working-tree" {
        items.push(CompareItem {
            rev: "--index".into(),
            label: "Staged".into(),
            is_special: true,
            short_hash: None, date: None, subject: None,
        });
    }
    let revspec = if new_rev.starts_with("--") { None } else { Some(new_rev.as_str()) };
    if let Ok(entries) = git::git_log_revspec(200, revspec) {
        for e in entries {
            if e.full_hash == new_rev { continue; }
            items.push(CompareItem {
                rev: e.full_hash.clone(),
                label: format!("{} {} {}", e.short_hash, e.date, truncate(&e.subject, 30)),
                is_special: false,
                short_hash: Some(e.short_hash),
                date: Some(e.date),
                subject: Some(e.subject),
            });
        }
    }
    items
}

/// Load a diff. `mode` is one of: "staged", "unstaged", "range:<revspec>",
/// "working-tree:<commit>", "staged-vs-commit:<commit>".
#[tauri::command]
pub fn load_diff(mode: String) -> Result<DiffResult, String> {
    let diff_mode = parse_diff_mode(&mode)?;
    let scope = diff_mode.scope_key();
    let context = diff_mode.context_label();
    let completed = Arc::new(AtomicUsize::new(0));
    let files = run_diff_background(diff_mode, completed)?;
    Ok(DiffResult { files, scope, context })
}

#[tauri::command]
pub fn mark_reviewed(scope: String, path: String, hash: u64) {
    if let Some(store) = open_review_store() {
        store.mark(&scope, &path, hash);
    }
}

#[tauri::command]
pub fn unmark_reviewed(scope: String, path: String) {
    if let Some(store) = open_review_store() {
        store.unmark(&scope, &path);
    }
}

#[tauri::command]
pub fn get_review_status(scope: String, files: Vec<DisplayFile>) -> ReviewState {
    let store = open_review_store();
    let indices = if let Some(store) = store {
        store.reviewed_set(&scope, &files).into_iter().collect()
    } else {
        Vec::new()
    };
    ReviewState { reviewed_indices: indices }
}

#[tauri::command]
pub fn clear_all_reviews() {
    if let Some(store) = open_review_store() {
        store.clear_all();
    }
}

#[tauri::command]
pub fn build_tree(files: Vec<DisplayFile>) -> Vec<TreeNode> {
    build_tree_from_files(&files)
}

#[tauri::command]
pub fn set_repo(path: String) -> Result<String, String> {
    let expanded = if path.starts_with('~') {
        let home = config::get_home_dir();
        format!("{}{}", home, &path[1..])
    } else {
        path
    };
    let canonical = std::fs::canonicalize(&expanded)
        .map_err(|e| format!("Invalid path: {e}"))?;
    let canonical_str = canonical.to_string_lossy().to_string();

    // Validate git repo by running git rev-parse in the target directory
    let git_check = std::process::Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(&canonical)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;
    if !git_check.status.success() {
        return Err(format!("Not a git repository: {canonical_str}"));
    }

    // Validate difft is available
    let difft_check = std::process::Command::new(difft_path())
        .arg("--version")
        .output()
        .map_err(|_| "difft binary not found. The app may not be installed correctly.".to_string())?;
    if !difft_check.status.success() {
        return Err("difft --version failed. The app may not be installed correctly.".to_string());
    }

    // Change process cwd — all git commands use this implicitly
    std::env::set_current_dir(&canonical)
        .map_err(|e| format!("Failed to set working directory: {e}"))?;

    // Update config
    let mut cfg = config::load_config();
    cfg.last_repo = Some(canonical_str.clone());
    cfg.recent_repos.retain(|r| r != &canonical_str);
    cfg.recent_repos.insert(0, canonical_str.clone());
    cfg.recent_repos.truncate(10);
    config::save_config(&cfg);

    Ok(canonical_str)
}

#[tauri::command]
pub fn get_app_config() -> config::AppConfig {
    config::load_config()
}

#[tauri::command]
pub fn remove_recent(path: String) -> config::AppConfig {
    let mut cfg = config::load_config();
    cfg.recent_repos.retain(|r| r != &path);
    if cfg.last_repo.as_deref() == Some(&path) {
        cfg.last_repo = cfg.recent_repos.first().cloned();
    }
    config::save_config(&cfg);
    cfg
}

#[tauri::command]
pub fn get_home_dir() -> String {
    config::get_home_dir()
}

#[tauri::command]
pub fn list_dirs(partial: String) -> Vec<String> {
    let expanded = if partial.starts_with('~') {
        let home = config::get_home_dir();
        format!("{}{}", home, &partial[1..])
    } else {
        partial.clone()
    };

    let (parent, prefix) = if expanded.ends_with('/') || expanded.ends_with('\\') {
        (std::path::PathBuf::from(&expanded), String::new())
    } else {
        let p = std::path::PathBuf::from(&expanded);
        let parent = p.parent().unwrap_or(std::path::Path::new("/")).to_path_buf();
        let prefix = p.file_name().unwrap_or_default().to_string_lossy().to_string();
        (parent, prefix)
    };

    let entries = match std::fs::read_dir(&parent) {
        Ok(entries) => entries,
        Err(_) => return Vec::new(),
    };

    let home = config::get_home_dir();
    let mut results: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with('.') && prefix.is_empty() {
                return false; // hide dotfiles unless explicitly typed
            }
            if !prefix.is_empty() && !name.starts_with(&prefix) {
                return false;
            }
            e.file_type().map(|t| t.is_dir()).unwrap_or(false)
        })
        .map(|e| {
            let full = parent.join(e.file_name());
            let s = full.to_string_lossy().to_string();
            if !home.is_empty() && s.starts_with(&home) {
                format!("~{}", &s[home.len()..])
            } else {
                s
            }
        })
        .collect();

    results.sort();
    results
}

/// Resolves the path to the difft binary.
/// In production bundles, the binary is placed next to the main executable.
/// In development, falls back to the system PATH.
fn difft_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let name = if cfg!(windows) { "difft.exe" } else { "difft" };
            let candidate = dir.join(name);
            if candidate.exists() {
                return candidate;
            }
        }
    }
    PathBuf::from("difft")
}

// --- Internals ---

fn open_review_store() -> Option<review::ReviewStore> {
    git::git_root().ok().and_then(|r| review::ReviewStore::open(&r))
}

enum DiffMode {
    Range(String),
    Unstaged,
    Staged,
    WorkingTree(String),
    StagedVsCommit(String),
}

impl DiffMode {
    fn scope_key(&self) -> String {
        match self {
            DiffMode::Range(range) => {
                let (old, new) = git::parse_git_range(range);
                let old = git::resolve_rev(&old).unwrap_or(old);
                let new = git::resolve_rev(&new).unwrap_or(new);
                format!("{old}:{new}")
            }
            DiffMode::Unstaged => "INDEX:WORKTREE".into(),
            DiffMode::Staged => {
                let head = git::resolve_rev("HEAD").unwrap_or_else(|| "HEAD".into());
                format!("{head}:INDEX")
            }
            DiffMode::WorkingTree(c) => {
                let c = git::resolve_rev(c).unwrap_or_else(|| c.clone());
                format!("{c}:WORKTREE")
            }
            DiffMode::StagedVsCommit(c) => {
                let c = git::resolve_rev(c).unwrap_or_else(|| c.clone());
                format!("{c}:INDEX")
            }
        }
    }

    fn context_label(&self) -> DiffContext {
        /// Returns "short_hash date subject" for a rev, e.g. "abc1234 2026-03-10 fix bug".
        fn describe(rev: &str) -> String {
            let output = std::process::Command::new("git")
                .args(["log", "-1", "--format=%h %as %s", rev])
                .output()
                .ok();
            if let Some(o) = output {
                if o.status.success() {
                    let line = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    if !line.is_empty() {
                        return line;
                    }
                }
            }
            rev.to_string()
        }

        match self {
            DiffMode::Range(range) => {
                let (old, new) = git::parse_git_range(range);
                DiffContext { left: describe(&old), right: describe(&new) }
            }
            DiffMode::Unstaged => DiffContext { left: "Staged".into(), right: "Working Tree".into() },
            DiffMode::Staged => {
                DiffContext { left: format!("{} (HEAD)", describe("HEAD")), right: "Staged".into() }
            }
            DiffMode::WorkingTree(c) => {
                DiffContext { left: describe(c), right: "Working Tree".into() }
            }
            DiffMode::StagedVsCommit(c) => {
                DiffContext { left: describe(c), right: "Staged".into() }
            }
        }
    }
}

fn parse_diff_mode(mode: &str) -> Result<DiffMode, String> {
    if mode == "staged" {
        Ok(DiffMode::Staged)
    } else if mode == "unstaged" {
        Ok(DiffMode::Unstaged)
    } else if let Some(range) = mode.strip_prefix("range:") {
        Ok(DiffMode::Range(range.to_string()))
    } else if let Some(commit) = mode.strip_prefix("working-tree:") {
        Ok(DiffMode::WorkingTree(commit.to_string()))
    } else if let Some(commit) = mode.strip_prefix("staged-vs-commit:") {
        Ok(DiffMode::StagedVsCommit(commit.to_string()))
    } else {
        Err(format!("Unknown diff mode: {mode}"))
    }
}

enum FetchMethod {
    FromRef(String),
    FromIndex,
    FromWorkingTree,
}

impl FetchMethod {
    fn fetch(&self, path: &std::path::Path) -> Option<String> {
        match self {
            Self::FromRef(r) => git::git_file_content(r, path),
            Self::FromIndex => git::git_index_content(path),
            Self::FromWorkingTree => git::working_tree_content(path),
        }
    }

    fn is_binary(&self, path: &std::path::Path) -> bool {
        match self {
            Self::FromRef(r) => git::is_binary_blob(r, path),
            Self::FromIndex => git::is_binary_blob("", path),
            Self::FromWorkingTree => git::is_binary_working_tree(path),
        }
    }
}

fn run_diff_background(
    mode: DiffMode,
    completed: Arc<AtomicUsize>,
) -> Result<Vec<DisplayFile>, String> {
    let (files, stats, renames) = run_diff(&mode, &completed)?;
    let mut display_files = process_diff_files(files, &stats, &mode)?;

    if !renames.is_empty() {
        apply_renames(&mut display_files, &renames);
    }

    if matches!(mode, DiffMode::Unstaged | DiffMode::WorkingTree(_)) {
        let untracked = load_untracked_files();
        display_files.extend(untracked);
    }

    display_files.retain(|f| f.status != FileStatus::Unchanged);
    integrity::verify_display(&display_files)?;
    Ok(display_files)
}

type DiffResultInternal = (Vec<difft::DifftFile>, git::FileStats, HashMap<PathBuf, PathBuf>);

fn run_diff(mode: &DiffMode, completed: &AtomicUsize) -> Result<DiffResultInternal, String> {
    let extra_args: Vec<String> = match mode {
        DiffMode::Range(range) => {
            let (o, n) = git::parse_git_range(range);
            vec![format!("{o}..{n}")]
        }
        DiffMode::Unstaged => vec![],
        DiffMode::Staged => vec!["--cached".to_string()],
        DiffMode::WorkingTree(commit) => vec![commit.clone()],
        DiffMode::StagedVsCommit(commit) => vec!["--cached".to_string(), commit.clone()],
    };

    let refs: Vec<&str> = extra_args.iter().map(|s| s.as_str()).collect();
    let stats_refs = refs.clone();
    let renames_refs = refs.clone();

    let (files_result, stats, renames) = std::thread::scope(|s| {
        let files_handle = s.spawn(|| run_parallel_diff(&refs, mode, completed));
        let stats_handle = s.spawn(|| git::git_diff_stats(&stats_refs));
        let renames_handle = s.spawn(|| git::git_rename_map(&renames_refs));
        (
            files_handle.join().map_err(|_| "diff thread panicked".to_string()),
            stats_handle.join().unwrap_or_default(),
            renames_handle.join().unwrap_or_default(),
        )
    });

    let files_result = files_result?;

    let files = files_result?;
    Ok((files, stats, renames))
}

fn run_parallel_diff(
    extra_args: &[&str],
    mode: &DiffMode,
    completed: &AtomicUsize,
) -> Result<Vec<difft::DifftFile>, String> {
    use rayon::prelude::*;

    let (old_fetch, new_fetch) = match mode {
        DiffMode::Range(range) => {
            let (old_ref, new_ref) = git::parse_git_range(range);
            (FetchMethod::FromRef(old_ref), FetchMethod::FromRef(new_ref))
        }
        DiffMode::Unstaged => (FetchMethod::FromIndex, FetchMethod::FromWorkingTree),
        DiffMode::Staged => (
            FetchMethod::FromRef("HEAD".to_string()),
            FetchMethod::FromIndex,
        ),
        DiffMode::WorkingTree(commit) => (
            FetchMethod::FromRef(commit.clone()),
            FetchMethod::FromWorkingTree,
        ),
        DiffMode::StagedVsCommit(commit) => (
            FetchMethod::FromRef(commit.clone()),
            FetchMethod::FromIndex,
        ),
    };

    let entries = git::git_changed_files(extra_args)?;

    let expected_files: Vec<(PathBuf, String)> = entries
        .iter()
        .map(|e| (e.new_path.clone(), e.status.clone()))
        .collect();

    let tmp_dir = tempfile::TempDir::new()
        .map_err(|e| format!("Failed to create temp dir: {e}"))?;

    let results: Vec<Result<difft::DifftFile, String>> = entries
        .into_par_iter()
        .enumerate()
        .map(|(i, entry)| {
            let path_display = entry.new_path.display().to_string();

            // Skip binary files — difft can't process them and content fetch would fail
            let old_binary = !entry.status.starts_with('A') && old_fetch.is_binary(&entry.old_path);
            let new_binary = !entry.status.starts_with('D') && new_fetch.is_binary(&entry.new_path);
            if old_binary || new_binary {
                let lang = git::language_from_ext(&entry.new_path);
                let status = if entry.status.starts_with('A') {
                    difft::Status::Created
                } else if entry.status.starts_with('D') {
                    difft::Status::Deleted
                } else {
                    difft::Status::Changed
                };
                completed.fetch_add(1, Ordering::Relaxed);
                return Ok(difft::DifftFile {
                    path: entry.new_path,
                    language: lang,
                    status,
                    aligned_lines: vec![],
                    chunks: vec![],
                });
            }

            let slot = tmp_dir.path().join(i.to_string());
            std::fs::create_dir_all(&slot)
                .map_err(|e| format!("{path_display}: temp dir: {e}"))?;

            let old_dir = slot.join("old");
            let new_dir = slot.join("new");
            std::fs::create_dir_all(&old_dir)
                .map_err(|e| format!("{path_display}: old dir: {e}"))?;
            std::fs::create_dir_all(&new_dir)
                .map_err(|e| format!("{path_display}: new dir: {e}"))?;

            let old_filename = entry.old_path.file_name().unwrap_or_default().to_string_lossy().into_owned();
            let new_filename = entry.new_path.file_name().unwrap_or_default().to_string_lossy().into_owned();

            let old_tmp = old_dir.join(if old_filename.is_empty() { "file" } else { &old_filename });
            let new_tmp = new_dir.join(if new_filename.is_empty() { "file" } else { &new_filename });

            let old_content = if entry.status.starts_with('A') {
                String::new()
            } else {
                old_fetch.fetch(&entry.old_path).ok_or_else(|| {
                    format!("{path_display}: failed to fetch old content")
                })?
            };

            let new_content = if entry.status.starts_with('D') {
                String::new()
            } else {
                new_fetch.fetch(&entry.new_path).ok_or_else(|| {
                    format!("{path_display}: failed to fetch new content")
                })?
            };

            std::fs::write(&old_tmp, &old_content)
                .map_err(|e| format!("{path_display}: write old: {e}"))?;
            std::fs::write(&new_tmp, &new_content)
                .map_err(|e| format!("{path_display}: write new: {e}"))?;

            let output = std::process::Command::new(difft_path())
                .arg(&old_tmp)
                .arg(&new_tmp)
                .env("DFT_DISPLAY", "json")
                .env("DFT_UNSTABLE", "yes")
                .output()
                .map_err(|e| format!("{path_display}: difft failed to run: {e}"))?;

            let exit_code = output.status.code().unwrap_or(-1);
            if exit_code != 0 && exit_code != 1 {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!(
                    "{path_display}: difft exited with code {exit_code}: {stderr}"
                ));
            }

            let json = String::from_utf8_lossy(&output.stdout);
            if json.trim().is_empty() {
                let lang = git::language_from_ext(&entry.new_path);
                completed.fetch_add(1, Ordering::Relaxed);
                return Ok(difft::DifftFile {
                    path: entry.new_path,
                    language: lang,
                    status: difft::Status::Unchanged,
                    aligned_lines: vec![],
                    chunks: vec![],
                });
            }

            let mut parsed = difft::parse(&json)
                .map_err(|e| format!("{path_display}: JSON parse error: {e}"))?;

            if parsed.len() != 1 {
                return Err(format!(
                    "{path_display}: expected 1 file from difft, got {}",
                    parsed.len()
                ));
            }

            let mut file = parsed.remove(0);
            file.path = entry.new_path;
            completed.fetch_add(1, Ordering::Relaxed);
            Ok(file)
        })
        .collect();

    let mut all_files = Vec::with_capacity(results.len());
    for result in results {
        all_files.push(result?);
    }

    let expected_entries: Vec<git::ChangedEntry> = expected_files
        .iter()
        .map(|(path, status)| git::ChangedEntry {
            status: status.clone(),
            old_path: path.clone(),
            new_path: path.clone(),
        })
        .collect();
    integrity::verify(&expected_entries, &all_files)?;

    Ok(all_files)
}

enum ContentFetcher {
    Range(String, String),
    Unstaged,
    Staged,
    WorkingTree(String),
    StagedVsCommit(String),
}

impl ContentFetcher {
    fn new(mode: &DiffMode) -> Self {
        match mode {
            DiffMode::Range(range) => {
                let (old_ref, new_ref) = git::parse_git_range(range);
                Self::Range(old_ref, new_ref)
            }
            DiffMode::Unstaged => Self::Unstaged,
            DiffMode::Staged => Self::Staged,
            DiffMode::WorkingTree(commit) => Self::WorkingTree(commit.clone()),
            DiffMode::StagedVsCommit(commit) => Self::StagedVsCommit(commit.clone()),
        }
    }

    fn fetch(
        &self,
        old_path: &std::path::Path,
        new_path: &std::path::Path,
        status: FileStatus,
    ) -> Result<(Vec<String>, Vec<String>, bool), String> {
        let path_display = new_path.display().to_string();
        let mut is_binary = false;

        // Deleted files have no new content; Created files have no old content.
        let old_lines = if status == FileStatus::Created {
            vec![]
        } else {
            let binary = match self {
                Self::Range(old_ref, _) => git::is_binary_blob(old_ref, old_path),
                Self::Unstaged => git::is_binary_blob("", old_path),
                Self::Staged => git::is_binary_blob("HEAD", old_path),
                Self::WorkingTree(commit) => git::is_binary_blob(commit, old_path),
                Self::StagedVsCommit(commit) => git::is_binary_blob(commit, old_path),
            };
            if binary {
                is_binary = true;
                vec!["(Binary file)".to_string()]
            } else {
                let old_content = match self {
                    Self::Range(old_ref, _) => git::git_file_content(old_ref, old_path),
                    Self::Unstaged => git::git_index_content(old_path),
                    Self::Staged => git::git_file_content("HEAD", old_path),
                    Self::WorkingTree(commit) => git::git_file_content(commit, old_path),
                    Self::StagedVsCommit(commit) => git::git_file_content(commit, old_path),
                };
                old_content
                    .map(|c| git::into_lines(Some(c)))
                    .unwrap_or_default()
            }
        };

        let new_lines = if status == FileStatus::Deleted {
            vec![]
        } else {
            let binary = match self {
                Self::Range(_, new_ref) => git::is_binary_blob(new_ref, new_path),
                Self::Unstaged => git::is_binary_working_tree(new_path),
                Self::Staged => git::is_binary_blob("", new_path),
                Self::WorkingTree(_) => git::is_binary_working_tree(new_path),
                Self::StagedVsCommit(_) => git::is_binary_blob("", new_path),
            };
            if binary {
                is_binary = true;
                vec!["(Binary file)".to_string()]
            } else {
                let new_content = match self {
                    Self::Range(_, new_ref) => git::git_file_content(new_ref, new_path),
                    Self::Unstaged => git::working_tree_content(new_path),
                    Self::Staged => git::git_index_content(new_path),
                    Self::WorkingTree(_) => git::working_tree_content(new_path),
                    Self::StagedVsCommit(_) => git::git_index_content(new_path),
                };
                new_content.ok_or_else(|| {
                    format!("{path_display}: failed to fetch new content for display")
                })?
                .lines()
                .map(String::from)
                .collect()
            }
        };

        Ok((old_lines, new_lines, is_binary))
    }

    fn old_blob_oid(&self, path: &std::path::Path) -> Option<String> {
        match self {
            Self::Range(old_ref, _) => git::resolve_rev(&format!("{old_ref}:{}", path.display())),
            Self::Unstaged => git::resolve_rev(&format!(":{}", path.display())),
            Self::Staged => git::resolve_rev(&format!("HEAD:{}", path.display())),
            Self::WorkingTree(commit) => git::resolve_rev(&format!("{commit}:{}", path.display())),
            Self::StagedVsCommit(commit) => git::resolve_rev(&format!("{commit}:{}", path.display())),
        }
    }

    fn new_blob_oid(&self, path: &std::path::Path) -> Option<String> {
        match self {
            Self::Range(_, new_ref) => git::resolve_rev(&format!("{new_ref}:{}", path.display())),
            Self::Unstaged | Self::WorkingTree(_) => git::working_tree_blob_hash(path),
            Self::Staged | Self::StagedVsCommit(_) => git::resolve_rev(&format!(":{}", path.display())),
        }
    }
}

fn process_diff_files(
    files: Vec<difft::DifftFile>,
    stats: &git::FileStats,
    mode: &DiffMode,
) -> Result<Vec<DisplayFile>, String> {
    use rayon::prelude::*;

    let fetcher = ContentFetcher::new(mode);

    let results: Vec<Result<DisplayFile, String>> = files
        .into_par_iter()
        .map(|file| {
            let file_stats = stats.get(&file.path).copied();
            let old_path = file.path.clone();
            let new_path = file.path.clone();
            let file_status = match file.status {
                difft::Status::Created => FileStatus::Created,
                difft::Status::Deleted => FileStatus::Deleted,
                difft::Status::Unchanged => FileStatus::Unchanged,
                difft::Status::Changed => FileStatus::Modified,
            };
            // Unchanged files will be filtered out later; don't error on fetch failure.
            let (old_lines, new_lines, is_binary) = match fetcher.fetch(&old_path, &new_path, file_status) {
                Ok(result) => result,
                Err(_) if file_status == FileStatus::Unchanged => (vec![], vec![], false),
                Err(e) => return Err(e),
            };
            let content_hash = if is_binary {
                // Use git blob OIDs so the hash changes when binary content changes
                let old_oid = if file_status != FileStatus::Created {
                    fetcher.old_blob_oid(&old_path).unwrap_or_default()
                } else {
                    String::new()
                };
                let new_oid = if file_status != FileStatus::Deleted {
                    fetcher.new_blob_oid(&new_path).unwrap_or_default()
                } else {
                    String::new()
                };
                compute_content_hash(&[old_oid], &[new_oid])
            } else {
                compute_content_hash(&old_lines, &new_lines)
            };
            Ok(processor::process_file(file, old_lines, new_lines, file_stats, content_hash))
        })
        .collect();

    let mut display_files = Vec::with_capacity(results.len());
    for result in results {
        display_files.push(result?);
    }
    Ok(display_files)
}

fn apply_renames(display_files: &mut Vec<DisplayFile>, renames: &HashMap<PathBuf, PathBuf>) {
    let old_paths: HashSet<PathBuf> = renames.values().cloned().collect();

    display_files.retain_mut(|file| {
        if let Some(old_path) = renames.get(&file.path) {
            file.moved_from = Some(old_path.clone());
            file.status = FileStatus::Created;
        }
        if file.status == FileStatus::Deleted && old_paths.contains(&file.path) {
            return false;
        }
        true
    });
}

fn load_untracked_files() -> Vec<DisplayFile> {
    use rayon::prelude::*;

    let untracked = git::git_untracked_files();
    let root = git::git_root().ok();

    untracked
        .into_par_iter()
        .filter_map(|path| {
            let language = git::language_from_ext(&path);

            if git::is_binary_working_tree(&path) {
                let new_lines = vec!["(Binary file)".to_string()];
                let empty: Vec<String> = vec![];
                let oid = vec![git::working_tree_blob_hash(&path).unwrap_or_default()];
                let content_hash = compute_content_hash(&empty, &oid);
                return Some(processor::process_file(
                    difft::DifftFile {
                        path,
                        language,
                        status: difft::Status::Created,
                        aligned_lines: vec![],
                        chunks: vec![],
                    },
                    vec![],
                    new_lines,
                    Some((0, 0)),
                    content_hash,
                ));
            }

            let abs_path = root.as_ref()?.join(&path);
            let content = std::fs::read_to_string(&abs_path).ok()?;
            let new_lines: Vec<String> = content.lines().map(String::from).collect();
            let num_lines = new_lines.len() as u32;
            let empty: Vec<String> = vec![];
            let content_hash = compute_content_hash(&empty, &new_lines);

            Some(processor::process_file(
                difft::DifftFile {
                    path,
                    language,
                    status: difft::Status::Created,
                    aligned_lines: vec![],
                    chunks: vec![],
                },
                vec![],
                new_lines,
                Some((num_lines, 0)),
                content_hash,
            ))
        })
        .collect()
}

fn compute_content_hash(old_lines: &[String], new_lines: &[String]) -> u64 {
    let mut hasher = std::hash::DefaultHasher::new();
    for line in old_lines {
        line.hash(&mut hasher);
    }
    0xFFFF_FFFF_FFFF_FFFFu64.hash(&mut hasher); // separator
    for line in new_lines {
        line.hash(&mut hasher);
    }
    hasher.finish()
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() > max {
        let truncated: String = s.chars().take(max.saturating_sub(3)).collect();
        format!("{truncated}...")
    } else {
        s.to_string()
    }
}

// --- Tree building (adapted from ui/tree_pane.rs) ---

fn build_tree_from_files(files: &[DisplayFile]) -> Vec<TreeNode> {
    let mut root_children: Vec<TreeNode> = Vec::new();

    for (idx, file) in files.iter().enumerate() {
        let path_str = file.path.to_string_lossy().to_string();
        let parts: Vec<&str> = path_str.split('/').collect();
        insert_into_tree(&mut root_children, &parts, idx, file);
    }

    flatten_single_child(&mut root_children);
    propagate_stats(&mut root_children);
    sort_tree(&mut root_children);
    root_children
}

fn insert_into_tree(nodes: &mut Vec<TreeNode>, parts: &[&str], file_idx: usize, file: &DisplayFile) {
    if parts.is_empty() { return; }

    let name = parts[0];
    let is_last = parts.len() == 1;

    let existing = nodes.iter().position(|n| n.name == name && n.is_dir != is_last);

    if let Some(pos) = existing {
        if !is_last {
            insert_into_tree(&mut nodes[pos].children, &parts[1..], file_idx, file);
        }
    } else {
        let mut node = TreeNode {
            name: name.to_string(),
            path: parts.join("/"),
            is_dir: !is_last,
            file_idx: if is_last { Some(file_idx) } else { None },
            status: if is_last { Some(file.status) } else { None },
            additions: if is_last { file.additions } else { 0 },
            deletions: if is_last { file.deletions } else { 0 },
            children: Vec::new(),
            expanded: true,
            moved_from: file.moved_from.as_ref().map(|p| p.to_string_lossy().to_string()),
        };

        if !is_last {
            insert_into_tree(&mut node.children, &parts[1..], file_idx, file);
        }
        nodes.push(node);
    }
}

fn flatten_single_child(nodes: &mut [TreeNode]) {
    for node in nodes.iter_mut() {
        flatten_single_child(&mut node.children);
        while node.children.len() == 1 && node.children[0].is_dir {
            let child = node.children.remove(0);
            node.name = format!("{}/{}", node.name, child.name);
            node.path = child.path;
            node.children = child.children;
        }
    }
}

fn propagate_stats(nodes: &mut [TreeNode]) -> (u32, u32) {
    let mut total_add = 0u32;
    let mut total_del = 0u32;
    for node in nodes.iter_mut() {
        if node.is_dir {
            let (add, del) = propagate_stats(&mut node.children);
            node.additions = add;
            node.deletions = del;
        }
        total_add += node.additions;
        total_del += node.deletions;
    }
    (total_add, total_del)
}

fn sort_tree(nodes: &mut [TreeNode]) {
    nodes.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return b.is_dir.cmp(&a.is_dir);
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    for node in nodes.iter_mut() {
        if node.is_dir {
            sort_tree(&mut node.children);
        }
    }
}
