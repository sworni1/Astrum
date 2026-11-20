"use client";

import { Package } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";

const THUMB_SIZE = 40;

type Props = {
  src: string;
};

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
