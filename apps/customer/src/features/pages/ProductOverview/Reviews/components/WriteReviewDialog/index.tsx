"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { showToast } from "@/common/helpers/showToast";
import type { CreateReviewDto } from "@/common/types/review.types";
import {
  createReviewFormSchema,
  type CreateReviewFormValues,
} from "@/common/zodSchemes/create-review.scheme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import StarRadioGroup from "@/features/pages/ProductOverview/Reviews/components/StarRadioGroup";
import { classifyReviewRefusal, fieldErrorsOf } from "@/features/pages/ProductOverview/Reviews/lib/refusal";
import { useCreateReview } from "@/hooks/review/useCreateReview";

const RATING_FIELDS = [
  { name: "rating", labelKey: "ratingOverall" },
  { name: "qualityRating", labelKey: "ratingQuality" },
  { name: "deliveryRating", labelKey: "ratingDelivery" },
  { name: "accuracyRating", labelKey: "ratingAccuracy" },
] as const;

const DEFAULT_VALUES: CreateReviewFormValues = {
  rating: 0,
  qualityRating: 0,
  deliveryRating: 0,
  accuracyRating: 0,
  comment: "",
};

/**
 * One send per press sequence, whatever the render timing says (AC-8): the
 * lock is taken before the request leaves and released in `finally`, so two
 * presses that land in the same tick still send once.
 */
const sendsInFlight = new Set<string>();

const claimSend = (productId: string): boolean => {
  if (sendsInFlight.has(productId)) {
    return false;
  }

  sendsInFlight.add(productId);

  return true;
};

const releaseSend = (productId: string): void => {
  sendsInFlight.delete(productId);
};

type Props = {
  productId: string;
  orderItemId: string;
};

/**
 * The write form: four star groups and a comment, validated on press, sent
 * once, and answered by a toast per refusal code (AC-8, AC-9, AC-10).
 */
const WriteReviewDialog = ({ productId, orderItemId }: Props) => {
  const t = useTranslations("reviews");
  const validation = useTranslations("validation");
  const [isOpen, setIsOpen] = useState(false);

  const { createReviewTrigger, isCreatingReview, revalidateReviewData } =
    useCreateReview(productId);

  const schema = useMemo(
    () => createReviewFormSchema(validation),
    [validation],
  );

  const form = useForm<CreateReviewFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  const onSubmit = async (values: CreateReviewFormValues): Promise<void> => {
    if (!claimSend(productId)) {
      return;
    }

    const dto: CreateReviewDto = { orderItemId, ...values };

    try {
      await createReviewTrigger(dto);
      setIsOpen(false);
      form.reset(DEFAULT_VALUES);
      showToast({ title: t("saved"), type: "success" });
    } catch (error) {
      const refusal = classifyReviewRefusal(error);

      if (refusal === "invalid") {
        for (const fieldError of fieldErrorsOf(error)) {
          form.setError(fieldError.property as keyof CreateReviewFormValues, {
            message: fieldError.message,
          });
        }

        showToast({ title: t("refused.invalid"), type: "error" });
      } else if (refusal !== "emailNotConfirmed") {
        // The confirmation branch already raised its own toast with a resend
        // action, so a second one would only repeat it.
        showToast({ title: t(`refused.${refusal}`), type: "error" });
      }

      // Never rejects: a failed re read must not escape the handler (AC-10).
      await revalidateReviewData();
    } finally {
      releaseSend(productId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">{t("writeReview")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogText")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
            {RATING_FIELDS.map((field) => (
              <FormField
                key={field.name}
                control={form.control}
                name={field.name}
                render={({ field: controlled }) => (
                  <FormItem>
                    <StarRadioGroup
                      name={field.name}
                      label={t(field.labelKey)}
                      value={controlled.value}
                      onChange={controlled.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("commentLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("commentPlaceholder")}
                      className="min-h-28"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isCreatingReview}>
                {isCreatingReview ? (
                  <>
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                    {t("busy")}
                  </>
                ) : (
                  t("submit")
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default WriteReviewDialog;
