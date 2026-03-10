<script lang="ts">
  import { appState, selectLogItem } from "$lib/stores/app.svelte";
  import { colors, fonts } from "$lib/theme";
  import type { LogItem } from "$lib/types";

  let listEl = $state<HTMLDivElement | null>(null);

  // When search is active, only show matching items
  let visibleItems = $derived.by(() => {
    if (appState.searchActive) {
      const filterSet = new Set(appState.searchFiltered);
      return appState.logItems
        .map((item, idx) => ({ item, idx }))
        .filter(({ idx }) => filterSet.has(idx));
    }
    return appState.logItems.map((item, idx) => ({ item, idx }));
  });

  let lastMouseY = $state(0);

  function handleMouseMove(e: MouseEvent, realIdx: number) {
    if (Math.abs(e.clientY - lastMouseY) < 2) return;
    lastMouseY = e.clientY;
    appState.logCursor = realIdx;
  }

  function handleClick(realIdx: number) {
    if (appState.searchActive) {
      appState.searchActive = false;
      appState.searchQuery = "";
      appState.searchFiltered = [];
    }
    appState.logCursor = realIdx;
    selectLogItem(realIdx);
  }

  function isSeparator(item: LogItem): boolean {
    return item.kind === "separator";
  }

  $effect(() => {
    if (!listEl) return;
    const cursor = appState.logCursor;
    // Find which visible child corresponds to the cursor
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

<div class="log-view" style:background={colors.bg} style:font-family={fonts.ui}>
  <div class="header" style:border-bottom="1px solid {colors.border}">
    <span class="title" style:color={colors.white}>Commits</span>
    <span class="hint" style:color={colors.fgDim}>Enter to open · c compare · / search</span>
  </div>
  <div class="list" bind:this={listEl}>
    {#each visibleItems as { item, idx }}
      {#if isSeparator(item)}
        <div class="separator" style:border-bottom="1px solid {colors.border}" data-idx={idx}></div>
      {:else}
        {@const isSelected = idx === appState.logCursor}
        <div
          class="item"
          class:selected={isSelected}
          style:background={isSelected ? colors.selected : "transparent"}
          onmousemove={(e) => handleMouseMove(e, idx)}
          onclick={() => handleClick(idx)}
          data-idx={idx}
        >
          {#if isSelected}
            <span class="select-bar" style:background="rgb(100, 140, 255)"></span>
          {/if}

          {#if item.kind === "working_tree"}
            <span class="badge badge-working" style:background="rgba(200, 175, 130, 0.15)" style:color={colors.statusModified}>Working Tree</span>
            <span class="item-subject" style:color={colors.fg}>Unstaged changes</span>
          {:else if item.kind === "staged"}
            <span class="badge badge-staged" style:background="rgba(100, 190, 140, 0.15)" style:color={colors.statusCreated}>Staged</span>
            <span class="item-subject" style:color={colors.fg}>Ready to commit</span>
          {:else if item.kind === "commit" && item.entry}
            <span class="item-hash" style:color={colors.fgDim} style:font-family={fonts.mono}>{item.entry.short_hash}</span>
            <span class="item-subject" style:color={isSelected ? colors.white : colors.fg} title={item.entry.subject}>{item.entry.subject}</span>
            <span class="item-date" style:color={colors.fgDim}>{item.entry.date}</span>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .log-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    width: 100%;
    font-size: 13px;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    flex-shrink: 0;
    height: 36px;
  }
  .title {
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.01em;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .hint {
    font-size: 11px;
    flex-shrink: 0;
    white-space: nowrap;
    margin-left: 16px;
  }
  .list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }
  .item {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 16px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    gap: 10px;
    position: relative;
  }
  .select-bar {
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 3px;
    border-radius: 0 2px 2px 0;
  }
  .badge {
    font-size: 11px;
    font-weight: 500;
    padding: 1px 8px;
    border-radius: 4px;
    flex-shrink: 0;
    letter-spacing: 0.02em;
  }
  .item-hash {
    font-size: 12px;
    flex-shrink: 0;
    width: 64px;
  }
  .item-subject {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item-date {
    flex-shrink: 0;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .separator {
    height: 1px;
    margin: 4px 16px;
  }
</style>
