import { Package } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type Props = {
  src?: string;
  alt: string;
};

/**
 * A thumbnail with the parcel icon as its fallback. The broken source is a
 * piece of state, so React owns the node and nothing is written behind it.
 */
const OrderItemImage = ({ src, alt }: Props) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative group">
      <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 group-hover:shadow-md group-hover:scale-105">
        {src && !failed ? (
          <Image
            src={src}
            alt={alt}
            width={64}
            height={64}
            className="rounded-xl object-cover w-full h-full transition-transform duration-200 group-hover:scale-110"
            onError={() => setFailed(true)}
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
    </div>
  );
};

export default OrderItemImage;
