// Tauri IPC wrappers

import { invoke } from "@tauri-apps/api/core";
import type {
  LogItem,
  DiffResult,
  ReviewState,
  CompareItem,
  TreeNode,
  DisplayFile,
  AppConfig,
} from "./types";

export async function preflightCheck(): Promise<void> {
  return invoke("preflight_check");
}

export async function getGitRoot(): Promise<string> {
  return invoke("get_git_root");
}

export async function getLog(): Promise<LogItem[]> {
  return invoke("get_log");
}

export async function getCompareItems(): Promise<CompareItem[]> {
  return invoke("get_compare_items");
}

export async function getCompareOldItems(
  newRev: string,
): Promise<CompareItem[]> {
  return invoke("get_compare_old_items", { newRev });
}

export async function loadDiff(mode: string): Promise<DiffResult> {
  return invoke("load_diff", { mode });
}

export async function markReviewed(
  scope: string,
  path: string,
  hash: number,
): Promise<void> {
  return invoke("mark_reviewed", { scope, path, hash });
}

export async function unmarkReviewed(
  scope: string,
  path: string,
): Promise<void> {
  return invoke("unmark_reviewed", { scope, path });
}

export async function getReviewStatus(
  scope: string,
  files: DisplayFile[],
): Promise<ReviewState> {
  return invoke("get_review_status", { scope, files });
}

export async function clearAllReviews(): Promise<void> {
  return invoke("clear_all_reviews");
}

export async function buildTree(files: DisplayFile[]): Promise<TreeNode[]> {
  return invoke("build_tree", { files });
}

export async function setRepo(path: string): Promise<string> {
  return invoke("set_repo", { path });
}

export async function getAppConfig(): Promise<AppConfig> {
  return invoke("get_app_config");
}

export async function removeRecent(path: string): Promise<AppConfig> {
  return invoke("remove_recent", { path });
}

export async function getHomeDir(): Promise<string> {
  return invoke("get_home_dir");
}

export async function listDirs(partial: string): Promise<string[]> {
  return invoke("list_dirs", { partial });
}
