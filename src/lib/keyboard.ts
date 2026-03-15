// Global keyboard handler

import {
  appState,
  selectLogItem,
  startCompare,
  goToFile,
  toggleReviewed,
  clearReviews,
  exitDiff,
  ensureDiffCursorVisible,
  loadLog,
  goToNextFileInTree,
  goToPrevFileInTree,
  openDiffFind,
  closeDiffFind,
  nextDiffFindMatch,
  prevDiffFindMatch,
  showWelcome,
} from "$lib/stores/app.svelte";
import { isModKey } from "$lib/platform";
import type { TreeNode } from "$lib/types";

function viewport() {
  return appState.viewportRows || 30;
}

let lastSpaceTime = 0;
const DOUBLE_TAP_MS = 300;

export let viewBeforeHelp: string = "log";

export function setViewBeforeHelp(v: string) {
  viewBeforeHelp = v;
}

export function handleKeydown(e: KeyboardEvent) {
  // Top bar input handles its own keys
  if (appState.topBarFocused) return;

  // Search mode is handled by the SearchOverlay component
  if (appState.searchActive) return;

  const view = appState.view;

  // Help view
  if (view === "help") {
    if (e.key === "?" || e.key === "Escape" || e.key === "q") {
      appState.view = viewBeforeHelp as any;
      e.preventDefault();
    }
    return;
  }

  // Welcome view
  if (view === "welcome") {
    if (e.key === "o") {
      window.dispatchEvent(new Event("re:focus-top-bar"));
      e.preventDefault();
    } else if (e.key === "?") {
      viewBeforeHelp = appState.view;
      appState.view = "help";
      e.preventDefault();
    }
    return;
  }

  // Error view
  if (view === "error") {
    if (e.key === "Escape" || e.key === "q") {
      const target = appState.viewBeforeError;
      if (target === "welcome" || !appState.repoPath) {
        showWelcome();
      } else if (target === "log") {
        loadLog();
      } else {
        // Return to previous view (diff, compare, etc.) — data is intact
        appState.view = target;
      }
      e.preventDefault();
    }
    return;
  }

  // Loading view
  if (view === "loading") {
    // No-op during loading (let async operation complete)
    return;
  }

  // Log view
  if (view === "log") {
    handleLogKey(e);
    return;
  }

  // Compare views
  if (view === "compare-new" || view === "compare-old") {
    handleCompareKey(e);
    return;
  }

  // Diff view
  if (view === "diff") {
    if (appState.treeFocused) {
      handleTreeKey(e);
    } else {
      handleDiffKey(e);
    }
  }
}

function handleLogKey(e: KeyboardEvent) {
  // Ctrl+r: refresh log
  if (isModKey(e) && e.key === "r") {
    loadLog();
    e.preventDefault();
    return;
  }

  const count = appState.logItems.length;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const down = e.key === "ArrowDown";
    if (isModKey(e)) {
      appState.logCursor = down ? Math.max(0, count - 1) : 0;
      if (!down) appState.logScroll = 0;
      e.preventDefault();
      return;
    }
    if (e.shiftKey) {
      moveCursorLog(down ? 5 : -5, count);
      e.preventDefault();
      return;
    }
  }

  switch (e.key) {
    case "j":
    case "ArrowDown":
      moveCursorLog(1, count);
      e.preventDefault();
      break;
    case "k":
    case "ArrowUp":
      moveCursorLog(-1, count);
      e.preventDefault();
      break;
    case "g":
      appState.logCursor = 0;
      appState.logScroll = 0;
      e.preventDefault();
      break;
    case "G":
      appState.logCursor = Math.max(0, count - 1);
      e.preventDefault();
      break;
    case "d":
      if (isModKey(e)) {
        moveCursorLog(15, count);
        e.preventDefault();
      }
      break;
    case "u":
      if (isModKey(e)) {
        moveCursorLog(-15, count);
        e.preventDefault();
      }
      break;
    case "Enter":
      selectLogItem(appState.logCursor);
      e.preventDefault();
      break;
    case "c":
      startCompare();
      e.preventDefault();
      break;
    case "/":
      appState.searchActive = true;
      appState.searchQuery = "";
      appState.searchFiltered = appState.logItems
        .map((_, i) => i)
        .filter((i) => appState.logItems[i].kind !== "separator");
      e.preventDefault();
      break;
    case "q":
      // Can't quit a desktop app easily, do nothing
      break;
    case "o":
      window.dispatchEvent(new Event("re:focus-top-bar"));
      e.preventDefault();
      break;
    case "?":
      viewBeforeHelp = appState.view;
      appState.view = "help";
      e.preventDefault();
      break;
  }
}

