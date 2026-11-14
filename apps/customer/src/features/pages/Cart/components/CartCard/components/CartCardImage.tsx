"use client";

import Image from "next/image";
import Link from "next/link";

type Props = {
  id: string;
  name: string;
  previewImage: string;
};

const CartCardImage = ({ id, name, previewImage }: Props) => (
  <div className="relative h-auto w-full md:w-37">
    <Link href={`/products/${id}`}>
      <Image
        unoptimized
        src={previewImage}
        alt={name}
        width={500}
        height={500}
        className="h-full w-full object-cover"
      />
    </Link>
  </div>
);

export default CartCardImage;
