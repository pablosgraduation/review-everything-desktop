// Global application state using Svelte 5 runes

import type {
  LogItem,
  DisplayFile,
  DiffContext,
  TreeNode,
  CompareItem,
} from "$lib/types";
import * as ipc from "$lib/ipc";

export type ViewKind =
  | "repo-picker"
  | "log"
  | "diff"
  | "compare-new"
  | "compare-old"
  | "loading"
  | "error"
  | "help";

// --- App state ---
let view = $state<ViewKind>("repo-picker");
let errorMessage = $state("");
let viewBeforeError = $state<ViewKind>("repo-picker");
let loadingMessage = $state("");

// Repo
let homeDir = $state("");
let repoPath = $state("");
let recentRepos = $state<string[]>([]);
let repoPickerCursor = $state(0);

// Log
let logItems = $state<LogItem[]>([]);
let logCursor = $state(0);
let logScroll = $state(0);
let logLoadedAt = $state<Date | null>(null);

// Diff
let diffFiles = $state<DisplayFile[]>([]);
let diffScope = $state("");
let diffContext = $state<DiffContext>({ left: "", right: "" });
let diffMode = $state("");
let diffLoadedAt = $state<Date | null>(null);
let diffRefreshedAt = $state<Date | null>(null);
let refreshDeltaText = $state("");
let initialFileCount = $state(0);
let baselineFilePaths = $state<Set<string>>(new Set());
let baselineFileHashes = $state<Map<string, number>>(new Map());
let currentFileIdx = $state(0);
let diffCursor = $state(0);
let diffScroll = $state(0);
let hScroll = $state(0);
let reviewed = $state<Set<number>>(new Set());

// Tree
let treeNodes = $state<TreeNode[]>([]);
let showTree = $state(true);
let treeFocused = $state(false);
let treeCursor = $state(0);
let treeScroll = $state(0);

// Compare
let compareItems = $state<CompareItem[]>([]);
let compareCursor = $state(0);
let compareScroll = $state(0);
let compareNewRev = $state("");
let compareNewLabel = $state("");

// Viewport
let viewportRows = $state(30);

// Search
let searchActive = $state(false);
let searchQuery = $state("");
let searchFiltered = $state<number[]>([]);
let searchCursor = $state(0);
let searchScroll = $state(0);

// Diff find
let diffFindActive = $state(false);
let diffFindQuery = $state("");
let diffFindSearchOld = $state(false);
let diffFindSearchNew = $state(true);
let diffFindCurrent = $state(0);

export interface DiffFindMatch {
  row: number;
  side: "left" | "right";
  start: number;
  end: number;
}

let diffFindMatches = $derived.by((): DiffFindMatch[] => {
  if (!diffFindActive || !diffFindQuery) return [];
  const file = diffFiles[currentFileIdx];
  if (!file) return [];
  const query = diffFindQuery.toLowerCase();
  const matches: DiffFindMatch[] = [];
  for (let row = 0; row < file.rows.length; row++) {
    if (diffFindSearchOld && !file.rows[row].left.is_filler) {
      const content = file.rows[row].left.content.toLowerCase();
      let pos = 0;
      while ((pos = content.indexOf(query, pos)) !== -1) {
        matches.push({ row, side: "left", start: pos, end: pos + query.length });
        pos += 1;
      }
    }
    if (diffFindSearchNew && !file.rows[row].right.is_filler) {
      const content = file.rows[row].right.content.toLowerCase();
      let pos = 0;
      while ((pos = content.indexOf(query, pos)) !== -1) {
        matches.push({ row, side: "right", start: pos, end: pos + query.length });
        pos += 1;
      }
    }
  }
  return matches;
});

