<script lang="ts">
  import { appState, selectLogItem, selectCompareNew, selectCompareOld } from "$lib/stores/app.svelte";
  import { colors, fonts } from "$lib/theme";

  let inputEl = $state<HTMLInputElement | null>(null);

  // Svelte use: action — runs when the element is mounted to the DOM
  function autoFocus(node: HTMLInputElement) {
    // Small delay to ensure the element is fully in the layout
    setTimeout(() => node.focus(), 0);
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    appState.searchQuery = target.value;
    updateFilter();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Stop propagation on ALL keys so the global handler never sees them
    e.stopPropagation();

    if (e.key === "Tab") {
      // Keep focus in the search input
      e.preventDefault();
    } else if (e.key === "Escape") {
      closeSearch();
      e.preventDefault();
    } else if (e.key === "Enter") {
      confirmSearch();
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      moveSearchCursor(1);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      moveSearchCursor(-1);
      e.preventDefault();
    }
  }

  function updateFilter() {
    const query = appState.searchQuery.toLowerCase();

    if (appState.view === "log") {
      if (query === "") {
        appState.searchFiltered = appState.logItems
          .map((_, i) => i)
          .filter(i => appState.logItems[i].kind !== "separator");
      } else {
        appState.searchFiltered = appState.logItems
          .map((item, i) => ({ item, i }))
          .filter(({ item }) => {
            if (item.kind === "separator") return false;
            if (item.kind === "working_tree") return "working tree unstaged changes".includes(query);
            if (item.kind === "staged") return "staged ready to commit".includes(query);
            if (item.kind === "commit" && item.entry) {
              const e = item.entry;
              return e.short_hash.toLowerCase().includes(query) ||
                e.full_hash.toLowerCase().includes(query) ||
                e.date.toLowerCase().includes(query) ||
                e.subject.toLowerCase().includes(query);
            }
            return false;
          })
          .map(({ i }) => i);
      }
    } else if (appState.view === "compare-new" || appState.view === "compare-old") {
      if (query === "") {
        appState.searchFiltered = appState.compareItems.map((_, i) => i);
      } else {
        appState.searchFiltered = appState.compareItems
          .map((item, i) => ({ item, i }))
          .filter(({ item }) => {
            if (item.label === "Working Tree") return "working tree unstaged changes".includes(query);
            if (item.label === "Staged") return "staged ready to commit".includes(query);
            // Commits: search hash, date, subject
            const searchable = [item.short_hash, item.date, item.subject, item.label]
              .filter(Boolean).join(" ").toLowerCase();
            return searchable.includes(query);
          })
          .map(({ i }) => i);
      }
    }

    appState.searchCursor = 0;
    appState.searchScroll = 0;
    syncSearchToReal();
  }

  function moveSearchCursor(delta: number) {
    if (appState.searchFiltered.length === 0) return;
    const max = appState.searchFiltered.length - 1;
    if (delta > 0) {
      appState.searchCursor = Math.min(appState.searchCursor + delta, max);
    } else {
      appState.searchCursor = Math.max(0, appState.searchCursor + delta);
    }
    syncSearchToReal();
  }

  function syncSearchToReal() {
    const realIdx = appState.searchFiltered[appState.searchCursor] ?? 0;
    if (appState.view === "log") {
      appState.logCursor = realIdx;
    } else if (appState.view === "compare-new" || appState.view === "compare-old") {
      appState.compareCursor = realIdx;
    }
  }

  function confirmSearch() {
    const view = appState.view;
    const realIdx = appState.searchFiltered[appState.searchCursor];
    appState.searchActive = false;
    appState.searchQuery = "";
    appState.searchFiltered = [];

    if (realIdx !== undefined) {
      if (view === "log") {
        selectLogItem(realIdx);
      } else if (view === "compare-new") {
        selectCompareNew(realIdx);
      } else if (view === "compare-old") {
        selectCompareOld(realIdx);
      }
    }
  }

  function closeSearch() {
    appState.searchActive = false;
    appState.searchQuery = "";
    appState.searchFiltered = [];
  }
</script>

{#if appState.searchActive}
  <div class="search-bar" style:background="rgb(32, 32, 38)" style:border-top="1px solid {colors.border}" style:font-family={fonts.ui}>
    <span class="search-icon" style:color={colors.fgDim}>/</span>
    <!-- Uncontrolled input: no value={...} binding to avoid Svelte reactivity fights -->
    <input
      bind:this={inputEl}
      use:autoFocus
      oninput={handleInput}
      onkeydown={handleKeydown}
      placeholder="Type to search..."
      style:color={colors.fg}
      style:background="transparent"
      style:font-family={fonts.ui}
    />
    <span class="match-count" style:color={colors.fgDim}>
      {appState.searchFiltered.length > 0
        ? `${appState.searchCursor + 1}/${appState.searchFiltered.length}`
        : "no matches"}
    </span>
    <span class="close-btn" style:color={colors.fgDim} onclick={closeSearch}>×</span>
  </div>
{/if}

<style>
  .search-bar {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
    gap: 8px;
    font-size: 13px;
    flex-shrink: 0;
  }
  .search-icon {
    font-size: 14px;
    flex-shrink: 0;
    opacity: 0.6;
  }
  input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 13px;
    user-select: text;
    -webkit-user-select: text;
  }
  input::placeholder {
    color: rgb(80, 80, 90);
  }
  .match-count {
    font-size: 11px;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .close-btn {
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
    padding: 0 2px;
    transition: opacity 0.1s;
    user-select: none;
  }
  .close-btn:hover {
    opacity: 0.7;
  }
</style>
