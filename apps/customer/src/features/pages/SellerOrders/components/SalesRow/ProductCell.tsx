"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SellerLineRow } from "@/common/types/order.types";
import {
  PRODUCT_NAME,
  QUANTITY,
  THUMB,
} from "@/features/pages/SellerOrders/lib/styles";
import ProductThumb from "./ProductThumb";

type Props = {
  line: SellerLineRow;
};

const ProductCell = ({ line }: Props) => {
  const t = useTranslations("seller");
  const name =
    line.name === "" ? t("productFallback", { id: line.productId }) : line.name;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        href={`/products/${line.productId}`}
        className={THUMB}
        tabIndex={-1}
        aria-hidden
      >
        <ProductThumb src={line.previewImage} />
      </Link>
      <div className="min-w-0">
        <Link href={`/products/${line.productId}`} className={PRODUCT_NAME}>
          {name}
        </Link>
        <p className={QUANTITY}>{t("quantity", { count: line.quantity })}</p>
      </div>
    </div>
  );
};

export default ProductCell;
