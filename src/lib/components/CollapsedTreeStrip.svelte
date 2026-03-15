<script lang="ts">
  import { appState, goToNextFileInTree, goToPrevFileInTree, toggleReviewed, clearReviews, exitDiff, refreshDiff, openDiffFind, closeDiffFind, toggleTreeAutoHide, toggleTreeHover, treeFileOrder } from "$lib/stores/app.svelte";
  import { colors } from "$lib/theme";

  let order = $derived(treeFileOrder());
  let treePos = $derived(order.indexOf(appState.currentFileIdx));
  let isFirstFile = $derived(treePos <= 0);
  let isLastFile = $derived(treePos >= order.length - 1);
  let isCurrentReviewed = $derived(appState.reviewed.has(appState.currentFileIdx));
  let hasAnyReviewed = $derived(appState.reviewed.size > 0);
</script>

<div class="collapsed-strip" style:background={colors.bg} style:border-right="1px solid {colors.border}">
  <div class="strip-buttons">
    <span class="strip-btn" style:color={colors.fgMuted} onclick={() => exitDiff()} title="Back to commits">⌂</span>
    <span
      class="strip-btn"
      style:color={isFirstFile ? colors.fgDim : colors.fgMuted}
      style:pointer-events={isFirstFile ? "none" : "auto"}
      onclick={() => goToPrevFileInTree()}
      title="Previous file"
    >‹</span>
    <span
      class="strip-btn"
      style:color={isLastFile ? colors.fgDim : colors.fgMuted}
      style:pointer-events={isLastFile ? "none" : "auto"}
      onclick={() => goToNextFileInTree()}
      title="Next file"
    >›</span>
    <span class="strip-sep" style:background={colors.border}></span>
    <span
      class="strip-btn"
      style:color={isCurrentReviewed ? colors.green : colors.fgDim}
      onclick={() => toggleReviewed()}
      title="Toggle reviewed"
    >✓</span>
    <span
      class="strip-btn"
      style:color={hasAnyReviewed ? colors.fgMuted : colors.fgDim}
      style:pointer-events={hasAnyReviewed ? "auto" : "none"}
      onclick={() => clearReviews()}
      title="Clear all reviews"
    >⊘</span>
    <span
      class="strip-btn"
      style:color={appState.diffFindActive ? colors.fg : colors.fgDim}
      onclick={() => appState.diffFindActive ? closeDiffFind() : openDiffFind()}
      title="Find in file"
    >/</span>
    <span
      class="strip-btn"
      style:color={colors.fgMuted}
      onclick={() => refreshDiff()}
      title="Refresh diff"
    >↻</span>
    <span
      class="strip-btn"
      style:color={colors.fgMuted}
      onclick={() => { const prev = appState.view; import("$lib/keyboard").then(m => m.setViewBeforeHelp(prev)); appState.view = "help"; }}
      title="Help (?)"
    >?</span>
  </div>
  <div class="strip-settings">
    <span
      class="strip-btn setting"
      onclick={() => { appState.highlightMode = (appState.highlightMode + 1) % 3; }}
      title="Cycle highlight mode (Ctrl+H)"
    ><span style:color={appState.highlightMode === 0 ? colors.fg : colors.fgDim}>E</span><span style:color={appState.highlightMode < 2 ? colors.fg : colors.fgDim}>S</span></span>
    <span class="strip-sep" style:background={colors.border}></span>
    <span
      class="strip-btn setting"
      style:color={appState.treeAutoHide ? colors.fg : colors.fgDim}
      onclick={() => toggleTreeAutoHide()}
      title="Auto-focus hide: {appState.treeAutoHide ? 'on' : 'off'}"
    >AF</span>
    <span
      class="strip-btn setting"
      style:color={appState.treeHoverEnabled ? colors.fg : colors.fgDim}
      onclick={() => toggleTreeHover()}
      title="Auto-hover hide: {appState.treeHoverEnabled ? 'on' : 'off'}"
    >AH</span>
    <span class="strip-sep" style:background={colors.border}></span>
    <span class="strip-btn" style:color={colors.fgMuted} onclick={() => { appState.showTree = true; appState.treeFocused = true; }} title="Show tree (t)">⇥</span>
  </div>
</div>

<style>
  .collapsed-strip {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 28px;
    height: 100%;
    flex-shrink: 0;
    overflow: hidden;
  }
  .strip-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding-top: 6px;
  }
  .strip-settings {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding-bottom: 6px;
  }
  .strip-btn {
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 3px 0;
    transition: opacity 0.1s;
    user-select: none;
  }
  .strip-btn:hover {
    opacity: 0.7;
  }
  .strip-btn.setting {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .strip-sep {
    width: 14px;
    height: 1px;
    margin: 3px 0;
    flex-shrink: 0;
  }
</style>
