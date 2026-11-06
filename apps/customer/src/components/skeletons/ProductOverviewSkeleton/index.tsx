import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem } from "../../ui/carousel";

export default function ProductOverviewSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="mx-auto w-full h-full lg:sticky lg:top-24 lg:self-start">
          <Carousel
            aria-hidden="true"
            opts={{
              align: "start",
              loop: true,
            }}
          >
            <CarouselContent>
              <CarouselItem>
                <Card>
                  <CardContent className="p-0">
                    <Skeleton className="aspect-[4/3] object-cover" />
                  </CardContent>
                </Card>
              </CarouselItem>
            </CarouselContent>
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
              {Array.from(
                { length: 3 },
                (_, index) => `carousel-indicator-${index + 1}`,
              ).map((id) => (
                <span
                  key={id}
                  className="block h-2 w-2 rounded-full bg-white/50"
                />
              ))}
            </div>
          </Carousel>
        </div>

        {/* Product Info Skeleton */}
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-3/4 sm:h-10" />

          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-8 w-24" />
            <div className="flex items-center gap-1">
              {Array.from(
                { length: 5 },
                (_, index) => `rating-star-${index + 1}`,
              ).map((id) => (
                <Skeleton key={id} className="h-5 w-5 rounded-sm" />
              ))}
              <Skeleton className="ml-2 h-4 w-16" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>

          <Separator />

          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="features">
              <AccordionTrigger className="hover:no-underline">
                <Skeleton className="h-6 w-20" />
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 py-2">
                  {Array.from(
                    { length: 4 },
                    (_, index) => `feature-${index + 1}`,
                  ).map((id) => (
                    <Skeleton key={id} className="h-4 w-full" />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="specifications">
              <AccordionTrigger className="hover:no-underline">
                <Skeleton className="h-6 w-28" />
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 py-2">
                  {Array.from(
                    { length: 4 },
                    (_, index) => `specification-${index + 1}`,
                  ).map((id) => (
                    <div key={id} className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="shipping">
              <AccordionTrigger className="hover:no-underline">
                <Skeleton className="h-6 w-40" />
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 py-2">
                  {Array.from(
                    { length: 3 },
                    (_, index) => `shipping-${index + 1}`,
                  ).map((id) => (
                    <Skeleton key={id} className="h-4 w-full" />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}
