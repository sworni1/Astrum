"use client";

import Image from "next/image";
import * as React from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../../../../components/ui/carousel";
import { Skeleton } from "../../../../components/ui/skeleton";

type Props = {
  images: string[];
};

function ProductGallery({ images }: Props) {
  const safeImages = React.useMemo<string[]>(
    () => images.filter(Boolean),
    [images],
  );
  const slides = safeImages.length > 0 ? safeImages : [""];

  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState<number>(0);
  const [imageErrors, setImageErrors] = React.useState<Record<number, boolean>>(
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
    api?.scrollTo(0);
  }, [api, safeImages.length]);

  const handleImageError = (index: number) => {
    setImageErrors((prev) => (prev[index] ? prev : { ...prev, [index]: true }));
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
        opts={{ align: "start", loop: slides.length > 1 }}
      >
        <CarouselContent>
          {slides.map((src, index) => (
            <CarouselItem key={`${src}-${index}`}>
              <AspectRatio
                ratio={4 / 3}
                className="relative overflow-hidden rounded-xl border bg-muted"
              >
                {src && !imageErrors[index] ? (
                  <Image
                    src={src}
                    alt={`Product image ${index + 1}`}
                    fill
                    unoptimized
                    className="object-contain"
                    priority={index === 0}
                    onError={() => handleImageError(index)}
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
            key={`thumb-${src}-${index}`}
            onClick={() => scrollTo(index)}
            type="button"
            aria-label={`Open image ${index + 1}`}
            className={cn(
              "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
              current === index
                ? "border-foreground"
                : "border-transparent hover:border-muted-foreground/50",
            )}
          >
            {src && !imageErrors[index] ? (
              <Image
                src={src}
                alt=""
                fill
                unoptimized
                className="object-cover"
                onError={() => handleImageError(index)}
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
