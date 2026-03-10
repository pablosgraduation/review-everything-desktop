<script lang="ts">
  import { appState, closeDiffFind, nextDiffFindMatch, prevDiffFindMatch, jumpToNearestDiffFindMatch } from "$lib/stores/app.svelte";
  import { colors, fonts } from "$lib/theme";

  let inputEl = $state<HTMLInputElement | null>(null);

  function autoFocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 0);
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    appState.diffFindQuery = target.value;
    appState.diffFindCurrent = 0;
    jumpToNearestDiffFindMatch();
  }

  function handleKeydown(e: KeyboardEvent) {
    e.stopPropagation();

    if (e.key === "Escape") {
      closeDiffFind();
      e.preventDefault();
    } else if (e.key === "Enter" && e.shiftKey) {
      prevDiffFindMatch();
      e.preventDefault();
    } else if (e.key === "Enter") {
      nextDiffFindMatch();
      e.preventDefault();
    } else if (e.key === "Tab") {
      inputEl?.blur();
      e.preventDefault();
    } else if (e.ctrlKey && e.key === "f") {
      closeDiffFind();
      e.preventDefault();
    } else if (e.ctrlKey && e.code === "KeyO") {
      toggleOld();
      e.preventDefault();
    } else if (e.ctrlKey && e.code === "KeyN") {
      toggleNew();
      e.preventDefault();
    }
  }

  function toggleOld() {
    if (appState.diffFindSearchOld && !appState.diffFindSearchNew) return;
    appState.diffFindSearchOld = !appState.diffFindSearchOld;
    appState.diffFindCurrent = 0;
    jumpToNearestDiffFindMatch();
  }

  function toggleNew() {
    if (appState.diffFindSearchNew && !appState.diffFindSearchOld) return;
    appState.diffFindSearchNew = !appState.diffFindSearchNew;
    appState.diffFindCurrent = 0;
    jumpToNearestDiffFindMatch();
  }

  let matchInfo = $derived.by(() => {
    const total = appState.diffFindMatches.length;
    if (!appState.diffFindQuery) return "";
    if (total === 0) return "no matches";
    const cur = Math.min(appState.diffFindCurrent, total - 1) + 1;
    return `${cur}/${total}`;
  });
</script>

{#if appState.diffFindActive}
  <div class="find-bar" style:background="rgb(28, 28, 34)" style:border-bottom="1px solid {colors.border}" style:font-family={fonts.ui}>
    <span class="find-icon" style:color={colors.fgDim}>/</span>
    <input
      bind:this={inputEl}
      use:autoFocus
      oninput={handleInput}
      onkeydown={handleKeydown}
      placeholder="Find in file..."
      style:color={colors.fg}
      style:background="transparent"
      style:font-family={fonts.ui}
    />
    <span class="find-scope">
      <span
        class="scope-btn"
        class:active={appState.diffFindSearchOld}
        style:color={appState.diffFindSearchOld ? colors.fg : colors.fgDim}
        style:background={appState.diffFindSearchOld ? "rgba(255,255,255,0.08)" : "transparent"}
        onclick={toggleOld}
        title="Ctrl+O"
      ><u>O</u>ld</span>
      <span
        class="scope-btn"
        class:active={appState.diffFindSearchNew}
        style:color={appState.diffFindSearchNew ? colors.fg : colors.fgDim}
        style:background={appState.diffFindSearchNew ? "rgba(255,255,255,0.08)" : "transparent"}
        onclick={toggleNew}
        title="Ctrl+N"
      ><u>N</u>ew</span>
    </span>
    {#if matchInfo}
      <span class="match-count" style:color={colors.fgDim}>{matchInfo}</span>
    {/if}
    <span class="close-btn" style:color={colors.fgDim} onclick={() => closeDiffFind()}>×</span>
  </div>
{/if}

<style>
  .find-bar {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
    gap: 8px;
    font-size: 13px;
    flex-shrink: 0;
  }
  .find-icon {
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
    min-width: 80px;
  }
  input::placeholder {
    color: rgb(80, 80, 90);
  }
  .find-scope {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .scope-btn {
    cursor: pointer;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 3px;
    user-select: none;
    transition: opacity 0.1s;
  }
  .scope-btn:hover {
    opacity: 0.8;
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
