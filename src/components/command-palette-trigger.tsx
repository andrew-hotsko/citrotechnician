"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";

const EMPTY = () => () => {};
const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Visible affordance for the ⌘K command palette — a search-like chip in
 * the TopNav. Clicking it fires the same keyboard event the palette
 * listens for, so we don't need a separate open API.
 */
export function CommandPaletteTrigger() {
  const mac = useSyncExternalStore(EMPTY, isMac, () => false);

  function open() {
    // Dispatch the same keyboard event the palette listens for.
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: mac,
      ctrlKey: !mac,
      bubbles: true,
    });
    document.dispatchEvent(event);
  }

  return (
    <button
      type="button"
      onClick={open}
      className="group hidden sm:inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-neutral-200/80 bg-white/70 text-[12px] text-neutral-500 transition-all hover:border-neutral-300 hover:bg-white hover:text-neutral-700"
      aria-label="Open command menu"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search</span>
      <kbd className="ml-4 hidden md:inline-flex items-center gap-0.5 rounded border border-neutral-200/80 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-neutral-500 transition-colors group-hover:border-neutral-300 group-hover:bg-white">
        {mac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}
