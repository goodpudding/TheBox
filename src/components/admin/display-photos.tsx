"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DisplayPhoto } from "@/lib/data";
import { displayPhotoUrl } from "@/lib/data/display-feed";
import { DISPLAY_CAPTION_MAX, DISPLAY_PHOTO_LIMIT } from "@/lib/data/provider";
import { uploadDisplayPicture } from "@/lib/display/compress-client";

/** Remove a picture's stored bytes. Sample photos in dev are plain files. */
async function removeStoredPicture(photo: Pick<DisplayPhoto, "id" | "staticPath">) {
  if (photo.staticPath) return;
  await fetch(`/api/display/photos/${photo.id}`, { method: "DELETE" }).catch(
    () => {},
  );
}

/**
 * The photos the lobby display rotates through, one beside each slide.
 * Staff add them here; nothing needs a deploy.
 */
export function DisplayPhotos() {
  const { provider, revision, bump } = useData();
  const [photos, setPhotos] = useState<DisplayPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void provider.listDisplayPhotos().then((list) => {
      if (!cancelled) setPhotos(list);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  /** Run one change, then reload the list. */
  async function change(work: () => Promise<string | null>) {
    setBusy(true);
    setErrors([]);
    setMessage(null);
    try {
      setMessage(await work());
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Could not save"]);
    } finally {
      bump();
      setBusy(false);
    }
  }

  async function addPhotos(files: File[]) {
    setBusy(true);
    setErrors([]);
    setMessage(null);
    let added = 0;
    const failed: string[] = [];
    for (const file of files) {
      try {
        const picture = await uploadDisplayPicture(file);
        try {
          await provider.saveDisplayPhoto({
            id: picture.id,
            mimeType: picture.mimeType,
            width: picture.width,
            height: picture.height,
          });
          added += 1;
        } catch (err) {
          // The bytes are stored but the display will never show them.
          await removeStoredPicture({ id: picture.id });
          throw err;
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "could not be added";
        // The provider's own messages are whole sentences; ours finish one.
        failed.push(/^[A-Z]/.test(reason) ? reason : `${file.name} ${reason}.`);
      }
    }
    if (added > 0) {
      setMessage(`${added} photo${added === 1 ? "" : "s"} added.`);
    }
    setErrors(failed);
    bump();
    setBusy(false);
  }

  function move(index: number, dir: -1 | 1) {
    const order = [...photos];
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    void change(async () => {
      // Renumber from the top: photos added at different times can share a
      // position, and swapping two equal numbers would change nothing.
      for (const [i, photo] of order.entries()) {
        if (photo.sortOrder !== i + 1) {
          await provider.saveDisplayPhoto({ id: photo.id, sortOrder: i + 1 });
        }
      }
      return null;
    });
  }

  return (
    <section aria-labelledby="display-photos-heading" className="mt-12 max-w-3xl">
      <h2
        id="display-photos-heading"
        className="font-display text-xl font-semibold text-brown"
      >
        Photos
      </h2>
      <p className="mt-2 text-sm text-secondary">
        The display shows one photo beside each slide and moves to the next
        photo with every slide. Photos are shrunk before they are sent. The
        photo area is taller than it is wide, so a wide photo is cropped at the
        sides: keep the subject near the middle. Up to {DISPLAY_PHOTO_LIMIT}{" "}
        photos.
      </p>

      <div className="mt-4 space-y-2">
        <Label htmlFor="display-photo-files">Add photos</Label>
        <Input
          id="display-photo-files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length > 0) void addPhotos(files);
          }}
        />
      </div>

      {busy ? <p className="mt-3 text-sm text-secondary">Working…</p> : null}
      {message ? (
        <p className="mt-3 text-sm text-secondary" role="status">
          {message}
        </p>
      ) : null}
      {errors.map((text) => (
        <p key={text} className="mt-3 text-sm text-brown" role="alert">
          {text}
        </p>
      ))}

      {photos.length === 0 ? (
        <p className="mt-6 text-sm text-secondary">
          No photos yet. Until you add one, the display shows a coloured panel
          where the photo goes.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="flex flex-wrap items-center gap-4 py-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayPhotoUrl(photo)}
                alt={photo.caption ?? `Display photo ${index + 1}`}
                className={`h-24 w-20 shrink-0 rounded-lg border border-border object-cover ${
                  photo.active ? "" : "opacity-40"
                }`}
              />
              <div className="min-w-48 flex-1 space-y-1">
                <Label htmlFor={`caption-${photo.id}`}>Caption</Label>
                <Input
                  id={`caption-${photo.id}`}
                  defaultValue={photo.caption ?? ""}
                  maxLength={DISPLAY_CAPTION_MAX}
                  placeholder="Optional. Shown over the photo."
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next === (photo.caption ?? "")) return;
                    void change(async () => {
                      await provider.saveDisplayPhoto({
                        id: photo.id,
                        caption: next,
                      });
                      return "Caption saved.";
                    });
                  }}
                />
                {photo.active ? null : (
                  <p className="text-sm text-secondary">Hidden from the display.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                >
                  Up
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy || index === photos.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Down
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void change(async () => {
                      await provider.saveDisplayPhoto({
                        id: photo.id,
                        active: !photo.active,
                      });
                      return null;
                    })
                  }
                >
                  {photo.active ? "Hide" : "Show"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void change(async () => {
                      await provider.deleteDisplayPhoto(photo.id);
                      await removeStoredPicture(photo);
                      return "Photo deleted.";
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
