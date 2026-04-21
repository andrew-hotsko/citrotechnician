"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, Loader2, X, Plus } from "lucide-react";
import imageCompression from "browser-image-compression";
import { uploadJobPhoto, deleteJobPhoto } from "@/app/actions/tech";
import { cn } from "@/lib/utils";
import type { PhotoCategory } from "@/generated/prisma/enums";

type Photo = { id: string; url: string };
type Groups = Record<PhotoCategory, Photo[]>;

const CATEGORIES: {
  key: PhotoCategory;
  label: string;
  minRequired: number;
  hint?: string;
}[] = [
  { key: "BEFORE", label: "Before", minRequired: 2, hint: "Minimum 2 photos of the untreated site" },
  { key: "DURING", label: "During", minRequired: 0 },
  { key: "AFTER", label: "After", minRequired: 2, hint: "Minimum 2 photos of completed application" },
  { key: "ISSUE", label: "Issues", minRequired: 0, hint: "Anything the office should know about" },
];

export function PhotosClient({
  jobId,
  photos: initial,
  locked,
}: {
  jobId: string;
  photos: Groups;
  locked: boolean;
}) {
  const [groups, setGroups] = useState<Groups>(initial);

  return (
    <div className="mt-4 space-y-5">
      {CATEGORIES.map(({ key, label, minRequired, hint }) => (
        <PhotoCategorySection
          key={key}
          jobId={jobId}
          category={key}
          label={label}
          minRequired={minRequired}
          hint={hint}
          photos={groups[key]}
          locked={locked}
          onAdd={(photo) =>
            setGroups((g) => ({ ...g, [key]: [...g[key], photo] }))
          }
          onRemove={(photoId) =>
            setGroups((g) => ({
              ...g,
              [key]: g[key].filter((p) => p.id !== photoId),
            }))
          }
        />
      ))}
    </div>
  );
}

function PhotoCategorySection({
  jobId,
  category,
  label,
  minRequired,
  hint,
  photos,
  locked,
  onAdd,
  onRemove,
}: {
  jobId: string;
  category: PhotoCategory;
  label: string;
  minRequired: number;
  hint?: string;
  photos: Photo[];
  locked: boolean;
  onAdd: (p: Photo) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // reset so the same file can be reselected
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of files) {
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 1500,
          useWebWorker: true,
          initialQuality: 0.8,
        });
        const compressedFile = new File(
          [compressed],
          `photo-${Date.now()}.jpg`,
          { type: compressed.type || "image/jpeg" },
        );
        const fd = new FormData();
        fd.set("jobId", jobId);
        fd.set("category", category);
        fd.set("file", compressedFile);
        const res = await uploadJobPhoto(fd);
        if (res.ok) onAdd(res.photo);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    }
    setUploading(false);
  }

  const enough = photos.length >= minRequired;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">
            {label}{" "}
            {minRequired > 0 && (
              <span
                className={cn(
                  "ml-1 text-[11px] font-normal",
                  enough ? "text-emerald-600" : "text-neutral-500",
                )}
              >
                ({photos.length} / {minRequired} required)
              </span>
            )}
          </h3>
          {hint && (
            <p className="text-[11px] text-neutral-500 mt-0.5">{hint}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <PhotoThumb
            key={p.id}
            photo={p}
            locked={locked}
            onDelete={() =>
              start(async () => {
                try {
                  await deleteJobPhoto(p.id);
                  onRemove(p.id);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Delete failed");
                }
              })
            }
          />
        ))}
        {!locked && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "aspect-square rounded-lg border-2 border-dashed border-neutral-300 bg-white text-neutral-500 flex flex-col items-center justify-center gap-1 text-[10px] font-medium hover:border-neutral-400 hover:text-neutral-700 active:bg-neutral-50 transition-colors",
              uploading && "opacity-60 cursor-wait",
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading…
              </>
            ) : photos.length === 0 ? (
              <>
                <Camera className="h-5 w-5" />
                Take photo
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Add more
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={onFileChosen}
      />

      {error && (
        <p className="mt-2 text-[11px] text-red-600">{error}</p>
      )}
    </section>
  );
}

function PhotoThumb({
  photo,
  locked,
  onDelete,
}: {
  photo: Photo;
  locked: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-neutral-100">
      <Image
        src={photo.url}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 500px) 33vw, 150px"
        unoptimized
      />
      {!locked && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove photo"
          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
