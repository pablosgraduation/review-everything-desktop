// IPC types mirroring the Rust backend

export interface HighlightRegion {
  start: number;
  end: number; // -1 means full line
  highlight: SyntaxHighlight | null;
}

export type SyntaxHighlight =
  | "delimiter"
  | "normal"
  | "string"
  | "type"
  | "comment"
  | "keyword";

export interface Side {
  content: string;
  is_filler: boolean;
  highlights: HighlightRegion[];
}

export interface Row {
  left: Side;
  right: Side;
}

export type HunkKind = "addonly" | "deleteonly" | "mixed";
export type FileStatus = "created" | "deleted" | "modified" | "unchanged";

export interface DisplayFile {
  path: string;
  moved_from: string | null;
  language: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  rows: Row[];
  hunks: [number, number, HunkKind][];
  aligned_lines: [number | null, number | null][];
  content_hash: number;
}

export interface LogEntry {
  full_hash: string;
  short_hash: string;
  date: string;
  subject: string;
}

export interface LogItem {
  kind: "working_tree" | "staged" | "separator" | "commit";
  entry?: LogEntry;
}

export interface DiffContext {
  left: string;
  right: string;
}

export interface DiffResult {
  files: DisplayFile[];
  scope: string;
  context: DiffContext;
}

export interface ReviewState {
  reviewed_indices: number[];
}

export interface CompareItem {
  rev: string;
  label: string;
  is_special: boolean;
  short_hash?: string;
  date?: string;
  subject?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  file_idx?: number;
  status?: FileStatus;
  additions: number;
  deletions: number;
  children: TreeNode[];
  expanded: boolean;
  moved_from?: string;
}

export interface AppConfig {
  last_repo: string | null;
  recent_repos: string[];
}
