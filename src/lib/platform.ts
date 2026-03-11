// Platform detection for cross-platform keyboard shortcuts and UI

export const isMac = navigator.userAgent.includes("Mac");

/** Returns true if the platform modifier key is pressed (Cmd on macOS, Ctrl elsewhere).
 *  On macOS, accepts BOTH Cmd and Ctrl to preserve TUI muscle memory. */
export function isModKey(e: KeyboardEvent): boolean {
  return isMac ? (e.metaKey || e.ctrlKey) : e.ctrlKey;
}

/** Display label for the platform modifier key */
export const modLabel = isMac ? "Cmd" : "Ctrl";
