<script lang="ts">
  import type { Side, HighlightRegion } from "$lib/types";
  import { colors, syntaxColor } from "$lib/theme";
  import { appState } from "$lib/stores/app.svelte";

  interface FindHighlight {
    start: number;
    end: number;
    isCurrent: boolean;
  }

  interface Props {
    side: Side;
    isLeft: boolean;
    lineNumber: number | null;
    isInHunk: boolean;
    isCursorLine: boolean;
    hScroll: number;
    findHighlights: FindHighlight[];
  }

  let { side, isLeft, lineNumber, isInHunk, isCursorLine, hScroll, findHighlights = [] }: Props = $props();

  const FULL_LINE = -1;

  function lineBg(): string {
    if (side.is_filler) return colors.fillerBg;
    if (isCursorLine) return colors.cursorLine;
    if (isInHunk && side.highlights.length > 0) {
      return isLeft ? colors.deletedBg : colors.addedBg;
    }
    return "transparent";
  }

  function lineNumColor(): string {
    if (isInHunk && side.highlights.length > 0) return colors.lineNumberChanged;
    return colors.lineNumber;
  }

  interface Span {
    text: string;
    fg: string;
    bg: string;
  }

  function buildSpans(): Span[] {
    const content = side.content;
    if (side.is_filler || content.length === 0) return [];

    const hl = side.highlights;
    if (hl.length === 0) {
      // No highlights — dim unchanged text
      return [{ text: content, fg: colors.unchanged, bg: "transparent" }];
    }

    // Full-line highlight
    if (hl.length === 1 && hl[0].end === FULL_LINE) {
      const fg = appState.highlightMode < 2
        ? (hl[0].highlight ? syntaxColor(hl[0].highlight) : colors.fg)
        : colors.unchanged;
      const bg = appState.highlightMode === 0 ? (isLeft ? colors.deletedEmphasis : colors.addedEmphasis) : "transparent";
      return [{ text: content, fg, bg }];
    }

    // Character-level highlights
    const spans: Span[] = [];
    let pos = 0;

    // Sort highlights by start
    const sorted = [...hl].sort((a, b) => a.start - b.start);

    for (const region of sorted) {
      const start = region.start;
      const end = region.end === FULL_LINE ? content.length : Math.min(region.end, content.length);

      // Gap before this region
      if (pos < start) {
        spans.push({
          text: content.slice(pos, start),
          fg: colors.unchanged,
          bg: "transparent",
        });
      }

      // The highlighted region
      if (start < end) {
        spans.push({
          text: content.slice(start, end),
          fg: appState.highlightMode < 2
            ? (region.highlight ? syntaxColor(region.highlight) : colors.fg)
            : colors.unchanged,
          bg: appState.highlightMode === 0 ? (isLeft ? colors.deletedEmphasis : colors.addedEmphasis) : "transparent",
        });
      }

      pos = Math.max(pos, end);
    }

    // Trailing text
    if (pos < content.length) {
      spans.push({
        text: content.slice(pos),
        fg: colors.unchanged,
        bg: "transparent",
      });
    }

    return spans;
  }

  let spans = $derived(buildSpans());
  let bgColor = $derived(lineBg());
  let lnColor = $derived(lineNumColor());
  let lnText = $derived(lineNumber !== null ? String(lineNumber + 1) : "");
</script>

<div
  class="diff-line"
  style:background={bgColor}
  class:cursor-line={isCursorLine}
>
  {#if isCursorLine}
    <div class="cursor-marker" style:background={colors.cursorMarker}></div>
  {/if}
  <div class="line-number" style:color={lnColor}>
    {lnText}
  </div>
  <div class="line-content">
    <div class="line-content-inner" style:transform="translateX(-{hScroll}ch)">
      {#if side.is_filler}
        <span class="filler" style:color={colors.dimmed}>{"╱ ".repeat(200)}</span>
      {:else}
        {#each spans as span}
          <span style:color={span.fg} style:background={span.bg}>{span.text}</span>
        {/each}
      {/if}
    </div>
    {#if findHighlights.length > 0}
      <div class="find-overlay" style:transform="translateX(-{hScroll}ch)">
        {#each findHighlights as hl}
          <span
            class="find-hl"
            class:find-current={hl.isCurrent}
            style:left="{hl.start}ch"
            style:width="{hl.end - hl.start}ch"
          ></span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .diff-line {
    display: flex;
    height: 20px;
    line-height: 20px;
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", "Menlo", monospace;
    font-size: 12px;
    position: relative;
    white-space: pre;
  }
  .cursor-marker {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
  }
  .line-number {
    width: 48px;
    min-width: 48px;
    text-align: right;
    padding-right: 8px;
    user-select: none;
    flex-shrink: 0;
  }
  .line-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  .line-content-inner {
    white-space: pre;
  }
  .find-overlay {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    pointer-events: none;
  }
  .find-hl {
    position: absolute;
    top: 2px;
    bottom: 2px;
    background: rgba(230, 180, 50, 0.3);
    border: 1px solid rgba(230, 180, 50, 0.5);
    border-radius: 2px;
  }
  .find-current {
    background: rgba(230, 180, 50, 0.55);
    border-color: rgba(230, 180, 50, 0.8);
  }
</style>