export const appState = {
  get view() { return view; },
  set view(v: ViewKind) { view = v; },
  get errorMessage() { return errorMessage; },
  set errorMessage(v: string) { errorMessage = v; },
  get viewBeforeError() { return viewBeforeError; },
  set viewBeforeError(v: ViewKind) { viewBeforeError = v; },
  get loadingMessage() { return loadingMessage; },
  set loadingMessage(v: string) { loadingMessage = v; },

  // Repo
  get homeDir() { return homeDir; },
  set homeDir(v: string) { homeDir = v; },
  get repoPath() { return repoPath; },
  set repoPath(v: string) { repoPath = v; },
  get recentRepos() { return recentRepos; },
  set recentRepos(v: string[]) { recentRepos = v; },
  get repoPickerCursor() { return repoPickerCursor; },
  set repoPickerCursor(v: number) { repoPickerCursor = v; },

  // Log
  get logItems() { return logItems; },
  set logItems(v: LogItem[]) { logItems = v; },
  get logCursor() { return logCursor; },
  set logCursor(v: number) { logCursor = v; },
  get logScroll() { return logScroll; },
  set logScroll(v: number) { logScroll = v; },
  get logLoadedAt() { return logLoadedAt; },
  set logLoadedAt(v: Date | null) { logLoadedAt = v; },

  // Diff
  get diffFiles() { return diffFiles; },
  set diffFiles(v: DisplayFile[]) { diffFiles = v; },
  get diffScope() { return diffScope; },
  set diffScope(v: string) { diffScope = v; },
  get diffContext() { return diffContext; },
  set diffContext(v: DiffContext) { diffContext = v; },
  get diffMode() { return diffMode; },
  set diffMode(v: string) { diffMode = v; },
  get diffLoadedAt() { return diffLoadedAt; },
  set diffLoadedAt(v: Date | null) { diffLoadedAt = v; },
  get diffRefreshedAt() { return diffRefreshedAt; },
  set diffRefreshedAt(v: Date | null) { diffRefreshedAt = v; },
  get refreshDeltaText() { return refreshDeltaText; },
  set refreshDeltaText(v: string) { refreshDeltaText = v; },
  get initialFileCount() { return initialFileCount; },
  set initialFileCount(v: number) { initialFileCount = v; },
  get baselineFilePaths() { return baselineFilePaths; },
  set baselineFilePaths(v: Set<string>) { baselineFilePaths = v; },
  get baselineFileHashes() { return baselineFileHashes; },
  set baselineFileHashes(v: Map<string, number>) { baselineFileHashes = v; },
  get currentFileIdx() { return currentFileIdx; },
  set currentFileIdx(v: number) { currentFileIdx = v; },
  get diffCursor() { return diffCursor; },
  set diffCursor(v: number) { diffCursor = v; },
  get diffScroll() { return diffScroll; },
  set diffScroll(v: number) { diffScroll = v; },
  get hScroll() { return hScroll; },
  set hScroll(v: number) { hScroll = v; },
  get reviewed() { return reviewed; },
  set reviewed(v: Set<number>) { reviewed = v; },

  // Tree
  get treeNodes() { return treeNodes; },
  set treeNodes(v: TreeNode[]) { treeNodes = v; },
  get showTree() { return showTree; },
  set showTree(v: boolean) { showTree = v; },
  get treeFocused() { return treeFocused; },
  set treeFocused(v: boolean) { treeFocused = v; },
  get treeCursor() { return treeCursor; },
  set treeCursor(v: number) { treeCursor = v; },
  get treeScroll() { return treeScroll; },
  set treeScroll(v: number) { treeScroll = v; },

  // Compare
  get compareItems() { return compareItems; },
  set compareItems(v: CompareItem[]) { compareItems = v; },
  get compareCursor() { return compareCursor; },
  set compareCursor(v: number) { compareCursor = v; },
  get compareScroll() { return compareScroll; },
  set compareScroll(v: number) { compareScroll = v; },
  get compareNewRev() { return compareNewRev; },
  set compareNewRev(v: string) { compareNewRev = v; },
  get compareNewLabel() { return compareNewLabel; },
  set compareNewLabel(v: string) { compareNewLabel = v; },

  // Viewport
  get viewportRows() { return viewportRows; },
  set viewportRows(v: number) { viewportRows = v; },

  // Search
  get searchActive() { return searchActive; },
  set searchActive(v: boolean) { searchActive = v; },
  get searchQuery() { return searchQuery; },
  set searchQuery(v: string) { searchQuery = v; },
  get searchFiltered() { return searchFiltered; },
  set searchFiltered(v: number[]) { searchFiltered = v; },
  get searchCursor() { return searchCursor; },
  set searchCursor(v: number) { searchCursor = v; },
  get searchScroll() { return searchScroll; },
  set searchScroll(v: number) { searchScroll = v; },

  // Diff find
  get diffFindActive() { return diffFindActive; },
  set diffFindActive(v: boolean) { diffFindActive = v; },
  get diffFindQuery() { return diffFindQuery; },
  set diffFindQuery(v: string) { diffFindQuery = v; },
  get diffFindSearchOld() { return diffFindSearchOld; },
  set diffFindSearchOld(v: boolean) { diffFindSearchOld = v; },
  get diffFindSearchNew() { return diffFindSearchNew; },
  set diffFindSearchNew(v: boolean) { diffFindSearchNew = v; },
  get diffFindCurrent() { return diffFindCurrent; },
  set diffFindCurrent(v: number) { diffFindCurrent = v; },
  get diffFindMatches() { return diffFindMatches; },

  // Computed
  get currentFile(): DisplayFile | undefined {
    return diffFiles[currentFileIdx];
  },
  get totalRows(): number {
    return diffFiles[currentFileIdx]?.rows.length ?? 0;
  },
};

