<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { appState, openRepo, shortenPath } from "$lib/stores/app.svelte";
  import * as ipc from "$lib/ipc";
  import { colors, fonts } from "$lib/theme";

  let pathInput = $state("");
  let suggestions = $state<string[]>([]);
  let suggestionCursor = $state(-1);
  let inputEl = $state<HTMLInputElement | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  async function openFolderDialog() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      openRepo(selected as string);
    }
  }

  function handleOpenFolder() {
    openFolderDialog();
  }

  async function removeRecent(path: string, event: MouseEvent) {
    event.stopPropagation();
    const cfg = await ipc.removeRecent(path);
    appState.recentRepos = cfg.recent_repos;
    if (appState.repoPickerCursor >= cfg.recent_repos.length) {
      appState.repoPickerCursor = Math.max(0, cfg.recent_repos.length - 1);
    }
  }

  let lastMouseY = 0;

  function handleMouseMove(e: MouseEvent, idx: number) {
    if (Math.abs(e.clientY - lastMouseY) < 2) return;
    lastMouseY = e.clientY;
    appState.repoPickerCursor = idx;
  }

  async function fetchSuggestions(value: string) {
    if (!value) {
      suggestions = [];
      suggestionCursor = -1;
      return;
    }
    try {
      suggestions = await ipc.listDirs(value);
      suggestionCursor = -1;
    } catch {
      suggestions = [];
    }
  }

  function onPathInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    pathInput = value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchSuggestions(value), 80);
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

  async function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length === 0) {
        await fetchSuggestions(pathInput);
      }
      if (suggestions.length === 1) {
        pathInput = suggestions[0] + "/";
        await fetchSuggestions(pathInput);
      } else if (suggestions.length > 1) {
        if (suggestionCursor >= 0) {
          // Cycle through suggestions
          suggestionCursor = (suggestionCursor + (e.shiftKey ? -1 + suggestions.length : 1)) % suggestions.length;
          pathInput = suggestions[suggestionCursor] + "/";
        } else {
          // Complete to longest common prefix
          const lcp = longestCommonPrefix(suggestions);
          if (lcp.length > pathInput.replace(/\/$/, "").length) {
            pathInput = lcp;
            await fetchSuggestions(pathInput);
          } else {
            // LCP equals input already — start cycling
            suggestionCursor = 0;
            pathInput = suggestions[0] + "/";
          }
        }
      }
    } else if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      suggestionCursor = Math.min(suggestions.length - 1, suggestionCursor + 1);
      pathInput = suggestions[suggestionCursor] + "/";
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      suggestionCursor = Math.max(0, suggestionCursor - 1);
      pathInput = suggestions[suggestionCursor] + "/";
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (pathInput.trim()) {
        openRepo(pathInput.replace(/\/+$/, ""));
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      inputEl?.blur();
      suggestions = [];
      suggestionCursor = -1;
    } else {
      // Reset cycling on any other key
      suggestionCursor = -1;
    }
  }

  function selectSuggestion(s: string) {
    pathInput = s + "/";
    fetchSuggestions(pathInput);
    inputEl?.focus();
  }

  function handleFocusPathInput() {
    inputEl?.focus();
  }

  onMount(() => {
    window.addEventListener("re:open-folder", handleOpenFolder);
    window.addEventListener("re:focus-path-input", handleFocusPathInput);
  });

  onDestroy(() => {
    window.removeEventListener("re:open-folder", handleOpenFolder);
    window.removeEventListener("re:focus-path-input", handleFocusPathInput);
    clearTimeout(debounceTimer);
  });
</script>

<div class="picker" style:font-family={fonts.ui}>
  <div class="inner">
    <div class="title" style:color={colors.fg}>Review Everything</div>

    <button class="open-btn" tabindex="-1" style:color={colors.fg} style:border-color={colors.border} onclick={openFolderDialog}>
      Open Repository...
    </button>

    <div class="path-input-wrapper">
      <input
        bind:this={inputEl}
        class="path-input"
        type="text"
        placeholder="Type a path... (Tab to complete)"
        value={pathInput}
        oninput={onPathInput}
        onkeydown={handleInputKeydown}
        style:color={colors.fg}
        style:border-color={colors.border}
        style:font-family={fonts.mono}
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      />
      {#if suggestions.length > 0 && pathInput}
        <div class="suggestions" style:border-color={colors.border} style:background="rgb(30, 30, 35)">
          {#each suggestions as s, i}
            <div
              class="suggestion-item"
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
        </div>
      {/if}
    </div>

    {#if appState.recentRepos.length > 0}
      <div class="recent-label" style:color={colors.unchanged}>Recent</div>
      <div class="recent-list">
        {#each appState.recentRepos as repo, i}
          <div
            class="recent-item"
            class:active={i === appState.repoPickerCursor}
            style:background={i === appState.repoPickerCursor ? colors.selected : "transparent"}
            onclick={() => openRepo(repo)}
            onmousemove={(e) => handleMouseMove(e, i)}
            role="button"
            tabindex="-1"
          >
            <span class="recent-path" style:color={i === appState.repoPickerCursor ? colors.fg : colors.fgMuted}>
              {shortenPath(repo)}
            </span>
            <span
              class="remove-btn"
              style:color={colors.unchanged}
              onclick={(e) => removeRecent(repo, e)}
              role="button"
              tabindex="-1"
            >&times;</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="hints" style:color={colors.unchanged}>
      <span>/ type path</span>
      <span>&middot;</span>
      <span>o browse</span>
      <span>&middot;</span>
      <span>j/k navigate</span>
      <span>&middot;</span>
      <span>enter select</span>
    </div>
  </div>
</div>

<style>
  .picker {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    min-width: 360px;
    max-width: 500px;
  }
  .title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .open-btn {
    background: transparent;
    border: 1px solid;
    border-radius: 6px;
    padding: 8px 24px;
    font-size: 13px;
    cursor: pointer;
    transition: opacity 0.1s;
    font-family: inherit;
  }
  .open-btn:hover {
    opacity: 0.8;
  }
  .path-input-wrapper {
    width: 100%;
    position: relative;
  }
  .path-input {
    width: 100%;
    background: transparent;
    border: 1px solid;
    border-radius: 6px;
    padding: 7px 12px;
    font-size: 12px;
    box-sizing: border-box;
  }
  .path-input::placeholder {
    color: rgb(80, 80, 80);
  }
  .path-input:focus {
    outline: 1px solid rgb(100, 140, 255);
    outline-offset: -1px;
  }
  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    border: 1px solid;
    border-radius: 0 0 6px 6px;
    max-height: 160px;
    overflow-y: auto;
    z-index: 10;
  }
  .suggestion-item {
    padding: 4px 12px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .suggestion-item:hover {
    background: rgba(255, 255, 255, 0.04) !important;
  }
  .recent-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 8px;
    align-self: flex-start;
  }
  .recent-list {
    width: 100%;
    display: flex;
    flex-direction: column;
  }
  .recent-item {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s;
  }
  .recent-path {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .recent-item.active .remove-btn {
    opacity: 0.6;
  }
  .recent-item.active .remove-btn:hover {
    opacity: 1;
  }
  .hints {
    display: flex;
    gap: 8px;
    font-size: 11px;
    margin-top: 8px;
  }
</style>
