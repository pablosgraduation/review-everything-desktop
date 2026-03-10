<script lang="ts">
  import { appState, startCompare, treeFileOrder, showRepoPicker, loadLog, shortenPath } from "$lib/stores/app.svelte";
  import { colors, fonts } from "$lib/theme";

  let repoDisplay = $derived.by(() => {
    const p = appState.repoPath;
    if (!p) return "Review Everything";
    return shortenPath(p);
  });

  function openHelp() {
    import("$lib/keyboard").then((m) => { m.setViewBeforeHelp(appState.view); });
    appState.view = "help";
  }

  function openSearch() {
    appState.searchActive = true;
    appState.searchQuery = "";
    appState.searchCursor = 0;
    appState.searchScroll = 0;
    if (appState.view === "log") {
      appState.searchFiltered = appState.logItems
        .map((_: any, i: number) => i)
        .filter((i: number) => appState.logItems[i].kind !== "separator");
    } else if (appState.view === "compare-new" || appState.view === "compare-old") {
      appState.searchFiltered = appState.compareItems.map((_: any, i: number) => i);
    }
  }

  function closeSearch() {
    appState.searchActive = false;
    appState.searchQuery = "";
    appState.searchFiltered = [];
  }

  function compareBack() {
    if (appState.searchActive) closeSearch();
    if (appState.view === "compare-old") {
      startCompare(); // Go back to pick-new
    } else {
      appState.view = "log";
    }
  }

  let repoName = $derived.by(() => {
    const p = appState.repoPath;
    if (!p) return "";
    const parts = p.split("/");
    return parts[parts.length - 1] || "";
  });

  let filePos = $derived.by(() => {
    const file = appState.currentFile;
    if (!file) return "";
    const order = treeFileOrder();
    const pos = order.indexOf(appState.currentFileIdx);
    const idx = (pos >= 0 ? pos : 0) + 1;
    const total = order.length;
    return `[${idx}/${total}] ${file.path}`;
  });

  let logTimestamp = $derived.by(() => {
    const d = appState.logLoadedAt;
    if (!d) return "";
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const s = d.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  });

  let reviewInfo = $derived.by(() => {
    const count = appState.reviewed.size;
    const total = appState.diffFiles.length;
    if (count === 0) return "";
    return `${count}/${total} reviewed`;
  });

  let lineInfo = $derived.by(() => {
    const file = appState.currentFile;
    if (!file) return "";
    const row = appState.diffCursor + 1;
    const total = file.rows.length;
    return `${row}/${total}`;
  });
</script>

<div class="status-bar" style:background={colors.bg} style:border-top="1px solid {colors.border}" style:font-family={fonts.ui}>
  {#if appState.view === "diff"}
    <span class="left" style:color={colors.fg}>
      {#if repoName}<span style:color={colors.unchanged}>Repo:</span> {repoName} <span style:color={colors.unchanged}>&middot; File:</span> {/if}{filePos}
    </span>
    <span class="center">
      <span style:color={colors.unchanged}>Left:</span> <span style:color={colors.fg}>{appState.diffContext.left}</span>
      <span style:color={colors.unchanged}>&nbsp;&middot;&nbsp;Right:</span> <span style:color={colors.fg}>{appState.diffContext.right}</span>
    </span>
    <span class="right">
      {#if reviewInfo}
        <span style:color={appState.reviewed.size === appState.diffFiles.length ? colors.green : colors.unchanged}>
          {reviewInfo}
        </span>
        <span style:color={colors.unchanged}>&nbsp;&middot;&nbsp;</span>
      {/if}
      <span style:color={colors.unchanged}>{lineInfo}</span>
    </span>
  {:else if appState.view === "log"}
    <span class="left" style:color={colors.fg}>
      {repoDisplay}
      {#if logTimestamp}
        <span style:color={colors.unchanged}>&nbsp;&middot; Updated: {logTimestamp}</span>
      {/if}
    </span>
    <span class="right" style:color={colors.unchanged}>
      <span class="hint-link" onclick={openHelp}>? help</span>
      <span> &middot; </span>
      <span class="hint-link" onclick={() => showRepoPicker()}>o open repo</span>
      <span> &middot; </span>
      <span class="hint-link" onclick={() => startCompare()}>c compare</span>
      <span> &middot; </span>
      <span class="hint-link" onclick={() => loadLog()}>ctrl+r refresh</span>
      <span> &middot; </span>
      <span class="hint-link" onclick={openSearch}>/ search</span>
    </span>
  {:else if appState.view === "compare-new" || appState.view === "compare-old"}
    <span class="left" style:color={colors.fg}>
      {appState.view === "compare-new" ? "Pick NEW side" : "Pick OLD side"}
    </span>
    <span class="right" style:color={colors.unchanged}>
      <span class="hint-link" onclick={openSearch}>/ search</span>
      <span> &middot; </span>
      <span class="hint-link" onclick={compareBack}>Esc back</span>
    </span>
  {/if}
</div>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    height: 24px;
    padding: 0 8px;
    font-size: 11px;
    flex-shrink: 0;
  }
  .left {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .center {
    flex: 0 0 auto;
    margin: 0 16px;
  }
  .right {
    flex: 0 0 auto;
    text-align: right;
  }
  .hint-link {
    cursor: pointer;
    transition: opacity 0.1s;
  }
  .hint-link:hover {
    opacity: 0.7;
  }
</style>
