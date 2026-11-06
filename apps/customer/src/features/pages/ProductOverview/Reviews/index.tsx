"use client";

import { Calendar, MessageCircle, Send, Star, ThumbsUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type FormEvent, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { showToast } from "../../../../common";

interface FormState {
  name: string;
  email: string;
  review: string;
}

interface Review {
  id: number;
  userName: string;
  userAvatar: string;
  date: string;
  rating: number;
  content: string;
  likes: number;
  comments: number;
}

const DEMO_REVIEWS: Review[] = [
  {
    id: 1,
    userName: "Emma Davis",
    userAvatar: "https://notion-avatars.netlify.app/api/avatar?preset=female-1",
    date: "2024-03-20",
    rating: 5,
    content:
      "I was blown away by the quality of this product. It's clear that a lot of thought and care went into its design. The attention to detail is remarkable, and it's been an absolute pleasure to use. I've already recommended it to several friends who are equally impressed with their purchases.",
    likes: 8,
    comments: 2,
  },
  {
    id: 2,
    userName: "Anuj Mishra",
    userAvatar: "https://notion-avatars.netlify.app/api/avatar?preset=male-1",
    date: "2023-12-16",
    rating: 5,
    content:
      "The customer service experience was exceptional from start to finish. When I had questions about my order, the team responded promptly and went above and beyond to ensure I was completely satisfied. It's rare to find such dedication to customer happiness these days.",
    likes: 10,
    comments: 5,
  },
  {
    id: 3,
    userName: "Robert Karmazov",
    userAvatar: "https://notion-avatars.netlify.app/api/avatar?preset=male-2",
    date: "2023-10-24",
    rating: 5,
    content:
      "I was hesitant about the price at first, but after using this product for several weeks, I can confidently say it's worth every penny. The quality and durability are outstanding, and it's made a noticeable difference in my daily routine. I'm already planning to purchase more items from this store.",
    likes: 4,
    comments: 0,
  },
  {
    id: 4,
    userName: "Sophia Chen",
    userAvatar: "https://notion-avatars.netlify.app/api/avatar?preset=female-2",
    date: "2024-05-15",
    rating: 4,
    content:
      "This is a fantastic product that has really improved my daily routine. The quality is excellent and it's very user-friendly. The only reason I'm not giving it 5 stars is that I wish it came in more color options. Other than that, it's been a great purchase and I would definitely recommend it to others.",
    likes: 6,
    comments: 1,
  },
];

interface ReviewsProps {
  productId: string;
}

const REVIEWS_PER_PAGE = 2;

const Reviews = ({ productId }: ReviewsProps) => {
  const t = useTranslations("reviews");
  const format = useFormatter();
  const [currentPage, setCurrentPage] = useState(1);
  const [isLiked, setIsLiked] = useState<Record<number, boolean>>({});
  const [rating, setRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    review: "",
  });
  // Calculate pagination
  const totalPages = Math.ceil(DEMO_REVIEWS.length / REVIEWS_PER_PAGE);
  const currentReviews = useMemo<Review[]>(() => {
    const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
    const endIndex = startIndex + REVIEWS_PER_PAGE;
    return DEMO_REVIEWS.slice(startIndex, endIndex);
  }, [currentPage]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!productId) {
      showToast({
        title: t("productMissing"),
        type: "error",
      });
      return;
    }
    if (rating < 1) {
      showToast({
        title: t("ratingMissing"),
        type: "error",
      });
      return;
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">
          {t("description")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {currentReviews.map((review) => (
            <Card key={review.id} className="transition-all hover:shadow-md">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="bg-muted size-12">
                      <AvatarImage
                        src={review.userAvatar}
                        alt={t("avatarAlt", { name: review.userName })}
                      />
                      <AvatarFallback>
                        {review.userName.substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{review.userName}</h3>
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                        <div
                          className="flex"
                          role="img"
                          aria-label={t("ratedOutOf", {
                            rating: review.rating,
                          })}
                        >
                          {Array.from(
                            { length: 5 },
                            (_, index) => index + 1,
                          ).map((star) => (
                            <Star
                              key={`review-star-${star}`}
                              className={cn(
                                "size-4",
                                star <= review.rating
                                  ? "fill-foreground text-foreground"
                                  : "text-foreground fill-transparent",
                              )}
                            />
                          ))}
                        </div>
                        <span>•</span>
                        <time
                          dateTime={
                            new Date(review.date).toISOString().split("T")[0]
                          }
                          className="flex items-center"
                        >
                          <Calendar className="me-1 size-3" />
                          {format.dateTime(new Date(review.date), {
                            dateStyle: "long",
                          })}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground mt-4">{review.content}</p>
                <div className="mt-4 flex gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setIsLiked((prev) => ({
                        ...prev,
                        [review.id]: !prev[review.id],
                      }))
                    }
                    className="h-8 px-3 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
                    aria-label={isLiked[review.id] ? t("unlike") : t("like")}
                  >
                    <ThumbsUp
                      className={cn(
                        "size-4",
                        isLiked[review.id] && "fill-current",
                      )}
                    />
                    <span>{review.likes + (isLiked[review.id] ? 1 : 0)}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
                    aria-label={t("viewComments")}
                  >
                    <MessageCircle className="size-4" />
                    <span>{review.comments}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {totalPages > 1 ? (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-8 lg:h-fit">
          <Card className="border-2 transition-colors">
            <CardHeader>
              <CardTitle id="review-form-heading">{t("formTitle")}</CardTitle>
              <CardDescription>{t("formDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div
                    className="flex gap-1"
                    role="radiogroup"
                    aria-label={t("ratingLabel")}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Button
                        variant="ghost"
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        className="h-9 px-4 py-2 focus-visible:ring-ring cursor-pointer rounded-full !p-1 hover:bg-transparent focus:outline-hidden focus-visible:ring-2"
                        aria-pressed={rating === star}
                        aria-label={t("rate", { star })}
                      >
                        <Star
                          className={cn(
                            "size-6",
                            (hoveredStar || rating) >= star
                              ? "fill-foreground"
                              : "",
                          )}
                        />
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{t("nameLabel")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={t("namePlaceholder")}
                    required
                    aria-required="true"
                    className="h-9"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t("emailLabel")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder={t("emailPlaceholder")}
                    required
                    aria-required="true"
                    className="h-9"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="review">{t("reviewLabel")}</Label>
                  <Textarea
                    id="review"
                    value={formData.review}
                    onChange={(e) =>
                      setFormData({ ...formData, review: e.target.value })
                    }
                    placeholder={t("reviewPlaceholder")}
                    required
                    aria-required="true"
                  />
                </div>

                <Button
                  type="submit"
                  className="h-9 px-4 py-2 w-full cursor-pointer"
                  disabled={rating < 1}
                >
                  {t("submit")}
                  <Send className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Reviews;
