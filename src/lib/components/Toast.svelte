<script lang="ts">
  import { onDestroy } from "svelte";
  import { appState, shortenPath } from "$lib/stores/app.svelte";
  import { colors, fonts } from "$lib/theme";

  let visible = $state(false);
  let message = $state("");
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const val = appState.resolvedFromPath;
    clearTimeout(timer);
    if (val) {
      message = `Resolved ${val} to git root`;
      visible = true;
      timer = setTimeout(() => { visible = false; }, 4000);
    } else {
      visible = false;
    }
  });

  onDestroy(() => { clearTimeout(timer); });
</script>

{#if visible}
  <div class="toast" style:font-family={fonts.ui}>
    {message}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: rgb(45, 45, 55);
    color: rgb(200, 200, 200);
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 100;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    animation: toast-in 0.2s ease-out, toast-out 0.3s ease-in 3.7s forwards;
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes toast-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
</style>
