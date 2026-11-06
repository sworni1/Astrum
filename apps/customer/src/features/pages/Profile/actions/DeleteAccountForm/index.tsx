"use client";

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
} from "../../../../../components/ui/alert-dialog";
import { Button } from "../../../../../components/ui/button";
import { useUser } from "../../../../../hooks";

const DeleteAccountForm = () => {
  const { deleteAccountTrigger } = useUser();
  const t = useTranslations("profile");
  const common = useTranslations("common");

  const handleDeleteAccount = () => {
    deleteAccountTrigger();
  };

  return (
    <div className="mt-8 pt-4">
      <h2 className="text-xl font-medium ">{t("deleteTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("deleteSubtitle")}
      </p>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" className="mt-4">
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
  );
};

export default DeleteAccountForm;
