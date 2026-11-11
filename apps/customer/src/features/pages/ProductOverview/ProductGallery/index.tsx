"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  images: string[];
};

function ProductGallery({ images }: Props) {
  const t = useTranslations("product");
  const safeImages = React.useMemo<string[]>(
    () => Array.from(new Set(images.filter(Boolean))),
    [images],
  );
  const slides = safeImages.length > 0 ? safeImages : [""];

  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState<number>(0);
  const [imageErrors, setImageErrors] = React.useState<Record<string, boolean>>(
    {},
  );

  React.useEffect(() => {
    if (!api) return;
    const handleSelect = () => setCurrent(api.selectedScrollSnap() ?? 0);
    handleSelect();
    api.on("select", handleSelect);
    api.on("reInit", handleSelect);
    return () => {
      api.off("select", handleSelect);
      api.off("reInit", handleSelect);
    };
  }, [api]);

  React.useEffect(() => {
    setCurrent(0);
    setImageErrors({});
    if (safeImages.length > 0) api?.scrollTo(0);
  }, [api, safeImages]);

  const handleImageError = (src: string) => {
    setImageErrors((previous) =>
      previous[src] ? previous : { ...previous, [src]: true },
    );
  };

  const scrollTo = React.useCallback(
    (index: number) => {
      api?.scrollTo(index);
    },
    [api],
  );

  return (
    <div className="flex w-full flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
      <Carousel
        setApi={setApi}
        className="w-full"
        aria-label={t("gallery")}
        opts={{ align: "start", loop: slides.length > 1 }}
      >
        <CarouselContent>
          {slides.map((src, index) => (
            <CarouselItem
              key={src || "empty-image"}
              aria-label={t("gallerySlide", {
                current: index + 1,
                total: slides.length,
              })}
            >
              <AspectRatio
                ratio={4 / 3}
                className="relative overflow-hidden rounded-xl border bg-muted"
              >
                {src && !imageErrors[src] ? (
                  <Image
                    src={src}
                    alt={t("imageAlt", { index: index + 1 })}
                    fill
                    unoptimized
                    className="object-contain"
                    priority={index === 0}
                    onError={() => handleImageError(src)}
                  />
                ) : (
                  <Skeleton className="h-full w-full" />
                )}
              </AspectRatio>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-4 bg-background/80 backdrop-blur-sm hover:bg-background" />
        <CarouselNext className="right-4 bg-background/80 backdrop-blur-sm hover:bg-background" />
      </Carousel>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {slides.map((src, index) => (
          <button
            key={`thumbnail-${src || "empty-image"}`}
            onClick={() => scrollTo(index)}
            type="button"
            aria-label={t("openImage", { index: index + 1 })}
            className={cn(
              "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
              current === index
                ? "border-foreground"
                : "border-transparent hover:border-muted-foreground/50",
            )}
          >
            {src && !imageErrors[src] ? (
              <Image
                src={src}
                alt=""
                fill
                unoptimized
                className="object-cover"
                onError={() => handleImageError(src)}
              />
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ProductGallery;
