import { memo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { FaStar } from "react-icons/fa";
import Link from "next/link";
import OptimizedImage from "@/components/OptimizedImage";
import { AddToCartWithQuantity, ToggleWishlistItemButton } from "./actions";
import {
  Currency,
  ProductCardProps,
} from "../../../common/types/product.types";
import { getCurrencyEmoji } from "../../../common";

// Memoized star component to prevent unnecessary re-renders
const StarRating = memo(
  ({ stars, reviewCount }: { stars: number; reviewCount: number }) => (
    <div className="flex items-center text-sm text-gray-700 gap-1">
      <div className="flex items-center">
        <FaStar size={16} color="yellow" />
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        {stars}
      </p>
      <span className="ml-1 text-gray-500">({reviewCount})</span>
    </div>
  ),
);
StarRating.displayName = "StarRating";

// Memoized price component
const PriceDisplay = memo(
  ({ price, currency }: { price: number; currency: Currency }) => (
    <CardTitle className="text-2xl font-bold leading-tight text-gray-900 dark:text-white h-[40px]">
      {price} {getCurrencyEmoji(currency)}
    </CardTitle>
  ),
);
PriceDisplay.displayName = "PriceDisplay";

// Memoized product name component
const ProductName = memo(
  ({ name, productId }: { name: string; productId: string }) => (
    <Link href={`/products/${productId}`}>
      <CardDescription
        className="text-lg font-[500] line-clamp-2 mb-[-15px] h-[55px] text-gray-900 dark:text-white"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {name}
      </CardDescription>
    </Link>
  ),
);
ProductName.displayName = "ProductName";

const ProductCard = memo<ProductCardProps>(function ProductCard({
  id,
  name,
  previewImage,
  images,
  quantity,
  price,
  // discount, // TODO: Implement discount display
  stars,
  currency,
  _count,
  isWishlisted,
  quantityInCart,
}) {
  const reviewCount = _count?.impressions ?? 0;

  return (
    <Card className="select-none">
      <Link href={`/products/${id}`}>
        <CardHeader className="h-auto w-auto">
          <OptimizedImage
            className="aspect-4/3 w-full rounded-lg object-cover"
            width={300}
            height={300}
            src={previewImage}
            fallbackSrcs={images}
            alt={name}
            priority={false}
            showLoadingSpinner={true}
            containerClassName="aspect-4/3"
            errorVariant="minimal"
          />
        </CardHeader>
      </Link>

      <CardContent>
        <PriceDisplay price={price} currency={currency} />
        <ProductName name={name} productId={id} />
      </CardContent>

      <CardFooter className="flex flex-col justify-between items-center h-[100px]">
        <div className="flex justify-between items-center w-full">
          <StarRating stars={stars} reviewCount={reviewCount} />
        </div>

        <div className="flex w-full gap-[10px] items-center">
          <ToggleWishlistItemButton
            productId={id}
            isWishlisted={isWishlisted}
          />
          <AddToCartWithQuantity
            quantity={quantity}
            size="full"
            quantityInCart={quantityInCart}
            productId={id}
          />
        </div>
      </CardFooter>
    </Card>
  );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;
