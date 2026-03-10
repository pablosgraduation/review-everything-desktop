<script lang="ts">
  import { appState, selectCompareNew, selectCompareOld } from "$lib/stores/app.svelte";
  import { colors, fonts } from "$lib/theme";
  import type { CompareItem } from "$lib/types";

  let listEl = $state<HTMLDivElement | null>(null);

  // When search is active, only show matching items
  let visibleItems = $derived.by(() => {
    if (appState.searchActive) {
      const filterSet = new Set(appState.searchFiltered);
      return appState.compareItems
        .map((item, idx) => ({ item, idx }))
        .filter(({ idx }) => filterSet.has(idx));
    }
    return appState.compareItems.map((item, idx) => ({ item, idx }));
  });

  let title = $derived(
    appState.view === "compare-new"
      ? "Select NEW endpoint (right side)"
      : `Select OLD endpoint (left side) — NEW: ${appState.compareNewLabel}`
  );

  let lastMouseY = $state(0);

  function handleMouseMove(e: MouseEvent, idx: number) {
    if (Math.abs(e.clientY - lastMouseY) < 2) return;
    lastMouseY = e.clientY;
    appState.compareCursor = idx;
  }

  function handleClick(idx: number) {
    if (appState.searchActive) {
      appState.searchActive = false;
      appState.searchQuery = "";
      appState.searchFiltered = [];
    }
    appState.compareCursor = idx;
    if (appState.view === "compare-new") {
      selectCompareNew(idx);
    } else {
      selectCompareOld(idx);
    }
  }

  $effect(() => {
    if (!listEl) return;
    const cursor = appState.compareCursor;
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

<div class="compare-view" style:background={colors.bg} style:font-family={fonts.ui}>
  <div class="header" style:color={colors.white} style:border-bottom="1px solid {colors.border}">
    {title}
  </div>
  <div class="list" bind:this={listEl}>
    {#each visibleItems as { item, idx }}
      {@const isSelected = idx === appState.compareCursor}
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

        {#if item.label === "Working Tree"}
          <span class="badge" style:background="rgba(200, 175, 130, 0.15)" style:color={colors.statusModified}>{item.label}</span>
          <span class="item-subject" style:color={colors.fg}>Unstaged changes</span>
        {:else if item.label === "Staged"}
          <span class="badge" style:background="rgba(100, 190, 140, 0.15)" style:color={colors.statusCreated}>{item.label}</span>
          <span class="item-subject" style:color={colors.fg}>Ready to commit</span>
        {:else if !item.is_special}
          <span class="item-hash" style:color={colors.fgDim} style:font-family={fonts.mono}>{item.short_hash ?? ""}</span>
          <span class="item-subject" style:color={isSelected ? colors.white : colors.fg}>{item.subject ?? item.label}</span>
          <span class="item-date" style:color={colors.fgDim}>{item.date ?? ""}</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .compare-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-size: 13px;
  }
  .header {
    padding: 0 16px;
    font-size: 13px;
    font-weight: 500;
    flex-shrink: 0;
    height: 36px;
    display: flex;
    align-items: center;
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
</style>
