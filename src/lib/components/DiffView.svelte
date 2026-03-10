<script lang="ts">
  import DiffPane from "./DiffPane.svelte";
  import DiffFindBar from "./DiffFindBar.svelte";
  import DiffScrollbar from "./DiffScrollbar.svelte";
  import { appState, exitDiff, goToNextFileInTree, goToPrevFileInTree, treeFileOrder, toggleReviewed, clearReviews, openDiffFind, closeDiffFind } from "$lib/stores/app.svelte";
  import { colors } from "$lib/theme";

  let order = $derived(treeFileOrder());
  let treePos = $derived(order.indexOf(appState.currentFileIdx));
  let isFirstFile = $derived(treePos <= 0);
  let isLastFile = $derived(treePos >= order.length - 1);
  let isReviewed = $derived(appState.reviewed.has(appState.currentFileIdx));
  let hasAnyReviewed = $derived(appState.reviewed.size > 0);

  let file = $derived(appState.currentFile);
  let title = $derived.by(() => {
    if (!file) return "";
    const movedFrom = file.moved_from;
    if (movedFrom) return `${movedFrom} -> ${file.path}`;
    return String(file.path);
  });
</script>

<div class="diff-view" style:background={colors.bg}>
  <div class="diff-header" style:color={colors.white} style:border-bottom="1px solid {colors.border}">
    <span class="nav-controls">
      <span class="nav-btn" style:color={colors.fgMuted} onclick={() => exitDiff()} title="Back to commits">⌂</span>
      <span
        class="nav-btn"
        style:color={isFirstFile ? colors.fgDim : colors.fgMuted}
        style:pointer-events={isFirstFile ? "none" : "auto"}
        onclick={() => goToPrevFileInTree()}
      >‹</span>
      <span
        class="nav-btn"
        style:color={isLastFile ? colors.fgDim : colors.fgMuted}
        style:pointer-events={isLastFile ? "none" : "auto"}
        onclick={() => goToNextFileInTree()}
      >›</span>
      <span
        class="nav-btn"
        style:color={isReviewed ? colors.green : colors.fgDim}
        onclick={() => toggleReviewed()}
        title="Toggle reviewed"
      >✓</span>
      <span
        class="nav-btn"
        style:color={hasAnyReviewed ? colors.fgMuted : colors.fgDim}
        style:pointer-events={hasAnyReviewed ? "auto" : "none"}
        onclick={() => clearReviews()}
        title="Clear all reviews"
      >⊘</span>
      <span
        class="nav-btn"
        style:color={appState.diffFindActive ? colors.fg : colors.fgDim}
        onclick={() => appState.diffFindActive ? closeDiffFind() : openDiffFind()}
        title="Find in file (Ctrl+F)"
      >/</span>
    </span>
    <span class="file-path">{title}</span>
    {#if file}
      <span class="file-stats">
        <span style:color={colors.green}>+{file.additions}</span>
        <span style:color={colors.red}> -{file.deletions}</span>
        <span style:color={colors.unchanged}> &middot; {file.language}</span>
      </span>
    {/if}
  </div>
  <DiffFindBar />
  <div class="diff-panes">
    <DiffPane isLeft={true} />
    <div class="divider" style:background={colors.border}></div>
    <DiffPane isLeft={false} />
    <DiffScrollbar />
  </div>
</div>

<style>
  .diff-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    height: 100%;
  }
  .diff-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 12px;
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", "Menlo", monospace;
    font-size: 12px;
    flex-shrink: 0;
    height: 28px;
  }
  .nav-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-right: 10px;
    flex-shrink: 0;
  }
  .nav-btn {
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    transition: opacity 0.1s;
    user-select: none;
  }
  .nav-btn:hover {
    opacity: 0.7;
  }
  .file-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-stats {
    flex-shrink: 0;
    margin-left: 16px;
  }
  .diff-panes {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .divider {
    width: 1px;
    flex-shrink: 0;
  }
</style>