// --- Validation ---

function validateDiffResult(result: { files: DisplayFile[]; scope: string }) {
  if (!result || !Array.isArray(result.files)) {
    throw new Error("Invalid diff result: missing files array");
  }
  if (!result.scope) {
    throw new Error("Invalid diff result: missing scope");
  }

  // Check every file has a path
  for (let i = 0; i < result.files.length; i++) {
    const f = result.files[i];
    if (!f.path) {
      throw new Error(`Invalid diff result: file at index ${i} has no path`);
    }
  }

  // Check for duplicate paths
  const seen = new Set<string>();
  for (const f of result.files) {
    if (seen.has(f.path)) {
      throw new Error(`Invalid diff result: duplicate path "${f.path}"`);
    }
    seen.add(f.path);
  }
}

function validateReviewIndices(indices: number[], fileCount: number) {
  for (const idx of indices) {
    if (idx < 0 || idx >= fileCount) {
      throw new Error(
        `Invalid review state: index ${idx} out of range (${fileCount} files)`
      );
    }
  }
}

function captureBaseline(files: DisplayFile[]): { paths: Set<string>; hashes: Map<string, number> } {
  const paths = new Set(files.map(f => f.path));
  const hashes = new Map(files.map(f => [f.path, f.content_hash]));

  // Verify capture integrity: Set/Map sizes must match file count.
  // A mismatch here means duplicate paths slipped past validation or
  // Map construction silently dropped entries.
  if (paths.size !== files.length) {
    throw new Error(
      `Baseline capture failed: expected ${files.length} paths, got ${paths.size}`
    );
  }
  if (hashes.size !== files.length) {
    throw new Error(
      `Baseline capture failed: expected ${files.length} hashes, got ${hashes.size}`
    );
  }

  return { paths, hashes };
}

// --- Delta computation ---

function computeRefreshDelta(newFiles: DisplayFile[]): string {
  const baseline = baselineFilePaths;
  const hashes = baselineFileHashes;

  // Guard: baseline must have been captured
  if (baseline.size === 0 && newFiles.length > 0) {
    return "⚠ missing baseline";
  }
  // Guard: hash map should be consistent with path set
  if (baseline.size !== hashes.size) {
    return "⚠ state mismatch";
  }

  const currentPaths = new Set(newFiles.map(f => f.path));
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const f of newFiles) {
    if (!baseline.has(f.path)) {
      added++;
    } else {
      const oldHash = hashes.get(f.path);
      // Only compare when both hashes are non-zero (0 = not computed)
      if (oldHash && f.content_hash && oldHash !== f.content_hash) {
        changed++;
      }
    }
  }
  for (const p of baseline) {
    if (!currentPaths.has(p)) removed++;
  }

  // Cross-validate: currentFiles = baseline + added - removed must hold
  if (newFiles.length !== baseline.size + added - removed) {
    return "⚠ inconsistent counts";
  }

  const parts: string[] = [];
  if (added > 0) parts.push(`+${added} new`);
  if (removed > 0) parts.push(`-${removed} removed`);
  if (changed > 0) parts.push(`${changed} changed`);
  if (parts.length === 0) return "no changes";
  return parts.join(" · ");
}

// --- Actions ---

