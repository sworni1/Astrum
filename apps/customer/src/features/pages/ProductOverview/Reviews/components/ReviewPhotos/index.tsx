"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

type Props = {
  reviewId: string;
  photos: string[];
};

/**
 * The photos a review carries. A URL that cannot be loaded leaves no box and no
 * alt text on screen, because a broken remote file must not reshuffle the card.
 */
const ReviewPhotos = ({ reviewId, photos }: Props) => {
  const t = useTranslations("reviews");
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const shown = photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ index }) => !failed[index]);

  if (shown.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map(({ photo, index }) => (
        <Image
          key={`${reviewId}-photo-${index}`}
          src={photo}
          alt={t("photoAlt", { index: index + 1 })}
          width={80}
          height={80}
          className="size-20 rounded-md bg-muted object-cover"
          onError={() => setFailed((current) => ({ ...current, [index]: true }))}
        />
      ))}
    </div>
  );
};

export default ReviewPhotos;