function moveCursorLog(delta: number, count: number) {
  let next = Math.max(0, Math.min(count - 1, appState.logCursor + delta));
  // Skip separators
  if (appState.logItems[next]?.kind === "separator") {
    next += delta > 0 ? 1 : -1;
    next = Math.max(0, Math.min(count - 1, next));
  }
  appState.logCursor = next;
}

function handleCompareKey(e: KeyboardEvent) {
  const count = appState.compareItems.length;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const down = e.key === "ArrowDown";
    if (isModKey(e)) {
      appState.compareCursor = down ? Math.max(0, count - 1) : 0;
      if (!down) appState.compareScroll = 0;
      e.preventDefault();
      return;
    }
    if (e.shiftKey) {
      const delta = down ? 5 : -5;
      appState.compareCursor = Math.max(0, Math.min(count - 1, appState.compareCursor + delta));
      e.preventDefault();
      return;
    }
  }

  switch (e.key) {
    case "j":
    case "ArrowDown":
      appState.compareCursor = Math.min(count - 1, appState.compareCursor + 1);
      e.preventDefault();
      break;
    case "k":
    case "ArrowUp":
      appState.compareCursor = Math.max(0, appState.compareCursor - 1);
      e.preventDefault();
      break;
    case "g":
      appState.compareCursor = 0;
      e.preventDefault();
      break;
    case "G":
      appState.compareCursor = Math.max(0, count - 1);
      e.preventDefault();
      break;
    case "Enter": {
      const idx = appState.compareCursor;
      if (appState.view === "compare-new") {
        import("$lib/stores/app.svelte").then((m) => m.selectCompareNew(idx));
      } else {
        import("$lib/stores/app.svelte").then((m) => m.selectCompareOld(idx));
      }
      e.preventDefault();
      break;
    }
    case "Escape":
    case "q":
      if (appState.view === "compare-old") {
        startCompare(); // Go back to pick-new
      } else {
        loadLog();
      }
      e.preventDefault();
      break;
    case "/":
      appState.searchActive = true;
      appState.searchQuery = "";
      appState.searchFiltered = appState.compareItems.map((_, i) => i);
      e.preventDefault();
      break;
  }
}