function resetAllState() {
  // Log
  logItems = [];
  logCursor = 0;
  logScroll = 0;
  logLoadedAt = null;

  // Diff
  diffFiles = [];
  diffScope = "";
  diffContext = { left: "", right: "" };
  diffMode = "";
  diffLoadedAt = null;
  diffRefreshedAt = null;
  refreshDeltaText = "";
  initialFileCount = 0;
  baselineFilePaths = new Set();
  baselineFileHashes = new Map();
  currentFileIdx = 0;
  diffCursor = 0;
  diffScroll = 0;
  hScroll = 0;
  reviewed = new Set();

  // Tree
  treeNodes = [];
  showTree = true;
  treeFocused = false;
  treeCursor = 0;
  treeScroll = 0;

  // Compare
  compareItems = [];
  compareCursor = 0;
  compareScroll = 0;
  compareNewRev = "";
  compareNewLabel = "";

  // Search
  searchActive = false;
  searchQuery = "";
  searchFiltered = [];
  searchCursor = 0;
  searchScroll = 0;

  // Diff find
  diffFindActive = false;
  diffFindQuery = "";
  diffFindSearchOld = false;
  diffFindSearchNew = true;
  diffFindCurrent = 0;

  // Error/loading
  errorMessage = "";
  loadingMessage = "";
}

export async function openRepo(path: string) {
  try {
    const canonical = await ipc.setRepo(path);
    repoPath = canonical;
    resetAllState();
    // Call preflight + log directly (not via loadLog) so errors
    // propagate to our catch, which sets viewBeforeError = "repo-picker".
    // If loadLog's own catch ran instead, it would set viewBeforeError = "log"
    // and trap the user in an error → retry loop with no way back to picker.
    await ipc.preflightCheck();
    appState.logItems = await ipc.getLog();
    appState.logCursor = 0;
    appState.logScroll = 0;
    appState.logLoadedAt = new Date();
    appState.view = "log";
  } catch (e) {
    appState.viewBeforeError = "repo-picker";
    appState.errorMessage = String(e);
    appState.view = "error";
  }
}

export async function showRepoPicker() {
  try {
    const cfg = await ipc.getAppConfig();
    recentRepos = cfg.recent_repos;
  } catch {
    recentRepos = [];
  }
  repoPickerCursor = 0;
  view = "repo-picker";
}

export async function loadLog() {
  try {
    await ipc.preflightCheck();
    appState.logItems = await ipc.getLog();
    appState.logCursor = 0;
    appState.logScroll = 0;
    appState.logLoadedAt = new Date();
    appState.view = "log";
  } catch (e) {
    appState.viewBeforeError = "log";
    appState.errorMessage = String(e);
    appState.view = "error";
  }
}

export async function loadDiffFromMode(mode: string) {
  appState.loadingMessage = "Computing diff...";
  appState.view = "loading";
  appState.diffMode = mode;

  try {
    // --- Gather all results before touching state ---
    const result = await ipc.loadDiff(mode);

    // Validate result structure
    validateDiffResult(result);

    appState.diffContext = result.context;

    // Complete remaining IPC before any state mutation
    const newTree = await ipc.buildTree(result.files);
    const reviewState = await ipc.getReviewStatus(
      result.scope,
      result.files,
    );

    // Validate review indices before using them
    validateReviewIndices(reviewState.reviewed_indices, result.files.length);

    // Capture and verify baseline before state mutation
    const baseline = captureBaseline(result.files);

    // --- All IPC succeeded and validated — update state atomically ---
    appState.diffFiles = result.files;
    appState.diffScope = result.scope;
    appState.currentFileIdx = 0;
    appState.diffCursor = 0;
    appState.diffScroll = 0;
    appState.hScroll = 0;
    appState.treeCursor = 0;
    appState.treeScroll = 0;
    appState.treeFocused = false;

    appState.treeNodes = newTree;
    appState.reviewed = new Set(reviewState.reviewed_indices);

    autoScrollToFirstHunk();

    appState.diffLoadedAt = new Date();
    appState.diffRefreshedAt = null;
    appState.refreshDeltaText = "";
    appState.initialFileCount = result.files.length;
    appState.baselineFilePaths = baseline.paths;
    appState.baselineFileHashes = baseline.hashes;
    appState.view = "diff";
  } catch (e) {
    appState.viewBeforeError = "log";
    appState.errorMessage = String(e);
    appState.view = "error";
  }
}

