"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { showToast } from "@/common/helpers/showToast";
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
import { useDeleteProductFromCart } from "@/hooks/product/useCart/useDeleteProductFromCart";

type Props = {
  id: string;
};

const RemoveFromCartButton = ({ id }: Props) => {
  const t = useTranslations("cart");
  const common = useTranslations("common");
  const { deleteProductFromCartTrigger, deleteProductFromCartError } =
    useDeleteProductFromCart(id);

  if (deleteProductFromCartError) {
    showToast({
      title: t("removeFailed"),
      type: "error",
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("removeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("removeText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => await deleteProductFromCartTrigger()}
          >
            {common("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RemoveFromCartButton;
