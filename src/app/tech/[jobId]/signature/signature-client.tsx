"use client";

import { useRef, useState, useTransition } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Loader2, RotateCcw, Check } from "lucide-react";
import { captureSignature } from "@/app/actions/tech";
import { cn } from "@/lib/utils";

export function SignatureClient({
  jobId,
  existing,
  locked,
}: {
  jobId: string;
  existing: string | null;
  locked: boolean;
}) {
  const padRef = useRef<SignatureCanvas>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(existing);
  const [isEditing, setIsEditing] = useState(!existing);

  function clear() {
    padRef.current?.clear();
  }

  async function save() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError("Please sign before saving");
      return;
    }
    setError(null);

    const dataUrl = pad.toDataURL("image/png");
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "signature.png", { type: "image/png" });

    start(async () => {
      try {
        const fd = new FormData();
        fd.set("jobId", jobId);
        fd.set("file", file);
        const res = await captureSignature(fd);
        if (res.ok) {
          setSavedUrl(res.url);
          setIsEditing(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  if (savedUrl && !isEditing) {
    return (
      <div className="mt-5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 mb-2">
            <Check className="h-3.5 w-3.5" />
            Signature captured
          </div>
          <div className="rounded-md bg-white border border-emerald-200 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={savedUrl}
              alt="Customer signature"
              className="w-full h-36 object-contain bg-white"
            />
          </div>
        </div>
        {!locked && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-full mt-3 h-11 rounded-md border border-neutral-200 bg-white text-[13px] font-medium text-neutral-700 active:bg-neutral-50"
          >
            Clear & re-sign
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="rounded-lg border-2 border-neutral-300 bg-white overflow-hidden">
        <SignatureCanvas
          ref={padRef}
          canvasProps={{
            className: "w-full h-48 touch-none",
          }}
          penColor="#111827"
        />
      </div>
      <p className="text-[11px] text-neutral-500 text-center mt-2">
        Sign above
      </p>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          onClick={clear}
          disabled={pending}
          className="flex items-center justify-center gap-1.5 h-12 rounded-md border border-neutral-200 bg-white text-[13px] font-medium text-neutral-700 active:bg-neutral-50 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className={cn(
            "flex items-center justify-center gap-1.5 h-12 rounded-md text-[13px] font-semibold transition-colors",
            pending
              ? "bg-emerald-400 text-white cursor-wait"
              : "bg-emerald-600 text-white active:bg-emerald-700",
          )}
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Save signature
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
