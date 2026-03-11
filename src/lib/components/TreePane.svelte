<script lang="ts">
  import { appState, goToFile, goToNextFileInTree, goToPrevFileInTree, treeFileOrder, toggleReviewed, clearReviews, exitDiff, refreshDiff, openDiffFind, closeDiffFind } from "$lib/stores/app.svelte";
  import { colors, fonts, statusColor } from "$lib/theme";
  import { modLabel } from "$lib/platform";
  import type { TreeNode } from "$lib/types";

  interface FlatNode {
    name: string;
    isDir: boolean;
    fileIdx: number | null;
    status: string | undefined;
    additions: number;
    deletions: number;
    depth: number;
    expanded: boolean;
    movedFrom: string | undefined;
    isReviewed: boolean;
  }

  function flattenTree(nodes: TreeNode[], depth: number): FlatNode[] {
    const result: FlatNode[] = [];
    for (const node of nodes) {
      const isReviewed = node.file_idx !== undefined && node.file_idx !== null
        ? appState.reviewed.has(node.file_idx)
        : false;
      result.push({
        name: node.name,
        isDir: node.is_dir,
        fileIdx: node.file_idx ?? null,
        status: node.status,
        additions: node.additions,
        deletions: node.deletions,
        depth,
        expanded: node.expanded,
        movedFrom: node.moved_from,
        isReviewed,
      });
      if (node.is_dir && node.expanded) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }
    return result;
  }

  let flatNodes = $derived(flattenTree(appState.treeNodes, 0));

  let totalAdditions = $derived(appState.diffFiles.reduce((s, f) => s + f.additions, 0));
  let totalDeletions = $derived(appState.diffFiles.reduce((s, f) => s + f.deletions, 0));
  let reviewedCount = $derived(appState.reviewed.size);
  let hasAnyReviewed = $derived(appState.reviewed.size > 0);

  let order = $derived(treeFileOrder());
  let treePos = $derived(order.indexOf(appState.currentFileIdx));
  let isFirstFile = $derived(treePos <= 0);
  let isLastFile = $derived(treePos >= order.length - 1);
  let isCurrentReviewed = $derived(appState.reviewed.has(appState.currentFileIdx));

  function fmtTime(d: Date | null): string {
    if (!d) return "";
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const s = d.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  let loadedTime = $derived(fmtTime(appState.diffLoadedAt));
  let refreshedTime = $derived(fmtTime(appState.diffRefreshedAt));

  let refreshDelta = $derived(appState.refreshDeltaText);

  function toggleExpand(flatIdx: number) {
    let count = 0;
    function walk(nodes: TreeNode[]): boolean {
      for (const node of nodes) {
        if (count === flatIdx) {
          node.expanded = !node.expanded;
          appState.treeNodes = [...appState.treeNodes];
          return true;
        }
        count++;
        if (node.is_dir && node.expanded) {
          if (walk(node.children)) return true;
        }
      }
      return false;
    }
    walk(appState.treeNodes);
  }

  let lastMouseY = $state(0);

  function handleMouseMove(e: MouseEvent, flatIdx: number) {
    if (Math.abs(e.clientY - lastMouseY) < 2) return;
    lastMouseY = e.clientY;
    appState.treeCursor = flatIdx;
    appState.treeFocused = true;
  }

  function handleClick(flatIdx: number, node: FlatNode) {
    appState.treeCursor = flatIdx;
    if (node.isDir) {
      toggleExpand(flatIdx);
    } else if (node.fileIdx !== null) {
      goToFile(node.fileIdx);
      appState.treeFocused = false;
    }
  }

  let listEl: HTMLDivElement;

  $effect(() => {
    if (!listEl) return;
    const cursor = appState.treeCursor;
    const children = listEl.children;
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement;
      if (el.dataset.idx === String(cursor)) {
        el.scrollIntoView({ block: "nearest" });
        break;
      }
    }
  });
</script>

