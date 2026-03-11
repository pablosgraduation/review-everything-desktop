<script lang="ts">
  import { onMount } from "svelte";
  import { appState, openRepo, showWelcome } from "$lib/stores/app.svelte";
  import * as ipc from "$lib/ipc";
  import { handleKeydown } from "$lib/keyboard";
  import { colors, fonts } from "$lib/theme";
  import TopBar from "$lib/components/TopBar.svelte";
  import LogView from "$lib/components/LogView.svelte";
  import CompareView from "$lib/components/CompareView.svelte";
  import DiffView from "$lib/components/DiffView.svelte";
  import TreePane from "$lib/components/TreePane.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import HelpOverlay from "$lib/components/HelpOverlay.svelte";
  import SearchOverlay from "$lib/components/SearchOverlay.svelte";
  import Toast from "$lib/components/Toast.svelte";

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);

    (async () => {
      try {
        // Fetch home dir for cross-platform ~ display
        appState.homeDir = await ipc.getHomeDir();
      } catch { /* non-critical */ }

      try {
        const cfg = await ipc.getAppConfig();
        if (cfg.last_repo) {
          try {
            await openRepo(cfg.last_repo);
          } catch {
            showWelcome();
          }
        } else {
          showWelcome();
        }
      } catch {
        showWelcome();
      }
    })();

    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<div class="app" style:background={colors.bg} style:color={colors.fg} style:font-family={fonts.ui}>
  <TopBar />
  <div class="main-area">
    {#if appState.view === "welcome"}
      <div class="center-message">
        <div style:color={colors.fg} style:font-size="16px" style:font-weight="600">Review Everything</div>
        <div style:color={colors.unchanged} style:margin-top="12px" style:font-size="13px">Open a repository to get started</div>
      </div>
    {:else if appState.view === "log"}
      <LogView />
    {:else if appState.view === "compare-new" || appState.view === "compare-old"}
      <CompareView />
    {:else if appState.view === "loading"}
      <div class="center-message">
        <div class="spinner"></div>
        <div style:color={colors.unchanged} style:margin-top="12px">{appState.loadingMessage}</div>
      </div>
    {:else if appState.view === "error"}
      <div class="center-message">
        <div style:color={colors.red} style:font-size="14px">Error</div>
        <div style:color={colors.fg} style:margin-top="8px" style:max-width="600px" style:text-align="center">
          {appState.errorMessage}
        </div>
        <div style:color={colors.unchanged} style:margin-top="16px" style:font-size="12px">
          Press Esc to go back
        </div>
      </div>
    {:else if appState.view === "diff"}
      {#if appState.showTree}
        <TreePane />
      {/if}
      <DiffView />
    {/if}
  </div>
  <SearchOverlay />
  <Toast />
  <StatusBar />
  {#if appState.view === "help"}
    <HelpOverlay />
  {/if}
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    outline: none;
  }
  :global(html, body) {
    height: 100%;
    overflow: hidden;
  }
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    font-size: 13px;
    overflow: hidden;
    user-select: none;
  }
  .main-area {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }
  .center-message {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgb(60, 60, 60);
    border-top-color: rgb(150, 150, 150);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