function handleDiffKey(e: KeyboardEvent) {
  const totalRows = appState.totalRows;

  // When find is active, remap n/N to match navigation, Escape closes find
  if (appState.diffFindActive) {
    if (e.key === "n") {
      nextDiffFindMatch();
      e.preventDefault();
      return;
    }
    if (e.key === "N") {
      prevDiffFindMatch();
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      closeDiffFind();
      e.preventDefault();
      return;
    }
  }

  // Ctrl+F: open find, or refocus if already open
  if (isModKey(e) && e.key === "f") {
    if (appState.diffFindActive) {
      const input = document.querySelector('.find-bar input') as HTMLInputElement | null;
      input?.focus();
    } else {
      openDiffFind();
    }
    e.preventDefault();
    return;
  }

  // Handle arrow keys with modifiers first
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const down = e.key === "ArrowDown";
    if (isModKey(e) && e.shiftKey) {
      // Ctrl+Shift+Arrow: next/prev hunk
      if (down) nextHunk(); else prevHunk();
      e.preventDefault();
      return;
    }
    if (isModKey(e)) {
      // Ctrl+Arrow: scroll to top/bottom
      if (down) {
        appState.diffCursor = Math.max(0, totalRows - 1);
      } else {
        appState.diffCursor = 0;
        appState.diffScroll = 0;
      }
      ensureDiffCursorVisible(viewport());
      e.preventDefault();
      return;
    }
    if (e.shiftKey) {
      // Shift+Arrow: scroll 5 lines
      const delta = down ? 5 : -5;
      appState.diffCursor = Math.max(0, Math.min(totalRows - 1, appState.diffCursor + delta));
      ensureDiffCursorVisible(viewport());
      e.preventDefault();
      return;
    }
  }

  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const right = e.key === "ArrowRight";
    if (isModKey(e)) {
      // Ctrl+Left/Right: beginning/end of line
      appState.hScroll = right ? 200 : 0;
      e.preventDefault();
      return;
    }
    if (e.shiftKey) {
      // Shift+Left/Right: scroll 5 chars
      const delta = right ? 5 : -5;
      appState.hScroll = Math.max(0, appState.hScroll + delta);
      e.preventDefault();
      return;
    }
  }

  // Ctrl+r: refresh diff
  if (isModKey(e) && e.key === "r") {
    import("$lib/stores/app.svelte").then((m) => m.refreshDiff());
    e.preventDefault();
    return;
  }

  // Ctrl+H: cycle highlight mode
  if (isModKey(e) && e.key === "h") {
    appState.highlightMode = (appState.highlightMode + 1) % 3;
    e.preventDefault();
    return;
  }

  switch (e.key) {
    case "j":
    case "ArrowDown":
      appState.diffCursor = Math.min(totalRows - 1, appState.diffCursor + 1);
      ensureDiffCursorVisible(viewport());
      e.preventDefault();
      break;
    case "k":
    case "ArrowUp":
      appState.diffCursor = Math.max(0, appState.diffCursor - 1);
      ensureDiffCursorVisible(viewport());
      e.preventDefault();
      break;
    case "h":
    case "ArrowLeft":
      appState.hScroll = Math.max(0, appState.hScroll - 4);
      e.preventDefault();
      break;
    case "l":
    case "ArrowRight":
      appState.hScroll += 4;
      e.preventDefault();
      break;
    case "g":
      appState.diffCursor = 0;
      appState.diffScroll = 0;
      e.preventDefault();
      break;
    case "G":
      appState.diffCursor = Math.max(0, totalRows - 1);
      ensureDiffCursorVisible(viewport());
      e.preventDefault();
      break;
    case "d":
      if (isModKey(e)) {
        appState.diffCursor = Math.min(totalRows - 1, appState.diffCursor + Math.floor(viewport() / 2));
        ensureDiffCursorVisible(viewport());
        e.preventDefault();
      }
      break;
    case "u":
      if (isModKey(e)) {
        appState.diffCursor = Math.max(0, appState.diffCursor - Math.floor(viewport() / 2));
        ensureDiffCursorVisible(viewport());
        e.preventDefault();
      }
      break;
    case "0":
      appState.hScroll = 0;
      e.preventDefault();
      break;
    case "$":
      appState.hScroll = 200; // large enough
      e.preventDefault();
      break;
    case "n":
      nextHunk();
      e.preventDefault();
      break;
    case "N":
      prevHunk();
      e.preventDefault();
      break;
    case "]":
      goToNextFileInTree();
      e.preventDefault();
      break;
    case "[":
      goToPrevFileInTree();
      e.preventDefault();
      break;
    case "Tab":
      appState.treeFocused = true;
      if (!appState.showTree) appState.showTree = true;
      e.preventDefault();
      break;
    case "t":
      if (appState.treeVisible) {
        appState.showTree = false;
        appState.treeFocused = false;
      } else {
        appState.showTree = true;
        appState.treeFocused = true;
      }
      e.preventDefault();
      break;
    case "r":
      toggleReviewed();
      e.preventDefault();
      break;
    case "R":
      clearReviews();
      e.preventDefault();
      break;
    case "/":
      openDiffFind();
      e.preventDefault();
      break;
    case "o":
      window.dispatchEvent(new Event("re:focus-top-bar"));
      e.preventDefault();
      break;
    case "Escape":
    case "q":
      exitDiff();
      e.preventDefault();
      break;
    case "?":
      viewBeforeHelp = appState.view;
      appState.view = "help";
      e.preventDefault();
      break;
    case " ": {
      const now = Date.now();
      if (now - lastSpaceTime < DOUBLE_TAP_MS) {
        lastSpaceTime = 0;
        if (appState.treeVisible) {
          appState.showTree = false;
          appState.treeFocused = false;
        } else {
          appState.showTree = true;
          appState.treeFocused = true;
        }
      } else {
        lastSpaceTime = now;
      }
      e.preventDefault();
      break;
    }
  }
}

