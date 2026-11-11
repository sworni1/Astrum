"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import { showToast } from "@/common/helpers/showToast";
import ProductOverviewSkeleton from "@/components/skeletons/ProductOverviewSkeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import AddToCartWithQuantity from "@/features/general/AddToCartWithQuantity";
import ToggleWishlistItemButton from "@/features/general/ProductCard/actions/ToggleWishlistItemButton";
import { useGetProduct } from "@/hooks/product/useProducts/useGetProduct";
import { useProductReviews } from "@/hooks/review/useProductReviews";
import { formatAverageRating } from "./Reviews/lib/distribution";
import ProductGallery from "./ProductGallery";
import Reviews from "./Reviews";

export default function ProductOverview() {
  const t = useTranslations("product");
  const reviewsT = useTranslations("reviews");
  const params = useParams<{ productId: string }>();
  const productId = params.productId;

  const { product, productIsLoading, productError } = useGetProduct(productId);
  // The header and the block read one key, so the screen sends one request for
  // the first page (spec 0012, AC-4, AC-5).
  const { aggregate } = useProductReviews(productId);

  if (productIsLoading) {
    return <ProductOverviewSkeleton />;
  }

  if (productError) {
    showToast({
      title: t("failed"),
      type: "error",
    });
    return null;
  }

  if (!product) return <ProductOverviewSkeleton />;

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <ProductGallery images={product.images} />
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold sm:text-3xl">{product?.name}</h1>

            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold">
                {formatMoney(product.price, product.currency)}
              </span>
              {aggregate ? (
                <Link
                  href="#reviews"
                  className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                >
                  <Star className="h-4 w-4 fill-primary text-primary" aria-hidden />
                  {aggregate.total > 0 ? (
                    <>
                      <span>
                        {reviewsT("summaryAverage", {
                          average: formatAverageRating(aggregate.averageRating),
                        })}
                      </span>
                      <span aria-hidden>•</span>
                    </>
                  ) : null}
                  <span>{reviewsT("count", { count: aggregate.total })}</span>
                </Link>
              ) : (
                <span
                  aria-hidden
                  className="inline-block h-5 w-40 animate-pulse rounded bg-muted"
                />
              )}
            </div>

            <div className="flex gap-4">
              <ToggleWishlistItemButton
                productId={productId}
                isWishlisted={product.isWishlisted}
                size="lg"
              />

              <AddToCartWithQuantity
                quantity={product.quantity}
                size="sm"
                quantityInCart={product.quantityInCart}
                productId={productId}
              />
            </div>

            <Separator className="my-4" />

            <div className="space-y-4 text-muted-foreground">
              <p>{product?.description}</p>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="specifications">
                <AccordionTrigger>{t("specifications")}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4">
                    {product?.properties.map((property) => (
                      <div key={property.id} className="grid grid-cols-2">
                        <span className="font-medium">{property.label}</span>
                        <span>{property.value}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="shipping">
                <AccordionTrigger>{t("shipping")}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <p>{t("shippingFree")}</p>
                    <p>{t("shippingReturns")}</p>
                    <p>{t("shippingTime")}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
      <Reviews productId={productId} reviewState={product.reviewState} />
    </>
  );
}
