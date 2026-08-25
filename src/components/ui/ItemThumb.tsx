"use client";

import { useState } from "react";
import type { CatalogItem } from "@/lib/types";
import { ItemGlyph } from "./ItemGlyph";

/**
 * Catalog ids with a rendered thumbnail in /public/thumbs. Anything else
 * — the sand styles and any item without a mesh — keeps the drawn glyph.
 */
const HAS_THUMB = new Set([
  "amphora",
  "anemone",
  "angel",
  "angler",
  "arch",
  "boulder",
  "brain",
  "bubble",
  "chest",
  "clownfish",
  "guppy",
  "jelly",
  "kelp",
  "koi",
  "neon",
  "pebbles",
  "pink-tube",
  "ray",
  "seagrass",
  "seahorse",
  "slate",
  "staghorn",
  "tang",
  "teal-weed",
  "violet-fan",
  "wreck",
  
]);

/** Rendered preview of the actual model, falling back to the SVG glyph. */
export function ItemThumb({
  item,
  className = "h-12 w-12",
}: {
  item: CatalogItem;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !HAS_THUMB.has(item.id)) {
    return <ItemGlyph item={item} className="h-10 w-10" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/thumbs/${item.id}.png`}
      alt=""
      aria-hidden
      loading="lazy"
      className={`${className} object-contain`}
      onError={() => setFailed(true)}
    />
  );
}
