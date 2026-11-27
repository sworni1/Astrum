"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  isOpen: boolean;
  isDeleting: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => void;

  onClosed: () => void;
};

const DeleteReviewCommentDialog = ({
  isOpen,
  isDeleting,
  onOpenChange,
  onConfirm,
  onClosed,
}: Props) => {
  const t = useTranslations("reviews");
  const keepRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("comments.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("comments.deleteText")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={keepRef}>
            {t("comments.keep")}
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {t("comments.deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteReviewCommentDialog;
