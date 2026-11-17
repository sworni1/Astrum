"use client";

import { Package } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { LINE_TILE } from "@/features/pages/Orders/lib/styles";

const TILE_SIZE = 96;

type Props = {
  src: string;
  alt: string;
};

/**
 * The 96px tile of one line. An empty column value and a source that fails to
 * load both render the parcel icon the mockup draws, because a broken image is
 * not what the screen is supposed to show (spec 0025, AC-11).
 *
 * A source that already failed before hydration never raises `error`, so the
 * mounted node is asked once through its ref: `complete` with a zero
 * `naturalWidth` is exactly a failed load.
 */
const LineImageTile = ({ src, alt }: Props) => {
  const [failed, setFailed] = useState(false);

  const readNode = useCallback((node: HTMLImageElement | null) => {
    if (node === null) {
      return;
    }

    const decide = (): void => {
      if (node.complete && node.naturalWidth === 0) {
        setFailed(true);
      }
    };

    decide();
  }, []);

  return (
    <div className={LINE_TILE}>
      {src === "" || failed ? (
        <Package className="size-7" aria-hidden />
      ) : (
        <Image
          ref={readNode}
          src={src}
          alt={alt}
          width={TILE_SIZE}
          height={TILE_SIZE}
          sizes="(max-width: 640px) 80px, 96px"
          className="size-full rounded-stat object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

export default LineImageTile;
