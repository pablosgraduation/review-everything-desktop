<script lang="ts">
  import { appState } from "$lib/stores/app.svelte";
  import { colors } from "$lib/theme";

  let trackEl = $state<HTMLDivElement | null>(null);
  let trackHeight = $state(100);

  let file = $derived(appState.currentFile);
  let totalRows = $derived(file?.rows.length ?? 0);

  // Thumb position and size
  let thumbInfo = $derived.by(() => {
    if (totalRows === 0 || trackHeight === 0) return { top: 0, height: 0 };
    const vp = appState.viewportRows || 30;
    const thumbSize = Math.max(16, (vp / totalRows) * trackHeight);
    const scrollFraction = totalRows <= vp ? 0 : appState.diffScroll / (totalRows - vp);
    const thumbTop = scrollFraction * (trackHeight - thumbSize);
    return { top: thumbTop, height: thumbSize };
  });

  // Hunk marks mapped to scrollbar positions
  let hunkMarks = $derived.by(() => {
    if (!file || totalRows === 0 || trackHeight === 0) return [];
    const marks: { top: number; height: number; color: string }[] = [];
    for (const [start, end, kind] of file.hunks) {
      const top = (start / totalRows) * trackHeight;
      const height = Math.max(2, ((end - start) / totalRows) * trackHeight);
      let color: string;
      if (kind === "addonly") color = colors.green;
      else if (kind === "deleteonly") color = colors.red;
      else color = colors.statusModified;
      marks.push({ top, height, color });
    }
    return marks;
  });

  // Cursor position indicator
  let cursorTop = $derived(
    totalRows > 0 ? (appState.diffCursor / totalRows) * trackHeight : 0
  );

  $effect(() => {
    if (trackEl) {
      trackHeight = trackEl.clientHeight;
      const observer = new ResizeObserver(() => {
        if (trackEl) trackHeight = trackEl.clientHeight;
      });
      observer.observe(trackEl);
      return () => observer.disconnect();
    }
  });

  function handleClick(e: MouseEvent) {
    if (!trackEl || totalRows === 0) return;
    const rect = trackEl.getBoundingClientRect();
    const fraction = (e.clientY - rect.top) / rect.height;
    const row = Math.round(fraction * (totalRows - 1));
    appState.diffCursor = Math.max(0, Math.min(totalRows - 1, row));
    const vp = appState.viewportRows || 30;
    appState.diffScroll = Math.max(0, Math.min(totalRows - vp, appState.diffCursor - Math.floor(vp / 2)));
  }
</script>

<div
  class="scrollbar"
  style:background={colors.scrollbarTrack}
  bind:this={trackEl}
  onclick={handleClick}
  role="presentation"
>
  <!-- Hunk marks -->
  {#each hunkMarks as mark}
    <div
      class="hunk-mark"
      style:top="{mark.top}px"
      style:height="{mark.height}px"
      style:background={mark.color}
    ></div>
  {/each}

  <!-- Thumb -->
  <div
    class="thumb"
    style:top="{thumbInfo.top}px"
    style:height="{thumbInfo.height}px"
    style:background={colors.scrollbarThumb}
  ></div>

  <!-- Cursor indicator -->
  <div
    class="cursor-indicator"
    style:top="{cursorTop}px"
    style:background={colors.cursorMarker}
  ></div>
</div>

<style>
  .scrollbar {
    width: 14px;
    flex-shrink: 0;
    position: relative;
    cursor: pointer;
  }
  .hunk-mark {
    position: absolute;
    left: 0;
    width: 14px;
    min-height: 2px;
    pointer-events: none;
    opacity: 0.6;
  }
  .thumb {
    position: absolute;
    left: 2px;
    width: 10px;
    border-radius: 5px;
    pointer-events: none;
    opacity: 0.5;
  }
  .cursor-indicator {
    position: absolute;
    left: 0;
    width: 14px;
    height: 2px;
    pointer-events: none;
  }
</style>
