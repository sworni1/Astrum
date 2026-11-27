import { Package } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type Props = {
  src?: string;
  alt: string;
};

const OrderItemImage = ({ src, alt }: Props) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-lg bg-secondary">
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          width={64}
          height={64}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Package className="h-8 w-8 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
};

export default OrderItemImage;
