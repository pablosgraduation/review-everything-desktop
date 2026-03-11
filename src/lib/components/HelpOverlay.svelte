<script lang="ts">
  import { appState } from "$lib/stores/app.svelte";
  import { viewBeforeHelp } from "$lib/keyboard";
  import { colors, fonts } from "$lib/theme";
  import { modLabel } from "$lib/platform";

  const mod = modLabel;

  const shortcuts = [
    ["Navigation", ""],
    ["j / k", "Scroll down / up"],
    ["↑ / ↓", "Scroll down / up"],
    ["Shift+↑ / ↓", "Scroll 5 lines"],
    [`${mod}+↑ / ↓`, "Go to top / bottom"],
    [`${mod}+Shift+↑ / ↓`, "Next / previous hunk"],
    ["h / l", "Scroll left / right"],
    ["Shift+← / →", "Scroll 5 chars"],
    [`${mod}+← / →`, "Beginning / end of line"],
    ["g / G", "Go to top / bottom"],
    [`${mod}+d / u`, "Half page down / up"],
    ["n / N", "Next / previous hunk"],
    ["] / [", "Next / previous file"],
    ["", ""],
    ["Diff View", ""],
    ["Enter", "Select (in tree/log)"],
    ["Esc / q", "Back / quit"],
    ["Tab", "Toggle tree focus"],
    ["t", "Toggle tree visibility"],
    ["r", "Toggle reviewed mark"],
    ["R", "Clear all reviews"],
    ["?", "Toggle help"],
    ["", ""],
    ["Log / Compare", ""],
    ["/", "Search"],
    ["c", "Compare mode"],
    ["o", "Focus repo bar"],
    [`${mod}+r`, "Refresh log"],
    ["Enter", "Select commit"],
  ];
</script>

<div class="help-overlay" onclick={() => { appState.view = viewBeforeHelp as any; }} role="button" tabindex="-1">
  <div class="help-content" style:background="rgb(30, 30, 35)" style:border="1px solid {colors.border}" onclick={(e) => e.stopPropagation()} role="dialog">
    <div class="help-title" style:color={colors.white}>Keyboard Shortcuts</div>
    <div class="help-body">
      {#each shortcuts as [key, desc]}
        {#if key === "" && desc === ""}
          <div class="help-spacer"></div>
        {:else if desc === ""}
          <div class="help-section" style:color={colors.treeDirectory}>{key}</div>
        {:else}
          <div class="help-row">
            <span class="help-key" style:color={colors.keyword}>{key}</span>
            <span class="help-desc" style:color={colors.fg}>{desc}</span>
          </div>
        {/if}
      {/each}
    </div>
    <div class="help-footer" style:color={colors.unchanged}>Press ? or Esc to close · click outside to dismiss</div>
  </div>
</div>

<style>
  .help-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .help-content {
    padding: 24px 32px;
    border-radius: 8px;
    min-width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    /* uses app-level system font */
    font-size: 13px;
  }
  .help-title {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 16px;
    text-align: center;
  }
  .help-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .help-section {
    font-weight: bold;
    margin-top: 4px;
  }
  .help-row {
    display: flex;
    gap: 16px;
  }
  .help-key {
    width: 140px;
    flex-shrink: 0;
    text-align: right;
  }
  .help-desc {
    flex: 1;
  }
  .help-spacer {
    height: 8px;
  }
  .help-footer {
    margin-top: 16px;
    text-align: center;
    font-size: 11px;
  }
</style>