function handleTreeKey(e: KeyboardEvent) {
  const flatCount = countFlatNodes(appState.treeNodes);

  // Ctrl+r: refresh diff
  if (isModKey(e) && e.key === "r") {
    import("$lib/stores/app.svelte").then((m) => m.refreshDiff());
    e.preventDefault();
    return;
  }

  // Ctrl+F: open find, or refocus if already open
  if (isModKey(e) && e.key === "f") {
    if (appState.diffFindActive) {
      const input = document.querySelector('.find-bar input') as HTMLInputElement | null;
      input?.focus();
    } else {
      openDiffFind();
    }
    e.preventDefault();
    return;
  }

  // Ctrl+H: cycle highlight mode
  if (isModKey(e) && e.key === "h") {
    appState.highlightMode = (appState.highlightMode + 1) % 3;
    e.preventDefault();
    return;
  }

  // Handle arrow keys with modifiers
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const down = e.key === "ArrowDown";
    if (isModKey(e)) {
      appState.treeCursor = down ? Math.max(0, flatCount - 1) : 0;
      if (!down) appState.treeScroll = 0;
      e.preventDefault();
      return;
    }
    if (e.shiftKey) {
      const delta = down ? 5 : -5;
      appState.treeCursor = Math.max(0, Math.min(flatCount - 1, appState.treeCursor + delta));
      e.preventDefault();
      return;
    }
  }

  switch (e.key) {
    case "j":
    case "ArrowDown":
      appState.treeCursor = Math.min(flatCount - 1, appState.treeCursor + 1);
      e.preventDefault();
      break;
    case "k":
    case "ArrowUp":
      appState.treeCursor = Math.max(0, appState.treeCursor - 1);
      e.preventDefault();
      break;
    case "g":
      appState.treeCursor = 0;
      appState.treeScroll = 0;
      e.preventDefault();
      break;
    case "G":
      appState.treeCursor = Math.max(0, flatCount - 1);
      e.preventDefault();
      break;
    case "d":
      if (isModKey(e)) {
        appState.treeCursor = Math.min(flatCount - 1, appState.treeCursor + 15);
        e.preventDefault();
      }
      break;
    case "u":
      if (isModKey(e)) {
        appState.treeCursor = Math.max(0, appState.treeCursor - 15);
        e.preventDefault();
      }
      break;
    case "Enter": {
      const node = getFlatNode(appState.treeNodes, appState.treeCursor);
      if (node) {
        if (node.is_dir) {
          node.expanded = !node.expanded;
          appState.treeNodes = [...appState.treeNodes];
        } else if (node.file_idx !== undefined && node.file_idx !== null) {
          goToFile(node.file_idx);
          appState.treeFocused = false;
        }
      }
      e.preventDefault();
      break;
    }
    case "r": {
      const rNode = getFlatNode(appState.treeNodes, appState.treeCursor);
      if (rNode?.file_idx !== undefined && rNode?.file_idx !== null) {
        toggleReviewed(rNode.file_idx);
      }
      e.preventDefault();
      break;
    }
    case "R":
      clearReviews();
      e.preventDefault();
      break;
    case "Tab":
    case "Escape":
      appState.treeFocused = false;
      if (appState.treeAutoHide) {
        appState.showTree = false;
      }
      e.preventDefault();
      break;
    case "t":
      appState.showTree = false;
      appState.treeFocused = false;
      e.preventDefault();
      break;
    case "?":
      viewBeforeHelp = appState.view;
      appState.view = "help";
      e.preventDefault();
      break;
    case "q":
      exitDiff();
      e.preventDefault();
      break;
    case " ": {
      const now = Date.now();
      if (now - lastSpaceTime < DOUBLE_TAP_MS) {
        lastSpaceTime = 0;
        appState.showTree = false;
        appState.treeFocused = false;
      } else {
        lastSpaceTime = now;
      }
      e.preventDefault();
      break;
    }
  }
}

function countFlatNodes(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.is_dir && node.expanded) {
      count += countFlatNodes(node.children);
    }
  }
  return count;
}

function getFlatNode(nodes: TreeNode[], target: number): TreeNode | null {
  let count = 0;
  function walk(ns: TreeNode[]): TreeNode | null {
    for (const n of ns) {
      if (count === target) return n;
      count++;
      if (n.is_dir && n.expanded) {
        const found = walk(n.children);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(nodes);
}

function nextHunk() {
  const file = appState.currentFile;
  if (!file) return;

  for (const [start] of file.hunks) {
    if (start > appState.diffCursor) {
      appState.diffCursor = start;
      ensureDiffCursorVisible(viewport());
      return;
    }
  }

  // Wrap to next file
  const files = appState.diffFiles;
  for (let offset = 1; offset < files.length; offset++) {
    const idx = (appState.currentFileIdx + offset) % files.length;
    if (files[idx].hunks.length > 0) {
      goToFile(idx);
      return;
    }
  }
}

function prevHunk() {
  const file = appState.currentFile;
  if (!file) return;

  for (let i = file.hunks.length - 1; i >= 0; i--) {
    const [start] = file.hunks[i];
    if (start < appState.diffCursor) {
      appState.diffCursor = start;
      ensureDiffCursorVisible(viewport());
      return;
    }
  }

  // Wrap to previous file
  const files = appState.diffFiles;
  for (let offset = 1; offset < files.length; offset++) {
    const idx = (appState.currentFileIdx + files.length - offset) % files.length;
    if (files[idx].hunks.length > 0) {
      appState.currentFileIdx = idx;
      appState.hScroll = 0;
      const lastHunk = files[idx].hunks[files[idx].hunks.length - 1];
      appState.diffCursor = lastHunk[0];
      ensureDiffCursorVisible(viewport());
      return;
    }
  }
}

