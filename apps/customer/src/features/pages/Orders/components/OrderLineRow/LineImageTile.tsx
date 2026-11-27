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
