"use client";

import { Package } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";

const THUMB_SIZE = 40;

type Props = {
  src: string;
};

/**
 * The 40px thumbnail of one line. An empty column value and a source that fails
 * to load both render the parcel icon, because a broken image is not what the
 * screen is supposed to show (spec 0026, AC-9).
 *
 * A source that already failed before hydration never raises `error`, so the
 * mounted node is asked once through its ref: `complete` with a zero
 * `naturalWidth` is exactly a failed load.
 */
const ProductThumb = ({ src }: Props) => {
  const [failed, setFailed] = useState(false);

  const readNode = useCallback((node: HTMLImageElement | null) => {
    if (node === null) {
      return;
    }

    if (node.complete && node.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  if (src === "" || failed) {
    return <Package className="size-5 text-muted-foreground" aria-hidden />;
  }

  return (
    <Image
      ref={readNode}
      src={src}
      alt=""
      width={THUMB_SIZE}
      height={THUMB_SIZE}
      sizes="40px"
      unoptimized={src.startsWith("http")}
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  );
};

export default ProductThumb;
