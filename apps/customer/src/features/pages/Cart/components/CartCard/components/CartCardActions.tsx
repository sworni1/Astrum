"use client";

import RemoveFromCartButton from "@/features/pages/Cart/components/CartCard/actions/RemoveFromCartButton";
import SelectionButton from "@/features/pages/Cart/components/CartCard/actions/SelectionButton";

type Props = {
  id: string;
  isSelected: boolean;
  onSelectionChange?: (checked: boolean) => void;
};

const CartCardActions = ({ id, isSelected, onSelectionChange }: Props) => (
  <div>
    <SelectionButton
      onSelectionChange={onSelectionChange}
      isSelected={isSelected}
    />
    <RemoveFromCartButton id={id} />
  </div>
);

export default CartCardActions;
