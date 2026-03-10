// Color scheme ported from highlights.rs

export const colors = {
  // Diff backgrounds
  deletedBg: "rgb(50, 18, 18)",
  addedBg: "rgb(18, 40, 18)",
  deletedEmphasis: "rgb(100, 30, 30)",
  addedEmphasis: "rgb(30, 80, 30)",
  fillerBg: "rgb(30, 30, 30)",

  // Syntax highlighting
  keyword: "rgb(198, 120, 221)",
  string: "rgb(152, 195, 121)",
  comment: "rgb(92, 99, 112)",
  type: "rgb(229, 192, 123)",
  delimiter: "rgb(171, 178, 191)",
  normal: "rgb(200, 200, 200)",

  // UI
  unchanged: "rgb(120, 120, 120)",
  lineNumber: "rgb(80, 80, 80)",
  lineNumberChanged: "rgb(140, 140, 100)",
  border: "rgb(50, 50, 54)",
  cursorLine: "rgb(40, 40, 65)",
  cursorMarker: "rgb(80, 80, 180)",
  selected: "rgb(45, 50, 80)",
  treeDirectory: "rgb(160, 170, 185)",
  treeCurrent: "rgb(38, 38, 44)",
  scrollbarTrack: "rgb(40, 40, 40)",
  scrollbarThumb: "rgb(100, 100, 100)",
  dimmed: "rgb(80, 80, 80)",

  // File status (muted, modern tones)
  statusCreated: "rgb(100, 190, 140)",
  statusDeleted: "rgb(210, 100, 100)",
  statusModified: "rgb(200, 175, 130)",

  // General
  bg: "rgb(24, 24, 24)",
  fg: "rgb(200, 200, 200)",
  fgMuted: "rgb(140, 140, 150)",
  fgDim: "rgb(100, 100, 110)",
  white: "rgb(230, 232, 236)",
  green: "rgb(100, 190, 140)",
  red: "rgb(210, 100, 100)",
  surfaceHover: "rgba(255, 255, 255, 0.04)",
  surfaceActive: "rgba(255, 255, 255, 0.07)",
} as const;

export const fonts = {
  mono: '"JetBrains Mono", "Fira Code", "SF Mono", "Menlo", monospace',
  ui: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
} as const;

export function syntaxColor(
  highlight: string | null | undefined,
): string {
  switch (highlight) {
    case "keyword":
      return colors.keyword;
    case "string":
      return colors.string;
    case "comment":
      return colors.comment;
    case "type":
      return colors.type;
    case "delimiter":
      return colors.delimiter;
    case "normal":
      return colors.normal;
    default:
      return colors.fg;
  }
}

export function statusColor(status: string | undefined): string {
  switch (status) {
    case "created":
      return colors.statusCreated;
    case "deleted":
      return colors.statusDeleted;
    case "modified":
      return colors.statusModified;
    default:
      return colors.unchanged;
  }
}
