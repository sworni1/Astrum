import type { PublicReviewComment } from "../review.serializer";

export type ReviewPageQuery = {
  after?: unknown;
  limit?: unknown;
};

export type LikeAnswer = {
  liked: boolean;
  likeCount: number;
};

export type CommentPage = {
  comments: PublicReviewComment[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type CommentWriteAnswer = {
  comment: PublicReviewComment;
  commentCount: number;
};
