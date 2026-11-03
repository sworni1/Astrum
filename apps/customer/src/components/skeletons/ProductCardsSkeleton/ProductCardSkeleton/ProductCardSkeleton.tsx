import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductCardSkeleton() {
  return (
    <Card className="bg-[hsl(var(--card))]">
      <CardHeader className="h-[255px] sm:h-[300px] p-0">
        <Skeleton className="w-full h-full rounded-lg" />
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        <CardTitle>
          <Skeleton className="h-6 w-16 rounded" />
        </CardTitle>

        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-8 rounded" />
          </div>
        </div>

        <div className="flex w-full gap-[10px]">
          <div className="w-10 h-10 flex items-center justify-center">
            <Skeleton className="w-6 h-6 rounded-full" />
          </div>
          <Button disabled className="flex-1 w-full">
            <Skeleton className="h-4 w-16 rounded" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