<div class="tree-pane" style:background={colors.bg} style:border-right="1px solid {colors.border}" style:font-family={fonts.ui} onmouseleave={() => { appState.treeFocused = false; }}>
  <!-- Header -->
  <div class="tree-header" style:border-bottom="1px solid {colors.border}">
    <span class="file-count" style:color={colors.fgMuted}>{appState.diffFiles.length} files</span>
    <span class="header-stats">
      {#if reviewedCount > 0}
        <span style:color={reviewedCount === appState.diffFiles.length ? colors.green : colors.fgDim}>
          {reviewedCount}/{appState.diffFiles.length} ✓
        </span>
      {/if}
      <span style:color={colors.green}>+{totalAdditions}</span>
      <span style:color={colors.red}>−{totalDeletions}</span>
    </span>
  </div>

  <!-- File list -->
  <div class="tree-list" bind:this={listEl}>
    {#each flatNodes as node, idx}
      {@const isCurrent = node.fileIdx === appState.currentFileIdx}
      {@const isCursorNode = appState.treeFocused && idx === appState.treeCursor}
      {@const dimmed = node.isReviewed}
      <div
        class="tree-node"
        class:cursor-node={isCursorNode}
        class:current-file={isCurrent && !isCursorNode}
        style:padding-left="{12 + node.depth * 24}px"
        style:background={isCursorNode ? colors.selected : isCurrent ? colors.treeCurrent : "transparent"}
        style:opacity={dimmed ? 0.4 : 1}
        onmousemove={(e) => handleMouseMove(e, idx)}
        onclick={() => handleClick(idx, node)}
        ondblclick={() => { if (!node.isDir && node.fileIdx !== null) toggleReviewed(node.fileIdx); }}
        data-idx={idx}
      >
        {#if isCursorNode}
          <span class="cursor-bar" style:background="rgb(100, 140, 255)"></span>
        {:else if isCurrent}
          <span class="cursor-bar" style:background="rgb(70, 75, 100)"></span>
        {/if}

        {#if node.isDir}
          <!-- Directory row -->
          <span class="chevron" style:color={colors.fgDim}>
            {node.expanded ? "▾" : "▸"}
          </span>
          <span class="node-name dir-name" style:color={colors.treeDirectory}>
            {node.name}
          </span>
        {:else}
          <!-- File row -->
          {#if node.movedFrom}
            <span class="node-name" style:color={colors.statusDeleted}>{node.movedFrom}</span>
            <span class="node-name" style:color={colors.fgDim}> → </span>
            <span class="node-name" style:color={colors.statusCreated}>{node.name}</span>
          {:else}
            <span class="node-name" style:color={statusColor(node.status)}>
              {node.name}
            </span>
          {/if}
        {/if}

        <!-- Status tag -->
        {#if node.status === "created" && !node.movedFrom && !node.isDir}
          <span class="status-tag" style:color={colors.statusCreated}>[NEW]</span>
        {:else if node.status === "deleted" && !node.isDir}
          <span class="status-tag" style:color={colors.statusDeleted}>[DEL]</span>
        {/if}

        <!-- Review mark -->
        {#if node.isReviewed}
          <span class="review-mark" style:color={colors.fgDim}>✓</span>
        {/if}

        <!-- Stats (right-aligned) -->
        {#if node.additions > 0 || node.deletions > 0}
          <span class="stats" style:color={colors.fgDim}>
            {#if node.additions > 0}
              <span style:color={dimmed ? colors.fgDim : colors.green}>+{node.additions}</span>
            {/if}
            {#if node.deletions > 0}
              <span style:color={dimmed ? colors.fgDim : colors.red}> −{node.deletions}</span>
            {/if}
          </span>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Status -->
  <div class="tree-status" style:border-top="1px solid {colors.border}">
    {#if loadedTime}
      <div class="status-line" style:color={colors.fgDim}>
        <span>loaded {loadedTime} · {appState.initialFileCount} files</span>
      </div>
    {/if}
    {#if refreshedTime}
      <div class="status-line" style:color={colors.fgDim}>
        <span>updated {refreshedTime} · {refreshDelta}</span>
      </div>
    {/if}
  </div>

  <!-- Toolbar -->
  <div class="tree-toolbar" style:border-top="1px solid {colors.border}">
    <span class="toolbar-group">
      <span class="tb-btn" style:color={colors.fgMuted} onclick={() => exitDiff()} title="Back to commits">⌂</span>
      <span
        class="tb-btn"
        style:color={isFirstFile ? colors.fgDim : colors.fgMuted}
        style:pointer-events={isFirstFile ? "none" : "auto"}
        onclick={() => goToPrevFileInTree()}
        title="Previous file"
      >‹</span>
      <span
        class="tb-btn"
        style:color={isLastFile ? colors.fgDim : colors.fgMuted}
        style:pointer-events={isLastFile ? "none" : "auto"}
        onclick={() => goToNextFileInTree()}
        title="Next file"
      >›</span>
      <span class="tb-sep" style:background={colors.border}></span>
      <span
        class="tb-btn"
        style:color={isCurrentReviewed ? colors.green : colors.fgDim}
        onclick={() => toggleReviewed()}
        title="Toggle reviewed"
      >✓</span>
      <span
        class="tb-btn"
        style:color={hasAnyReviewed ? colors.fgMuted : colors.fgDim}
        style:pointer-events={hasAnyReviewed ? "auto" : "none"}
        onclick={() => clearReviews()}
        title="Clear all reviews"
      >⊘</span>
      <span
        class="tb-btn"
        style:color={appState.diffFindActive ? colors.fg : colors.fgDim}
        onclick={() => appState.diffFindActive ? closeDiffFind() : openDiffFind()}
        title="Find in file ({modLabel}+F)"
      >/</span>
      <span class="tb-sep" style:background={colors.border}></span>
      <span
        class="tb-btn"
        style:color={colors.fgMuted}
        onclick={() => refreshDiff()}
        title="Refresh diff"
      >↻</span>
    </span>
  </div>
</div>

<style>
  .tree-pane {
    display: flex;
    flex-direction: column;
    width: 280px;
    min-width: 180px;
    max-width: 400px;
    height: 100%;
    font-size: 12px;
    flex-shrink: 0;
    overflow: hidden;
  }
  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    flex-shrink: 0;
    height: 28px;
    font-size: 11px;
    letter-spacing: 0.02em;
  }
  .file-count {
    font-weight: 500;
  }
  .header-stats {
    display: flex;
    gap: 8px;
    font-variant-numeric: tabular-nums;
  }
  .tree-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    min-height: 52px;
  }
  .tree-node {
    display: flex;
    align-items: center;
    height: 26px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    position: relative;
    padding-right: 8px;
    gap: 6px;
  }
  .cursor-bar {
    position: absolute;
    left: 0;
    top: 3px;
    bottom: 3px;
    width: 3px;
    border-radius: 0 2px 2px 0;
  }
  .chevron {
    width: 12px;
    flex-shrink: 0;
    font-size: 10px;
    text-align: center;
  }
  .node-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dir-name {
    font-weight: 600;
  }
  .status-tag {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 500;
    margin-left: 4px;
    letter-spacing: 0.03em;
  }
  .review-mark {
    flex-shrink: 0;
    font-size: 11px;
    margin-left: 2px;
  }
  .stats {
    margin-left: auto;
    flex-shrink: 0;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .tree-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    height: 28px;
    flex-shrink: 0;
    font-size: 11px;
  }
  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .tb-btn {
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0 3px;
    transition: opacity 0.1s;
    user-select: none;
  }
  .tb-btn:hover {
    opacity: 0.7;
  }
  .tb-sep {
    width: 1px;
    height: 14px;
    margin: 0 4px;
    flex-shrink: 0;
  }
  .tree-status {
    padding: 4px 10px;
    flex-shrink: 0;
    overflow: hidden;
    max-height: 52px;
  }
  .status-line {
    font-size: 10px;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }
</style>
