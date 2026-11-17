"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import ProfileCard from "@/features/pages/Profile/components/ProfileCard";
import {
  ACTION_SIZE,
  CARD_TEXT,
  DESTRUCTIVE_CARD,
  DESTRUCTIVE_TITLE,
  ROW,
} from "@/features/pages/Profile/lib/styles";
import { useUser } from "@/hooks/user/useUser";

/** The account removal card: the last card of the screen, in red (AC-7). */
const DeleteAccountForm = () => {
  const { deleteAccountTrigger } = useUser();
  const t = useTranslations("profile");
  const common = useTranslations("common");

  const handleDeleteAccount = () => {
    deleteAccountTrigger();
  };

  return (
    <ProfileCard
      className={DESTRUCTIVE_CARD}
      testId="delete-account-card"
    >
      <div className={ROW}>
        <div>
          <h2 className={DESTRUCTIVE_TITLE}>{t("deleteTitle")}</h2>
          <p className={CARD_TEXT}>{t("deleteSubtitle")}</p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive-outline"
              className={ACTION_SIZE}
            >
              <Trash2 />
              {t("deleteButton")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("sureTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteWarning")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteAccount()}>
                {common("confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProfileCard>
  );
};

export default DeleteAccountForm;
