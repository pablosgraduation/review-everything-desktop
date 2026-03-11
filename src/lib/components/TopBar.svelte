<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { appState, openRepo, showWelcome, shortenPath } from "$lib/stores/app.svelte";
  import * as ipc from "$lib/ipc";
  import { colors, fonts } from "$lib/theme";

  let inputEl = $state<HTMLInputElement | null>(null);
  let inputValue = $state("");
  let suggestions = $state<string[]>([]);
  let suggestionCursor = $state(-1);
  let showDropdown = $state(false);
  let showRecents = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let wrapperEl = $state<HTMLDivElement | null>(null);

  let displayPath = $derived.by(() => {
    const p = appState.repoPath;
    if (!p) return "";
    return shortenPath(p);
  });

  let isDisabled = $derived(appState.view === "loading");

  function focusInput() {
    if (isDisabled) return;
    appState.topBarFocused = true;
    appState.treeFocused = false;
    inputValue = appState.repoPath;
    showDropdown = true;
    // Determine dropdown content: empty input or same as repo → recents
    showRecents = !inputValue || inputValue === appState.repoPath;
    if (showRecents) {
      loadRecents();
    }
    // Select all after DOM update
    requestAnimationFrame(() => {
      inputEl?.select();
    });
  }

  function blurInput() {
    appState.topBarFocused = false;
    inputValue = "";
    suggestions = [];
    suggestionCursor = -1;
    showDropdown = false;
    showRecents = false;
    clearTimeout(debounceTimer);
  }

  async function loadRecents() {
    try {
      const cfg = await ipc.getAppConfig();
      appState.recentRepos = cfg.recent_repos;
    } catch {
      appState.recentRepos = [];
    }
  }

  async function fetchSuggestions(value: string) {
    if (!value) {
      suggestions = [];
      suggestionCursor = -1;
      showRecents = true;
      return;
    }
    try {
      suggestions = await ipc.listDirs(value);
      suggestionCursor = -1;
      showRecents = false;
    } catch {
      suggestions = [];
    }
  }

  function onInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    inputValue = value;
    clearTimeout(debounceTimer);
    if (!value || value === appState.repoPath) {
      showRecents = true;
      suggestions = [];
      suggestionCursor = -1;
    } else {
      debounceTimer = setTimeout(() => fetchSuggestions(value), 80);
    }
    showDropdown = true;
  }

  function longestCommonPrefix(strs: string[]): string {
    if (strs.length === 0) return "";
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
      while (!strs[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
      }
    }
    return prefix;
  }

  async function handleKeydown(e: KeyboardEvent) {
    e.stopPropagation();

    if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length === 0 && !showRecents) {
        await fetchSuggestions(inputValue);
      }
      if (suggestions.length === 1) {
        inputValue = suggestions[0] + "/";
        await fetchSuggestions(inputValue);
      } else if (suggestions.length > 1) {
        if (suggestionCursor >= 0) {
          suggestionCursor = (suggestionCursor + (e.shiftKey ? -1 + suggestions.length : 1)) % suggestions.length;
          inputValue = suggestions[suggestionCursor] + "/";
        } else {
          const lcp = longestCommonPrefix(suggestions);
          if (lcp.length > inputValue.replace(/\/$/, "").length) {
            inputValue = lcp;
            await fetchSuggestions(inputValue);
          } else {
            suggestionCursor = 0;
            inputValue = suggestions[0] + "/";
          }
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (showRecents && !showingRecentsInDropdown()) {
        // nothing
      } else if (showRecents) {
        suggestionCursor = Math.min(appState.recentRepos.length - 1, suggestionCursor + 1);
      } else if (suggestions.length > 0) {
        suggestionCursor = Math.min(suggestions.length - 1, suggestionCursor + 1);
        inputValue = suggestions[suggestionCursor] + "/";
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showRecents) {
        suggestionCursor = Math.max(0, suggestionCursor - 1);
      } else if (suggestions.length > 0) {
        suggestionCursor = Math.max(0, suggestionCursor - 1);
        inputValue = suggestions[suggestionCursor] + "/";
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      let pathToOpen = inputValue.replace(/\/+$/, "").trim();
      // If a recent is highlighted, use that
      if (showRecents && suggestionCursor >= 0 && suggestionCursor < appState.recentRepos.length) {
        pathToOpen = appState.recentRepos[suggestionCursor];
      }
      if (pathToOpen) {
        // Revert display to old path before loading
        blurInput();
        openRepo(pathToOpen);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      blurInput();
      inputEl?.blur();
    } else {
      suggestionCursor = -1;
    }
  }

  function selectSuggestion(s: string) {
    inputValue = s + "/";
    fetchSuggestions(inputValue);
    inputEl?.focus();
  }

  function selectRecent(path: string) {
    blurInput();
    openRepo(path);
  }

  async function removeRecent(path: string, event: MouseEvent) {
    event.stopPropagation();
    const cfg = await ipc.removeRecent(path);
    appState.recentRepos = cfg.recent_repos;
  }

  async function openFolderDialog() {
    if (isDisabled) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      blurInput();
      openRepo(selected as string);
    }
  }

  function handleFocusTopBar() {
    focusInput();
    requestAnimationFrame(() => {
      inputEl?.focus();
    });
  }

  function handleClickOutside(e: MouseEvent) {
    if (appState.topBarFocused && wrapperEl && !wrapperEl.contains(e.target as Node)) {
      blurInput();
    }
  }

  function showingRecentsInDropdown(): boolean {
    return showRecents && appState.recentRepos.length > 0;
  }

  onMount(() => {
    window.addEventListener("re:focus-top-bar", handleFocusTopBar);
    document.addEventListener("mousedown", handleClickOutside);
  });

  onDestroy(() => {
    window.removeEventListener("re:focus-top-bar", handleFocusTopBar);
    document.removeEventListener("mousedown", handleClickOutside);
    clearTimeout(debounceTimer);
  });
</script>

<div class="top-bar" style:background={colors.bg} style:border-bottom="1px solid {colors.border}" style:font-family={fonts.ui} bind:this={wrapperEl}>
  <div class="input-wrapper">
    {#if appState.topBarFocused}
      <input
        bind:this={inputEl}
        class="path-input focused"
        type="text"
        value={inputValue}
        oninput={onInput}
        onkeydown={handleKeydown}
        placeholder="Type a path... (Tab to complete)"
        style:color={colors.fg}
        style:border-color="rgb(100, 140, 255)"
        style:font-family={fonts.mono}
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        disabled={isDisabled}
      />
    {:else}
      <button
        class="path-display"
        style:color={displayPath ? colors.fgMuted : colors.unchanged}
        style:border-color={colors.border}
        style:font-family={fonts.mono}
        onclick={focusInput}
        disabled={isDisabled}
      >
        {displayPath || "Open a repository..."}
      </button>
    {/if}

    {#if showDropdown && appState.topBarFocused}
      <div class="dropdown" style:border-color={colors.border}>
        {#if showRecents && appState.recentRepos.length > 0}
          <div class="dropdown-label" style:color={colors.unchanged}>RECENT</div>
          {#each appState.recentRepos as repo, i}
            <div
              class="dropdown-item"
              class:active={i === suggestionCursor}
              style:background={i === suggestionCursor ? colors.selected : "transparent"}
              style:color={i === suggestionCursor ? colors.fg : colors.fgMuted}
              onclick={() => selectRecent(repo)}
              role="button"
              tabindex="-1"
            >
              <span class="dropdown-item-path">{shortenPath(repo)}</span>
              <span
                class="remove-btn"
                style:color={colors.unchanged}
                onclick={(e) => removeRecent(repo, e)}
                role="button"
                tabindex="-1"
              >&times;</span>
            </div>
          {/each}
        {:else if !showRecents && suggestions.length > 0}
          {#each suggestions as s, i}
            <div
              class="dropdown-item"
              class:active={i === suggestionCursor}
              style:background={i === suggestionCursor ? colors.selected : "transparent"}
              style:color={i === suggestionCursor ? colors.fg : colors.fgMuted}
              onclick={() => selectSuggestion(s)}
              role="button"
              tabindex="-1"
            >
              {shortenPath(s)}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <button
    class="open-btn"
    style:color={colors.fgMuted}
    style:border-color={colors.border}
    onclick={openFolderDialog}
    disabled={isDisabled}
    title="Open folder"
  >
    Open
  </button>
</div>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 12px;
    gap: 8px;
    flex-shrink: 0;
    position: relative;
    z-index: 50;
  }
  .input-wrapper {
    flex: 1;
    position: relative;
    min-width: 0;
  }
  .path-display {
    width: 100%;
    background: transparent;
    border: 1px solid;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: border-color 0.1s;
    box-sizing: border-box;
  }
  .path-display:hover:not(:disabled) {
    border-color: rgb(80, 80, 90) !important;
  }
  .path-display:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .path-input {
    width: 100%;
    background: transparent;
    border: 1px solid;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 12px;
    box-sizing: border-box;
  }
  .path-input::placeholder {
    color: rgb(80, 80, 80);
  }
  .path-input.focused {
    outline: none;
  }
  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: rgb(30, 30, 35);
    border: 1px solid;
    border-top: none;
    border-radius: 0 0 6px 6px;
    max-height: 240px;
    overflow-y: auto;
    z-index: 50;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .dropdown-label {
    font-size: 11px;
    letter-spacing: 0.5px;
    padding: 6px 12px 2px;
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dropdown-item:hover {
    background: rgba(255, 255, 255, 0.04) !important;
  }
  .dropdown-item-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .remove-btn {
    flex-shrink: 0;
    width: 20px;
    text-align: center;
    font-size: 16px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .dropdown-item.active .remove-btn {
    opacity: 0.6;
  }
  .dropdown-item.active .remove-btn:hover {
    opacity: 1;
  }
  .open-btn {
    background: transparent;
    border: 1px solid;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: opacity 0.1s;
    font-family: inherit;
    flex-shrink: 0;
  }
  .open-btn:hover:not(:disabled) {
    opacity: 0.7;
  }
  .open-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
