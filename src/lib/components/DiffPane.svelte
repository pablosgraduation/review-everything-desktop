<script lang="ts">
  import DiffLine from "./DiffLine.svelte";
  import type { Row } from "$lib/types";
  import { appState, ensureDiffCursorVisible } from "$lib/stores/app.svelte";
  import { colors } from "$lib/theme";

  interface Props {
    isLeft: boolean;
  }

  let { isLeft }: Props = $props();

  let containerEl = $state<HTMLDivElement | null>(null);

  // Build a set of rows that are inside a hunk for quick lookup
  function hunkSet(): Set<number> {
    const file = appState.currentFile;
    if (!file) return new Set();
    const s = new Set<number>();
    for (const [start, end] of file.hunks) {
      for (let i = start; i < end; i++) s.add(i);
    }
    return s;
  }

  let inHunk = $derived(hunkSet());

  // Virtual scrolling: only render visible rows
  const ROW_HEIGHT = 20;
  let containerHeight = $state(600);

  let visibleStart = $derived(appState.diffScroll);
  let visibleCount = $derived(Math.ceil(containerHeight / ROW_HEIGHT) + 2);
  let totalRows = $derived(appState.currentFile?.rows.length ?? 0);

  let visibleRows = $derived.by(() => {
    const file = appState.currentFile;
    if (!file) return [];
    const start = Math.max(0, visibleStart);
    const end = Math.min(file.rows.length, start + visibleCount);
    const result: { row: Row; idx: number; lineNum: number | null }[] = [];
    for (let i = start; i < end; i++) {
      const aligned = file.aligned_lines[i];
      const lineNum = isLeft
        ? (aligned?.[0] ?? null)
        : (aligned?.[1] ?? null);
      result.push({ row: file.rows[i], idx: i, lineNum });
    }
    return result;
  });

  // Build a map of row → find highlights for this pane's side
  let findHighlightMap = $derived.by(() => {
    if (!appState.diffFindActive || !appState.diffFindQuery) return new Map<number, { start: number; end: number; isCurrent: boolean }[]>();
    const side = isLeft ? "left" : "right";
    const map = new Map<number, { start: number; end: number; isCurrent: boolean }[]>();
    const matches = appState.diffFindMatches;
    const current = appState.diffFindCurrent;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      if (m.side === side) {
        if (!map.has(m.row)) map.set(m.row, []);
        map.get(m.row)!.push({ start: m.start, end: m.end, isCurrent: i === current });
      }
    }
    return map;
  });

  $effect(() => {
    if (containerEl) {
      containerHeight = containerEl.clientHeight;
      appState.viewportRows = Math.floor(containerHeight / ROW_HEIGHT);
      const observer = new ResizeObserver(() => {
        if (containerEl) {
          containerHeight = containerEl.clientHeight;
          appState.viewportRows = Math.floor(containerHeight / ROW_HEIGHT);
        }
      });
      observer.observe(containerEl);
      return () => observer.disconnect();
    }
  });

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    // Shift+wheel or native horizontal scroll (trackpad) → horizontal scroll
    if (e.shiftKey) {
      appState.hScroll = Math.max(0, appState.hScroll + Math.sign(e.deltaY));
      return;
    }
    if (e.deltaX !== 0) {
      appState.hScroll = Math.max(0, appState.hScroll + Math.sign(e.deltaX));
      return;
    }
    const delta = Math.sign(e.deltaY);
    const maxRow = totalRows - 1;
    appState.diffCursor = Math.max(0, Math.min(maxRow, appState.diffCursor + delta));
    ensureDiffCursorVisible(Math.floor(containerHeight / ROW_HEIGHT));
  }

  function handleClick(e: MouseEvent) {
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rowIdx = visibleStart + Math.floor(y / ROW_HEIGHT);
    if (rowIdx >= 0 && rowIdx < totalRows) {
      appState.diffCursor = rowIdx;
    }
  }
</script>

<div
  class="diff-pane"
  bind:this={containerEl}
  style:background={colors.bg}
  onwheel={handleWheel}
  onclick={handleClick}
  role="presentation"
>
  {#each visibleRows as { row, idx, lineNum } (idx)}
    <DiffLine
      side={isLeft ? row.left : row.right}
      {isLeft}
      lineNumber={lineNum}
      isInHunk={inHunk.has(idx)}
      isCursorLine={idx === appState.diffCursor}
      hScroll={appState.hScroll}
      findHighlights={findHighlightMap.get(idx) ?? []}
    />
  {/each}
</div>

<style>
  .diff-pane {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