export function selectLogItem(index: number) {
  const item = appState.logItems[index];
  if (!item) return;

  if (item.kind === "working_tree") {
    loadDiffFromMode("unstaged");
  } else if (item.kind === "staged") {
    loadDiffFromMode("staged");
  } else if (item.kind === "commit" && item.entry) {
    loadDiffFromMode(`range:${item.entry.full_hash}`);
  }
}

export async function startCompare() {
  appState.compareItems = await ipc.getCompareItems();
  appState.compareCursor = 0;
  appState.compareScroll = 0;
  // Close any active search — it may have been opened with stale view context
  appState.searchActive = false;
  appState.searchQuery = "";
  appState.searchFiltered = [];
  appState.view = "compare-new";
}

export async function selectCompareNew(index: number) {
  const item = appState.compareItems[index];
  if (!item) return;
  appState.compareNewRev = item.rev;
  appState.compareNewLabel = item.label;
  appState.compareItems = await ipc.getCompareOldItems(item.rev);
  appState.compareCursor = 0;
  appState.compareScroll = 0;
  appState.view = "compare-old";
}

export function selectCompareOld(index: number) {
  const item = appState.compareItems[index];
  if (!item) return;
  const oldRev = item.rev;
  const newRev = appState.compareNewRev;

  let mode: string;
  if (oldRev === "--index" && newRev === "--working-tree") {
    mode = "unstaged";
  } else if (newRev === "--working-tree") {
    mode = `working-tree:${oldRev}`;
  } else if (newRev === "--staged") {
    mode = `staged-vs-commit:${oldRev}`;
  } else {
    mode = `range:${oldRev}..${newRev}`;
  }

  loadDiffFromMode(mode);
}

export function goToFile(fileIdx: number) {
  if (fileIdx < 0 || fileIdx >= appState.diffFiles.length) return;
  appState.currentFileIdx = fileIdx;
  appState.hScroll = 0;
  autoScrollToFirstHunk();
  // Reset find index so current-match highlight is valid for the new file
  if (diffFindActive) {
    diffFindCurrent = 0;
  }
}

// File indices in tree order (depth-first traversal)
export function treeFileOrder(): number[] {
  const order: number[] = [];
  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (node.is_dir) {
        walk(node.children);
      } else if (node.file_idx !== undefined && node.file_idx !== null) {
        order.push(node.file_idx);
      }
    }
  }
  walk(appState.treeNodes);
  return order;
}

export function goToNextFileInTree() {
  const order = treeFileOrder();
  const pos = order.indexOf(appState.currentFileIdx);
  if (pos >= 0 && pos < order.length - 1) {
    goToFile(order[pos + 1]);
  }
}

export function goToPrevFileInTree() {
  const order = treeFileOrder();
  const pos = order.indexOf(appState.currentFileIdx);
  if (pos > 0) {
    goToFile(order[pos - 1]);
  }
}

export function autoScrollToFirstHunk() {
  const file = appState.currentFile;
  if (file && file.hunks.length > 0) {
    const firstHunkStart = file.hunks[0][0];
    appState.diffCursor = firstHunkStart;
    appState.diffScroll = firstHunkStart;
  } else {
    appState.diffCursor = 0;
    appState.diffScroll = 0;
  }
}

export async function toggleReviewed(fileIdx?: number) {
  const idx = fileIdx ?? appState.currentFileIdx;
  const file = appState.diffFiles[idx];
  if (!file) return;

  const path = file.path;
  const hash = file.content_hash;
  const newSet = new Set(appState.reviewed);

  if (newSet.has(idx)) {
    newSet.delete(idx);
    await ipc.unmarkReviewed(appState.diffScope, path);
  } else {
    newSet.add(idx);
    await ipc.markReviewed(appState.diffScope, path, hash);
  }
  appState.reviewed = newSet;
}

export async function clearReviews() {
  appState.reviewed = new Set();
  await ipc.clearAllReviews();
}

export function exitDiff() {
  diffFindActive = false;
  diffFindQuery = "";
  appState.reviewed = new Set();
  appState.diffScope = "";
  appState.diffLoadedAt = null;
  appState.diffRefreshedAt = null;
  appState.refreshDeltaText = "";
  appState.initialFileCount = 0;
  appState.baselineFilePaths = new Set();
  appState.baselineFileHashes = new Map();
  appState.view = "log";
}

