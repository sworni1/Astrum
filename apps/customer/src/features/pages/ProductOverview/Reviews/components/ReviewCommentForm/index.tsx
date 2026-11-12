"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { showToast } from "@/common/helpers/showToast";
import type { ReviewCommentWriteAnswer } from "@/common/types/review.types";
import {
  createReviewCommentFormSchema,
  type CreateReviewCommentFormValues,
} from "@/common/zodSchemes/create-review-comment.scheme";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  COMMENT_REFUSAL_KEYS,
  classifyCommentRefusal,
} from "@/features/pages/ProductOverview/Reviews/lib/commentRefusal";
import { useCreateReviewComment } from "@/hooks/review/useCreateReviewComment";

const EMPTY_VALUES: CreateReviewCommentFormValues = { body: "" };

/** The thread's own send lock, so two presses in one tick still send once. */
const sendsInFlight = new Set<string>();

type Props = {
  reviewId: string;
  onCreated: (answer: ReviewCommentWriteAnswer) => void;
};

/**
 * The form at the bottom of the thread: the label is the field's accessible
 * name, the submit control is refused while the body is out of range, and one
 * press sends one request. A refusal keeps the typed text where it is
 * (spec 0014, AC-9, AC-11).
 */
const ReviewCommentForm = ({ reviewId, onCreated }: Props) => {
  const t = useTranslations("reviews");
  const validation = useTranslations("validation");

  const { createCommentTrigger, isCreatingComment } =
    useCreateReviewComment(reviewId);

  const schema = useMemo(
    () => createReviewCommentFormSchema(validation),
    [validation],
  );

  const form = useForm<CreateReviewCommentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  const body = useWatch({ control: form.control, name: "body" });
  const typed = (body ?? "").trim();
  const isSendable = typed.length >= 5 && typed.length <= 2000;

  const onSubmit = async (
    values: CreateReviewCommentFormValues,
  ): Promise<void> => {
    if (sendsInFlight.has(reviewId)) {
      return;
    }

    sendsInFlight.add(reviewId);

    try {
      const answer = await createCommentTrigger({
        body: values.body.trim(),
      });

      onCreated(answer);
      form.reset(EMPTY_VALUES);
      showToast({ title: t("comments.saved"), type: "success" });
    } catch (error) {
      const refusal = classifyCommentRefusal(error);

      // The confirmation branch already raised its own toast with a resend
      // action, so a second one would only repeat it.
      if (refusal !== "emailNotConfirmed") {
        showToast({ title: t(COMMENT_REFUSAL_KEYS[refusal]), type: "error" });
      }
    } finally {
      sendsInFlight.delete(reviewId);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-3"
      >
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("comments.label")}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={t("comments.placeholder")}
                  className="min-h-20"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="sm"
          className="self-start"
          disabled={isCreatingComment || !isSendable}
          aria-busy={isCreatingComment}
        >
          {isCreatingComment ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {t("comments.busy")}
            </>
          ) : (
            t("comments.submit")
          )}
        </Button>
      </form>
    </Form>
  );
};

export default ReviewCommentForm;
