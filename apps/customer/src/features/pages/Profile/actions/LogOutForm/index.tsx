"use client";

import { LogOut } from "lucide-react";
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
import {
  ACTION_SIZE,
  ROW,
  ROW_HINT,
  ROW_TEXT,
} from "@/features/pages/Profile/lib/styles";
import { useLogOut } from "@/hooks/useLogOut";

/** One row of the security card: the logout behind a confirmation (AC-7). */
const LogOutForm = () => {
  const { logOut } = useLogOut();
  const t = useTranslations("profile");
  const common = useTranslations("common");

  return (
    <div className={ROW} data-testid="log-out-row">
      <div>
        <div className={ROW_TEXT}>{t("logoutTitle")}</div>
        <p className={ROW_HINT}>{t("logoutSubtitle")}</p>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" className={ACTION_SIZE}>
            <LogOut />
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
