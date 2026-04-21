import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export const MEDIA_BUCKET = "job-media";

export async function uploadToMediaBucket(
  path: string,
  file: File | Blob,
  contentType: string,
): Promise<string> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      contentType,
      cacheControl: "3600",
      upsert: true,
    });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFromMediaBucket(path: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

/**
 * Extract the storage path (object key) from a public URL returned by
 * uploadToMediaBucket. Used when deleting existing objects.
 */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${MEDIA_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