export async function refreshDiff() {
  if (!appState.diffMode) return;

  const prevFilePath = appState.currentFile?.path;
  const expectedScope = appState.diffScope;

  appState.loadingMessage = "Refreshing...";
  appState.view = "loading";

  try {
    // --- Gather all results before touching state ---
    const result = await ipc.loadDiff(appState.diffMode);

    // Validate result structure
    validateDiffResult(result);

    // Verify scope hasn't changed (e.g., ref was force-pushed or rebased)
    if (expectedScope && result.scope !== expectedScope) {
      throw new Error(
        `Scope changed: "${expectedScope}" → "${result.scope}". The ref may have been rewritten. Please reload.`
      );
    }

    // Complete remaining IPC before any state mutation
    const newTree = await ipc.buildTree(result.files);
    const reviewState = await ipc.getReviewStatus(result.scope, result.files);

    // Validate review indices before using them
    validateReviewIndices(reviewState.reviewed_indices, result.files.length);

    // Compute delta BEFORE advancing baseline (compares new files against previous state)
    const deltaText = computeRefreshDelta(result.files);

    // Capture and verify new baseline before state mutation
    const newBaseline = captureBaseline(result.files);

    // --- All IPC succeeded and validated — update state atomically ---
    appState.diffFiles = result.files;
    appState.diffScope = result.scope;

    let restoredIdx = 0;
    if (prevFilePath) {
      const found = result.files.findIndex(f => f.path === prevFilePath);
      if (found >= 0) restoredIdx = found;
    }
    appState.currentFileIdx = restoredIdx;
    appState.diffCursor = 0;
    appState.diffScroll = 0;
    appState.hScroll = 0;
    appState.treeCursor = 0;
    appState.treeScroll = 0;
    appState.treeFocused = false;

    appState.treeNodes = newTree;
    appState.reviewed = new Set(reviewState.reviewed_indices);

    autoScrollToFirstHunk();

    appState.refreshDeltaText = deltaText;
    appState.diffRefreshedAt = new Date();
    // Advance baseline so next refresh delta is incremental, not cumulative
    appState.baselineFilePaths = newBaseline.paths;
    appState.baselineFileHashes = newBaseline.hashes;
    appState.view = "diff";
  } catch (e) {
    appState.viewBeforeError = "diff";
    appState.errorMessage = `Refresh failed: ${String(e)}`;
    appState.view = "error";
  }
}

// Ensure cursor is within visible viewport
export function ensureDiffCursorVisible(viewportHeight: number) {
  if (appState.diffCursor < appState.diffScroll) {
    appState.diffScroll = appState.diffCursor;
  } else if (appState.diffCursor >= appState.diffScroll + viewportHeight) {
    appState.diffScroll = Math.max(0, appState.diffCursor - viewportHeight + 1);
  }
}

// --- Diff find ---

export function openDiffFind() {
  diffFindActive = true;
  diffFindQuery = "";
  diffFindCurrent = 0;
}

export function closeDiffFind() {
  diffFindActive = false;
  diffFindQuery = "";
  diffFindCurrent = 0;
}

export function nextDiffFindMatch() {
  if (diffFindMatches.length === 0) return;
  diffFindCurrent = (diffFindCurrent + 1) % diffFindMatches.length;
  diffCursor = diffFindMatches[diffFindCurrent].row;
  ensureDiffCursorVisible(viewportRows);
}

export function prevDiffFindMatch() {
  if (diffFindMatches.length === 0) return;
  diffFindCurrent = (diffFindCurrent - 1 + diffFindMatches.length) % diffFindMatches.length;
  diffCursor = diffFindMatches[diffFindCurrent].row;
  ensureDiffCursorVisible(viewportRows);
}

export function jumpToNearestDiffFindMatch() {
  if (diffFindMatches.length === 0) {
    diffFindCurrent = 0;
    return;
  }
  let idx = diffFindMatches.findIndex(m => m.row >= diffCursor);
  if (idx === -1) idx = 0;
  diffFindCurrent = idx;
  diffCursor = diffFindMatches[idx].row;
  ensureDiffCursorVisible(viewportRows);
}

/// Shorten a path by replacing the home directory prefix with ~.
export function shortenPath(path: string): string {
  const home = appState.homeDir;
  if (home && path.startsWith(home)) {
    return "~" + path.slice(home.length);
  }
  return path;
}
