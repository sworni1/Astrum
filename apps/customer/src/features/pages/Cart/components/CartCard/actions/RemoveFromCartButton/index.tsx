"use client";

import { Trash2 } from "lucide-react";
import { Button } from "../../../../../../../components/ui/button";
import { useDeleteProductFromCart } from "../../../../../../../hooks";
import { showToast } from "../../../../../../../common";
import {
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "../../../../../../../components/ui/alert-dialog";

type Props = {
  id: string;
};

const RemoveFromCartButton = ({ id }: Props) => {
  const { deleteProductFromCartTrigger, deleteProductFromCartError } =
    useDeleteProductFromCart(id);

  if (deleteProductFromCartError) {
    showToast({
      title: "Error!",
      type: "error",
      description: "Failed to remove product from cart",
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
          <AlertDialogTitle>Remove product from cart</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the selected item? This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => await deleteProductFromCartTrigger()}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RemoveFromCartButton;
