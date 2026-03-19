"use client";

import { useState } from "react";
import { Card, CardContent } from "../../../../components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../../../../components/ui/carousel";
import { Skeleton } from "../../../../components/ui/skeleton";

type Props = {
  images: string[];
};

const ProductGallery = ({ images }: Props) => {
  const [imageErrors, setImageErrors] = useState<boolean[]>(
    Array(images.length).fill(false),
  );

  const handleImageError = (index: number) => {
    // Обновляем состояние только если ещё не было ошибки
    setImageErrors((prev) => {
      const updated = [...prev];
      if (!updated[index]) {
        updated[index] = true;
      }
      return updated;
    });
  };

  return (
    <div className="mx-auto lg:sticky lg:top-24 lg:self-start">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className=" w-full h-full"
      >
        <CarouselContent>
          {images.length > 0 ? (
            images.map((image, idx) => (
              <CarouselItem key={idx}>
                <Card>
                  <CardContent className="p-0 h-full flex items-center justify-center">
                    {imageErrors[idx] || !image ? (
                      <Skeleton className="w-full h-full aspect-[4/3] object-cover rounded-lg" />
                    ) : (
                      <img
                        src={image}
                        alt={`Product image ${idx + 1}`}
                        className="w-full h-full aspect-[4/3] object-cover rounded-lg"
                        onError={() => handleImageError(idx)}
                        loading="lazy"
                      />
                    )}
                  </CardContent>
                </Card>
              </CarouselItem>
            ))
          ) : (
            <CarouselItem>
              <Card>
                <CardContent className="p-0">
                  <Skeleton className="aspect-[4/3] object-cover" />
                </CardContent>
              </Card>
            </CarouselItem>
          )}
        </CarouselContent>

        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
          {images.map((_, index) => (
            <span
              key={index}
              className="block h-2 w-2 rounded-full bg-white/50"
            />
          ))}
        </div>
        <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full" />
        <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full" />
      </Carousel>
    </div>
  );
};

export default ProductGallery;
