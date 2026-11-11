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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useLogOut } from "@/hooks/useLogOut";

const LogOutForm = () => {
  const { logOut } = useLogOut();
  const t = useTranslations("profile");
  const common = useTranslations("common");

  return (
    <div className="mt-8 pt-4">
      <h2 className="text-xl font-medium ">{t("logoutTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("logoutSubtitle")}
      </p>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" className="mt-4">
            {t("logoutButton")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sureTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("logoutWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => logOut()}>
              {common("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LogOutForm;
