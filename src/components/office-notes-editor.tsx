"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { updateJobNotes } from "@/app/actions/jobs";

export function OfficeNotesEditor({
  jobId,
  initialValue,
  canEdit,
}: {
  jobId: string;
  initialValue: string;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== savedValue;

  function save() {
    if (!dirty) return;
    start(async () => {
      try {
        await updateJobNotes(jobId, "officeNotes", value);
        setSavedValue(value);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  if (!canEdit) {
    return (
      <p className="text-[13px] text-neutral-700 whitespace-pre-wrap">
        {initialValue || (
          <span className="text-neutral-400 italic">No office notes.</span>
        )}
      </p>
    );
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder="Add a note (saves on blur)…"
        rows={3}
        className={cn(
          "w-full resize-y rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-[13px] placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400 transition-opacity",
          pending && "opacity-60",
        )}
      />
      <div className="flex items-center justify-between text-[11px] mt-1 h-4">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : dirty ? (
          <span className="text-neutral-500">Unsaved · will save on blur</span>
        ) : pending ? (
          <span className="text-neutral-500">Saving…</span>
        ) : (
          <span className="text-neutral-400">Saved</span>
        )}
      </div>
    </div>
  );
}
